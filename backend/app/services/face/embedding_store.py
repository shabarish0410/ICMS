"""
embedding_store.py — Storage abstraction for face embeddings.

The rest of the application calls save/load through this module and never
directly handles the jsonb ↔ vector(512) distinction. At startup,
`detect_backend()` queries pg_extension to see whether pgvector is available
and sets the module-level `_backend` accordingly.

All Supabase REST calls accept Python list[float] for both backends, so
serialisation is fully transparent.
"""
import logging
import ast
from typing import Optional, List, Any

logger = logging.getLogger("icms.face.embedding_store")

_backend: str = "jsonb"   # "pgvector" | "jsonb"


# ── Backend Detection ─────────────────────────────────────────────────────────

def detect_backend(supabase) -> str:
    """
    Query pg_extension to check for pgvector availability.
    Sets the module-level _backend and returns it.
    Call once during application startup.
    """
    global _backend
    try:
        result = supabase.rpc("check_pgvector", {}).execute()
        if result.data is True or result.data == [True] or result.data == [{"check_pgvector": True}]:
            _backend = "pgvector"
        else:
            _backend = "jsonb"
    except Exception as e:
        _backend = "jsonb"
        logger.warning(f"[EmbeddingStore] pgvector detection failed — defaulting to jsonb: {e}")

    logger.info(f"[EmbeddingStore] Active embedding backend: {_backend}")
    return _backend


def get_backend() -> str:
    """Return the currently active embedding backend name."""
    return _backend


# ── Serialisation Helpers ─────────────────────────────────────────────────────

def embedding_write_column() -> str:
    """
    Return the correct column name for writing the embedding.
    - pgvector: 'face_embedding_vec'   (vector(512) column)
    - jsonb:    'face_embedding'        (jsonb column — legacy)
    """
    return "face_embedding_vec" if _backend == "pgvector" else "face_embedding"


def embedding_select_columns() -> str:
    """
    Return the column expression for SELECT queries so that callers always
    receive a value under the key 'embedding' regardless of backend.
    """
    if _backend == "pgvector":
        return "face_embedding_vec"
    return "face_embedding"


def serialize_embedding(embedding: List[float]) -> Any:
    """
    Prepare an embedding for storage.
    Both backends accept a plain Python list[float] via the Supabase REST client.
    The method exists as a hook in case future backends need different formats.
    """
    return embedding


def deserialize_embedding(raw: Any) -> Optional[List[float]]:
    """
    Convert a stored embedding value back to list[float], regardless of
    whether it came from pgvector, jsonb, or a legacy JSON string.

    Handles:
        list          — returned as-is (most common)
        str           — legacy JSON string representation (ast.literal_eval)
        None          — returns None

    Returns:
        list[float] or None
    """
    if raw is None:
        return None
    if isinstance(raw, list):
        try:
            return [float(x) for x in raw]
        except (TypeError, ValueError):
            logger.error("[EmbeddingStore] deserialize: list contains non-numeric values")
            return None
    if isinstance(raw, str):
        try:
            parsed = ast.literal_eval(raw)
            return [float(x) for x in parsed]
        except Exception as e:
            logger.error(f"[EmbeddingStore] deserialize: could not parse string embedding: {e}")
            return None
    logger.error(f"[EmbeddingStore] deserialize: unexpected type {type(raw)}")
    return None


def build_embedding_payload(embedding: List[float]) -> dict:
    """
    Return a dict suitable for inclusion in a Supabase upsert/update payload.
    Automatically selects the correct column name for the active backend.
    Also writes to the legacy 'face_embedding' jsonb column when using pgvector,
    so that the attendance service (which reads jsonb) still works during migration.
    """
    serialized = serialize_embedding(embedding)
    payload: dict = {"face_embedding": serialized}   # Always write legacy column
    if _backend == "pgvector":
        payload["face_embedding_vec"] = serialized   # Also write vector column
    return payload


def extract_embedding_from_row(row: dict) -> Optional[List[float]]:
    """
    Pull the embedding from a Supabase row dict, trying pgvector column first,
    then falling back to the legacy jsonb column.
    """
    raw = row.get("face_embedding_vec") or row.get("face_embedding")
    return deserialize_embedding(raw)
