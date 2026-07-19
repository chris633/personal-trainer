// Thin wrapper around the local `claude` CLI (uses the Max subscription, no API key).
// Streams text tokens as they arrive.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const MODEL = process.env.COACH_MODEL || 'claude-sonnet-5';
const WORKDIR = path.join(__dirname, '.workdir');
fs.mkdirSync(WORKDIR, { recursive: true });

// Concurrent `claude` CLI invocations contend and can return empty, so serialize them.
// Only one claude process runs at a time; calls queue in order.
let chain = Promise.resolve();
function askStream(opts) {
  const run = () => _askStream(opts);
  const result = chain.then(run, run);
  chain = result.catch(() => {});
  return result;
}

// Streams Claude's reply. Calls onDelta(text) as tokens arrive; resolves with the full text.
function _askStream({ system, prompt, model = MODEL, onDelta }) {
  return new Promise((resolve, reject) => {
    const args = [
      '-p', prompt,
      '--output-format', 'stream-json',
      '--include-partial-messages',
      '--verbose',
      '--max-turns', '1',
      '--model', model,
      // Run lean: ignore the user's MCP servers so startup is fast and the coach stays text-only.
      '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
    ];
    if (system) args.push('--append-system-prompt', system);

    const env = { ...process.env, PATH: `${process.env.HOME}/.local/bin:${process.env.PATH || ''}` };
    const child = spawn(CLAUDE_BIN, args, { cwd: WORKDIR, env });

    let buf = '', full = '', stderr = '';
    child.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        let obj;
        try { obj = JSON.parse(line); } catch { continue; }
        if (obj.type === 'stream_event' && obj.event && obj.event.type === 'content_block_delta'
            && obj.event.delta && obj.event.delta.type === 'text_delta') {
          const t = obj.event.delta.text || '';
          if (t) { full += t; if (onDelta) onDelta(t); }
        }
      }
    });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (!full && code !== 0) return reject(new Error(`claude exited ${code}: ${stderr.slice(0, 400)}`));
      resolve(full.trim());
    });
  });
}

module.exports = { askStream, MODEL };
