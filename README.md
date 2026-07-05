# PersonaPez

## Live Website Link

https://personapez.onrender.com/

AI-powered chat app that simulates conversations with **Hitesh Choudhary** and **Piyush Garg**, co-founders of [Chai aur Code](https://chaicode.com) — built entirely on prompt engineering, no fine-tuning, no RAG.

> AI persona simulation for demo purposes — not the real individuals.

---

## What it does

- Simulates two distinct educators using structured persona JSON files as the single source of truth
- Writes Hinglish in Roman/Latin script — matching how Hitesh and Piyush actually type
- Detects the user's language register (Hinglish vs clean English) and matches it
- Streams responses progressively — text appears as it is generated, not all at once
- Maintains separate conversation history per persona
- Enforces persona-specific hard boundaries (no financial advice, no badmouthing, no outcome promises)
- Suggests real starter questions pulled directly from each persona's sample dialogues

---

## Tech stack

| Layer        | Choice                                     |
| ------------ | ------------------------------------------ |
| Backend      | Node.js + Express                          |
| Frontend     | Plain HTML + CSS + JS                      |
| LLM          | OpenAI `gpt-4o-mini`, streaming mode       |
| Persona data | 2 structured JSON files                    |
| Hosting      | Render (free Web Service)                  |
| Auth         | None — deliberately out of scope           |
| State        | In-memory, per persona, per server process |

---

## File structure

```
personapez/
├── server.js                  # Express entry — serves /public, mounts routes
├── chatRoute.js               # POST /api/chat (streaming) + GET /api/personas
├── personaService.js          # Loads persona JSON, builds system prompt, trims history
├── openaiService.js           # Streaming call to OpenAI, yields chunks via callback
├── personas/
│   ├── hitesh_persona.json    # Hitesh's voice, tone, opinions, boundaries
│   └── piyush_persona.json    # Piyush's voice, tone, opinions, boundaries
├── public/
│   ├── index.html             # Markup only
│   ├── style.css              # Dark theme, indigo/lavender palette
│   ├── app.js                 # Fetch, streaming render, persona switch, timestamps
│   └── logo.png               # PersonaPez logo
├── .env.example               # Environment variable template
└── package.json
```

10 source files. No build tools. No database. No auth.

---

## Local setup

### Prerequisites

- Node.js 18 or higher
- An OpenAI API key — [platform.openai.com](https://platform.openai.com)

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/personapez.git
cd personapez
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

```dotenv
PORT=3000
OPENAI_API_KEY=sk-...your key here...
OPENAI_API_URL=https://api.openai.com/v1/chat/completions
```

### 4. Start the server

```bash
node server.js
```

### 5. Open the app

```
http://localhost:3000
```

---

## API reference

### `GET /health`

Health check.

```bash
curl http://localhost:3000/health
```

Response:

```json
{ "status": "ok", "message": "PersonaPez is running" }
```

---

### `GET /api/personas`

Returns metadata and starter questions for all personas.

```bash
curl http://localhost:3000/api/personas
```

Response:

```json
[
  {
    "id": "hitesh",
    "displayName": "Hitesh Choudhary",
    "starterQuestions": [
      "Sir data analyst ka future kaisa hai AI ke baad?",
      "Course mehenga lag raha hai, discount milega?",
      "Should I switch my job right now?"
    ]
  },
  {
    "id": "piyush",
    "displayName": "Piyush Garg",
    "starterQuestions": [
      "Bhai 22 months experience hai, interview mein kya expect karu?",
      "Kitne saal ka experience chahiye good engineer banne ke liye?",
      "AI ke baad coding seekhna zaroori hai kya?"
    ]
  }
]
```

---

### `POST /api/chat`

Streams a persona reply. Response is plain text chunks, not JSON.

```bash
curl --no-buffer -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "persona": "hitesh",
    "messages": [
      { "role": "user", "content": "Sir data analyst ka future kaisa hai AI ke baad?" }
    ]
  }'
```

**Request body:**

| Field      | Type   | Required | Description                                       |
| ---------- | ------ | -------- | ------------------------------------------------- |
| `persona`  | string | ✅       | `"hitesh"` or `"piyush"`                          |
| `messages` | array  | ✅       | `[{ role, content }]` — full conversation history |

**Error responses:**

| Status | Reason                                   |
| ------ | ---------------------------------------- |
| `400`  | Unknown persona or empty messages array  |
| `500`  | OpenAI API error or missing env variable |

---

## Persona design

Each persona is defined by a structured JSON file covering:

- Language style and code-switch ratio (Hinglish vs English)
- Tone traits and personality traits
- Filler words, catchphrases, vocabulary habits
- Humor style with real examples
- Personal anecdotes (used sparingly)
- Stances on AI tools, topics of expertise, recurring opinions
- Hard behavioral boundaries — enforced as non-negotiable rules in the system prompt
- Real sample dialogues — used as few-shot examples and starter questions

The system prompt is assembled from a trimmed field set (~1,950–2,000 tokens) to keep cost bounded. Livestream-specific fields (`greeting_patterns`, `sign_off_patterns`, `business_context`) are excluded since a 1:1 text chat has no stream context.

---

## Cost estimate

Per request on `gpt-4o-mini`:

| Component                | Tokens     |
| ------------------------ | ---------- |
| System prompt            | ~2,000     |
| History (max 8 messages) | ~600       |
| Output (capped)          | ~350       |
| **Total**                | **~2,950** |

10 evaluators × 30 messages = 300 requests ≈ **$0.15–$0.35 total**.

---

## Deployment — Render

1. Push to GitHub
2. Render → **New Web Service** → connect repo
3. Set build command: `npm install`
4. Set start command: `node server.js`
5. Add environment variables (`PORT`, `OPENAI_API_KEY`, `OPENAI_API_URL`)
6. Deploy

> **Free tier note:** Render free instances spin down after 15 minutes of inactivity. The first request after a cold start takes ~30 seconds. Expected behavior — not a bug.

---

## Testing checklist

| Test                              | Expected                                               |
| --------------------------------- | ------------------------------------------------------ |
| `GET /health`                     | `{ status: "ok" }`                                     |
| `GET /api/personas`               | Both personas with real starter questions              |
| Hinglish input → Hitesh           | Roman script Hinglish reply in Hitesh's voice          |
| English input → Hitesh            | Clean English reply, more formal register              |
| Hinglish input → Piyush           | Clipped, energetic, "Right?" / "OK?" tags              |
| Unknown persona                   | `400` error                                            |
| Empty messages                    | `400` error                                            |
| Financial advice question         | Declined in character — no real advice given           |
| Badmouthing question              | Deflected in character                                 |
| Outcome promise question (Piyush) | Tied to effort, no guarantee given                     |
| Switch persona tab                | Separate chat history, correct accent color            |
| Streaming                         | Text appears progressively, not all at once            |
| Timestamps                        | Each bubble shows correct local time                   |
| Starter chips                     | 3 real questions per persona, hide after first message |
| Markdown in response              | Code blocks, bold, lists render correctly              |

---

## Scope — what is deliberately excluded

- No authentication
- No database or persistence — history resets on server restart
- No RAG or vector search
- No fine-tuning
- No LangChain or agent frameworks
- No TypeScript
- No React or any frontend framework
- No build tooling

---

## Disclaimer

PersonaPez is an AI persona simulation built for demo and educational purposes. It is not affiliated with, endorsed by, or representative of Hitesh Choudhary or Piyush Garg. All persona data is derived from publicly available content for research demonstration only.
