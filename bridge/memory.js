// Per-user memory + chat history, stored as JSON files. Users never share memory.
const fs = require('node:fs');
const path = require('node:path');
const USERS = require('./users');

const DIR = path.join(__dirname, 'memory');
fs.mkdirSync(DIR, { recursive: true });

const memFile = (u) => path.join(DIR, `${safe(u)}.json`);
const chatFile = (u) => path.join(DIR, `${safe(u)}.chat.json`);
const safe = (u) => String(u).replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'unknown';

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getMemory(user) {
  let m = readJSON(memFile(user), null);
  if (!m) {
    const seed = USERS[user] || { name: user, goals: '', tone: 'warm and encouraging' };
    m = { user: safe(user), name: seed.name, goals: seed.goals, tone: seed.tone, notes: [] };
    writeJSON(memFile(user), m);
  }
  return m;
}

function addNotes(user, texts) {
  if (!texts || !texts.length) return;
  const m = getMemory(user);
  const now = new Date().toISOString();
  for (const raw of texts) {
    const text = String(raw).trim();
    if (text && !m.notes.some((n) => n.text.toLowerCase() === text.toLowerCase())) {
      m.notes.push({ at: now, text });
    }
  }
  m.notes = m.notes.slice(-60);
  writeJSON(memFile(user), m);
}

function getChat(user) { return readJSON(chatFile(user), []); }

function appendChat(user, role, content) {
  const c = getChat(user);
  c.push({ role, content, at: new Date().toISOString() });
  writeJSON(chatFile(user), c.slice(-40));
}

module.exports = { getMemory, addNotes, getChat, appendChat };
