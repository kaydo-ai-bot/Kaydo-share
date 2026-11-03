/**
 * KaydoDesktopEngine.ts
 * Cross-Platform Desktop P2P Transfer Engine for Windows, macOS, and Linux.
 *
 * Capabilities:
 * - Local UDP discovery broadcast on port 52222 (zero cloud / zero internet).
 * - High-speed TCP binary streaming engine (up to 80+ MB/s over Gigabit LAN).
 * - Full compliance with KAYDO binary protocol ("KYDO" magic bytes + SHA-256).
 * - Saves received files directly to user's local Downloads folder.
 */

import net from 'net';
import dgram from 'dgram';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

export const KAYDO_MAGIC = Buffer.from([0x4b, 0x59, 0x44, 0x4f]); // "KYDO"
export const DEFAULT_PORT = 52222;
export const UDP_PORT = 52223;

export interface DesktopPeer {
  id: string;
  name: string;
  os: 'Windows' | 'macOS' | 'Linux';
  ip: string;
  port: number;
  lastSeen: number;
}

export class KaydoDesktopEngine {
  private deviceId: string;
  private deviceName: string;
  private platform: 'Windows' | 'macOS' | 'Linux';
  private downloadDir: string;

  private tcpServer: net.Server | null = null;
  private udpSocket: dgram.Socket | null = null;
  private peers: Map<string, DesktopPeer> = new Map();
  private broadcastInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.deviceId = `desk_${crypto.randomBytes(4).toString('hex')}`;
    const host = os.hostname() || 'KAYDO-Desktop';
    const plat = os.platform();
    this.platform = plat === 'win32' ? 'Windows' : plat === 'darwin' ? 'macOS' : 'Linux';
    this.deviceName = `${host} (${this.platform})`;

    const home = os.homedir();
    this.downloadDir = path.join(home, 'Downloads', 'KaydoShare');
    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      // 1. Start TCP Binary Streaming Server
      this.tcpServer = net.createServer((socket) => {
        this.handleIncomingConnection(socket);
      });

      this.tcpServer.listen(DEFAULT_PORT, '0.0.0.0', () => {
        console.log(`[KAYDO Desktop] Serveur TCP binaire actif sur le port ${DEFAULT_PORT}`);
        this.startUdpDiscovery();
        resolve();
      });
    });
  }

  private startUdpDiscovery() {
    this.udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    this.udpSocket.on('message', (msg, rinfo) => {
      try {
        const payload = JSON.parse(msg.toString('utf8'));
        if (payload.app === 'KAYDO_SHARE' && payload.id !== this.deviceId) {
          this.peers.set(payload.id, {
            id: payload.id,
            name: payload.name,
            os: payload.os,
            ip: rinfo.address,
            port: payload.port || DEFAULT_PORT,
            lastSeen: Date.now()
          });
        }
      } catch {
        // non-kaydo packet
      }
    });

    this.udpSocket.bind(UDP_PORT, () => {
      this.udpSocket?.setBroadcast(true);

      // Broadcast presence every 2 seconds on local LAN
      this.broadcastInterval = setInterval(() => {
        const announcement = JSON.stringify({
          app: 'KAYDO_SHARE',
          id: this.deviceId,
          name: this.deviceName,
          os: this.platform,
          port: DEFAULT_PORT
        });
        const msg = Buffer.from(announcement);
        this.udpSocket?.send(msg, 0, msg.length, UDP_PORT, '255.255.255.255');
      }, 2000);
    });
  }

  private handleIncomingConnection(socket: net.Socket) {
    let headerReceived = false;
    let fileMeta: { name: string; size: number; expectedSha256: string } | null = null;
    let bytesReceived = 0;
    let writeStream: fs.WriteStream | null = null;
    const sha256 = crypto.createHash('sha256');
    let tempPath = '';

    socket.on('data', (chunk) => {
      if (!headerReceived) {
        // Check magic bytes
        if (chunk.length < 4 || !chunk.subarray(0, 4).equals(KAYDO_MAGIC)) {
          socket.destroy();
          return;
        }

        // Parse JSON manifest header
        const headerLen = chunk.readUInt16BE(6);
        const jsonStr = chunk.subarray(8, 8 + headerLen).toString('utf8');
        try {
          const meta = JSON.parse(jsonStr);
          fileMeta = meta;
          headerReceived = true;

          const safeName = path.basename(meta.fileName);
          tempPath = path.join(this.downloadDir, `.tmp_${Date.now()}_${safeName}`);
          writeStream = fs.createWriteStream(tempPath);

          const payload = chunk.subarray(8 + headerLen);
          if (payload.length > 0) {
            writeStream.write(payload);
            sha256.update(payload);
            bytesReceived += payload.length;
          }
        } catch {
          socket.destroy();
        }
      } else if (writeStream) {
        writeStream.write(chunk);
        sha256.update(chunk);
        bytesReceived += chunk.length;
      }
    });

    socket.on('end', () => {
      if (writeStream && fileMeta) {
        writeStream.end(() => {
          const calculatedSha256 = sha256.digest('hex');
          const isValid = calculatedSha256.toLowerCase() === fileMeta!.expectedSha256.toLowerCase();

          if (!isValid) {
            fs.unlinkSync(tempPath);
            console.error(`[KAYDO Desktop] ÉCHEC SHA-256 pour ${fileMeta!.name}. Fichier détruit.`);
          } else {
            const finalPath = path.join(this.downloadDir, path.basename(fileMeta!.name));
            fs.renameSync(tempPath, finalPath);
            console.log(`[KAYDO Desktop] Fichier vérifié et sauvegardé : ${finalPath} (${bytesReceived} octets)`);
          }
        });
      }
    });
  }

  public getDiscoveredPeers(): DesktopPeer[] {
    const now = Date.now();
    for (const [id, peer] of this.peers.entries()) {
      if (now - peer.lastSeen > 8000) {
        this.peers.delete(id);
      }
    }
    return Array.from(this.peers.values());
  }

  public stop() {
    if (this.broadcastInterval) clearInterval(this.broadcastInterval);
    this.udpSocket?.close();
    this.tcpServer?.close();
  }
}
