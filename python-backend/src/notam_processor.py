import re
import os
# pyrefly: ignore [missing-import]
from groq import Groq, RateLimitError
from dotenv import load_dotenv
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type
from src.config import CHAT_MODEL, NOTAM_BATCH_SIZE

load_dotenv()
client = Groq(api_key=os.environ["GROQ_API_KEY"])

# --- Local abbreviation expansion (FREE — no LLM tokens spent on this) --------
ABBREVIATIONS_LOOKUP = {
    "RWY": "Runway", "TWY": "Taxiway", "AVBL": "Available", "U/S": "Unserviceable",
    "CLSD": "Closed", "MAINT": "Maintenance", "WIP": "Work In Progress", "LGT": "Light",
    "APN": "Apron", "ACFT": "Aircraft", "OPR": "Operate/Operator", "EXER CTN": "Exercise Caution",
    "DRG": "During", "FM": "From", "BTN": "Between", "HGT": "Height", "DIST": "Distance",
    "RCL": "Runway Centreline", "TKOF": "Takeoff", "LDG": "Landing", "APCH": "Approach",
    "DEP": "Departure", "ARR": "Arrival", "TWR": "Tower", "APP": "Approach Control",
    "SMC": "Surface Movement Control", "ILS": "Instrument Landing System",
    "VOR": "VHF Omnidirectional Range", "DME": "Distance Measuring Equipment",
    "PAPI": "Precision Approach Path Indicator", "NR": "Number",
    "AVDGS": "Advanced Visual Docking Guidance System", "EST": "Estimated",
    "PERM": "Permanent", "H24": "24 hours", "DLY": "Daily", "SFC": "Surface",
    "AGL": "Above Ground Level", "AMSL": "Above Mean Sea Level", "SKED": "Scheduled",
    "NON-SKED": "Non-Scheduled", "AD": "Aerodrome", "PRKG": "Parking", "FL": "Flight Level",
    "ALT": "Altitude", "CTN": "Caution", "OBST": "Obstacle", "FREQ": "Frequency",
    "NAV": "Navigation", "PROC": "Procedure", "ACT": "Active", "EXP": "Expected",
    "EFF": "Effective", "SUPP": "Supplement", "AMDT": "Amendment", "NOTAM": "Notice to Air Missions",
}

_SINGLE_PASS_RE = re.compile(
    r"\b(" + "|".join(re.escape(k) for k in sorted(ABBREVIATIONS_LOOKUP.keys(), key=len, reverse=True)) + r")\b",
    re.IGNORECASE
)


def expand_abbreviations(text: str) -> str:
    """Ultra-fast single-pass regex replacement for all aviation abbreviations."""
    return _SINGLE_PASS_RE.sub(
        lambda m: ABBREVIATIONS_LOOKUP.get(m.group(0).upper(), m.group(0)),
        text
    )


# --- Groq call with automatic retry/backoff on rate limits --------------------
@retry(
    retry=retry_if_exception_type(RateLimitError),
    wait=wait_exponential(multiplier=2, min=4, max=60),
    stop=stop_after_attempt(10),
    reraise=True,
)
def _call_groq_with_retry(prompt: str, max_tokens: int):
    return client.chat.completions.create(
        model=CHAT_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=max_tokens,
    )


# --- Batched Groq decoding: N NOTAMs per call instead of 1 per call -----------
BATCH_PROMPT = """You are an aviation NOTAM expert for Indian airspace (AAI).
Below are {count} NOTAMs, each starting with an ID line like "###1###".
For EACH one, write a short plain-language summary (2-3 sentences max) covering:
location, effective period, what changed, and operational impact on pilots.
Abbreviations are already expanded — do not re-explain them.

Reply in EXACTLY this format, one block per NOTAM, nothing else:
###1###
<summary>
###2###
<summary>
(etc.)

NOTAMs:
{notams_block}
"""


def decode_notams_batch(notam_texts: list[str]) -> list[str]:
    """
    Decode multiple NOTAMs in a single Groq call.
    Returns a list of summaries in the same order as notam_texts.
    """
    if not notam_texts:
        return []

    expanded = [expand_abbreviations(t)[:1200] for t in notam_texts]  # cap length per NOTAM
    notams_block = "\n\n".join(f"###{i+1}###\n{t}" for i, t in enumerate(expanded))

    prompt = BATCH_PROMPT.format(count=len(expanded), notams_block=notams_block)

    response = _call_groq_with_retry(prompt, max_tokens=120 * len(expanded))

    raw = response.choices[0].message.content.strip()

    # Parse "###N###\n<summary>" blocks back into an ordered list
    parts = re.split(r"###(\d+)###", raw)
    results = {}
    for i in range(1, len(parts), 2):
        idx = int(parts[i])
        summary = parts[i + 1].strip()
        results[idx] = summary

    # Fallback for any NOTAM the model skipped/mis-formatted
    return [results.get(i + 1, "Summary unavailable — see raw NOTAM text.") for i in range(len(notam_texts))]


def decode_notam(notam_text: str) -> str:
    """Single-NOTAM decode — kept for compatibility, but prefer decode_notams_batch."""
    return decode_notams_batch([notam_text])[0]


# --- Field parsing (unchanged, no LLM involved) --------------------------------
AAI_HEADER_RE = re.compile(
    r"^([A-Z]\d{4}/\d{2})\s+(\d{10})\s*/\s*(\d{10}(?:EST)?)"
)


def parse_notam_fields(raw_text: str) -> dict[str, str]:
    fields = {}
    lines = raw_text.strip().splitlines()

    if lines:
        m = AAI_HEADER_RE.match(lines[0].strip())
        if m:
            fields["NOTAM_ID"] = m.group(1)
            fields["B"] = m.group(2)
            fields["C"] = m.group(3)
            rest = lines[1:]
            desc_lines = [line.strip() for line in rest if line.strip()]
            if desc_lines:
                fields["E"] = " ".join(desc_lines)
            return fields

    # Try to extract NOTAM ID from the first line (e.g., A1624/26 NOTAMN)
    first_line = lines[0].strip() if lines else ""
    id_match = re.match(r"^([A-Z]\d{4}/\d{2})\s+(NOTAM[NR/C])", first_line, re.IGNORECASE)
    if id_match:
        fields["NOTAM_ID"] = id_match.group(1)

    # Robust extraction of fields Q) through G) anywhere in the text
    matches = re.finditer(r"\b(Q|A|B|C|D|E|F|G)\)\s*(.*?)(?=\s+\b(?:Q|A|B|C|D|E|F|G)\)|$)", raw_text, re.DOTALL)
    for match in matches:
        key = match.group(1).upper()
        val = match.group(2).strip()
        fields[key] = val

    return fields


def build_enriched_document(raw_notam: str, simplified: str) -> str:
    fields = parse_notam_fields(raw_notam)
    parts = ["=== RAW NOTAM ===", raw_notam.strip()]

    if fields:
        parts.append("\n=== PARSED FIELDS ===")
        labels = {
            "NOTAM_ID": "NOTAM ID", "Q": "Qualifier", "A": "Location", "B": "Start (UTC)",
            "C": "End (UTC)", "D": "Schedule", "E": "Description", "F": "Lower limit", "G": "Upper limit",
        }
        for key, label in labels.items():
            if key in fields:
                parts.append(f"{label}: {fields[key]}")

    parts.append("\n=== SIMPLIFIED EXPLANATION ===")
    parts.append(simplified)
    return "\n".join(parts)