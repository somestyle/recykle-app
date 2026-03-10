# CLAUDE.md

## Project Name

Recykle

## Hackathon

Gemini Live Agent Challenge — Devpost
Deadline: March 16, 2026
Category: Live Agents 🗣️

---

## Project Summary

Recykle is a real-time AI recycling assistant that helps users correctly dispose of waste using their phone camera, their voice, and local recycling regulations.

Users point their phone camera at any item — a bottle, takeout container, cardboard box, battery — and simply ask out loud: "What do I do with this?" The Gemini Live API processes both the audio and the camera feed simultaneously, then responds with a spoken answer and on-screen disposal instructions.

Recykle knows your city's recycling rules, speaks back clearly, and saves your scan history so you can reference it later for special disposal items like hazardous waste or bulky items.

This is a hackathon MVP. Keep it simple, demoable in under 3 minutes, and focused on a compelling live AI experience.

---

## Why This Fits the Hackathon

- Uses **Gemini Live API** with real-time audio + vision (mandatory for Live Agents category)
- Hosted on **Google Cloud Run** (mandatory Google Cloud requirement)
- Built with **Google GenAI SDK** (mandatory SDK requirement)
- Multimodal: voice input + camera input + voice output + visual result card
- Has a distinct AI persona ("Recykle") with eco-friendly tone
- Solves a real problem with immediate, everyday relevance
- Demos in under 3 minutes with a clear before/after story

---

## Product Goals

1. Demonstrate real-time AI reasoning using Gemini Live API (audio + vision simultaneously)
2. Show context-aware disposal decisions based on municipal recycling rules
3. Provide clear, spoken disposal guidance to reduce recycling mistakes
4. Deliver a compelling demo that judges immediately understand and find impressive
5. Showcase an AI companion that helps people make environmentally responsible decisions

---

## Target Users

Primary users are everyday residents who are unsure how to dispose of waste properly.

Examples:
- Households sorting takeout waste after a meal
- Residents unsure about local recycling rules
- People disposing of unusual items such as electronics, paint, or furniture
- Environmentally conscious users trying to reduce landfill contributions

---

## AI Persona

Name: Recykle
Voice: Warm, friendly, knowledgeable. Like a helpful neighbor who knows everything about recycling.
Tone: Encouraging, never judgmental. Always gives actionable next steps.
Personality: Eco-conscious but not preachy. Quick and direct with answers.

Example personality in responses:
- "Great news — that one's recyclable! Just give it a quick rinse first."
- "That one's tricky. Black plastic isn't accepted in most blue boxes — this one goes in the garbage."
- "That's actually hazardous waste. Don't toss it — I'll show you the nearest drop-off."

The persona must be defined in the Gemini system prompt.

---

## Core Use Case

A user finishes a takeout meal and wants to dispose of items properly.

They open Recykle. The camera activates. They hold up a black plastic container and say:

"What about this?"

Recykle responds (voice + screen):

"That's a black plastic container. Unfortunately those aren't accepted in Markham recycling — the sorting machines can't detect the color. That one goes in the garbage. Just make sure it's empty first."

---

## Core Features

### 1. Location Setup

When the user first opens Recykle, they enter their postal code.

Example input:
```
L3R 2A1
```

The system resolves this to a municipality.

Example output:
```
City: Markham
Province: Ontario
Country: Canada
```

The resolved city determines which recycling rules apply throughout the session.

MVP supports three cities only:
- Markham, Ontario
- Toronto, Ontario
- San Francisco, California

This keeps the dataset small while demonstrating the concept across two countries.

---

### 2. Live Camera + Voice Interface (PRIMARY FEATURE)

This is the core interaction. It must use the Gemini Live API.

The interface shows:
- Live camera preview (full screen or large frame)
- Microphone status indicator (listening / speaking)
- Minimal UI — do not clutter the screen

How it works:
1. User taps "Start Session" to open a Live API connection
2. The camera feed streams to Gemini continuously
3. The microphone listens for the user's voice
4. When the user speaks, Gemini processes both audio and camera frame simultaneously
5. Gemini returns a spoken response AND structured disposal data
6. The UI displays a result card while the voice plays

This is NOT a tap-to-scan button flow. It is a continuous, interruptible conversation.
The user can speak again mid-response and Recykle will adapt. This demonstrates Live API's
interruption handling capability, which judges will recognize as technically impressive.

---

### 3. AI Object Recognition + Disposal Reasoning

Gemini analyzes the camera frame and the user's spoken question together.

Gemini system prompt must include:
- The user's city and its recycling rules (injected as context)
- Recykle's persona instructions
- Output format requirements

Gemini should return:
- Item name (e.g., "black plastic clamshell container")
- Material type (e.g., "plastic — polypropylene")
- Disposal category (Recycling / Garbage / Compost / Depot Drop-off / Bulk Item)
- Short spoken explanation (2–3 sentences, conversational)
- Preparation tip if applicable (e.g., "rinse before recycling")

Disposal categories:
- **Recycling** — blue box / curbside recycling
- **Garbage** — black bin / landfill
- **Compost** — green bin / organic waste
- **Depot Drop-off** — requires trip to recycling facility
- **Bulk Item** — requires special municipal pickup

---

### 4. Result Card

After each scan, display a card overlay on screen showing:

```
Item:        Black Plastic Container
Category:    Garbage  🗑️
City:        Markham

Explanation:
Black plastic isn't detectable by sorting machines
and is not accepted in Markham recycling.

Tip: Empty the container before disposing.
```

The card appears while the voice response plays.
User can dismiss the card to continue scanning.

---

### 5. Disposal History

Each scan is automatically saved to local history.

History entry contains:
- Image thumbnail (captured frame)
- Item name
- Disposal category
- Short instruction
- Timestamp
- City used for rules

History screen shows a scrollable list of past scans.
Users can tap any entry to review full disposal instructions.

This is especially useful for Depot Drop-off items that require a later trip.

---

### 6. Optional Feature: Multi-Item Table Scan

User places several items on a table and says: "Sort all of these for me."

Gemini identifies multiple objects in the scene and groups them by disposal category.

Example output:

```
♻️ Recycling
  • Aluminum can
  • Cardboard box

🗑️ Garbage
  • Black plastic wrapper
  • Styrofoam cup

🌱 Compost
  • Napkin
```

For MVP, detecting 2–4 objects correctly is sufficient to impress judges.

---

## Recycling Rules Data Model

Rules are stored in a local JSON file loaded at session start based on city.

```json
{
  "city": "Markham",
  "province": "Ontario",
  "country": "Canada",
  "rules": {
    "recycling": [
      "aluminum can",
      "steel can",
      "plastic bottle",
      "plastic container (clear)",
      "glass bottle",
      "glass jar",
      "cardboard",
      "newspaper",
      "paper bag",
      "milk carton"
    ],
    "garbage": [
      "black plastic container",
      "plastic film",
      "plastic wrap",
      "styrofoam",
      "chip bag",
      "coffee cup"
    ],
    "compost": [
      "food waste",
      "fruit",
      "vegetable",
      "napkin",
      "paper towel",
      "coffee grounds",
      "egg shell"
    ],
    "depot": [
      "paint can",
      "battery",
      "electronics",
      "light bulb",
      "motor oil",
      "propane tank",
      "medications"
    ],
    "bulk": [
      "furniture",
      "mattress",
      "appliance",
      "bicycle"
    ]
  }
}
```

Include separate JSON files for Toronto and San Francisco.

The full rules JSON for all three cities is injected into the Gemini system prompt
at the start of each session. This gives the AI grounded, accurate rules to reason from.

---

## Technical Architecture

### Frontend

Stack:
- **Next.js** with App Router
- **React**
- **Tailwind CSS**

Key components:
- `LocationSetup` — postal code entry and city resolution
- `LiveScanner` — camera preview + Live API session manager + microphone
- `ResultCard` — disposal result overlay
- `HistoryList` — past scans list

The app must be mobile-first. Most users will demo this on a phone.

### Backend

Minimal backend using Next.js API routes.

Responsibilities:
- Proxy Gemini Live API calls (keeps API key server-side)
- Serve recycling rules JSON by city
- Store scan history (local storage for MVP, optional: SQLite or Firestore)

### AI Integration

Primary: **Gemini Live API** via Google GenAI SDK
- Handles simultaneous audio + video streaming
- Returns audio response + structured text
- Supports real-time interruption

System prompt structure:
```
You are Recykle, a friendly AI recycling assistant.
The user is in [CITY]. Here are the recycling rules for [CITY]:
[RULES_JSON]

When the user asks about an item:
1. Identify the item from the camera
2. Determine the correct disposal category
3. Give a short, friendly spoken response (2-3 sentences)
4. Return structured JSON with: item, material, category, explanation, tip

Always be encouraging and never judgmental.
If you are unsure about an item, say so and suggest the user check their municipality's website.
```

### Deployment

Host on **Google Cloud Run**.

This is required by the hackathon. Google Cloud Run is a managed service — you deploy a
Docker container and Google handles everything else. No server management needed.

Steps for deployment:
1. Write a `Dockerfile` for the Next.js app
2. Deploy to Cloud Run using `gcloud run deploy`
3. The app gets a public HTTPS URL automatically

The deployment must be included in the GitHub repo as either:
- A `deploy.sh` script, OR
- GitHub Actions workflow that auto-deploys on push

This satisfies the "automated deployment" bonus point requirement.

---

## UX Flow

```
Screen 1: Location Setup
  → User enters postal code
  → System resolves to city
  → "Welcome to Recykle — rules loaded for Markham"

Screen 2: Live Scanner (main screen)
  → Camera preview
  → "Listening..." indicator
  → User speaks naturally
  → Result card overlays on response

Screen 3: Result Card
  → Item identified
  → Disposal category + icon
  → Explanation + tip
  → "Continue scanning" button

Screen 4: History
  → Scrollable list of past scans
  → Tap to expand full instructions
```

---

## Demo Scenario for Video

The demo video must be under 4 minutes and show real software working.

Recommended demo script:

**Opening (30 seconds)**
"I just finished takeout and I have no idea what goes where. Let me show you Recykle."

**Setup (15 seconds)**
Enter postal code L3R 2A1 → city resolves to Markham → rules loaded.

**Scan 1 — Easy win (30 seconds)**
Hold up aluminum can.
Ask: "What about this?"
Recykle: "That's an aluminum can — definitely recyclable! Give it a rinse and toss it in the blue box."
→ Result card appears with green Recycling label.

**Scan 2 — Surprising result (30 seconds)**
Hold up black plastic container.
Ask: "And this one?"
Recykle: "That's black plastic — and here's the tricky part. Black plastic isn't detectable by recycling sorting machines, so Markham puts this in the garbage, not recycling."
→ Result card appears with red Garbage label.
→ This surprises the audience. This is the "aha" moment.

**Scan 3 — Special disposal (30 seconds)**
Hold up a battery.
Ask: "What do I do with this?"
Recykle: "Batteries are hazardous waste and can't go in any regular bin. You'll need to drop this off at a recycling depot. I'll save this one to your history so you don't forget."
→ Result card shows Depot Drop-off in orange.

**Optional: Interruption demo (30 seconds)**
Start asking about one item, then switch to another mid-sentence.
Recykle adapts without getting confused.
→ Shows Live API real-time capability.

**History (15 seconds)**
Open history tab. Show all three items saved.
"Everything is saved so I can remember to drop off that battery later."

**Close (30 seconds)**
"Recykle uses Gemini Live API, runs on Google Cloud, and helps people recycle correctly.
Small decisions add up. Let's make them easier."

---

## Required Submission Elements

Build these in order of priority:

1. **Working demo** — Gemini Live API + camera + voice
2. **Google Cloud Run deployment** — app live on a public URL
3. **Architecture diagram** — saved as `architecture.png` in repo root
4. **README.md** — with setup instructions, deployment steps, and demo walkthrough
5. **Demo video** — under 4 minutes, screen recording + narration
6. **Devpost text description** — summary, tech used, learnings

Bonus points:
- Automated deployment script in repo (`deploy.sh` or GitHub Actions)
- Blog post or LinkedIn article about building Recykle with Gemini

---

## MVP Scope Rules

This is a hackathon project. Build fast and demo well.

**Build:**
- Location setup (postal code → city)
- Live camera + voice interface using Gemini Live API
- Object recognition + disposal category result
- Result card with spoken + visual response
- History log (local storage is fine)
- Google Cloud Run deployment

**Do NOT build:**
- User accounts or authentication
- Global recycling database (3 cities only)
- Barcode scanning
- Native mobile app (responsive web is enough)
- Complex backend infrastructure
- Barcode or QR scanning

**If you are running short on time, cut in this order:**
1. Cut multi-item table scan
2. Cut history thumbnails (text only is fine)
3. Cut San Francisco (2 cities is enough)
4. Do NOT cut voice — voice is the demo

---

## Success Criteria

Recykle successfully demonstrates:

1. Gemini Live API handling real-time voice + camera input simultaneously
2. Correct, city-specific disposal guidance grounded in local rules
3. A friendly AI persona that feels natural to talk to
4. A clean, mobile-first interface judges can immediately understand
5. A compelling live demo that tells a clear story in under 4 minutes
6. A working deployment on Google Cloud

---

## Key Links

- Gemini Live API docs: https://ai.google.dev/gemini-api/docs/live
- Google GenAI SDK: https://ai.google.dev/gemini-api/docs/sdks
- Google Cloud Run: https://cloud.google.com/run
- ADK (Agent Development Kit): https://google.github.io/adk-docs/
- Hackathon page: https://geminiliveagentchallenge.devpost.com/

---

End of document.
