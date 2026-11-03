import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PeerRecord {
  id: string;
  name: string;
  model: string;
  os: string;
  lastSeen: number;
  localIp?: string;
  port?: number;
}

interface SignalEnvelope {
  id: string;
  fromId: string;
  toId: string;
  type: 'CONNECT_REQUEST' | 'CONNECT_ACCEPT' | 'CONNECT_REJECT' | 'WEBRTC_SIGNAL' | 'TRANSFER_CANCEL';
  payload: any;
  timestamp: number;
}

// In-memory peer registry for local discovery signaling only (ZERO file payloads)
const activePeers = new Map<string, PeerRecord>();
const signalMailbox = new Map<string, SignalEnvelope[]>();

// Cleanup stale peers (evict after 10s of silence)
setInterval(() => {
  const now = Date.now();
  for (const [id, peer] of activePeers.entries()) {
    if (now - peer.lastSeen > 10000) {
      activePeers.delete(id);
      signalMailbox.delete(id);
    }
  }
}, 4000);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Strict payload limit: only lightweight signaling (SDP, ICE, Handshake).
  // Strictly NO file chunk transport through the server!
  app.use(express.json({ limit: '64kb' }));

  // 1. Peer Discovery: Heartbeat & Local Registration
  app.post('/api/discovery/heartbeat', (req, res) => {
    const { id, name, model, os, localIp, port } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing device id' });

    activePeers.set(id, {
      id,
      name: name || `KAYDO-${id.substring(0, 4)}`,
      model: model || 'Appareil',
      os: os || 'Android',
      lastSeen: Date.now(),
      localIp,
      port
    });

    res.json({ success: true });
  });

  // 2. Peer Discovery: Retrieve real active peers
  app.get('/api/discovery/peers', (req, res) => {
    const myId = req.query.myId as string;
    const now = Date.now();
    const result: PeerRecord[] = [];

    for (const [id, peer] of activePeers.entries()) {
      if (id !== myId && now - peer.lastSeen <= 10000) {
        result.push(peer);
      }
    }

    res.json({ peers: result });
  });

  // 3. Signaling Relay: Strictly for WebRTC SDP / ICE or Hotspot coordination
  // File data payloads are strictly rejected here.
  app.post('/api/signal/send', (req, res) => {
    const { fromId, toId, type, payload } = req.body;
    if (!toId || !type) return res.status(400).json({ error: 'Missing parameters' });

    // Block any attempt to send file chunks through the server
    if (type === 'FILE_CHUNK' || type === 'START_FILE' || type === 'FILE_COMPLETE') {
      return res.status(403).json({
        error: 'Interdit: Le transport de fichiers doit obligatoirement se faire en direct P2P (WebRTC ou Wi-Fi Direct/Socket local).'
      });
    }

    const envelope: SignalEnvelope = {
      id: `sig_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      fromId,
      toId,
      type,
      payload,
      timestamp: Date.now()
    };

    if (!signalMailbox.has(toId)) {
      signalMailbox.set(toId, []);
    }
    const q = signalMailbox.get(toId)!;
    q.push(envelope);

    if (q.length > 50) q.shift(); // Keep only recent signals

    res.json({ success: true, signalId: envelope.id });
  });

  // 4. Signaling Poll: Retrieve WebRTC / Handshake messages
  app.get('/api/signal/messages', (req, res) => {
    const myId = req.query.myId as string;
    if (!myId) return res.status(400).json({ error: 'Missing myId' });

    const messages = signalMailbox.get(myId) || [];
    signalMailbox.set(myId, []);

    res.json({ messages });
  });

  // Mount Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[KAYDO SHARE] Pure P2P Signaling & App Server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Server startup error:", err);
  process.exit(1);
});
