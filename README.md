# Recykle — AI Recycling Assistant

> Point your phone at any item and ask. Recykle tells you exactly what to do with it.

Recykle is a real-time AI recycling assistant that uses **Gemini Live API** to simultaneously process your voice and camera feed, then responds with spoken disposal guidance and an on-screen result card — all grounded in your city's actual recycling rules.

> ⚡ **Live app:** https://recykle-app-xegkworlaq-uc.a.run.app

Built for the **[Gemini Live Agent Challenge](https://geminiliveagentchallenge.devpost.com/)** — Devpost hackathon.

---

## The Problem & The Vision

Every day, well-meaning people make recycling mistakes — not out of carelessness, but out of genuine confusion. This behavior is known as **"wish-cycling"**: tossing something in the recycling bin and *hoping* it belongs there. Studies estimate this causes up to **25% contamination** in residential recycling streams, which means entire truckloads of recyclables are sent to landfill because a single wrong item ruins the batch.

The problem is not motivation — it's **cognitive burden**. Municipal recycling rules are complex, inconsistent across cities, and buried in PDFs nobody reads. Black plastic looks recyclable. Takeout containers feel like they should be compostable. Batteries seem harmless. The gap between intent and correct action costs us enormously.

**Recykle's vision is to eliminate that gap entirely.** Instead of asking people to remember rules, we give them a conversational AI companion that knows their city's actual guidelines and answers instantly — in plain speech, while they're holding the item. No searching, no guessing, no guilt. Just hold it up and ask.

This is what ambient intelligence should feel like: invisible help at the moment of decision, reducing friction so the right choice becomes the easy choice.

---

## Why This Is Different

| Feature | Standard chatbot | Recykle |
|---|---|---|
| Input | Text only | Live voice + camera simultaneously |
| Interruptions | Must wait for response | Speak anytime, AI adapts in real-time |
| Accuracy | General AI knowledge | Grounded in your city's actual municipal rules |
| Output | Text on screen | Spoken response + structured result card |

---

## 🎥 Demo Video

[Watch the Recykle Live Agent in Action](https://www.youtube.com/shorts/wE6vEf-5ekM)

> A 3-minute walkthrough showing live **Multimodal** input (voice + camera), real-time disposal decisions, **Barge-in** interruption handling, and the full scan history flow.

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

### Resilience & Error Handling

Recykle is built to degrade gracefully across a range of real-world edge cases:

| Scenario | How Recykle handles it |
|---|---|
| **Poor lighting** | Gemini processes the frame and responds with reduced confidence; the result card reflects uncertainty and prompts the user to improve framing |
| **Background noise** | AudioWorklet applies downsampling at 16 kHz; Gemini Live API's built-in VAD filters non-speech audio before processing |
| **Lost WebSocket connection** | Client detects close events and auto-reconnects with exponential backoff (up to 3 retries); session state is preserved across reconnects |
| **No item in frame** | System prompt instructs Recykle to ask the user to hold the item closer rather than guess or hallucinate a classification |
| **Unsupported city** | Resolves to the nearest supported municipality by province/state prefix; communicates the assumption to the user |
| **Gemini API error (1008 / overload)** | Server sends an `error` message to the client; UI displays a friendly recovery message and invites retry |

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

### ⚡ Interruption handling (key differentiator)
Unlike turn-based APIs, Gemini Live API allows the user to speak at any time — even mid-response. This capability is called **Barge-in**: the user interrupts Recykle's spoken answer and the AI adapts immediately — no custom interruption logic, no awkward silences, no queued responses to clear. This is what makes it feel like a real conversation, not a chatbot.

### Real-time **Multimodal** loop
1. Browser captures microphone audio via **AudioWorklet** at 16 kHz, encodes as PCM16, sends to server via WebSocket
2. Browser captures camera frames via **Canvas** at 1 fps, encodes as JPEG, sends to server via WebSocket
3. Server proxies both streams to **Gemini Live API** via `ai.live.connect()`
4. Gemini processes audio + video simultaneously with the city's recycling rules injected into its system prompt
5. Gemini returns a spoken audio response + a structured `<disposal_data>` JSON block in the text stream
6. Server forwards audio chunks to browser for real-time playback, and parses the disposal JSON for the result card

### City-specific grounding & hallucination prevention
Recycling rules for each city are stored as JSON in `lib/recycling-rules/`. The **full rules object is injected into the Gemini system prompt at session start**, before any user input is processed.

This is a deliberate architectural choice to **prevent AI hallucinations**. Without grounding, a general-purpose language model will answer recycling questions based on pre-trained knowledge — which may be outdated, region-agnostic, or simply incorrect. By forcing the agent to reason against the provided municipal JSON data, Recykle ensures that every disposal decision reflects what your city actually accepts today, not what a model learned during training. The system prompt explicitly instructs Gemini to treat the injected rules as authoritative and override any conflicting prior knowledge.

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

> **Note on Python files:** The Python files in this repo are utility/analysis scripts used during development (e.g. testing recycling rule parsing). The production app is entirely Node.js + TypeScript as described above.

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
- **Barge-in** / interruption handling is built into the Live API. No custom logic needed to handle users speaking mid-response.
- Using Gemini function calling (`record_disposal` tool) instead of XML text parsing gives reliable structured output regardless of transcription order.

### Challenges
- The `@google/genai` SDK for Live API was evolving rapidly during development. Call signatures changed between minor versions.
- AudioWorklet downsampling from the browser's native sample rate (48 kHz) to Gemini's required 16 kHz required careful linear interpolation to avoid artifacts.
- WebSocket upgrade handling in Next.js required a custom `server.js`. The standard Next.js server does not support WebSocket upgrades out of the box.
- Black plastic container disposal is a genuinely surprising result for most people. That moment is the strongest part of the demo.

### What's next
- Add Vertex AI API endpoint instead of AI Studio key for production use
- Barcode scanning to look up product-specific recycling data
- Expand to 10+ cities with a proper rules database
- Native iOS/Android app (camera + mic access is much smoother in native)
- Voice Activity Detection (VAD) visual feedback
- **IoT Smart Bin Integration** — connect Recykle to smart bins that auto-sort items based on the AI's disposal decision, closing the loop from guidance to action
- **Computer Vision Material Health Scores** — go beyond category labels and score the recyclability quality of a material (e.g. contamination level, resin type, degradation state) to help sorting facilities prioritize high-value streams

---

## Cloud Deployment

**Live URL:** https://recykle-app-xegkworlaq-uc.a.run.app

Deployed on Google Cloud Run (managed, serverless containers). The backend WebSocket server proxies audio and video streams to Gemini Live API in real-time.

To verify deployment, visit the live URL above or see `deploy.sh` for the one-command deployment script.

---

## Hackathon Requirements Checklist

Built for the **[Gemini Live Agent Challenge](https://geminiliveagentchallenge.devpost.com/)** — Devpost hackathon, March 2026.

| Requirement | Status | Detail |
|---|---|---|
| Gemini 2.5 series model | ✅ | `gemini-2.5-flash-native-audio-latest` |
| Google GenAI SDK | ✅ | `@google/genai` v1.45+ |
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

<!--
  REMINDER: Upload architecture.png as the Social Preview image for this repo.
  GitHub repo → Settings → (scroll to) Social Preview → Upload an image → select architecture.png
  This is what shows up when the repo link is shared on Twitter, LinkedIn, Devpost, etc.
-->
