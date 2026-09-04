import os
import re
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
PDF_DIR = DATA_DIR / "pdfs"
CHROMA_DIR = DATA_DIR / "chroma_db"

CHAT_MODEL = "groq/compound-mini"   # Active high-throughput Groq Cloud LLM model
NOTAM_BATCH_SIZE = 10                  # how many NOTAMs decoded per Groq call

# Local sentence-transformers — no API needed for embeddings
EMBED_MODEL = "all-MiniLM-L6-v2"

COLLECTION_NAME = "notams"
CHUNK_SIZE = 800
CHUNK_OVERLAP = 150
TOP_K = 5

# --- Live NOTAM fetching (FAA NMS-API, official/granted access) ---
FAA_NMS_HOST = os.environ.get("FAA_NMS_HOST", "https://api-nms.aim.faa.gov").rstrip("/")
FAA_NMS_AUTH_URL = f"{FAA_NMS_HOST}/v1/auth/token"
FAA_NMS_BASE_URL = f"{FAA_NMS_HOST}/nmsapi"
FAA_NMS_CLIENT_ID = os.environ.get("FAA_NMS_CLIENT_ID", "")
FAA_NMS_CLIENT_SECRET = os.environ.get("FAA_NMS_CLIENT_SECRET", "")
FAA_NMS_ICAO_CODES = [
    "VIDP", "VABB", "VOBL", "VOMM", "VECC", "VOHS", "VAAH", "VOCI", "VAGO", "VIAR",
    "VOTV", "VOCL", "VEBN", "VIJP", "VILK", "VEGT", "VAPO", "VEPT", "VOCB", "VOML",
    "EGLL", "EGKK", "KJFK", "KEWR", "KORD", "KLAX", "KSFO", "OMDB", "OMAA", "OTHH",
    "WSSS", "VHHH", "RJTT", "RJAA", "EDDF", "LFPG", "EHAM", "VTBS", "WMKK", "YSSY"
]

FAA_NMS_AIRPORTS = {
    # India
    "VIDP": "Delhi", "VABB": "Mumbai", "VOBL": "Bengaluru", "VOMM": "Chennai",
    "VECC": "Kolkata", "VOHS": "Hyderabad", "VAAH": "Ahmedabad", "VOCI": "Cochin",
    "VAGO": "Goa", "VIAR": "Amritsar", "VOTV": "Trivandrum", "VOCL": "Calicut",
    "VEBN": "Varanasi", "VIJP": "Jaipur", "VILK": "Lucknow", "VEGT": "Guwahati",
    "VAPO": "Pune", "VEPT": "Patna", "VOCB": "Coimbatore", "VOML": "Mangalore",
    # Global Hubs
    "EGLL": "London Heathrow", "EGKK": "London Gatwick", "KJFK": "New York JFK",
    "KEWR": "Newark", "KORD": "Chicago O'Hare", "KLAX": "Los Angeles", "KSFO": "San Francisco",
    "OMDB": "Dubai", "OMAA": "Abu Dhabi", "OTHH": "Doha", "WSSS": "Singapore",
    "VHHH": "Hong Kong", "RJTT": "Tokyo Haneda", "RJAA": "Tokyo Narita",
    "EDDF": "Frankfurt", "LFPG": "Paris CDG", "EHAM": "Amsterdam", "VTBS": "Bangkok",
    "WMKK": "Kuala Lumpur", "YSSY": "Sydney", "YMML": "Melbourne", "CYYZ": "Toronto",
}

FAA_NMS_IATA_ALIASES = {
    "DEL": "VIDP", "BOM": "VABB", "BLR": "VOBL", "MAA": "VOMM", "CCU": "VECC",
    "HYD": "VOHS", "AMD": "VAAH", "COK": "VOCI", "GOI": "VAGO", "ATQ": "VIAR",
    "TRV": "VOTV", "CCJ": "VOCL", "VNS": "VEBN", "JAI": "VIJP", "LKO": "VILK",
    "GAU": "VEGT", "PNQ": "VAPO", "PAT": "VEPT", "CJB": "VOCB", "IXE": "VOML",
    "LHR": "EGLL", "LGW": "EGKK", "JFK": "KJFK", "EWR": "KEWR", "ORD": "KORD",
    "LAX": "KLAX", "SFO": "KSFO", "DXB": "OMDB", "AUH": "OMAA", "DOH": "OTHH",
    "SIN": "WSSS", "HKG": "VHHH", "HND": "RJTT", "NRT": "RJAA", "FRA": "EDDF",
    "CDG": "LFPG", "AMS": "EHAM", "BKK": "VTBS", "KUL": "WMKK", "SYD": "YSSY",
}

def resolve_icao_codes(query: str) -> list[str]:
    """Resolve airport names, ICAO codes, or IATA codes for any international airport worldwide."""
    query = (query or "").strip()
    if not query:
        return []

    query_upper = query.upper()
    query_lower = query.lower()
    tokens = [t for t in re.findall(r"\b[A-Z0-9]{3,5}\b", query_upper)]
    matches = set()

    # Common English words to ignore when scanning 4-5 letter tokens
    STOP_WORDS = {
        "WITH", "FROM", "THIS", "THAT", "HAVE", "ALSO", "SOME", "WHAT", "WHEN", "INFO",
        "DATA", "TEST", "THERE", "HERE", "WERE", "THEM", "THEN", "ONLY", "ALSO", "NOTAM",
        "NOTAMS", "SHOW", "LIST", "VIEW", "GIVE", "FIND", "YOUR", "THEIR", "ABOUT", "EVERY",
        "DELHI", "MUMBAI", "PARIS", "TOKYO", "DUBAI", "CHINA", "JAPAN", "INDIA", "TEXAS"
    }

    for token in tokens:
        # 1. Check known ICAO dictionary or configured codes
        if token in FAA_NMS_AIRPORTS or token in FAA_NMS_ICAO_CODES:
            matches.add(token)
        # 2. Check IATA alias dictionary (e.g. LHR -> EGLL, DXB -> OMDB, JFK -> KJFK, SIN -> WSSS)
        elif len(token) == 3 and token in FAA_NMS_IATA_ALIASES:
            matches.add(FAA_NMS_IATA_ALIASES[token])
        # 3. Direct 4-character ICAO typed by user (e.g. EGLL, KJFK, OMDB, KDFW)
        elif len(token) == 4 and token not in STOP_WORDS and token.isalpha():
            matches.add(token)
        # 4. 5-character domestic/ICAO location codes (e.g. 01AAA, 01AA, etc.)
        elif len(token) == 5 and token not in STOP_WORDS:
            matches.add(token)

    # 5. Check airport names (e.g. "heathrow" -> EGLL, "dubai" -> OMDB, "singapore" -> WSSS, "kolkata" -> VECC)
    for code, airport_name in FAA_NMS_AIRPORTS.items():
        name_lower = airport_name.lower()
        if name_lower in query_lower:
            matches.add(code)
        else:
            name_parts = [p for p in name_lower.split() if len(p) >= 4 and p not in {"international", "airport", "regional", "north", "south"}]
            if any(p in query_lower for p in name_parts):
                matches.add(code)

    return sorted(matches)

PDF_DIR.mkdir(parents=True, exist_ok=True)
CHROMA_DIR.mkdir(parents=True, exist_ok=True)