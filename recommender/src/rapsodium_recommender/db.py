from collections.abc import Iterator
from contextlib import contextmanager

import psycopg

from .config import get_settings


@contextmanager
def get_connection() -> Iterator[psycopg.Connection]:
    """Open a fresh Postgres connection.

    A single shared pool will be added in Phase 6 when algorithm endpoints land;
    for the stub scaffolding a per-call connection keeps the surface minimal.
    """
    conn = psycopg.connect(get_settings().database_url)
    try:
        yield conn
    finally:
        conn.close()
