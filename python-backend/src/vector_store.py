import hashlib
import time
from pathlib import Path
from sentence_transformers import SentenceTransformer
import chromadb

from src.config import (
    CHROMA_DIR, CHUNK_OVERLAP, CHUNK_SIZE,
    COLLECTION_NAME, TOP_K, NOTAM_BATCH_SIZE,
)
from src.notam_processor import build_enriched_document, expand_abbreviations, decode_notams_batch
from src.pdf_loader import chunk_text, extract_text_from_pdf, split_into_notams
from src.faa_notam_fetcher import fetch_live_notams as fetch_faa_live_notams, fetch_bulk_notams


import torch

# Restrict PyTorch CPU threads so PyTorch tensor calculations don't hog all CPU cores or block FastAPI event loop
try:
    torch.set_num_threads(2)
except Exception:
    pass

# Loads once at startup — ~90MB download on first run
_embedder = SentenceTransformer("all-MiniLM-L6-v2")


class NotamVectorStore:
    def __init__(self):
        self.client = chromadb.PersistentClient(path=str(CHROMA_DIR))
        self._coll = None

    def _embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        return _embedder.encode(
            texts,
            batch_size=128,
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=True
        ).tolist()

    def _doc_id(self, source: str, index: int) -> str:
        return hashlib.md5(f"{source}:{index}".encode()).hexdigest()

    def ingest_pdf(self, pdf_path: Path, progress_callback=None) -> dict:
        raw_text = extract_text_from_pdf(pdf_path)
        if not raw_text.strip():
            raise ValueError(f"No text extracted from {pdf_path.name}")

        notams = split_into_notams(raw_text)
        is_fallback = not notams
        if is_fallback:
            notams = chunk_text(raw_text, chunk_size=1500, overlap=200)

        documents, metadatas, ids = [], [], []

        for i, notam in enumerate(notams):
            if progress_callback and (i % 10 == 0 or i == len(notams) - 1):
                progress_callback(
                    i + 1, len(notams),
                    f"Processing NOTAM {i + 1}/{len(notams)}..."
                )

            simplified = expand_abbreviations(notam)
            enriched = build_enriched_document(notam, simplified)
            chunks = chunk_text(enriched, CHUNK_SIZE, CHUNK_OVERLAP) if is_fallback else [enriched]

            for j, chunk in enumerate(chunks):
                doc_id = self._doc_id(f"{pdf_path.name}:{i}", j)
                documents.append(chunk)
                metadatas.append({
                    "source": pdf_path.name,
                    "notam_index": i,
                    "chunk_index": j,
                })
                ids.append(doc_id)

        existing = self.collection.get(where={"source": pdf_path.name}, include=[])
        if existing["ids"]:
            self.collection.delete(ids=existing["ids"])

        if progress_callback:
            progress_callback(len(notams), len(notams), "Embedding and storing...")

        embeddings = self._embed(documents)
        self.collection.upsert(
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids,
        )

        return {
            "filename": pdf_path.name,
            "notams_found": len(notams),
            "chunks_stored": len(documents),
        }

    def ingest_faa_live_notams(self, icao_codes: list[str] = None, progress_callback=None, last_updated_date: str = None) -> dict:
        """Fetch live NOTAMs from the official FAA NMS-API and store them (source: faa_nms_live)."""
        if progress_callback:
            progress_callback(0, 1, f"Fetching live NOTAMs{' (incremental)' if last_updated_date else ''} (FAA NMS-API)...")
        live_notams = fetch_faa_live_notams(icao_codes, last_updated_date)
        return self._ingest_live_batch("faa_nms_live", live_notams, progress_callback, is_incremental=bool(last_updated_date))

    def ingest_faa_bulk_notams(self, icao_codes: list[str] = None, progress_callback=None) -> dict:
        """Fetch all global live NOTAMs via bulk classification, filter by configured airports, and store them (source: faa_nms_live)."""
        if progress_callback:
            progress_callback(0, 1, "Fetching bulk classification NOTAMs (FAA NMS-API)...")
        live_notams = fetch_bulk_notams(icao_codes)
        return self._ingest_live_batch("faa_nms_live", live_notams, progress_callback)

    def _ingest_live_batch(self, source_label: str, live_notams: list[dict], progress_callback=None, is_incremental: bool = False) -> dict:
        if not live_notams:
            return {"filename": source_label, "notams_found": 0, "chunks_stored": 0}

        valid_notams = []
        deleted_ids = []
        for i, notam in enumerate(live_notams):
            raw_text = notam["raw_text"]
            if not raw_text.strip():
                continue

            doc_id = self._doc_id(f"{source_label}:{notam['notam_id']}", 0)
            is_cancellation = "NOTAMC" in raw_text or ("Q)" in raw_text and "/Q" in raw_text and "CN" in raw_text)
            if is_cancellation and is_incremental:
                deleted_ids.append(doc_id)
                continue

            valid_notams.append((notam, doc_id))

        if is_incremental and deleted_ids:
            self.collection.delete(ids=deleted_ids)

        documents: list[str] = []
        metadatas: list[dict] = []
        ids: list[str] = []

        for (notam, doc_id) in valid_notams:
            simplified = expand_abbreviations(notam["raw_text"])
            enriched = build_enriched_document(notam["raw_text"], simplified)
            documents.append(enriched)
            metadatas.append({
                "source": source_label,
                "notam_index": len(documents) - 1,
                "chunk_index": 0,
                "icao": notam.get("icao") or "",
                "notam_id": notam["notam_id"],
            })
            ids.append(doc_id)

        # For full load (not incremental), wipe out the existing snapshot first
        if not is_incremental:
            existing = self.collection.get(where={"source": source_label}, include=[])
            if existing["ids"]:
                self.collection.delete(ids=existing["ids"])

        if progress_callback and documents:
            progress_callback(len(documents), len(documents), "Embedding and storing...")

        if documents:
            embeddings = self._embed(documents)
            self.collection.upsert(
                documents=documents,
                embeddings=embeddings,
                metadatas=metadatas,
                ids=ids,
            )

        return {
            "filename": source_label,
            "notams_found": len(live_notams),
            "chunks_stored": len(documents),
        }

    def search(self, query: str, top_k: int = TOP_K) -> list[dict]:
        if self.collection.count() == 0:
            return []

        # Retrieve a broader candidate pool
        n_fetch = min(max(top_k * 2, 12), self.collection.count())
        query_embedding = self._embed([query])[0]
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_fetch,
            include=["documents", "metadatas", "distances"],
        )

        query_upper = query.upper()

        hits = []
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            base_relevance = round(max(0.0, 1.0 - dist), 3)
            boost = 0.0

            # Boost hits matching explicit ICAO code mentioned in query (e.g. VABB, VIDP, VOBL)
            doc_icao = (meta.get("icao") or "").upper()
            if doc_icao and doc_icao in query_upper:
                boost += 0.15

            # Boost hits matching runway/procedure numbers mentioned in query (e.g. 14, 32, 27, 09L)
            tokens = [t for t in query_upper.replace("/", " ").replace("-", " ").split() if len(t) <= 4]
            for token in tokens:
                if token in doc.upper():
                    boost += 0.05

            hits.append({
                "text": doc,
                "source": meta.get("source", ""),
                "notam_index": meta.get("notam_index", 0),
                "icao": meta.get("icao", ""),
                "notam_id": meta.get("notam_id", ""),
                "relevance": min(1.0, round(base_relevance + boost, 3)),
                "_score": base_relevance + boost,
            })

        hits.sort(key=lambda x: x["_score"], reverse=True)
        return hits[:top_k]

    def list_sources(self) -> list[str]:
        if self.collection.count() == 0:
            return []
        all_meta = self.collection.get(include=["metadatas"])["metadatas"]
        return sorted({m["source"] for m in all_meta})

    @property
    def collection(self):
        try:
            if self._coll is None:
                self._coll = self.client.get_or_create_collection(
                    name=COLLECTION_NAME,
                    metadata={"hnsw:space": "cosine"},
                )
            # Test handle validity
            _ = self._coll.count()
            return self._coll
        except Exception:
            self._coll = self.client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )
            return self._coll

    @collection.setter
    def collection(self, value):
        self._coll = value

    def clear(self):
        try:
            coll = self.collection
            existing = coll.get(include=[])
            if existing and existing.get("ids"):
                coll.delete(ids=existing["ids"])
        except Exception:
            try:
                self.client.delete_collection(COLLECTION_NAME)
            except Exception:
                pass
            self._coll = self.client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )

    def count(self) -> int:
        try:
            return self.collection.count()
        except Exception:
            return 0