"""Secret Manager access for the agent tier.
Reads GEMINI_API_KEY at runtime; caches it in-process. Never hardcoded, never logged.
"""
import os
import logging
from functools import lru_cache

log = logging.getLogger("agent-tier.secrets")


@lru_cache(maxsize=8)
def get_secret(secret_id: str, project_id: str | None = None) -> str:
    """Fetch a secret's latest version from Secret Manager.
    Falls back to an env var of the same name (useful for local dev)."""
    env_val = os.getenv(secret_id)
    if env_val:
        return env_val

    from google.cloud import secretmanager

    project_id = project_id or os.getenv("GOOGLE_CLOUD_PROJECT")
    if not project_id:
        raise RuntimeError("GOOGLE_CLOUD_PROJECT not set and no env fallback for secret.")

    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{project_id}/secrets/{secret_id}/versions/latest"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8")


def gemini_api_key() -> str:
    return get_secret("GEMINI_API_KEY")
