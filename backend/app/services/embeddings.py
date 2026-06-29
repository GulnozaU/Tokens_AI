"""Lightweight text embedding for skill similarity search.

Uses a deterministic bag-of-words + n-gram hashing approach so the MVP
runs without external API keys or heavy ML dependencies.
"""

import hashlib
import math
import re

from app.config import settings

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


def embed_text(text: str) -> list[float]:
    """Create a fixed-dimension embedding vector from text."""
    dim = settings.embedding_dim
    vec = [0.0] * dim
    tokens = _tokenize(text)

    # Unigrams
    for token in tokens:
        idx = int(hashlib.md5(token.encode()).hexdigest(), 16) % dim
        vec[idx] += 1.0

    # Bigrams for phrase awareness
    for i in range(len(tokens) - 1):
        bigram = f"{tokens[i]}_{tokens[i + 1]}"
        idx = int(hashlib.md5(bigram.encode()).hexdigest(), 16) % dim
        vec[idx] += 0.5

    # L2 normalize
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    return max(0.0, min(1.0, dot))
