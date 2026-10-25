"""Gemini client. Returns 503 when GEMINI_API_KEY is not set."""
import json
import time
from functools import lru_cache

from fastapi import HTTPException

from . import config


def is_configured() -> bool:
    return bool(config.GEMINI_API_KEY)


@lru_cache
def get_client():
    if not is_configured():
        raise HTTPException(status_code=503, detail="AI unavailable: set GEMINI_API_KEY in backend/.env")
    import truststore
    from google import genai

    # Use the OS certificate store so HTTPS works behind antivirus web shields (e.g. Avast)
    truststore.inject_into_ssl()
    return genai.Client(api_key=config.GEMINI_API_KEY)


RETRY_DELAYS = [1, 2]  # seconds between retries of one model; Gemini sometimes returns 503/429 under load
BUSY = (429, 500, 503)


def generate(contents, gen_config):
    """Call Gemini, retrying busy errors and then falling back to the next model in the list."""
    from google.genai import errors, types

    if gen_config.thinking_config is None:
        gen_config.thinking_config = types.ThinkingConfig(thinking_budget=config.GEMINI_THINKING_BUDGET)
    client = get_client()
    last = None
    for model in config.GEMINI_MODELS:
        for attempt in range(len(RETRY_DELAYS) + 1):
            try:
                return client.models.generate_content(model=model, contents=contents, config=gen_config)
            except errors.APIError as e:
                last = e
                if e.code in BUSY and attempt < len(RETRY_DELAYS):
                    time.sleep(RETRY_DELAYS[attempt])
                    continue
                if e.code in BUSY or e.code == 404:  # busy for good, or model retired: try the next one
                    break
                raise HTTPException(status_code=502, detail=f"AI request failed: {e}") from e
            except Exception as e:
                raise HTTPException(status_code=502, detail=f"AI request failed: {e}") from e
    if last is not None and last.code in BUSY:
        raise HTTPException(status_code=503, detail="AI is busy right now, try again in a minute") from last
    raise HTTPException(status_code=502, detail=f"AI request failed: {last}") from last


def polish_email(subject: str, body: str, tone: str, club_name: str) -> dict:
    from google.genai import types

    prompt = (
        f"You polish emails for {club_name}, a Stony Brook University student club.\n"
        f"Rewrite the email below in a {tone} tone. Keep every fact (dates, times, places, names, amounts, "
        f"email addresses) exactly the same, do not invent new facts, keep the sign-off. Plain text, no markdown.\n"
        f'Answer as JSON: {{"subject": "...", "body": "..."}}\n\nSUBJECT: {subject}\n\nBODY:\n{body}'
    )
    resp = generate(prompt, types.GenerateContentConfig(response_mime_type="application/json", temperature=0.7))
    try:
        data = json.loads(resp.text)
        return {"subject": str(data["subject"]), "body": str(data["body"])}
    except (ValueError, KeyError, TypeError):
        raise HTTPException(status_code=502, detail="AI returned an unexpected answer, try again")
