"""
Live NOTAM fetching via the official FAA NMS-API.

Uses nmsResponseFormat: GEOJSON rather than AIXM, because the GeoJSON
response includes a `notamTranslation` array per NOTAM with a
`type: "ICAO"` entry containing `icao_message` — the raw Q)/A)/B)/C)/E)
formatted NOTAM text our existing decode/parse pipeline already expects.
This avoids writing a separate AIXM 5.1 XML parser.

Note: unlike NOTAMify, the NMS-API's `location` filter accepts only a
single ICAO/domestic code per request (not a list), so fetching multiple
airports requires one request per airport.
"""

import time
import requests
import gzip
import io
import json

from src.config import FAA_NMS_BASE_URL, FAA_NMS_ICAO_CODES
from src.faa_client import FAANmsClient

_client = FAANmsClient()


def _extract_icao_message(notam_feature: dict) -> str:
    """Pull the raw ICAO-format NOTAM text out of a GeoJSON NOTAM feature."""
    properties = notam_feature.get("properties", {})
    core_data = properties.get("coreNOTAMData", {})
    
    # Try coreNOTAMData -> notamTranslation
    for translation in core_data.get("notamTranslation", []):
        if translation.get("type") == "ICAO":
            msg = translation.get("formattedText") or translation.get("icao_message")
            if msg:
                return msg
                
    # Fall back to root level properties.get("notamTranslation") if any
    for translation in properties.get("notamTranslation", []):
        if translation.get("type") == "ICAO":
            msg = translation.get("formattedText") or translation.get("icao_message")
            if msg:
                return msg

    # Fall back to the text field inside coreNOTAMData -> notam, or root level text
    notam_info = core_data.get("notam", {}) if isinstance(core_data, dict) else {}
    if isinstance(notam_info, dict) and notam_info.get("text"):
        return notam_info.get("text")
        
    return properties.get("text") or ""


def fetch_notams_for_location(icao_code: str, last_updated_date: str = None) -> list[dict]:
    """Fetch active NOTAMs for a single ICAO location from the NMS-API."""
    token = _client.get_valid_token()

    # FAA Staging has a Spike Arrest limit of 1 request per second.
    # We retry if we hit 429 Too Many Requests.
    max_retries = 3
    backoff = 1.5
    for attempt in range(max_retries):
        params = {"location": icao_code, "classification": "INTERNATIONAL"}
        if last_updated_date:
            params["lastUpdatedDate"] = last_updated_date
            
        response = requests.get(
            f"{FAA_NMS_BASE_URL}/v1/notams",
            params=params,
            headers={
                "Authorization": f"Bearer {token}",
                "nmsResponseFormat": "GEOJSON",
            },
            timeout=30,
        )
        if response.status_code == 429 and attempt < max_retries - 1:
            time.sleep(backoff * (attempt + 1))
            continue
        break
    
    response.raise_for_status()
    payload = response.json()

    features = payload.get("data", {}).get("features")
    if features is None:
        features = payload.get("data", {}).get("geojson", [])

    results = []
    for feature in features:
        properties = feature.get("properties", {})
        raw_text = _extract_icao_message(feature)
        if not raw_text.strip():
            continue

        core = properties.get("coreNOTAMData", {})
        notam_props = core.get("notam", {}) if isinstance(core, dict) else {}

        results.append(
            {
                "icao": notam_props.get("icaoLocation") or properties.get("icaoLocation") or icao_code,
                "notam_id": notam_props.get("id") or notam_props.get("notamNumber") or icao_code,
                "raw_text": raw_text,
            }
        )
    return results


from concurrent.futures import ThreadPoolExecutor, as_completed

DEFAULT_PRIMARY_AIRPORTS = ["VIDP", "VABB", "VOBL", "VOMM"]


def fetch_live_notams(icao_codes: list[str] = None, last_updated_date: str = None) -> list[dict]:
    """
    Fetch active NOTAMs concurrently for configured (or provided) ICAO codes.
    """
    target_codes = icao_codes if icao_codes and len(icao_codes) > 0 else DEFAULT_PRIMARY_AIRPORTS
    all_results: list[dict] = []

    def _fetch_single(code):
        try:
            return fetch_notams_for_location(code, last_updated_date)
        except Exception as e:
            print(f"[FAA-Live] Error fetching {code}: {e}")
            return []

    # Use ThreadPoolExecutor with up to 4 concurrent workers for fast response
    with ThreadPoolExecutor(max_workers=min(4, len(target_codes))) as executor:
        futures = [executor.submit(_fetch_single, code) for code in target_codes]
        for future in as_completed(futures):
            res = future.result()
            if res:
                all_results.extend(res)

    return all_results


def fetch_bulk_notams(icao_codes: list[str] = None) -> list[dict]:
    """
    Perform a single global bulk pull of ALL classification NOTAMs from the FAA Production NMS-API,
    decompress the resulting GZIP payload, and filter to keep only NOTAMs matching the configured/provided
    ICAO locations.
    """
    icao_codes = icao_codes or FAA_NMS_ICAO_CODES
    target_set = set(icao_codes)
    
    token = _client.get_valid_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "nmsResponseFormat": "GEOJSON",
    }
    
    # Trigger bulk fetch request
    response = requests.get(
        f"{FAA_NMS_BASE_URL}/v1/notams",
        params={"classification": "INTERNATIONAL"},
        headers=headers,
        timeout=120
    )
    response.raise_for_status()
    
    content_bytes = response.content

    # If the response is a JSON containing the relative URL to content, fetch that content first
    try:
        # Check if response is JSON (e.g. starting with { or [)
        if response.headers.get("content-type", "").startswith("application/json") or content_bytes.startswith(b"{"):
            payload = response.json()
            relative_url = None
            if isinstance(payload, dict):
                for k, v in payload.items():
                    if isinstance(v, str) and "/content/" in v:
                        relative_url = v
                        break
            
            if relative_url:
                # Remove prefix /nmsapi if present since it is part of FAA_NMS_BASE_URL
                clean_path = relative_url
                if relative_url.startswith("/nmsapi"):
                    clean_path = relative_url.replace("/nmsapi", "", 1)
                
                content_url = f"{FAA_NMS_BASE_URL}{clean_path}"
                print(f"[FAA-Bulk] Fetching redirected content from: {content_url}")
                
                content_response = requests.get(
                    content_url,
                    headers=headers,
                    timeout=120
                )
                content_response.raise_for_status()
                content_bytes = content_response.content
    except Exception as e:
        print(f"[FAA-Bulk] Warning while parsing relative redirect URL: {e}. Attempting direct decompression.")

    # Decompress GZIP payload
    compressed_file = io.BytesIO(content_bytes)
    with gzip.GzipFile(fileobj=compressed_file) as f:
        decompressed_data = f.read()
        
    all_features = json.loads(decompressed_data)
    if not isinstance(all_features, list):
        if isinstance(all_features, dict) and "features" in all_features:
            all_features = all_features["features"]
        else:
            all_features = []
            
    results = []
    for feature in all_features:
        if not isinstance(feature, dict):
            continue
            
        properties = feature.get("properties", {})
        core = properties.get("coreNOTAMData", {})
        notam_props = core.get("notam", {}) if isinstance(core, dict) else {}
        
        loc = notam_props.get("location")
        icao = notam_props.get("icaoLocation")
        
        if loc in target_set or icao in target_set:
            raw_text = _extract_icao_message(feature)
            if not raw_text.strip():
                continue
                
            results.append(
                {
                    "icao": icao or loc or icao_codes[0],
                    "notam_id": notam_props.get("id") or notam_props.get("notamNumber") or (icao or loc),
                    "raw_text": raw_text,
                }
            )
            
    return results
