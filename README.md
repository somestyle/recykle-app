# Recykle — AI Recycling Assistant

> Point your phone at any item and ask. Recykle tells you exactly what to do with it.

Recykle is a real-time AI recycling assistant that uses **Gemini Live API** to simultaneously process your voice and camera feed, then responds with spoken disposal guidance and an on-screen result card — all grounded in your city's actual recycling rules.

Built for the **[Gemini Live Agent Challenge](https://geminiliveagentchallenge.devpost.com/)** — Devpost hackathon.

---

## Demo

**Scenario:** You just finished takeout. You hold up a black plastic container and ask *"What about this?"*

Recykle responds:
> *"That's black plastic — and here's the tricky part. Black plastic isn't detectable by recycling sorting machines, so Markham puts this in the garbage, not recycling."*

A result card appears on screen with the Garbage category and a preparation tip.

### 3-scan demo flow
1. **Aluminum can** → Recycling (easy win, sets expectations)
2. **Black plastic container** → Garbage (surprising — the "aha" moment)
3. **Battery** → Depot Drop-off (hazardous, saved to history for later)

---

## Architecture

![Architecture Diagram](architecture.png)

```
User (phone camera + voice)
        |
Browser — Next.js (camera preview, AudioWorklet mic capture)
        |  WebSocket /ws/gemini
server.js (Node.js + ws — Google Cloud Run)
        |  ai.live.connect()  [v1beta1]
Gemini Live API — gemini-live-2.5-flash-native-audio
        |  toolCall: record_disposal() + audio response (PCM16)
server.js — forwards disposal data + audio to browser
        |
Result Card (UI overlay) + Voice Playback + Notes (localStorage)
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full Mermaid sequence diagram.

---

## Tech Stack

| Layer | Technology |
|---|---|
| AI | Gemini Live API (`gemini-live-2.5-flash-native-audio`) |
| AI SDK | Google GenAI SDK (`@google/genai`) |
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Backend | Node.js custom server with WebSocket proxy (`ws`) |
| Audio capture | AudioWorklet → PCM16 at 16 kHz |
| Video capture | Canvas JPEG frames at 1 fps |
| Audio playback | Web Audio API (PCM16 at 24 kHz) |
| Hosting | Google Cloud Run |
| Data | Local JSON recycling rules (Markham, Toronto, San Francisco) |
| History | localStorage |

---

## Supported Cities

| City | Province/State | Postal Codes |
|---|---|---|
| Markham | Ontario, Canada | L3R, L3S, L3T, L6B, L6C, L6E (or any L*) |
| Toronto | Ontario, Canada | M4, M5, M6 (or any M*) |
| San Francisco | California, USA | 941xx |

---

## Local Setup

### Prerequisites
- Node.js 20+
- Chrome or Chromium browser (required for camera/mic on localhost)
- A Gemini API key → get one free at [aistudio.google.com](https://aistudio.google.com/)

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/somestyle/recykle-app.git
cd recykle-app

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Open .env.local and add your key:
#   GEMINI_API_KEY=your_key_here

# 4. Start the dev server
npm run dev

# 5. Open in Chrome (must be a real browser tab, not an embedded iframe)
#    Camera and microphone require either localhost or HTTPS
open http://localhost:3000
```

### Using the app
1. Enter your postal code (try `L3R 2A1` for Markham, `M5V 3A9` for Toronto, or `94102` for San Francisco)
2. Tap **Start Session** — Recykle opens a Gemini Live connection
3. Point your camera at any item and ask naturally: *"What is this?"* or *"What do I do with this?"*
4. Recykle responds with voice + a result card showing disposal category and tip
5. Tap **History** to review all past scans

---

## Cloud Run Deployment

### Prerequisites
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (`gcloud` CLI)
- A GCP project with billing enabled
- The `deploy.sh` script enables all required APIs automatically:
  - `run.googleapis.com`
  - `artifactregistry.googleapis.com`
  - `cloudbuild.googleapis.com`
  - `aiplatform.googleapis.com`

### Deploy

```bash
# Authenticate and set project
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Deploy (builds Docker image via Cloud Build, deploys to Cloud Run)
export GEMINI_API_KEY=your_key_here
./deploy.sh YOUR_PROJECT_ID us-central1

# Output: a public HTTPS URL like https://recykle-xxxxx-uc.a.run.app
```

The deploy script:
1. Enables all required Google Cloud APIs
2. Creates an Artifact Registry Docker repository (`recykle`) if it does not exist
3. Builds the container image via Cloud Build and pushes to Artifact Registry
4. Deploys to Cloud Run with 512 Mi RAM, 1 CPU, auto-scaling 0 to 10 instances
5. Sets `GEMINI_API_KEY` and `GEMINI_MODEL` as environment variables

### Cloud Run notes
- Minimum instances: 0 (cold starts ~3s on first request)
- WebSocket connections are supported on Cloud Run (HTTP/2 upgrade)
- The app uses a custom Node.js server (`server.js`) — not Next.js standalone static export

---

## How It Works

### Real-time multimodal loop
1. Browser captures microphone audio via **AudioWorklet** at 16 kHz, encodes as PCM16, sends to server via WebSocket
2. Browser captures camera frames via **Canvas** at 1 fps, encodes as JPEG, sends to server via WebSocket
3. Server proxies both streams to **Gemini Live API** via `ai.live.connect()`
4. Gemini processes audio + video simultaneously with the city's recycling rules injected into its system prompt
5. Gemini returns a spoken audio response + a structured `<disposal_data>` JSON block in the text stream
6. Server forwards audio chunks to browser for real-time playback, and parses the disposal JSON for the result card

### Interruption handling
Because this uses the Gemini Live API (not a turn-based API), the user can speak mid-response and Recykle adapts immediately. This is the key differentiator from standard chat-style AI.

### City-specific grounding
Recycling rules for each city are stored as JSON in `lib/recycling-rules/`. The full rules object is injected into the Gemini system prompt at session start, ensuring all disposal decisions are grounded in the actual municipal guidelines — not hallucinated.

---

## Project Structure

```
recykle-app/
├── server.js                     # Custom Node.js server: WebSocket proxy + Gemini Live integration
├── app/
│   ├── page.tsx                  # Root screen router (setup → scanner → history)
│   ├── layout.tsx                # Metadata, viewport
│   ├── globals.css               # Design tokens, animations
│   └── api/recycling-rules/      # API route to serve city rules
├── components/
│   ├── LiveScanner.tsx           # Main camera + voice UI
│   ├── LocationSetup.tsx         # Postal code entry and city resolution
│   ├── ResultCard.tsx            # Disposal result overlay
│   └── HistoryList.tsx           # Past scans with filter tabs
├── lib/
│   ├── gemini-live-client.ts     # Browser WebSocket client class
│   ├── types.ts                  # Shared types + postal code → city resolution
│   ├── history.ts                # localStorage scan history CRUD
│   └── recycling-rules/
│       ├── markham.json
│       ├── toronto.json
│       └── san-francisco.json
├── public/
│   └── audio-processor.js        # AudioWorklet: mic capture → PCM16 at 16 kHz
├── Dockerfile                    # Multi-stage build for Cloud Run
└── deploy.sh                     # One-command Cloud Run deployment
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes | — | Gemini API key from [aistudio.google.com](https://aistudio.google.com/) |
| `GEMINI_MODEL` | No | `gemini-live-2.5-flash-native-audio` | Gemini model to use |
| `PORT` | No | `3000` (dev) / `8080` (Cloud Run) | Server port |

---

## Findings & Learnings

### What worked well
- **Gemini Live API** handles simultaneous audio + video streams with almost no latency. The real-time feel is genuinely impressive to demo live.
- Injecting city recycling rules directly into the system prompt is a simple, effective way to ground the AI without a vector database or RAG pipeline.
- The AudioWorklet + custom WebSocket proxy architecture keeps the API key server-side while still enabling real-time bidirectional streaming.
- Interruption handling is built into the Live API. No custom logic needed to handle users speaking mid-response.
- Using Gemini function calling (`record_disposal` tool) instead of XML text parsing gives reliable structured output regardless of transcription order.

### Challenges
- The `@google/genai` SDK for Live API was evolving rapidly during development. Call signatures changed between minor versions.
- AudioWorklet downsampling from the browser's native sample rate (48 kHz) to Gemini's required 16 kHz required careful linear interpolation to avoid artifacts.
- WebSocket upgrade handling in Next.js required a custom `server.js`. The standard Next.js server does not support WebSocket upgrades out of the box.
- Black plastic container disposal is a genuinely surprising result for most people. That moment is the strongest part of the demo.

### If we had more time
- Add Vertex AI API endpoint instead of AI Studio key for production use
- Barcode scanning to look up product-specific recycling data
- Expand to 10+ cities with a proper rules database
- Native iOS/Android app (camera + mic access is much smoother in native)
- Voice Activity Detection (VAD) visual feedback

---

## Hackathon Requirements Checklist

Built for the **[Gemini Live Agent Challenge](https://geminiliveagentchallenge.devpost.com/)** — Devpost hackathon, March 2026.

| Requirement | Status | Detail |
|---|---|---|
| Gemini 2.5 series model | ✅ | `gemini-live-2.5-flash-native-audio` |
| Google GenAI SDK | ✅ | `@google/genai` v1.45+, initialized with `apiVersion: 'v1beta1'` |
| Google Cloud Run deployment | ✅ | Managed serverless container, auto-scales 0 to 10 instances |
| Real-time audio via Live API | ✅ | AudioWorklet at 16 kHz PCM16, bidirectional streaming |
| Real-time vision via Live API | ✅ | Camera JPEG frames at 1 fps, simultaneous with audio |
| Automated deployment script | ✅ | `deploy.sh` enables APIs, creates Artifact Registry repo, builds and deploys |
| Architecture diagram | ✅ | `architecture.png` + `ARCHITECTURE.md` with Mermaid sequence diagram |
| Public GitHub repository | ✅ | github.com/somestyle/recykle-app |

### Hackathon Submission Details

- **Category:** Live Agents
- **Event:** [Gemini Live Agent Challenge — Devpost](https://geminiliveagentchallenge.devpost.com/)
- **Deadline:** March 16, 2026

---

## License

MIT
