"""Gemini wrapper. If GEMINI_API_KEY is missing, AI endpoints answer 503 'AI unavailable' instead of crashing."""
import json
from functools import lru_cache

from fastapi import HTTPException

from . import config


def is_configured() -> bool:
    return bool(config.GEMINI_API_KEY)


@lru_cache
def get_client():
    if not is_configured():
        raise HTTPException(status_code=503, detail="AI unavailable: set GEMINI_API_KEY in backend/.env")
    from google import genai

    return genai.Client(api_key=config.GEMINI_API_KEY)


def generate(contents, gen_config):
    """Single place every Gemini call goes through (tests replace this)."""
    try:
        return get_client().models.generate_content(model=config.GEMINI_MODEL, contents=contents, config=gen_config)
    except HTTPException:
        raise
    except Exception as e:  # network, quota, bad key...
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
