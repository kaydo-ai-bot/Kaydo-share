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
  rssi: number;
  avatarColor: string;
  lastSeen: number;
  roomId?: string;
}

interface SignalMessage {
  id: string;
  fromId: string;
  toId: string;
  type: string;
  payload: any;
  timestamp: number;
}

// In-memory registry of active devices & messages
const peers = new Map<string, PeerRecord>();
const messageQueue = new Map<string, SignalMessage[]>();

// Cleanup inactive peers every 10 seconds
setInterval(() => {
  const now = Date.now();
  for (const [id, peer] of peers.entries()) {
    if (now - peer.lastSeen > 12000) {
      peers.delete(id);
      messageQueue.delete(id);
    }
  }
}, 5000);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json({ limit: '100mb' }));

  // 1. Peer Discovery: Heartbeat & Announce
  app.post('/api/discovery/heartbeat', (req, res) => {
    const { id, name, model, os, avatarColor, roomId } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'Missing device id' });
    }

    peers.set(id, {
      id,
      name: name || `KAYDO-${id.substring(0, 4)}`,
      model: model || 'Appareil mobile',
      os: os || 'Android',
      rssi: -40 - Math.floor(Math.random() * 20),
      avatarColor: avatarColor || 'bg-blue-600',
      lastSeen: Date.now(),
      roomId
    });

    res.json({ success: true });
  });

  // 2. Peer Discovery: List other active devices
  app.get('/api/discovery/peers', (req, res) => {
    const myId = req.query.myId as string;
    const now = Date.now();
    const activePeers: PeerRecord[] = [];

    for (const [id, peer] of peers.entries()) {
      if (id !== myId && now - peer.lastSeen <= 12000) {
        activePeers.push(peer);
      }
    }

    res.json({ peers: activePeers });
  });

  // 3. Signaling: Send message to a target peer (e.g. connect request, pin verify, chunk, WebRTC SDP/ICE)
  app.post('/api/signal/send', (req, res) => {
    const { fromId, toId, type, payload } = req.body;
    if (!toId || !type) {
      return res.status(400).json({ error: 'Missing toId or type' });
    }

    const msg: SignalMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      fromId,
      toId,
      type,
      payload,
      timestamp: Date.now()
    };

    if (!messageQueue.has(toId)) {
      messageQueue.set(toId, []);
    }
    const q = messageQueue.get(toId)!;
    q.push(msg);

    // Keep max 200 items in queue
    if (q.length > 200) {
      q.splice(0, q.length - 200);
    }

    res.json({ success: true, messageId: msg.id });
  });

  // 4. Signaling: Poll messages for my device
  app.get('/api/signal/messages', (req, res) => {
    const myId = req.query.myId as string;
    if (!myId) {
      return res.status(400).json({ error: 'Missing myId' });
    }

    const messages = messageQueue.get(myId) || [];
    // Clear read messages
    messageQueue.set(myId, []);

    res.json({ messages });
  });

  // 5. Direct Chunk Relay: Guaranteed fallback transfer across different networks
  app.post('/api/signal/chunk', (req, res) => {
    const { toId, chunkMeta, chunkData } = req.body;
    if (!toId) {
      return res.status(400).json({ error: 'Missing toId' });
    }

    if (!messageQueue.has(toId)) {
      messageQueue.set(toId, []);
    }
    const q = messageQueue.get(toId)!;
    q.push({
      id: `chk_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      fromId: req.body.fromId,
      toId,
      type: 'FILE_CHUNK',
      payload: { chunkMeta, chunkData },
      timestamp: Date.now()
    });

    res.json({ success: true });
  });

  // Mount Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve dist folder
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[KAYDO SHARE] Real-time P2P Signaling Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start KAYDO SHARE server:", err);
  process.exit(1);
});
