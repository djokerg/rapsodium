# Assistant (Conversational Recommendation Control)

## 1. Overview

The Assistant is a chat-based control layer over Rapsodium's existing recommendation
engine. Instead of only picking an algorithm from a fixed menu (popularity / content /
collaborative), the user can describe—in natural language—**what they're doing** or
**what vibe they want**, and the recommendations adapt in real time. In the same chat,
the user can also **fine-tune the algorithm conversationally**: ask for more of a genre,
exclude an artist, push toward "less mainstream", etc.

### Original requirement (Serbian)

> Korisnik kroz chat može da napiše šta trenutno radi ili kakav vibe želi (npr. učim,
> vozim, nešto lagano ali ne previše mainstream), a sistem na osnovu toga prilagođava
> preporuke u realnom vremenu. U istom chatu može i fino da podešava algoritam — da
> traži više određenog žanra, izbegne izvođače ili slično.

### What this means in product terms

| User says (NL) | System does |
|----------------|-------------|
| "učim, nešto mirno u pozadini" | Targets low energy / instrumental-leaning songs, moderate tempo |
| "vozim, daj nešto da me drži budnim" | Targets high energy + high tempo |
| "nešto lagano ali ne previše mainstream" | Moderate valence, **down-weights popularity** |
| "više rocka" | Boosts the `rock` genre in ranking |
| "izbegavaj Eda Širana" | Adds the artist to an exclusion list |
| "ma ne, hoću nešto igrivo" | Updates the live context, re-ranks immediately |

The key insight: **Rapsodium already has the right data.** The `songs` table carries
`energy`, `valence`, `danceability`, `tempo` (see [database-design.md](./database-design.md)),
so "vibe" maps directly onto an audio-feature target vector, and "not too mainstream"
maps onto popularity weighting. The Assistant's job is to **translate natural language
into a structured recommendation context**, which the recommender then applies.

It is built as a **stateless, ephemeral** feature (no chat history is stored — see §6):
OpenAI does the NL→structure translation, and the small amount of conversation state lives
in the mobile app and round-trips through each request.

---

## 2. How it fits the existing architecture

```
┌─────────────────────────────────────────┐
│  Mobile App (React Native)              │
│  NEW: Assistant chat screen            │
│  Holds the current VibeProfile in       │
│  memory (Zustand) — no server session   │
└──────────────┬──────────────────────────┘
               │ POST /assistant/message  { text, context }
               v
┌─────────────────────────────────────────────┐
│  Backend (NestJS) — STATELESS                │
│  NEW: assistant module                       │
│   1. Receive { text, context } from client   │
│   2. Call OpenAI API → structured context patch│
│   3. Merge patch into the received context    │
│   4. Call recommender with the merged context │
│   5. Return { reply, context, songs }         │
└──────┬───────────────────────┬───────────────┘
       │                        │
       v                        v
┌────────────────┐   ┌──────────────────────────┐
│ OpenAI API     │   │ Python Recommender        │
│ structured     │   │ NEW: contextual endpoint  │
│ output         │   │ vibe → nearest songs +    │
│ (json_schema)  │   │ filters + popularity skew │
└────────────────┘   └──────────────────────────┘
                                │
                                v
                        ┌────────────┐
                        │ PostgreSQL │
                        │ (songs etc)│
                        └────────────┘
```

This is **additive** and **stateless**. It does not change the existing `/recommendations`
endpoint or the three algorithms; it adds a parallel, conversation-driven path on top of
them. The conversation state (the accumulated `VibeProfile`) lives **client-side in
memory** and is sent with every request — nothing about the chat is written to the
database. This matches the "vibe-at-a-time" usage: when the user leaves, the vibe is gone.

---

## 3. Core concept: the Session Context ("Vibe Profile")

Everything flows through a single structured object that represents the **current,
accumulated state of the conversation**. Each chat message produces a *patch* to this
object; the recommender consumes the merged result.

```ts
// backend/src/assistant/types.ts
export interface VibeProfile {
  /** Free-text activity, for logging/debugging and thesis analysis. */
  activity: string | null;            // "studying", "driving", "workout"

  /** Target audio-feature vector (0..1, except tempo in BPM). Nullable per field. */
  featureTargets: {
    energy?: number;                  // 0 calm  → 1 intense
    valence?: number;                 // 0 sad   → 1 happy
    danceability?: number;            // 0 → 1
    tempo?: number;                   // BPM, e.g. 60..180
  };

  /** Multiplicative ranking boosts per genre. >1 boost, <1 suppress. */
  genreBoosts: Record<string, number>; // { "rock": 1.5, "pop": 0.7 }

  /** Hard filters. */
  excludedArtists: string[];
  excludedGenres: string[];

  /** -1 = underground, 0 = neutral, +1 = chart hits. Skews popularity weighting. */
  mainstream: number;

  /** Which base algorithm to blend the vibe with. */
  baseAlgorithm: 'content' | 'collaborative' | 'popularity';
}
```

### Why a *patch* model (not rebuild-each-turn)

Fine-tuning is incremental. When the user says "više rocka" they mean *adjust the current
state*, not *start over*. So each LLM call returns a **partial** `VibeProfile` (a patch),
and the backend deep-merges it into the context **the client sent in this request**:

- `featureTargets` / `genreBoosts` → field-level merge (new keys override, others kept)
- `excludedArtists` / `excludedGenres` → set union (client clears by sending an empty `{}`)
- scalars (`activity`, `mainstream`, `baseAlgorithm`) → overwrite if present in patch

This makes "vozim → ma ne, hoću nešto mirno" work correctly: the second message just
overwrites `energy`/`tempo` while keeping the genre boosts from earlier. Because the
merge is a pure function and the state round-trips through the client, the backend stays
stateless — no session storage required. To start a fresh vibe, the client simply sends
an empty context (`{}`).

---

## 4. The translation table: natural language → audio features

This mapping is the heart of the feature. Give it to the model in the system prompt as
guidance (the model infers the rest), and use it as the basis for evaluation in the thesis.

| Vibe / activity | energy | valence | danceability | tempo (BPM) | mainstream |
|-----------------|:------:|:-------:|:------------:|:-----------:|:----------:|
| studying / focus / reading | 0.2 | 0.4 | 0.3 | ~80 | 0 |
| relaxing / chill | 0.3 | 0.5 | 0.4 | ~90 | 0 |
| driving | 0.7 | 0.6 | 0.6 | ~120 | 0 |
| workout / gym | 0.9 | 0.7 | 0.8 | ~140 | 0 |
| party / dancing | 0.8 | 0.8 | 0.9 | ~125 | +0.5 |
| sad / melancholic | 0.3 | 0.2 | 0.3 | ~75 | 0 |
| "ne previše mainstream" | — | — | — | — | −0.6 |
| "samo hitovi" | — | — | — | — | +0.8 |

> These are **seed heuristics**, not hard rules. The model is told to produce sensible
> targets for vibes not in the table and to leave fields `undefined` when the user gave
> no signal for them (so the merge doesn't clobber prior state).

---

## 5. LLM design (OpenAI API)

### 5.1 Provider & model

Use the **OpenAI API** via the official Node SDK (`openai`), which fits the
NestJS/TypeScript backend. (Decision: OpenAI is the chosen provider.)

**Recommendation for this feature:** the per-message extraction is a *narrow, well-scoped
classification-into-schema task*, and it runs on every chat turn (latency- and
cost-sensitive). Pick a **small/fast model** — e.g. `gpt-4o-mini` (or the current-generation
equivalent in your account, such as a `*-mini`/`nano` tier). These are cheap, low-latency,
and more than capable of structured extraction. Keep the model ID in **config**
(`ASSISTANT_MODEL` env var) so you can swap to a larger model if vibe inference needs more
nuance, and so you don't hardcode a model that may rotate.

> Requirement: the chosen model must support **Structured Outputs** (`response_format` with
> `json_schema` + `strict: true`). The `4o`/`4.1` families and the `o`-series support it.
> Verify current model availability and pricing in your OpenAI dashboard.

### 5.2 Approach: single-call structured output (chosen)

We want **one structured object per turn** plus a short natural-language reply, so the
design is a **single chat completion with Structured Outputs** (`response_format` of type
`json_schema`, `strict: true`) returning both fields:

```ts
// Response schema the model is forced to produce
{
  assistant_reply: string;        // short, friendly NL reply in Serbian
  context_patch: Partial<VibeProfile>;  // the merge patch (see §3)
}
```

One round trip, deterministic shape, easy to parse. `strict: true` guarantees the JSON
matches the schema, so no defensive shape-checking is needed beyond value validation (§12).

### 5.3 Future option: function calling (deferred)

If you later want the assistant to **query live data** mid-conversation — e.g. "šta sam
slušao juče?" or "ima li nešto novo od ovog izvođača?" — you can move to OpenAI **function
calling** with tools like `search_songs` / `get_listening_history` and an execute-and-loop
pattern. Not needed for the first version; noted so the module layout doesn't have to
change later.

### 5.4 System prompt (sketch)

```
You are Rapsodium's music assistant. The user describes what they're doing or the
vibe they want, possibly in Serbian. Translate that into a recommendation context.

Rules:
- Output ONLY the structured object. Put a short, friendly reply (Serbian) in
  `assistant_reply` and the changes in `context_patch`.
- `context_patch` is a PATCH: include ONLY fields the user gave a signal for this turn.
  Leave everything else out so prior context is preserved.
- Map vibes to audio features using this guidance: <insert table from §4>.
- "ne previše mainstream" / "underground" → lower `mainstream` (toward -1).
  "samo hitovi" / "popularno" → raise `mainstream` (toward +1).
- "više <genre>" → genreBoosts[<genre>] > 1. "manje/bez <genre>" → < 1 or excludedGenres.
- "izbegavaj <artist>" → add to excludedArtists.
- If the user just chats without a music signal, return an empty context_patch.
```

### 5.5 Caching & cost control

- Keep the system prompt **byte-stable** (don't interpolate timestamps/IDs). OpenAI applies
  automatic prompt caching to long, repeated prefixes, so a stable system prompt + feature
  table is reused cheaply across turns at no extra integration effort.
- The conversation is kept short by design: since we **don't persist** and the merged
  `VibeProfile` already encodes the accumulated state, each request sends just the current
  `VibeProfile` (compact JSON) + the new user message. No message history is stored or
  replayed — minimal tokens, fast turns.

---

## 6. Data model: none (stateless / ephemeral)

**No new tables.** Decision: the chat is "vibe-at-a-time" usage — no history is needed.

- The conversation state (the accumulated `VibeProfile`) lives **client-side in memory**
  (Zustand) and is sent on every request; the backend never stores it.
- No chat transcript is persisted. When the app is closed or the user starts a new vibe,
  the state is simply discarded.
- The only database the assistant reads is the existing **`songs`** table (via the
  recommender) — and the existing `interactions`/`user_preferences` if you blend in the
  user's taste profile (§8). No writes.

This keeps [database-design.md](./database-design.md) unchanged and the backend fully
stateless.

> If you ever want offline evaluation data for the thesis, you could *optionally* log
> turns to a file/CSV (outside the DB, the approach already endorsed for experiment data
> in [scope.md](./scope.md)) — but that's not part of this design.

---

## 7. Backend module (NestJS)

New module `backend/src/assistant/`:

```
src/assistant/
├── assistant.module.ts
├── assistant.controller.ts   # POST /assistant/message
├── assistant.service.ts      # orchestration: LLM → merge → recommend (stateless)
├── llm.service.ts            # thin wrapper around the OpenAI SDK
├── vibe-merge.ts             # pure function: mergeVibeProfile(current, patch)
└── types.ts                  # VibeProfile, schema, DTOs
```

### 7.1 Endpoint

| Method | Path | Auth | Body / Description |
|--------|------|------|--------------------|
| `POST` | `/assistant/message` | Yes (JWT) | `{ text, context }` → `{ reply, context, songs }` |

There is no session/reset endpoint — the client owns the state. To start fresh, the client
sends `context: {}`.

### 7.2 Request flow (the core of `assistant.service.ts`)

```
handleMessage(userId, text, context):              // context comes from the client
  1. { assistant_reply, context_patch } = llm.extract(context, text)
  2. merged = mergeVibeProfile(context, context_patch)
  3. merged = validate(merged)                      // clamp/sanitize — see §12
  4. songs  = recommender.contextual(userId, merged)   // §8
  5. return { reply: assistant_reply, context: merged, songs }
```

Fully stateless: no DB reads/writes for the conversation; `userId` (from the JWT) is only
passed to the recommender so it can blend in the user's taste profile.

### 7.3 `llm.service.ts` (OpenAI SDK)

```ts
import OpenAI from 'openai';

const client = new OpenAI(); // reads OPENAI_API_KEY from env

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['assistant_reply', 'context_patch'],
  properties: {
    assistant_reply: { type: 'string' },
    context_patch: {
      type: 'object',
      additionalProperties: false,
      properties: {
        activity: { type: 'string' },
        featureTargets: {
          type: 'object',
          additionalProperties: false,
          properties: {
            energy: { type: 'number' },
            valence: { type: 'number' },
            danceability: { type: 'number' },
            tempo: { type: 'number' },
          },
        },
        genreBoosts: { type: 'object', additionalProperties: { type: 'number' } },
        excludedArtists: { type: 'array', items: { type: 'string' } },
        excludedGenres: { type: 'array', items: { type: 'string' } },
        mainstream: { type: 'number' },
        baseAlgorithm: { type: 'string', enum: ['content', 'collaborative', 'popularity'] },
      },
    },
  },
} as const;

async extract(current: VibeProfile, userText: string) {
  const res = await client.chat.completions.create({
    model: process.env.ASSISTANT_MODEL ?? 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content:
          `Current context (JSON):\n${JSON.stringify(current)}\n\n` +
          `User message:\n${userText}`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'vibe_turn', schema: RESPONSE_SCHEMA, strict: true },
    },
  });

  const content = res.choices[0].message.content ?? '{}';
  return JSON.parse(content) as {
    assistant_reply: string;
    context_patch: Partial<VibeProfile>;
  };
}
```

> Note: under `strict: true`, OpenAI requires every key in `properties` to be listed in
> `required` and `additionalProperties: false` on each object. Since `context_patch` is a
> *partial*, model "field omission" is expressed by making each property nullable
> (`type: ['number','null']`, etc.) and treating `null` as "no signal this turn" in the
> merge. Adjust the schema above accordingly when you wire it up; alternatively use the
> SDK's `zodResponseFormat` helper with a Zod schema to generate a compliant strict schema
> automatically.

Notes:
- `OPENAI_API_KEY` and `ASSISTANT_MODEL` go in the backend `.env` (server-side only — never
  in the mobile bundle).
- Guard `JSON.parse` and fall back to an empty patch + a generic reply if the response is
  malformed or the model refuses.
- Wrap the call in a try/catch and degrade gracefully (return the received context
  unchanged + a friendly reply) rather than failing the request.

---

## 8. Recommender extension (Python)

Add one contextual entry point that turns a `VibeProfile` into a ranked song list. It
reuses the content-based machinery already built in Phase 6.

### 8.1 New endpoint / function

```
GET /recommend/contextual?user_id=...   (body: VibeProfile)
```

Algorithm:

1. **Build the target vector** from `featureTargets`. For any field the user didn't set,
   fall back to the user's content-based profile (mean of liked songs' features) so the
   result is still personalized. This is the natural blend of "vibe" + "taste".
2. **Candidate filtering** — drop songs whose `artist ∈ excludedArtists` or
   `genre ∈ excludedGenres`.
3. **Similarity** — cosine similarity between the target vector and each candidate's
   `[energy, valence, danceability, tempo_normalized]` (reuse the existing
   content-based similarity code).
4. **Genre boosts** — multiply each candidate's score by `genreBoosts[genre] ?? 1`.
5. **Mainstream skew** — blend in a popularity term weighted by `mainstream`:
   `score = sim_score + mainstream * w * normalized_popularity`
   (negative `mainstream` subtracts popularity → favors deep cuts).
6. **Exclude already-seen** songs (same as existing recommenders), return top-N.

`baseAlgorithm` selects which engine provides the candidate pool / fallback profile
(`content` is the default and the most natural fit for vibe matching).

> This is a thin layer over the existing content-based recommender — most of steps 3 and 6
> already exist. Steps 1, 2, 4, 5 are the new contextual logic.

---

## 9. Mobile app (Expo)

### 9.1 New route

Add `app/assistant.tsx` (chat screen) to the structure in
[architecture.md](./architecture.md). Entry point: a button/tab on the home screen.

### 9.2 Screen behavior

- A standard chat UI: message list + text input.
- On send: `POST /assistant/message` with `{ text, context }` — where `context` is the
  `VibeProfile` currently held in memory — via the existing API client (JWT auto-attached
  by the interceptor).
- On response: store the returned `context` back into memory (it becomes the input for the
  next turn), render `reply` as a chat bubble, and render the returned `songs` as a
  **live, swappable recommendation strip** directly under the conversation — this is what
  makes the adaptation feel real-time.
- Tapping a song reuses the existing song detail / preview player.

### 9.3 State (in-memory, ephemeral)

- **Zustand** holds the current `VibeProfile` (`context`) and the visible chat messages
  for this session. This is the source of truth — it's sent on every request and replaced
  by the server's returned `context`. Nothing is persisted; closing the app discards it.
- **TanStack Query** mutation for `POST /assistant/message`; the returned `songs` feed the
  recommendation strip (no separate `/recommendations` call needed while in chat).
- Optionally surface the active `context` as chips ("🎸 rock ↑", "🚫 Ed Sheeran",
  "underground"). A "novi razgovor" action just resets the in-memory store (`context = {}`,
  clear messages) — no server call needed.

---

## 10. End-to-end example

```
User:  "učim, nešto mirno ali ne previše mainstream"

OpenAI returns:
{
  "assistant_reply": "Važi! Spremam nešto smireno za učenje, bez velikih hitova. 🎧",
  "context_patch": {
    "activity": "studying",
    "featureTargets": { "energy": 0.2, "valence": 0.4, "tempo": 80 },
    "mainstream": -0.6,
    "baseAlgorithm": "content"
  }
}

Backend merges → calls recommender → returns 10 calm, lower-popularity songs.

User:  "može, ali daj više rocka"

OpenAI returns:
{
  "assistant_reply": "Ubacujem više rocka u miks. 🤘",
  "context_patch": { "genreBoosts": { "rock": 1.6 } }
}

Backend merges (keeps energy/valence/tempo/mainstream from before, adds rock boost)
→ re-ranks → returns updated list immediately.
```

---

## 11. Implementation steps (checklist)

**Backend — module (stateless, no DB changes)**
- [ ] Scaffold `assistant` module (controller, service, module)
- [ ] Implement `mergeVibeProfile` (pure function) + unit tests for the patch semantics
- [ ] Implement `validate` (clamp/sanitize the merged profile — see §12)
- [ ] Add `openai` SDK; create `llm.service.ts` with the structured-output call
- [ ] Add `OPENAI_API_KEY` and `ASSISTANT_MODEL` to backend env / config
- [ ] Implement `POST /assistant/message` (`{ text, context }` → `{ reply, context, songs }`)
- [ ] Graceful degradation on OpenAI errors (catch → return received context + generic reply)

**Recommender**
- [ ] Add `contextual` function/endpoint accepting a `VibeProfile`
- [ ] Build target vector (vibe ⊕ user content profile) + exclusion filters
- [ ] Apply genre boosts + mainstream popularity skew; reuse existing similarity & top-N
- [ ] Wire backend `assistant.service` → recommender contextual call

**Mobile**
- [ ] Add `app/assistant.tsx` chat screen + entry point from home
- [ ] TanStack Query mutation for `/assistant/message`
- [ ] Zustand: in-memory `context` (VibeProfile) + chat messages
- [ ] Send `context` each turn; store the returned `context` back
- [ ] Render live recommendation strip; reuse song detail/player
- [ ] "Novi razgovor" = reset the in-memory store (no server call)

**Polish / evaluation (optional)**
- [ ] Filter chips UI showing active context
- [ ] Keep the system prompt byte-stable so OpenAI prompt-caching kicks in
- [ ] Thesis: compare extraction quality across a few OpenAI models; optionally log
      NL→recommendation outcomes to a CSV (outside the DB) for analysis

---

## 12. Suggestions & risks

- **Latency.** This adds one LLM round trip per message. A small/fast model keeps it quick;
  the byte-stable system prompt (OpenAI prompt-caching) and sending only the compact
  `VibeProfile` (not full history) keep tokens minimal. Show a typing indicator in the UI.
- **Cost.** A turn is small (~1–2K input incl. the cached system prompt, <300 output) — on
  a `*-mini` model this is a fraction of a cent per message, negligible for a thesis demo.
- **Don't trust the model blindly (`validate` step, §7.2).** Clamp `featureTargets` to
  [0,1] (tempo to a sane BPM range), clamp `mainstream` to [-1,1], drop unknown
  `baseAlgorithm` values, and cap `genreBoosts` to a reasonable multiplier range. Treat the
  model's output as untrusted input even though `strict: true` guarantees the shape.
- **Determinism for the thesis.** The schema is fixed and the merge is a pure function, so
  the *application* of a patch is fully deterministic and testable; only the NL→patch step
  is model-driven. A clean boundary to write about.
- **Scope boundary.** "Reason for recommendation" explanations remain out of scope
  ([scope.md](./scope.md)); the assistant's NL `reply` is a *lightweight* form of
  explanation — keep the formal explanation feature in the optional extensions phase.
- **Security.** Keep `OPENAI_API_KEY` strictly server-side. The mobile app only ever talks
  to your NestJS backend, never to OpenAI directly.

## 13. Decisions (locked)

1. **Provider/model** — OpenAI; default to a small/fast model (`gpt-4o-mini` or equivalent),
   configurable via `ASSISTANT_MODEL`.
2. **Persistence** — none. Ephemeral, vibe-at-a-time; state held in the mobile app's memory
   and round-tripped through the client. No new DB tables.
3. **LLM approach** — single-call **structured output** (`response_format` json_schema,
   `strict: true`); function-calling deferred.
