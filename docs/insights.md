# Listening Insights

A personal "year in sound" view. The user sees an overview of their listening over time:
the artists and songs they play most, **when and how** they listen, and **how their taste is
shifting**. It turns the raw event log the app already collects into something the user can
reflect on.

---

## 1. Data source — why no new table

Every signal we need is already in the `interactions` table:

| Column | Used for |
| --- | --- |
| `user_id` | scope everything to the current user |
| `song_id` → `songs` join | top songs, artists, genres |
| `event_type` (`play` / `skip` / `save`) | plays drive listening stats; saves are counted separately |
| `listened_seconds` | total listening time |
| `created_at` | time-of-day / day-of-week patterns, and the recent-vs-previous taste shift |

So insights are **computed on read** via aggregation queries — no new tables, no denormalized
snapshots to keep in sync. This mirrors the project's existing design decision that *favorites
and history are derived from `interactions` rather than stored separately*
(see [architecture.md](./architecture.md)). A materialized/cached stats table would only be
worth it at a scale this app doesn't target; if it ever is, the service is the single place to
add it behind the same response shape.

Reusing the existing `GET /interactions/history` endpoint was considered and rejected: it is
paginated and returns one page of songs, so the client could only ever aggregate a slice. A
dedicated endpoint that aggregates server-side is correct.

---

## 2. Endpoint

```
GET /insights?days=<7..365>        (JWT-guarded)
```

- `days` — the window size. Optional, defaults to **90**; clamped to `[7, 365]`.
- Everything is computed over events with `created_at >= now - days`.

### Response shape

```jsonc
{
  "range":  { "days": 90, "since": "2026-03-23T..." },
  "totals": { "plays": 412, "uniqueSongs": 188, "uniqueArtists": 96,
              "saves": 24, "listeningMinutes": 1340 },
  "topArtists": [{ "artist": "Rammstein", "plays": 31 }, ...],   // up to 5
  "topSongs":   [{ "song": { /* SongSummary */ }, "plays": 12 }, ...], // up to 5
  "topGenres":  [{ "genre": "metal", "plays": 120, "share": 0.29 }, ...], // up to 6
  "byHour":     [{ "hour": 0, "plays": 3 }, ... 24 entries ...],
  "byWeekday":  [{ "weekday": 0, "plays": 40 }, ... 7 entries, 0=Sun ...],
  "tasteShift": {
    "rising":  [{ "genre": "metal", "recent": 22, "previous": 6, "delta": 16 }, ...],
    "falling": [{ "genre": "pop",   "recent": 4,  "previous": 18, "delta": -14 }, ...]
  }
}
```

---

## 3. How each section is computed

All ranked lists are built from `play` events only (a save is an explicit signal counted in
`totals.saves`, not a "listen").

- **Totals** — `count` of plays, `countDistinct(song_id)`, `countDistinct(artist)` (via the
  `songs` join), `count` of saves, and `sum(listened_seconds)` rounded to minutes.
- **Top artists / songs / genres** — group plays by `artist` / `song.id` / `genre`, order by
  play count (ties broken alphabetically for stable output), take the top N. Genre rows also
  carry their **share** of total plays.
- **Listening patterns** — `EXTRACT(HOUR …)` and `EXTRACT(DOW …)` from `created_at`, grouped.
  The DB returns only the buckets that have plays; the service **zero-fills** them into a dense
  0–23 / 0–6 series so the client renders a complete chart. *(Hours/weekdays use the database
  session timezone — UTC in the current local setup. For per-user local-time accuracy this
  would need a stored user timezone; out of scope for the MVP.)*
- **Taste shift** — within the window, split each genre's plays at the **midpoint**
  (`now - days/2`) using SQL `COUNT(*) FILTER (WHERE …)`, giving `recent` vs `previous` counts.
  `delta = recent - previous`. Genres absent from both halves are dropped; the biggest positive
  deltas are **rising**, the biggest negative are **falling** (top 3 each).

The bucket-filling, share, and taste-shift logic live as pure functions in
`insights.util.ts` and are unit-tested (`insights.util.spec.ts`) independent of the database.

---

## 4. Mobile screen

A new **Insights** tab (`app/(app)/(tabs)/insights.tsx`):

- A range selector (Last 30 days / 90 days / Last year) reusing the existing pill picker.
- Stat cards for the headline totals.
- Top-artist / top-song / top-genre lists (top songs link to the song detail screen; genres
  show a share bar).
- Lightweight bar charts for the hour-of-day and day-of-week patterns (plain views, no chart
  dependency).
- A rising/falling list for the taste shift, with up/down trend icons.

Data is fetched with TanStack Query (`useInsights`), keyed by the selected range, with
pull-to-refresh. An empty state is shown until the user has at least one play in the window.

---

## 5. Limitations / future work

- Time-of-day patterns assume the server timezone (see §3).
- "Taste shift" is a simple two-window comparison; a longer-term trend (monthly buckets) would
  read better over a full year.
- Results are recomputed per request. Caching or a periodic rollup would only matter at much
  larger interaction volumes.
