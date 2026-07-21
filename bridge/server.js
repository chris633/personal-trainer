// Local coach bridge. Runs on Chris's Mac, talks to Claude via the Max subscription.
// Streams chat replies; keeps per-user memory. Workouts never depend on this being up.
const http = require('node:http');
const { askStream, MODEL } = require('./claude');
const mem = require('./memory');

const PORT = Number(process.env.PORT || 8787);
const TOKEN = process.env.BRIDGE_TOKEN || '';
const ALLOWED = (process.env.ALLOWED_ORIGINS
  || 'https://trainer.azurecarson.com,http://localhost:4173,http://localhost:8000')
  .split(',').map((s) => s.trim()).filter(Boolean);

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || '';
const VALID_TAGS = ['warmup', 'upper', 'lower', 'glutes', 'fullbody', 'core', 'ride', 'cardio', 'walk', 'hiit', 'stretch', 'recovery'];

const PROGRAM_OVERVIEW =
  'Caryn current block is 4 weeks, training Mon/Wed/Fri 6:30-7:15am on Peloton. '
  + 'Structure: Mondays upper body plus glutes, Wednesdays lower body, Fridays full body, '
  + 'with recurring Glutes & Legs strength (often Selena Samuela) and short cardio or stretch finishers.';

function coachSystem(m) {
  return [
    `You are ${m.name}'s personal training coach, texting with them inside a workout app.`,
    `About ${m.name}: ${m.goals}`,
    m.notes.length
      ? `Things you remember about ${m.name}:\n${m.notes.map((n) => '- ' + n.text).join('\n')}`
      : `You have no saved notes about ${m.name} yet.`,
    `Program: ${PROGRAM_OVERVIEW}`,
    `How you talk: warm, ${m.tone}, and concise. Chat replies are 2 to 4 short sentences; `
      + 'encouragement is 1 to 2. Be specific and practical, and value consistency over intensity. '
      + 'If they mention pain or injury, be supportive and suggest seeing a professional rather than giving medical advice. '
      + 'Write in plain sentences. IMPORTANT: never use an em-dash or en-dash. Use commas, periods, or parentheses instead.',
    `Write only your message to ${m.name}. Do not restate these instructions, do not describe your own tone or `
      + 'formatting, and do not mention being an AI or a chat. Just reply naturally as their coach.',
  ].join('\n\n');
}

// Safety net: the user never wants em/en-dashes, so strip them no matter what the model does.
function deDash(s) {
  return String(s).replace(/\s*—\s*/g, ', ').replace(/–/g, '-');
}

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}
function setCors(req, res) {
  // Behind Cloudflare Access, Access injects the CORS headers itself. Emitting our own
  // would duplicate Access-Control-Allow-Origin and the browser would reject the response.
  // So only set CORS for direct (local) calls that did NOT come through Access.
  if (req.headers['cf-access-jwt-assertion']) return;
  const origin = req.headers.origin;
  if (origin && ALLOWED.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-bridge-token');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
}
function authed(req) {
  if (!TOKEN) return true;
  const h = req.headers['authorization'] || '';
  const t = req.headers['x-bridge-token'] || (h.startsWith('Bearer ') ? h.slice(7) : '');
  return t === TOKEN;
}
function readBody(req) {
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } });
  });
}
function transcript(user) {
  const c = mem.getChat(user).slice(-10);
  if (!c.length) return '';
  return 'Recent conversation:\n'
    + c.map((t) => `${t.role === 'user' ? 'Them' : 'Coach'}: ${t.content}`).join('\n')
    + '\n\n';
}

// After a chat exchange, quietly extract durable facts to remember (per user, non-blocking).
async function extractMemory(user, userMsg, coachMsg) {
  try {
    const m = mem.getMemory(user);
    const out = await askStream({
      system: 'You extract facts a fitness coach should remember about a client. You reply with only a JSON array of short strings.',
      prompt: `Already known about ${m.name} (do not repeat):\n${m.notes.map((n) => '- ' + n.text).join('\n') || '(none)'}\n\n`
        + 'From this client message, list every NEW concrete personal fact the coach should remember long term: '
        + 'injuries or body areas that bother them, exercise or class likes and dislikes, equipment, schedule '
        + 'constraints, goals, milestones, life context. Include only facts the client actually states, and skip '
        + 'anything already known. Reply with a JSON array of short strings (use [] only if there are genuinely no new facts).\n\n'
        + `Client message: "${userMsg}"`,
    });
    const arr = JSON.parse((out.match(/\[[\s\S]*\]/) || ['[]'])[0]);
    if (Array.isArray(arr)) mem.addNotes(user, arr.filter((x) => typeof x === 'string'));
  } catch (e) {
    console.warn('memory extract failed:', e.message);
  }
}

// Write a plan override (a changed/added/rest day) to Supabase. App reads these and merges them.
async function upsertOverride(user, date, session) {
  if (!SUPABASE_URL || !SUPABASE_ANON) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/plan_overrides?on_conflict=user_id,date`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON,
      Authorization: 'Bearer ' + SUPABASE_ANON,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({ user_id: user, date, session, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) console.warn('override upsert failed', res.status, await res.text().catch(() => ''));
}

// After a chat exchange, detect and apply any schedule change the client asked for.
async function applyPlanEdits(user, message, reply, plan, today) {
  if (!SUPABASE_URL) return [];
  try {
    const out = await askStream({
      system: 'You turn a client\'s request into structured edits to their workout schedule. '
        + 'You reply with only a JSON object, no prose.',
      prompt: `Today is ${today}. The client\'s current plan (JSON array of upcoming sessions):\n`
        + `${JSON.stringify(plan || [])}\n\n`
        + `The client said: "${message}"\nThe coach replied: "${reply}"\n\n`
        + 'If the client asked to CHANGE, ADD, REMOVE, MOVE, make easier/harder, or swap any workout, output the edits. '
        + 'Output ONLY this JSON shape: {"edits":[ ... ]}. Each edit is EITHER a full replacement session for a date:\n'
        + '{"date":"YYYY-MM-DD","focus":"Lower Body","window":"6:30-7:15 AM","blocks":['
        + '{"time":"6:30","title":"Lower Body Strength","detail":"Rebecca Kennedy. 20 min.","minutes":20,"tag":"lower"}]}\n'
        + 'OR a rest day: {"date":"YYYY-MM-DD","rest":true}.\n'
        + `Valid tags: ${VALID_TAGS.join(', ')}. When editing a date, include the FULL set of blocks you want that day to have. `
        + 'For any block you are keeping, copy its exact time, title, detail, minutes, and tag from the current plan. '
        + 'Only include dates that actually change. If nothing about the schedule changed, output {"edits":[]}.',
    });
    const parsed = JSON.parse((out.match(/\{[\s\S]*\}/) || ['{"edits":[]}'])[0]);
    const edits = Array.isArray(parsed.edits) ? parsed.edits : [];
    for (const e of edits) {
      if (!e || !/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')) continue;
      let session;
      if (e.rest) {
        session = { rest: true };
      } else {
        session = {
          focus: String(e.focus || 'Workout').slice(0, 60),
          window: String(e.window || '6:30-7:15 AM'),
          blocks: (Array.isArray(e.blocks) ? e.blocks : []).slice(0, 8).map((b, i) => ({
            id: `${e.date}-o${i}`,
            time: String(b.time || ''),
            title: String(b.title || 'Workout'),
            detail: String(b.detail || ''),
            minutes: Number(b.minutes) || 0,
            tag: VALID_TAGS.includes(b.tag) ? b.tag : 'fullbody',
          })),
          source: 'coach',
        };
      }
      await upsertOverride(user, e.date, session);
      console.log('[plan] override saved for', user, e.date, e.rest ? '(rest)' : `(${session.focus})`);
    }
    return edits;
  } catch (e) {
    console.warn('plan edit failed:', e.message);
    return [];
  }
}

const server = http.createServer(async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, 'http://x');
  // Works whether mounted at the root or behind a /coach path prefix.
  const pathname = url.pathname.replace(/^\/coach(?=\/|$)/, '') || '/';

  if (req.method === 'GET' && pathname === '/health') {
    return send(res, 200, { ok: true, model: MODEL });
  }
  if (!authed(req)) return send(res, 401, { error: 'unauthorized' });

  try {
    if (req.method === 'POST' && pathname === '/chat') {
      const { user = 'caryn', message = '', context = {} } = await readBody(req);
      if (!String(message).trim()) return send(res, 400, { error: 'empty message' });
      const m = mem.getMemory(user);
      const prompt = `${transcript(user)}Them just said: ${message}\n\nRespond as their coach.`;
      // Stream plain text back to the browser as tokens arrive.
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
      let full = '';
      try {
        full = await askStream({ system: coachSystem(m), prompt, onDelta: (t) => res.write(deDash(t)) });
      } catch (e) {
        console.error('chat error:', e.message);
      }
      res.end();
      if (full) {
        const clean = deDash(full);
        mem.appendChat(user, 'user', message);
        mem.appendChat(user, 'coach', clean);
        extractMemory(user, message, clean); // fire and forget
        applyPlanEdits(user, message, clean, context.plan, context.today); // fire and forget
      }
      return;
    }

    if (req.method === 'POST' && pathname === '/feedback') {
      const { user = 'caryn', session = {}, streak = 0 } = await readBody(req);
      const m = mem.getMemory(user);
      const prompt = `They just finished today's workout: ${session.focus || 'their session'} (${session.day || ''}). `
        + `Current streak: ${streak}. Write one or two warm sentences celebrating them and nudging consistency. `
        + 'Make it personal using what you know about them, not generic.';
      const message = deDash(await askStream({ system: coachSystem(m), prompt }));
      return send(res, 200, { message });
    }

    return send(res, 404, { error: 'not found' });
  } catch (e) {
    console.error('bridge error:', e.message);
    return send(res, 500, { error: 'coach unavailable' });
  }
});

server.listen(PORT, () => console.log(`Coach bridge on http://localhost:${PORT} (model ${MODEL})`));
