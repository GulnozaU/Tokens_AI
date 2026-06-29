"""Security Agent — redacts secrets before skills are persisted.

Scans workflow text for API keys, passwords, tokens, and PII patterns.
Never stores raw secrets in the skill memory system.
"""

import re
from typing import Any

# Patterns for common secret formats
_SECRET_PATTERNS = [
  (re.compile(r"sk-[a-zA-Z0-9]{20,}"), "[REDACTED_OPENAI_KEY]"),
  (re.compile(r"ghp_[a-zA-Z0-9]{36}"), "[REDACTED_GITHUB_TOKEN]"),
  (re.compile(r"AKIA[0-9A-Z]{16}"), "[REDACTED_AWS_KEY]"),
  (re.compile(r"-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC )?PRIVATE KEY-----"), "[REDACTED_PRIVATE_KEY]"),
  (re.compile(r"(?i)(api[_-]?key|secret|password|token|auth)\s*[:=]\s*['\"]?[\w\-./+=]{8,}"), "[REDACTED_CREDENTIAL]"),
  (re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"), "[REDACTED_EMAIL]"),
  (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "[REDACTED_SSN]"),
]


def redact_secrets(text: str) -> str:
    """Redact known secret patterns from a string."""
    if not text:
        return text
    result = text
    for pattern, replacement in _SECRET_PATTERNS:
        result = pattern.sub(replacement, result)
    return result


def sanitize_workflow(data: dict[str, Any]) -> dict[str, Any]:
    """Recursively redact secrets from workflow event data."""
    sanitized: dict[str, Any] = {}
    for key, value in data.items():
        if isinstance(value, str):
            sanitized[key] = redact_secrets(value)
        elif isinstance(value, list):
            sanitized[key] = [
                redact_secrets(v) if isinstance(v, str) else v for v in value
            ]
        else:
            sanitized[key] = value
    return sanitized


def scan_for_secrets(text: str) -> list[str]:
    """Return list of secret types detected (for audit logging)."""
    found = []
    labels = [
        "OpenAI API key", "GitHub token", "AWS key",
        "Private key", "Credential", "Email", "SSN",
    ]
    for i, (pattern, _) in enumerate(_SECRET_PATTERNS):
        if pattern.search(text):
            found.append(labels[i])
    return found
