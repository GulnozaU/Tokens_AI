"""LLM service for TokenOS agents — Gemini + Groq with graceful fallback."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_gemini_client = None


def is_ai_enabled() -> bool:
    return bool(settings.google_api_key or settings.groq_api_key)


def active_providers() -> list[str]:
    providers: list[str] = []
    if settings.google_api_key:
        providers.append("gemini")
    if settings.groq_api_key:
        providers.append("groq")
    return providers


def _get_gemini_client():
    global _gemini_client
    if _gemini_client is None:
        if not settings.google_api_key:
            return None
        from google import genai

        _gemini_client = genai.Client(api_key=settings.google_api_key)
    return _gemini_client


def estimate_tokens(text: str) -> int:
    if not text:
        return 0
    return max(1, len(text) // 4)


def _strip_json_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _parse_json(text: str) -> dict[str, Any] | None:
    text = _strip_json_fences(text)
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                return None
    return None


def _gemini_generate_json(prompt: str, schema: dict[str, Any]) -> dict[str, Any] | None:
    client = _get_gemini_client()
    if not client:
        return None

    from google.genai import types

    try:
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                response_mime_type="application/json",
                response_schema=schema,
            ),
        )
        return _parse_json(response.text or "")
    except Exception as exc:
        logger.warning("Gemini generate_json failed: %s", exc)
        return None


def _groq_generate_json(prompt: str, schema: dict[str, Any]) -> dict[str, Any] | None:
    if not settings.groq_api_key:
        return None

    schema_hint = json.dumps(schema, indent=2)
    full_prompt = (
        f"{prompt}\n\n"
        f"Respond with ONLY valid JSON matching this schema:\n{schema_hint}"
    )

    try:
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.groq_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.groq_model,
                    "messages": [{"role": "user", "content": full_prompt}],
                    "temperature": 0.2,
                    "response_format": {"type": "json_object"},
                },
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return _parse_json(content)
    except Exception as exc:
        logger.warning("Groq generate_json failed: %s", exc)
        return None


def generate_json(prompt: str, schema: dict[str, Any]) -> dict[str, Any] | None:
    """Try Gemini first, then Groq. Returns None if all providers fail."""
    if settings.google_api_key:
        result = _gemini_generate_json(prompt, schema)
        if result:
            result["_provider"] = "gemini"
            return result

    if settings.groq_api_key:
        result = _groq_generate_json(prompt, schema)
        if result:
            result["_provider"] = "groq"
            return result

    return None


def embed_texts(texts: list[str]) -> list[list[float]] | None:
    """Batch embed via Gemini. Returns None if unavailable."""
    client = _get_gemini_client()
    if not client or not texts:
        return None

    try:
        response = client.models.embed_content(
            model=settings.embedding_model,
            contents=texts,
        )
        embeddings = response.embeddings or []
        if len(embeddings) != len(texts):
            return None
        return [list(e.values) for e in embeddings]
    except Exception as exc:
        logger.warning("Gemini embed_content failed: %s", exc)
        return None
