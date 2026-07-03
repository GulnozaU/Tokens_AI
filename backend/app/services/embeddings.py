"""Text embedding for skill similarity search.

Uses Gemini embeddings when GOOGLE_API_KEY is set; otherwise hash-based fallback.
"""

import hashlib
import math
import re

from app.config import settings
from app.services.llm import embed_texts, is_ai_enabled

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


def _hash_embed(text: str) -> list[float]:
    """Deterministic bag-of-words fallback (no API key required)."""
    dim = settings.embedding_dim
    vec = [0.0] * dim
    tokens = _tokenize(text)

    for token in tokens:
        idx = int(hashlib.md5(token.encode()).hexdigest(), 16) % dim
        vec[idx] += 1.0

    for i in range(len(tokens) - 1):
        bigram = f"{tokens[i]}_{tokens[i + 1]}"
        idx = int(hashlib.md5(bigram.encode()).hexdigest(), 16) % dim
        vec[idx] += 0.5

    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def embed_text(text: str) -> list[float]:
    """Create an embedding vector from text."""
    if is_ai_enabled():
        vectors = embed_texts([text])
        if vectors and vectors[0]:
            return vectors[0]
    return _hash_embed(text)


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a)) or 1.0
    norm_b = math.sqrt(sum(x * x for x in b)) or 1.0
    return max(0.0, min(1.0, dot / (norm_a * norm_b)))
