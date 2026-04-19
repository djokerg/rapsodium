"""Load interactions and songs from Postgres into pandas DataFrames.

Kept separate from the algorithms so tests can feed hand-built DataFrames
directly, without touching a database.
"""

from __future__ import annotations

import pandas as pd

from .db import get_connection


def load_interactions_df() -> pd.DataFrame:
    """Return all interaction rows as a DataFrame.

    Columns: user_id (UUID), song_id (UUID), event_type (str),
    listened_seconds (int | None), created_at (datetime).
    """
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT user_id, song_id, event_type, listened_seconds, created_at
            FROM interactions
            """
        )
        rows = cur.fetchall()
        columns = [desc[0] for desc in cur.description] if cur.description else []

    return pd.DataFrame(rows, columns=columns)


def load_songs_df() -> pd.DataFrame:
    """Return the song catalogue as a DataFrame.

    Columns: id (UUID), title, artist, genre, duration_sec,
    tempo, energy, danceability, valence (the last four can be NULL if
    `seed-audio-features` has not been run).
    """
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, title, artist, genre, duration_sec,
                   tempo, energy, danceability, valence
            FROM songs
            """
        )
        rows = cur.fetchall()
        columns = [desc[0] for desc in cur.description] if cur.description else []

    return pd.DataFrame(rows, columns=columns)
