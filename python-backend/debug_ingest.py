import traceback
from pathlib import Path
from src.rag_chain import NotamRAG

try:
    r = NotamRAG()
    res = r.ingest_pdf(Path("sample_notam.pdf"))
    print("SUCCESS INGEST:", res)
except Exception as e:
    print("FAILED INGEST:")
    traceback.print_exc()
