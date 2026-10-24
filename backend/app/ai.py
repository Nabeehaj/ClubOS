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


RETRY_DELAYS = [1, 3, 6]  # seconds; Gemini sometimes returns 503/429 under load


def generate(contents, gen_config):
    from google.genai import errors

    client = get_client()
    for attempt in range(len(RETRY_DELAYS) + 1):
        try:
            return client.models.generate_content(model=config.GEMINI_MODEL, contents=contents, config=gen_config)
        except errors.APIError as e:
            if e.code in (429, 500, 503) and attempt < len(RETRY_DELAYS):
                time.sleep(RETRY_DELAYS[attempt])
                continue
            if e.code in (429, 503):
                raise HTTPException(status_code=503, detail="AI is busy right now, try again in a minute") from e
            raise HTTPException(status_code=502, detail=f"AI request failed: {e}") from e
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"AI request failed: {e}") from e


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
