/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer, WebSocket } = require('ws');
const path = require('path');
const fs = require('fs');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ─── Gemini Live API integration ──────────────────────────────────────────────

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-live-001';

function loadRecyclingRules(cityKey) {
  const filePath = path.join(__dirname, 'lib', 'recycling-rules', `${cityKey}.json`);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[Recykle] Failed to load rules for ${cityKey}:`, err.message);
    return null;
  }
}

function buildSystemPrompt(city, province, country, rules) {
  const rulesText = rules ? JSON.stringify(rules, null, 2) : 'No specific rules found — use general recycling best practices.';

  return `You are Recykle, a warm and friendly AI recycling assistant. You help people correctly dispose of their waste items.

The user is located in ${city}, ${province}, ${country}.

Here are the official recycling rules for ${city}:
${rulesText}

YOUR PERSONALITY:
- Warm and encouraging, never judgmental
- Quick and direct — 2 to 3 sentences maximum for spoken responses
- Eco-conscious but not preachy
- Like a helpful neighbour who knows everything about recycling

INSTRUCTIONS:
When the user shows you an item through the camera or asks what to do with something:
1. Look carefully at what is visible in the camera feed
2. Identify the specific item (be precise — e.g. "black plastic clamshell container", not just "container")
3. Determine the correct disposal category based ONLY on ${city}'s specific rules above
4. Respond with a short, conversational spoken answer (2–3 sentences max)
5. After your spoken answer, output a structured data block formatted EXACTLY like this:

<disposal_data>
{
  "item": "descriptive item name",
  "material": "material type",
  "category": "Recycling",
  "explanation": "One sentence explaining why this category applies in ${city}.",
  "tip": "One short preparation tip, or null if none needed"
}
</disposal_data>

Valid category values: "Recycling", "Garbage", "Compost", "Depot Drop-off", "Bulk Item"

EXAMPLES of good spoken responses:
- "Great news — that aluminum can is recyclable! Give it a quick rinse and pop it in the blue box."
- "That's a black plastic container, and here's the tricky part — black plastic can't be detected by sorting machines, so it goes in the garbage in ${city}."
- "That's a battery and it's hazardous waste. Don't put it in any regular bin — you'll need to drop it off at a recycling depot. I'll save this to your history so you remember."

If you cannot clearly see the item, ask the user to hold it closer or at a better angle.
Always be encouraging. When unsure, err on the side of caution and suggest garbage or depot drop-off.`;
}

function extractDisposalData(text) {
  const match = text.match(/<disposal_data>\s*([\s\S]*?)\s*<\/disposal_data>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

async function handleGeminiWebSocket(ws) {
  let geminiSession = null;
  let isSetup = false;
  let textBuffer = '';

  function sendToClient(msg) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  async function setupGeminiSession(setupMsg) {
    const { GoogleGenAI } = require('@google/genai');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      sendToClient({ type: 'error', message: 'GEMINI_API_KEY not configured on server.' });
      return;
    }

    const rules = loadRecyclingRules(setupMsg.cityKey);
    const systemPrompt = buildSystemPrompt(
      setupMsg.city,
      setupMsg.province,
      setupMsg.country,
      rules
    );

    console.log(`[Recykle] Setting up Gemini session for ${setupMsg.city}`);

    const ai = new GoogleGenAI({ apiKey });

    try {
      geminiSession = await ai.live.connect({
        model: GEMINI_MODEL,
        callbacks: {
          onopen() {
            console.log('[Recykle] Gemini session opened');
            sendToClient({ type: 'ready' });
          },
          onmessage(message) {
            processGeminiMessage(message);
          },
          onerror(error) {
            console.error('[Recykle] Gemini error:', error);
            sendToClient({ type: 'error', message: String(error.message || error) });
          },
          onclose() {
            console.log('[Recykle] Gemini session closed');
          },
        },
        config: {
          responseModalities: ['AUDIO', 'TEXT'],
          systemInstruction: systemPrompt,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Aoede' },
            },
          },
        },
      });
    } catch (err) {
      console.error('[Recykle] Failed to connect to Gemini:', err);
      sendToClient({ type: 'error', message: `Failed to connect to Gemini: ${err.message}` });
    }
  }

  function processGeminiMessage(message) {
    if (!message) return;

    // Setup confirmation
    if (message.setupComplete !== undefined) {
      console.log('[Recykle] Setup complete');
      return;
    }

    const content = message.serverContent;
    if (!content) return;

    // Handle interruption (VAD detected user speaking)
    if (content.interrupted) {
      textBuffer = '';
      sendToClient({ type: 'interrupted' });
      return;
    }

    // Handle model turn with parts
    if (content.modelTurn?.parts) {
      for (const part of content.modelTurn.parts) {
        // Audio response
        if (part.inlineData) {
          const { mimeType, data } = part.inlineData;
          if (mimeType && mimeType.startsWith('audio/')) {
            sendToClient({ type: 'audio', data, mimeType });
          }
        }
        // Text response
        if (part.text) {
          textBuffer += part.text;
          sendToClient({ type: 'text', text: part.text });

          // Try to extract disposal data from accumulated text
          const disposal = extractDisposalData(textBuffer);
          if (disposal) {
            sendToClient({ type: 'disposal', ...disposal });
            textBuffer = ''; // Reset after extraction
          }
        }
      }
    }

    // Turn complete
    if (content.turnComplete) {
      // One final check for disposal data in the full buffer
      if (textBuffer) {
        const disposal = extractDisposalData(textBuffer);
        if (disposal) {
          sendToClient({ type: 'disposal', ...disposal });
        }
        textBuffer = '';
      }
      sendToClient({ type: 'turnComplete' });
    }
  }

  // ─── Handle messages from browser ─────────────────────────────────────────

  ws.on('message', async (rawData) => {
    let msg;
    try {
      msg = JSON.parse(rawData.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case 'setup':
        if (!isSetup) {
          isSetup = true;
          await setupGeminiSession(msg);
        }
        break;

      case 'audio':
        if (geminiSession && msg.data) {
          try {
            await geminiSession.sendRealtimeInput({
              media: {
                data: msg.data,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          } catch (err) {
            console.error('[Recykle] Error sending audio:', err.message);
          }
        }
        break;

      case 'video':
        if (geminiSession && msg.data) {
          try {
            await geminiSession.sendRealtimeInput({
              media: {
                data: msg.data,
                mimeType: 'image/jpeg',
              },
            });
          } catch (err) {
            console.error('[Recykle] Error sending video:', err.message);
          }
        }
        break;

      case 'audioEnd':
        // Signal end of audio turn — Gemini will respond
        if (geminiSession) {
          try {
            await geminiSession.sendRealtimeInput({ audioStreamEnd: true });
          } catch {
            // Some SDK versions don't support audioStreamEnd — ignore
          }
        }
        break;
    }
  });

  ws.on('close', () => {
    console.log('[Recykle] Browser disconnected');
    if (geminiSession) {
      try {
        geminiSession.close();
      } catch {
        // Ignore close errors
      }
      geminiSession = null;
    }
  });

  ws.on('error', (err) => {
    console.error('[Recykle] WebSocket error:', err.message);
  });

  // Notify browser that WebSocket is connected (Gemini session not yet ready)
  sendToClient({ type: 'connected' });
}

// ─── Boot the server ───────────────────────────────────────────────────────────

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  // Attach WebSocket server on the /ws/gemini path
  const wss = new WebSocketServer({ server, path: '/ws/gemini' });

  wss.on('connection', (ws, req) => {
    console.log(`[Recykle] New WebSocket connection from ${req.socket.remoteAddress}`);
    handleGeminiWebSocket(ws);
  });

  server.listen(port, hostname, () => {
    console.log(`[Recykle] Server ready on http://${hostname}:${port}`);
    console.log(`[Recykle] WebSocket proxy on ws://${hostname}:${port}/ws/gemini`);
    console.log(`[Recykle] Environment: ${dev ? 'development' : 'production'}`);
  });
});
