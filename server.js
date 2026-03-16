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

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-live-2.5-flash-native-audio';

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
2. Identify the specific item precisely (e.g. "black plastic clamshell container", not just "container")
3. Determine the correct disposal category based ONLY on ${city}'s rules above
4. IMMEDIATELY call record_disposal() with the structured data — do this BEFORE saying anything
5. THEN speak: 1-2 sentences ONLY, starting directly with the verdict

CRITICAL SPOKEN RESPONSE RULES:
- Start with the answer: "That's recyclable!" / "That goes in the garbage." / "That needs a depot drop-off."
- Maximum 2 sentences. Never more.
- NEVER begin with: "I'm analyzing..." / "I'm currently..." / "Based on..." / "Let me..." / "My research..."
- NEVER speak reasoning or analysis — only the verdict and one brief tip
- Do NOT use markdown formatting (no **bold**, no ## headers)
For Depot Drop-off or Bulk Item, mention the nearest drop-off location name in your 1-2 sentence response.

Valid category values: "Recycling", "Garbage", "Compost", "Depot Drop-off", "Bulk Item"

EXAMPLES of good spoken responses:
- "Great news — that aluminum can is recyclable! Give it a quick rinse and pop it in the blue box."
- "That's a black plastic container, and here's the tricky part — black plastic can't be detected by sorting machines, so it goes in the garbage in ${city}."
- "That's a battery and it's hazardous waste. Don't put it in any regular bin — you'll need to drop it off at a recycling depot. I've saved this to your notes so you remember."

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

// Resolve a depot/bulk drop-off address from recycling rules data
function resolveDepotAddress(item, category, rules) {
  if (!rules || !rules.depotLocations) return null;
  if (category !== 'Depot Drop-off' && category !== 'Bulk Item') return null;
  const itemLower = (item || '').toLowerCase();
  const locs = rules.depotLocations;
  let key = 'hazardous';
  if (itemLower.includes('battery') || itemLower.includes('batteries')) key = 'battery';
  else if (itemLower.includes('electronic') || itemLower.includes('laptop') || itemLower.includes('phone') || itemLower.includes('computer') || itemLower.includes('tablet') || itemLower.includes('tv') || itemLower.includes('monitor')) key = 'electronics';
  else if (category === 'Bulk Item' || itemLower.includes('furniture') || itemLower.includes('mattress') || itemLower.includes('appliance') || itemLower.includes('bicycle')) key = 'bulk';
  const candidates = locs[key] || locs.hazardous || [];
  return candidates[0] || null;
}

// Function calling tool definition for structured disposal data
const RECORD_DISPOSAL_TOOL = {
  functionDeclarations: [{
    name: 'record_disposal',
    description: 'Record the identified item and its correct disposal instructions. Call this every time you identify a waste item.',
    parameters: {
      type: 'OBJECT',
      properties: {
        item:        { type: 'STRING', description: 'Descriptive item name (e.g. "black plastic clamshell container")' },
        material:    { type: 'STRING', description: 'Material type (e.g. "polypropylene plastic")' },
        category:    { type: 'STRING', description: 'Disposal category: Recycling, Garbage, Compost, Depot Drop-off, or Bulk Item' },
        explanation: { type: 'STRING', description: 'One sentence explaining why this category applies in this city' },
        tip:         { type: 'STRING', description: 'One short preparation tip, or empty string if none needed' },
      },
      required: ['item', 'material', 'category', 'explanation'],
    },
  }],
};

async function handleGeminiWebSocket(ws) {
  let geminiSession = null;
  let isSetup = false;
  let textBuffer = '';
  let currentRules = null; // stored for depot address lookups in tool calls
  let disposalFiredThisTurn = false; // tracks if record_disposal was called this turn

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
    currentRules = rules;
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
            console.error('[Recykle] Gemini error:', JSON.stringify({ message: error.message, code: error.code, type: error.type }));
            sendToClient({ type: 'error', message: String(error.message || error) });
          },
          onclose(event) {
            console.log('[Recykle] Gemini session closed — code:', event?.code, 'reason:', event?.reason, 'wasClean:', event?.wasClean);
            sendToClient({ type: 'error', message: `Session closed (code ${event?.code}): ${event?.reason || 'unknown reason'}` });
          },
        },
        config: {
          // Native audio model only supports AUDIO modality — TEXT causes 1007.
          // We get transcription via outputAudioTranscription instead.
          responseModalities: ['AUDIO'],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          systemInstruction: systemPrompt,
          tools: [RECORD_DISPOSAL_TOOL],
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

  async function handleDisposalToolCall(call) {
    const args = call.args || {};
    const address = resolveDepotAddress(args.item, args.category, currentRules);
    const disposal = {
      item: args.item || 'Unknown item',
      material: args.material || 'Unknown material',
      category: args.category || 'Garbage',
      explanation: args.explanation || '',
      tip: args.tip || null,
      ...(address ? { address } : {}),
    };
    console.log(`[Recykle] Tool call: record_disposal — ${disposal.category}: ${disposal.item}`);
    disposalFiredThisTurn = true;  // ← ADD THIS
    sendToClient({ type: 'disposal', ...disposal });
    // Acknowledge the tool call back to Gemini
    try {
      await geminiSession.sendToolResponse({
        functionResponses: [{ id: call.id, name: call.name, response: { result: 'saved' } }],
      });
    } catch (err) {
      console.error('[Recykle] Error sending tool response:', err.message);
    }
  }

  function processGeminiMessage(message) {
    if (!message) return;

    // Setup confirmation
    if (message.setupComplete !== undefined) {
      console.log('[Recykle] Setup complete');
      return;
    }

    // Function calling — model wants to call record_disposal
    if (message.toolCall) {
      for (const call of message.toolCall.functionCalls || []) {
        if (call.name === 'record_disposal') {
          handleDisposalToolCall(call);
        }
      }
      return;
    }

    const content = message.serverContent;
    if (!content) return;

    // Handle interruption (VAD detected user speaking)
    if (content.interrupted) {
      textBuffer = '';
      disposalFiredThisTurn = false;
      sendToClient({ type: 'interrupted' });
      return;
    }

    // Handle model turn with parts (audio chunks)
    if (content.modelTurn && content.modelTurn.parts) {
      for (const part of content.modelTurn.parts) {
        // Audio response (native audio model returns audio here)
        if (part.inlineData) {
          const { mimeType, data } = part.inlineData;
          if (mimeType && mimeType.startsWith('audio/')) {
            sendToClient({ type: 'audio', data, mimeType });
          }
        }
        // Text parts (only if TEXT modality is enabled — not used with native audio)
        if (part.text) {
          textBuffer += part.text;
          sendToClient({ type: 'text', text: part.text, isResponse: disposalFiredThisTurn });
          const disposal = extractDisposalData(textBuffer);
          if (disposal) {
            sendToClient({ type: 'disposal', ...disposal });
            textBuffer = '';
          }
        }
      }
    }

    // Output transcription — from outputAudioTranscription config.
    // This gives us the text of what Gemini spoke, so we can parse <disposal_data>.
    if (content.outputTranscription) {
      const t = content.outputTranscription;
      if (t.text) {
        textBuffer += t.text;
        sendToClient({ type: 'text', text: t.text, isResponse: disposalFiredThisTurn });
        const disposal = extractDisposalData(textBuffer);
        if (disposal) {
          sendToClient({ type: 'disposal', ...disposal });
          textBuffer = '';
        }
      }
      if (t.finished) {
        // Transcription complete — final disposal data check
        if (textBuffer) {
          const disposal = extractDisposalData(textBuffer);
          if (disposal) {
            sendToClient({ type: 'disposal', ...disposal });
          }
          textBuffer = '';
        }
      }
    }

    // Input transcription — user speech (from inputAudioTranscription config)
    if (content.inputTranscription) {
      const t = content.inputTranscription;
      if (t.text) {
        sendToClient({ type: 'userTranscript', text: t.text, finished: false });
      }
      if (t.finished) {
        sendToClient({ type: 'userTranscript', text: '', finished: true });
      }
    }

    // Turn complete
    if (content.turnComplete) {
      if (textBuffer) {
        const disposal = extractDisposalData(textBuffer);
        if (disposal) {
          sendToClient({ type: 'disposal', ...disposal });
        }
        textBuffer = '';
      }
      disposalFiredThisTurn = false;
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
            // SDK v1.x: use `audio` field (not `media`) for PCM audio
            await geminiSession.sendRealtimeInput({
              audio: {
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
            // SDK v1.x: use `video` field (not `media`) for JPEG frames
            await geminiSession.sendRealtimeInput({
              video: {
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

      case 'clientText':
        // "Check This" button — send a text turn to Gemini to analyze current camera frame
        if (geminiSession && msg.text) {
          try {
            await geminiSession.sendClientContent({
              turns: [{ role: 'user', parts: [{ text: msg.text }] }],
              turnComplete: true,
            });
          } catch (err) {
            console.error('[Recykle] Error sending client text:', err.message);
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
