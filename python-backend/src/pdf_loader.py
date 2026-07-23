import re
from pathlib import Path
from pypdf import PdfReader


def extract_text_from_pdf(pdf_path: Path) -> str:
    reader = PdfReader(str(pdf_path))
    pages = []
    for i, page in enumerate(reader.pages, start=1):
        text = page.extract_text()
        if text and text.strip():
            pages.append(f"--- Page {i} ---\n{text.strip()}")
    return "\n\n".join(pages)


# Matches AAI-style IDs: A1226/26, B5678/26, etc.
NOTAM_ID_RE = re.compile(r"^[A-Z]\d{4}/\d{2}\b")

# Page furniture / letterhead / footer / checklist boilerplate — never real
# NOTAM content. (AAI text is entirely uppercase, so we can't use isupper()
# to detect "section headers" — that used to eat real NOTAM description
# lines that happened to also be all-caps.)
JUNK_LINE_PATTERNS = [
    re.compile(r"^-{5,}$"),
    re.compile(r"^CHECKLIST$", re.IGNORECASE),
    re.compile(r"Page\s+\d+\s+of\s+\d+", re.IGNORECASE),
    re.compile(r"^CHENNAI NOTAM SUMMARY", re.IGNORECASE),
    re.compile(r"^TEL:|^FAX:|^AFS:|^E-mail:", re.IGNORECASE),
    re.compile(r"^AIRPORTS AUTHORITY OF INDIA$", re.IGNORECASE),
    re.compile(r"^INTERNATIONAL NOTAM OFFICE$", re.IGNORECASE),
    re.compile(r"^NOTAM$"),
    re.compile(r"^Series [A-Z]$"),
    re.compile(r"^\d{1,2}\s+[A-Z]{3}\s+\d{4}$"),          # e.g. "01 JUL 2026"
    re.compile(r"^YEAR="),
    re.compile(r"^[\d\s]+$"),                              # checklist number-only continuation lines
    re.compile(r"^LATEST PUBLICATIONS", re.IGNORECASE),
    re.compile(r"^AIP[\s:]", re.IGNORECASE),
    re.compile(r"^AIC ISSUED", re.IGNORECASE),
    re.compile(r"^AIS PRODUCTS", re.IGNORECASE),
]


def split_into_notams(raw_text: str) -> list[str]:
    """Split AAI NOTAM summary PDF into individual NOTAM blocks.

    Only flushes the current block when a NEW NOTAM ID is encountered —
    never on blank lines or page markers. AAI PDFs frequently wrap a single
    NOTAM's description across a page boundary, and extract_text_from_pdf
    joins pages with a blank line, so flushing on blank lines used to sever
    the ID/dates from their own description text.
    """
    lines = raw_text.splitlines()
    blocks: list[str] = []
    current: list[str] = []

    for line in lines:
        stripped = line.strip()

        if not stripped or stripped.startswith("--- Page"):
            continue

        if any(p.search(stripped) for p in JUNK_LINE_PATTERNS):
            continue

        is_new_notam = (
            NOTAM_ID_RE.match(stripped)           # AAI format: A1226/26
            or stripped.startswith("NOTAMN")      # Full ICAO format
            or stripped.startswith("NOTAMR")
            or stripped.startswith("NOTAMC")
            or stripped.startswith("!")            # FAA format
        )

        if is_new_notam and current:
            blocks.append("\n".join(current))
            current = [stripped]
        elif is_new_notam:
            current = [stripped]
        else:
            current.append(stripped)

    if current:
        blocks.append("\n".join(current))

    return [b for b in blocks if len(b.strip()) > 20]


def chunk_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    if len(text) <= chunk_size:
        return [text]
    chunks: list[str] = []
    start = 0
    while start < len(text):
        chunk = text[start:start + chunk_size].strip()
        if chunk:
            chunks.append(chunk)
        start += chunk_size - overlap
    return chunks