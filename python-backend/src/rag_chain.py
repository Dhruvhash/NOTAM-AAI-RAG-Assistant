import os
from groq import Groq
from dotenv import load_dotenv
from src.config import CHAT_MODEL
from src.vector_store import NotamVectorStore

load_dotenv()
client = Groq(api_key=os.environ["GROQ_API_KEY"])

SYSTEM_PROMPT = """You are an expert aviation NOTAM assistant for Indian airspace (AAI).
You help pilots, flight dispatchers, and ATC staff understand active Notices to Airmen.

Rules:
- Answer using ONLY the NOTAM context provided below.
- Carefully check ALL NOTAMs in the context for matches on airport ICAO codes (e.g., VABB, VIDP, VOBL, VOMM), runway numbers (e.g., 14, 32, 27, 09L), taxiways, or procedure designations (e.g., RNP, ILS, VOR).
- If the context contains any matching or related operational notices for the queried location, runway, or procedure, synthesize a direct, clear, pilot-friendly answer. Explain what changes, effective dates (UTC), and operational impacts apply.
- If no NOTAM in the context references the specific runway or procedure queried, explicitly state: "No active NOTAM restriction found for [item] in the loaded feed, but review other active notices for this airport."
- Decode all ICAO/AAI abbreviations in plain English.
- Cite the source file and NOTAM ID/number for every statement.
- NEVER guess or hallucinate NOTAM content. Aviation safety depends on accuracy.

NOTAM Context:
{context}"""


class NotamRAG:
    def __init__(self):
        self.store = NotamVectorStore()

    def ingest_pdf(self, pdf_path, progress_callback=None) -> dict:
        return self.store.ingest_pdf(pdf_path, progress_callback)

    def ingest_faa_live_notams(self, icao_codes: list[str] = None, progress_callback=None, last_updated_date: str = None) -> dict:
        return self.store.ingest_faa_live_notams(icao_codes, progress_callback, last_updated_date)

    def ingest_faa_bulk_notams(self, icao_codes: list[str] = None, progress_callback=None) -> dict:
        return self.store.ingest_faa_bulk_notams(icao_codes, progress_callback)

    def ask(self, question: str) -> dict:
        hits = self.store.search(question, top_k=8)
        if not hits:
            return {
                "answer": "No NOTAMs have been fetched or uploaded yet. Please pull live NOTAMs or upload a NOTAM PDF first.",
                "sources": [],
            }

        context_parts = []
        for hit in hits:
            icao_tag = f", Airport: {hit['icao']}" if hit.get("icao") else ""
            notam_tag = f", NOTAM ID: {hit['notam_id']}" if hit.get("notam_id") else ""
            context_parts.append(
                f"[Source: {hit['source']}{icao_tag}{notam_tag}, NOTAM #{hit['notam_index'] + 1}]\n{hit['text']}"
            )
        context = "\n\n---\n\n".join(context_parts)

        response = client.chat.completions.create(
            model=CHAT_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT.format(context=context)},
                {"role": "user", "content": question},
            ],
            temperature=0.2,
            max_tokens=850,
        )

        return {
            "answer": response.choices[0].message.content.strip(),
            "sources": [
                {
                    "file": h["source"],
                    "notam": h["notam_index"] + 1,
                    "relevance": h["relevance"],
                    "notam_id": h.get("notam_id", ""),
                    "icao": h.get("icao", ""),
                }
                for h in hits
            ],
        }

    def list_sources(self) -> list[str]:
        return self.store.list_sources()

    def summarize(self, filename: str) -> dict:
        results = self.store.collection.get(where={"source": filename}, include=["documents"])
        docs = results.get("documents", [])
        if not docs:
            return {"summary": "No NOTAMs found for this document.", "total_notams": 0}

        explanations = []
        for doc in docs:
            parts = doc.split("=== SIMPLIFIED EXPLANATION ===")
            if len(parts) > 1:
                explanations.append(parts[1].strip())
            else:
                explanations.append(doc.strip()[:300])

        unique_exps = list(dict.fromkeys(explanations))
        context_text = "\n".join(f"- {exp}" for exp in unique_exps[:30])

        prompt = f"""You are an aviation NOTAM coordinator.
Below is a list of plain-language NOTAM updates from the document "{filename}".
Summarize the key operational changes at this airport/airspace.
Group the updates into logical categories (e.g., Runway/Taxiway Closures, NAVAID/ILS Status, Obstacles/Work in Progress, Airspace Restrictions).
Highlight any critical safety notices or major disruptions first.
Keep the summary professional, structured, and easy to read using markdown.

NOTAM Updates:
{context_text}
"""

        try:
            response = client.chat.completions.create(
                model=CHAT_MODEL,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=1000,
            )
            summary_text = response.choices[0].message.content.strip()
        except Exception as e:
            summary_text = f"Failed to generate summary from Groq API: {str(e)}"

        return {
            "filename": filename,
            "total_notams": len(unique_exps),
            "summary": summary_text
        }

    def clear(self):
        self.store.clear()

    def count(self) -> int:
        return self.store.count()