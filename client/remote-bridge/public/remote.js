let socket = null;
const statusEl = document.getElementById('status');
const codeEl = document.getElementById('code');
const connectBtn = document.getElementById('connect');
const searchTextEl = document.getElementById('searchText');
const sendTextBtn = document.getElementById('sendText');
const nowPlayingEl = document.getElementById('nowPlaying');

function setStatus(text) { statusEl.textContent = text; }

function sendCommand(command, text) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: 'command', command, text }));
}

connectBtn.addEventListener('click', () => {
  const code = (codeEl.value || '').trim();
  if (!code) return setStatus('Enter pair code shown on TV');
  if (socket) socket.close();
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  socket = new WebSocket(`${proto}://${location.host}/ws?role=mobile&code=${encodeURIComponent(code)}`);
  socket.onopen = () => setStatus(`Connected to ${code}`);
  socket.onclose = () => setStatus('Disconnected');
  socket.onerror = () => setStatus('Connection error');
  socket.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (msg?.type === 'tv_status' && msg.status) {
        const title = msg.status.title || 'Unknown';
        const progress = Number(msg.status.progress || 0);
        const isPlaying = !!msg.status.isPlaying;
        nowPlayingEl.querySelector('.np-title').textContent = title;
        nowPlayingEl.querySelector('.np-meta').textContent = `${progress}% • ${isPlaying ? 'Playing' : 'Paused'}`;
      }
    } catch {
      // ignore parse errors
    }
  };
});

document.querySelectorAll('button[data-cmd]').forEach((btn) => {
  btn.addEventListener('click', () => sendCommand(btn.getAttribute('data-cmd')));
});

sendTextBtn.addEventListener('click', () => {
  const text = (searchTextEl.value || '').trim();
  if (!text) return;
  sendCommand('type_text', text);
});

searchTextEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const text = (searchTextEl.value || '').trim();
    if (!text) return;
    sendCommand('type_text', text);
  }
});
