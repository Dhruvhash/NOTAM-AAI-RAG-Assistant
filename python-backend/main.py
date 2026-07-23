import os
import shutil
import threading
import uuid
import traceback
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.config import PDF_DIR
from src.rag_chain import NotamRAG

app = FastAPI(title="NOTAM Assistant API")

# In-memory job store: job_id -> {status, current, total, message, result, error}
# Reloaded vector_store optimizations
jobs: dict[str, dict] = {}
jobs_lock = threading.Lock()


def _run_ingest_job(job_id: str, save_path: Path):
    def on_progress(current, total, message):
        with jobs_lock:
            jobs[job_id].update(status="processing", current=current, total=total, message=message)
        print(f"[{job_id}] [{current}/{total}] {message}")

    try:
        result = rag.ingest_pdf(save_path, progress_callback=on_progress)
        with jobs_lock:
            jobs[job_id].update(status="done", result=result, message="Done")
        print(f"[{job_id}] done: {result}")
    except Exception as e:
        traceback.print_exc()
        with jobs_lock:
            jobs[job_id].update(status="error", error=str(e), message=f"Error: {e}")


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React
        "http://localhost:5000",  # Node
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rag = NotamRAG()


@app.on_event("startup")
def startup_event():
    print("[Startup] Automating database clear on startup...")
    try:
        rag.clear()
        from src.cooldown_manager import COOLDOWN_FILE
        if COOLDOWN_FILE.exists():
            try:
                COOLDOWN_FILE.unlink()
            except Exception as ce:
                print(f"[Startup] Warning: failed to delete cooldown file: {ce}")
        print("[Startup] Database cleared and cooldowns reset successfully.")
    except Exception as e:
        print(f"[Startup] Error clearing database on startup: {e}")


class QuestionRequest(BaseModel):
    question: str


class SearchRequest(BaseModel):
    query: str
    top_k: int = 5



@app.get("/health")
def health():
    return {
        "status": "ok",
        "chunks": rag.count(),
        "sources": rag.list_sources(),
    }


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    save_path = PDF_DIR / file.filename

    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    job_id = str(uuid.uuid4())
    with jobs_lock:
        jobs[job_id] = {
            "status": "processing",
            "current": 0,
            "total": 0,
            "message": "Starting...",
            "filename": file.filename,
            "result": None,
            "error": None,
        }

    thread = threading.Thread(target=_run_ingest_job, args=(job_id, save_path), daemon=True)
    thread.start()

    return {"job_id": job_id, "status": "processing", "filename": file.filename}


@app.get("/upload/status/{job_id}")
def upload_status(job_id: str):
    with jobs_lock:
        job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Unknown job_id")
    return {"job_id": job_id, **job}


@app.get("/summarize/{filename}")
def summarize(filename: str):
    try:
        return rag.summarize(filename)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/ask")
def ask(body: QuestionRequest):
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    try:
        return rag.ask(body.question)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/search")
def search_notams(body: SearchRequest):
    if not body.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    try:
        return {"hits": rag.store.search(body.query, top_k=body.top_k)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/sources")
def sources():
    return {
        "sources": rag.list_sources(),
        "total_chunks": rag.count(),
    }


# --- FAA Live Fetch endpoints & helpers ---

class FaaFetchRequest(BaseModel):
    icao_codes: list[str] | None = None

class ResolveRequest(BaseModel):
    query: str


def _run_faa_live_job(job_id: str, icao_codes: list[str] | None):
    def on_progress(current, total, message):
        with jobs_lock:
            jobs[job_id].update(status="processing", current=current, total=total, message=message)
        print(f"[FAA-Live] [{job_id}] [{current}/{total}] {message}")

    try:
        import datetime
        from src.cooldown_manager import CooldownManager
        cooldown_mgr = CooldownManager()
        # Always fetch all active NOTAMs instead of delta updates
        result = rag.ingest_faa_live_notams(icao_codes, progress_callback=on_progress, last_updated_date=None)
        
        cooldown_mgr.update_last_pull_time("incremental")
        
        with jobs_lock:
            jobs[job_id].update(status="done", result=result, message="Done")
        print(f"[FAA-Live] [{job_id}] done: {result}")
    except Exception as e:
        traceback.print_exc()
        with jobs_lock:
            jobs[job_id].update(status="error", error=str(e), message=f"Error: {e}")


def _run_faa_bulk_job(job_id: str, icao_codes: list[str] | None):
    def on_progress(current, total, message):
        with jobs_lock:
            jobs[job_id].update(status="processing", current=current, total=total, message=message)
        print(f"[FAA-Bulk] [{job_id}] [{current}/{total}] {message}")

    try:
        from src.cooldown_manager import CooldownManager
        cooldown_mgr = CooldownManager()
        
        result = rag.ingest_faa_bulk_notams(icao_codes, progress_callback=on_progress)
        
        cooldown_mgr.update_last_pull_time("bulk")
        
        with jobs_lock:
            jobs[job_id].update(status="done", result=result, message="Done")
        print(f"[FAA-Bulk] [{job_id}] done: {result}")
    except Exception as e:
        traceback.print_exc()
        with jobs_lock:
            jobs[job_id].update(status="error", error=str(e), message=f"Error: {e}")


@app.post("/faa/live")
def faa_live(body: FaaFetchRequest):
    from src.cooldown_manager import CooldownManager
    cooldown_mgr = CooldownManager()
    remaining = cooldown_mgr.get_remaining_cooldown("incremental")
    if remaining > 0.0:
        raise HTTPException(
            status_code=429,
            detail={
                "message": "cooldown_active",
                "remaining": remaining,
            }
        )

    job_id = str(uuid.uuid4())
    with jobs_lock:
        jobs[job_id] = {
            "status": "processing",
            "current": 0,
            "total": 0,
            "message": "Initializing live fetch...",
            "filename": "FAA Live Fetch",
            "result": None,
            "error": None,
        }

    thread = threading.Thread(target=_run_faa_live_job, args=(job_id, body.icao_codes), daemon=True)
    thread.start()

    return {"job_id": job_id, "status": "processing"}


@app.post("/faa/bulk")
def faa_bulk(body: FaaFetchRequest):
    raise HTTPException(status_code=501, detail="Bulk fetch feature is disabled.")


@app.get("/faa/cooldown")
def faa_cooldown():
    from src.cooldown_manager import CooldownManager
    cooldown_mgr = CooldownManager()
    return {
        "incremental_remaining": cooldown_mgr.get_remaining_cooldown("incremental"),
        "bulk_remaining": cooldown_mgr.get_remaining_cooldown("bulk"),
    }


@app.post("/faa/resolve")
def faa_resolve(body: ResolveRequest):
    from src.config import resolve_icao_codes
    codes = resolve_icao_codes(body.query)
    return {"icao_codes": codes}


@app.get("/all")
def get_all_notams():
    try:
        results = rag.store.collection.get(include=["documents", "metadatas"])
        hits = []
        docs = results.get("documents", [])
        metas = results.get("metadatas", [])
        ids = results.get("ids", [])
        for doc, meta, doc_id in zip(docs, metas, ids):
            hits.append({
                "text": doc,
                "id": doc_id,
                "source": meta.get("source", ""),
                "notam_index": meta.get("notam_index", 0),
                "icao": meta.get("icao", ""),
                "notam_id": meta.get("notam_id", ""),
            })
        return {"notams": hits}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.delete("/clear")
def clear():
    rag.clear()
    from src.cooldown_manager import COOLDOWN_FILE
    if COOLDOWN_FILE.exists():
        try:
            COOLDOWN_FILE.unlink()
        except Exception as e:
            print(f"Failed to delete cooldown file: {e}")
    return {"status": "cleared"}