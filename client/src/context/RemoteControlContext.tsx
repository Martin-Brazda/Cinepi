import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type RemoteState = {
  connected: boolean;
  pairCode: string | null;
  pairUrl: string | null;
};

const RemoteContext = createContext<RemoteState>({ connected: false, pairCode: null, pairUrl: null });

function emitKey(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

export const RemoteControlProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [pairUrl, setPairUrl] = useState<string | null>(null);

  useEffect(() => {
    const host = window.location.hostname || 'localhost';
    const url = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${host}:8099/ws?role=tv`;
    const ws = new WebSocket(url);
    setPairUrl(`http://${host}:8099`);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg?.type === 'paired' && msg.code) setPairCode(String(msg.code));
        if (msg?.type === 'command') {
          const command = String(msg.command || '');
          if (command === 'up') emitKey('ArrowUp');
          if (command === 'down') emitKey('ArrowDown');
          if (command === 'left') emitKey('ArrowLeft');
          if (command === 'right') emitKey('ArrowRight');
          if (command === 'select') emitKey('Enter');
          if (command === 'back') emitKey('Escape');
          if (command === 'playpause') emitKey(' ');
          if (command === 'backspace') window.dispatchEvent(new CustomEvent('cinepi-remote-search-backspace'));
          if (command === 'clear_search') window.dispatchEvent(new CustomEvent('cinepi-remote-search-clear'));
          if (command === 'run_search') window.dispatchEvent(new CustomEvent('cinepi-remote-search-run'));
          if (command === 'type_text' && typeof msg.text === 'string') {
            window.dispatchEvent(new CustomEvent('cinepi-remote-search-text', { detail: msg.text }));
          }
        }
      } catch {
        // ignore malformed payload
      }
    };

    const sendStatus = (evt: Event) => {
      const detail = (evt as CustomEvent<any>).detail;
      if (!detail || ws.readyState !== ws.OPEN) return;
      ws.send(JSON.stringify({ type: 'tv_status', status: detail }));
    };
    window.addEventListener('cinepi-tv-status', sendStatus as EventListener);

    return () => {
      window.removeEventListener('cinepi-tv-status', sendStatus as EventListener);
      ws.close();
    };
  }, []);

  const value = useMemo(() => ({ connected, pairCode, pairUrl }), [connected, pairCode, pairUrl]);
  return <RemoteContext.Provider value={value}>{children}</RemoteContext.Provider>;
};

export const useRemoteControl = () => useContext(RemoteContext);
