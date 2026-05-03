import http from 'node:http';
import { randomInt } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, 'public');
const PORT = Number(process.env.REMOTE_BRIDGE_PORT || 8099);

const rooms = new Map(); // code -> { tv: ws|null, mobiles:Set<ws>, lastStatus:object|null }

function makeCode() {
  return String(randomInt(0, 10000)).padStart(4, '0');
}

function ensureRoom(code) {
  if (!rooms.has(code)) {
    rooms.set(code, { tv: null, mobiles: new Set(), lastStatus: null });
  }
  return rooms.get(code);
}

function safeSend(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  let file = 'index.html';
  if (url.pathname === '/remote.css') file = 'remote.css';
  if (url.pathname === '/remote.js') file = 'remote.js';

  try {
    const content = await readFile(resolve(publicDir, file));
    const type = file.endsWith('.css')
      ? 'text/css'
      : file.endsWith('.js')
      ? 'application/javascript'
      : 'text/html';
    res.writeHead(200, { 'content-type': type });
    res.end(content);
  } catch {
    res.writeHead(404).end('not found');
  }
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '/ws', `http://${req.headers.host}`);
  const role = url.searchParams.get('role');
  let code = url.searchParams.get('code') || '';

  if (role === 'tv') {
    if (!code) code = makeCode();
    const room = ensureRoom(code);
    if (room.tv && room.tv !== ws) room.tv.close();
    room.tv = ws;
    safeSend(ws, { type: 'paired', code });
  } else if (role === 'mobile') {
    if (!code) {
      safeSend(ws, { type: 'error', message: 'missing code' });
      ws.close();
      return;
    }
    const room = ensureRoom(code);
    room.mobiles.add(ws);
    safeSend(ws, { type: 'connected', code, hasTv: !!room.tv });
    if (room.lastStatus) safeSend(ws, { type: 'tv_status', status: room.lastStatus });
  } else {
    safeSend(ws, { type: 'error', message: 'invalid role' });
    ws.close();
    return;
  }

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const room = rooms.get(code);
    if (!room) return;

    if (role === 'mobile' && msg.type === 'command' && typeof msg.command === 'string') {
      if (room.tv) safeSend(room.tv, { type: 'command', command: msg.command, text: msg.text });
    }
    if (role === 'tv' && msg.type === 'tv_status' && msg.status && typeof msg.status === 'object') {
      room.lastStatus = msg.status;
      room.mobiles.forEach((m) => safeSend(m, { type: 'tv_status', status: room.lastStatus }));
    }
  });

  ws.on('close', () => {
    const room = rooms.get(code);
    if (!room) return;
    if (role === 'tv' && room.tv === ws) room.tv = null;
    if (role === 'mobile') room.mobiles.delete(ws);
    if (!room.tv && room.mobiles.size === 0) rooms.delete(code);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Remote bridge listening on http://0.0.0.0:${PORT}`);
});
