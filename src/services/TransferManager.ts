/**
 * TransferManager.ts
 * Pure Direct Peer-to-Peer (P2P) Engine for KAYDO SHARE.
 *
 * Rules:
 * - ZERO file payloads are relayed through any server.
 * - Files are transmitted directly device-to-device via WebRTC RTCDataChannel (binary ArrayBuffer).
 * - Implements KaydoProtocol binary framing & strict SHA-256 validation.
 * - Handles pause, cancellation, and corrupt file rejection.
 * - Real metrics only: no fake RSSI or simulated speeds.
 */

import { KaydoFile, NearbyDevice, TransferTask } from '../types';
import {
  FileManifest,
  FileAssemblyBuffer,
  encodeManifestFrame,
  decodeManifestFrame,
  encodeChunkFrame,
  decodeChunkFrame,
  calculateSha256,
  KaydoMessageType,
  KAYDO_MAGIC
} from './KaydoProtocol';

export type ConnectionState = 'disconnected' | 'advertising' | 'discovering' | 'connecting' | 'connected' | 'error';

export interface TransferListener {
  onPeersUpdated?: (peers: NearbyDevice[]) => void;
  onIncomingConnectionRequest?: (device: NearbyDevice, pin: string) => void;
  onConnectionEstablished?: (device: NearbyDevice, pin: string) => void;
  onConnectionRejected?: () => void;
  onTransferProgress?: (task: TransferTask) => void;
  onFileReceived?: (file: KaydoFile, blob: Blob) => void;
  onError?: (error: string) => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export class TransferManager {
  private static instance: TransferManager;
  private state: ConnectionState = 'disconnected';
  private listener: TransferListener | null = null;
  private localDevice: NearbyDevice;
  private discoveredPeers: Map<string, NearbyDevice> = new Map();
  private connectedPeer: NearbyDevice | null = null;
  private currentPin: string = '';

  // WebRTC P2P direct connection
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private isInitiator: boolean = false;

  private heartbeatTimer: number | null = null;
  private signalPollTimer: number | null = null;
  private peerPollTimer: number | null = null;

  // Active incoming file assembly buffer
  private currentAssembly: FileAssemblyBuffer | null = null;
  private isCancelled: boolean = false;
  private isPaused: boolean = false;

  private constructor() {
    let deviceId = localStorage.getItem('kaydo_device_id');
    if (!deviceId) {
      deviceId = `dev_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('kaydo_device_id', deviceId);
    }

    let deviceName = localStorage.getItem('kaydo_device_name');
    if (!deviceName) {
      const isAndroid = /Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad/i.test(navigator.userAgent);
      const prefix = isAndroid ? 'KAYDO-Android' : isIOS ? 'KAYDO-iPhone' : 'KAYDO-Web';
      deviceName = `${prefix}-${Math.floor(100 + Math.random() * 900)}`;
      localStorage.setItem('kaydo_device_name', deviceName);
    }

    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad/i.test(navigator.userAgent);

    this.localDevice = {
      id: deviceId,
      name: deviceName,
      model: isAndroid ? 'Android Device' : isIOS ? 'Apple iPhone' : 'PC / Mac',
      os: isAndroid ? 'Android' : isIOS ? 'iOS' : 'Windows',
      rssi: 0, // No fake RSSI
      avatarColor: 'bg-blue-600'
    };

    this.startDiscoverySignaling();
  }

  public static getInstance(): TransferManager {
    if (!TransferManager.instance) {
      TransferManager.instance = new TransferManager();
    }
    return TransferManager.instance;
  }

  public setLocalDeviceName(name: string) {
    this.localDevice.name = name;
    localStorage.setItem('kaydo_device_name', name);
    this.sendHeartbeat();
  }

  public getLocalDevice(): NearbyDevice {
    return this.localDevice;
  }

  public setListener(listener: TransferListener) {
    this.listener = listener;
  }

  private startDiscoverySignaling() {
    this.sendHeartbeat();

    this.heartbeatTimer = window.setInterval(() => {
      this.sendHeartbeat();
    }, 2500);

    this.signalPollTimer = window.setInterval(() => {
      this.pollSignalingMessages();
    }, 500);
  }

  private async sendHeartbeat() {
    try {
      await fetch('/api/discovery/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: this.localDevice.id,
          name: this.localDevice.name,
          model: this.localDevice.model,
          os: this.localDevice.os
        })
      });
    } catch {
      // offline / local network
    }
  }

  private async pollSignalingMessages() {
    try {
      const res = await fetch(`/api/signal/messages?myId=${encodeURIComponent(this.localDevice.id)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.messages || data.messages.length === 0) return;

      for (const msg of data.messages) {
        await this.handleIncomingSignal(msg);
      }
    } catch {
      // network hiccup
    }
  }

  private async handleIncomingSignal(msg: any) {
    const { fromId, type, payload } = msg;

    if (type === 'CONNECT_REQUEST') {
      const senderDevice: NearbyDevice = payload.sender;
      this.currentPin = payload.pin;
      this.connectedPeer = senderDevice;
      this.listener?.onIncomingConnectionRequest?.(senderDevice, this.currentPin);
    } else if (type === 'CONNECT_ACCEPT') {
      const peerDevice: NearbyDevice = payload.sender;
      this.connectedPeer = peerDevice;
      this.currentPin = payload.pin || this.currentPin;
      // Receiver accepted connection request. If initiator, setup WebRTC offer.
      if (this.isInitiator) {
        await this.initiateWebRtcConnection();
      }
    } else if (type === 'CONNECT_REJECT') {
      this.cleanupRtc();
      this.connectedPeer = null;
      this.state = 'disconnected';
      this.listener?.onConnectionRejected?.();
    } else if (type === 'WEBRTC_SIGNAL') {
      await this.handleWebRtcSignal(payload);
    }
  }

  // --- WebRTC Peer-to-Peer Direct Engine ---

  private async createPeerConnection() {
    this.cleanupRtc();
    this.peerConnection = new RTCPeerConnection(RTC_CONFIG);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.connectedPeer) {
        this.sendSignal('WEBRTC_SIGNAL', {
          candidate: event.candidate
        });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      if (state === 'connected') {
        this.state = 'connected';
        if (this.connectedPeer) {
          this.listener?.onConnectionEstablished?.(this.connectedPeer, this.currentPin);
        }
      } else if (state === 'failed' || state === 'closed') {
        this.state = 'disconnected';
      }
    };

    this.peerConnection.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };
  }

  private setupDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;
    this.dataChannel.binaryType = 'arraybuffer';

    this.dataChannel.onopen = () => {
      this.state = 'connected';
      if (this.connectedPeer) {
        this.listener?.onConnectionEstablished?.(this.connectedPeer, this.currentPin);
      }
    };

    this.dataChannel.onmessage = async (event) => {
      await this.handleDataChannelMessage(event.data);
    };

    this.dataChannel.onerror = (err) => {
      console.warn("RTCDataChannel error:", err);
    };
  }

  private async initiateWebRtcConnection() {
    await this.createPeerConnection();
    if (!this.peerConnection) return;

    // Initiator creates the binary RTCDataChannel
    const channel = this.peerConnection.createDataChannel('kaydo_transfer_channel', {
      ordered: true
    });
    this.setupDataChannel(channel);

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    this.sendSignal('WEBRTC_SIGNAL', { sdp: offer });
  }

  private async handleWebRtcSignal(payload: any) {
    if (payload.sdp) {
      if (!this.peerConnection) {
        await this.createPeerConnection();
      }
      if (!this.peerConnection) return;

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));

      if (payload.sdp.type === 'offer') {
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        this.sendSignal('WEBRTC_SIGNAL', { sdp: answer });
      }
    } else if (payload.candidate) {
      if (this.peerConnection && this.peerConnection.remoteDescription) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
      }
    }
  }

  private sendSignal(type: any, payload: any) {
    if (!this.connectedPeer) return;
    fetch('/api/signal/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromId: this.localDevice.id,
        toId: this.connectedPeer.id,
        type,
        payload
      })
    }).catch(() => {});
  }

  /**
   * Processes incoming binary frames received directly from the remote peer's RTCDataChannel.
   * STRICT: Validates Magic bytes, decodes chunks, and triggers SHA-256 verification.
   */
  private async handleDataChannelMessage(data: ArrayBuffer) {
    const uint8 = new Uint8Array(data);
    if (uint8.length < 6) return;

    // Check magic bytes
    if (
      uint8[0] !== KAYDO_MAGIC[0] ||
      uint8[1] !== KAYDO_MAGIC[1] ||
      uint8[2] !== KAYDO_MAGIC[2] ||
      uint8[3] !== KAYDO_MAGIC[3]
    ) {
      console.warn("Frame invalide: Magic bytes manquants");
      return;
    }

    const type = uint8[5];

    if (type === KaydoMessageType.FILE_MANIFEST) {
      const manifest = decodeManifestFrame(data);
      this.currentAssembly = new FileAssemblyBuffer(manifest);

      this.listener?.onTransferProgress?.({
        id: manifest.fileId,
        fileName: manifest.fileName,
        fileSize: manifest.fileSize,
        transferredBytes: 0,
        speedMBs: 0,
        progress: 0,
        status: 'transferring',
        direction: 'receive',
        peerName: this.connectedPeer?.name || 'Émetteur',
        startTime: Date.now()
      });
    } else if (type === KaydoMessageType.FILE_CHUNK && this.currentAssembly) {
      const { header, payload } = decodeChunkFrame(data);
      this.currentAssembly.addChunk(header, payload);

      const elapsed = (Date.now() - this.currentAssembly.startTime) / 1000;
      const speedMBs = elapsed > 0 ? (this.currentAssembly.bytesReceived / (1024 * 1024)) / elapsed : 0;
      const progress = this.currentAssembly.getProgressPercentage();

      this.listener?.onTransferProgress?.({
        id: this.currentAssembly.manifest.fileId,
        fileName: this.currentAssembly.manifest.fileName,
        fileSize: this.currentAssembly.manifest.fileSize,
        transferredBytes: this.currentAssembly.bytesReceived,
        speedMBs: parseFloat(speedMBs.toFixed(2)),
        progress,
        status: 'transferring',
        direction: 'receive',
        peerName: this.connectedPeer?.name || 'Émetteur',
        startTime: this.currentAssembly.startTime
      });

      // If all chunks arrived, finalize with STRICT SHA-256 validation
      if (this.currentAssembly.isComplete()) {
        const assembly = this.currentAssembly;
        try {
          const { blob, verifiedSha256 } = await assembly.finalize();

          const receivedFile: KaydoFile = {
            id: assembly.manifest.fileId,
            name: assembly.manifest.fileName,
            size: assembly.manifest.fileSize,
            type: assembly.manifest.mimeType,
            category: this.getCategoryFromType(assembly.manifest.fileName, assembly.manifest.mimeType),
            date: new Date().toLocaleDateString(),
            blob,
            thumbnail: assembly.manifest.mimeType.startsWith('image/') ? URL.createObjectURL(blob) : undefined
          };

          const totalTime = (Date.now() - assembly.startTime) / 1000;
          const finalSpeed = totalTime > 0 ? (assembly.manifest.fileSize / (1024 * 1024)) / totalTime : 0;

          this.listener?.onTransferProgress?.({
            id: receivedFile.id,
            fileName: receivedFile.name,
            fileSize: receivedFile.size,
            transferredBytes: receivedFile.size,
            speedMBs: parseFloat(finalSpeed.toFixed(2)),
            progress: 100,
            status: 'completed',
            direction: 'receive',
            peerName: this.connectedPeer?.name || 'Émetteur',
            startTime: assembly.startTime,
            checksum: verifiedSha256
          });

          // Deliver ONLY after cryptographic hash has been 100% verified!
          this.listener?.onFileReceived?.(receivedFile, blob);
          this.currentAssembly = null;
        } catch (err: any) {
          // Checksum mismatch or corruption: strictly reject!
          this.listener?.onTransferProgress?.({
            id: assembly.manifest.fileId,
            fileName: assembly.manifest.fileName,
            fileSize: assembly.manifest.fileSize,
            transferredBytes: assembly.bytesReceived,
            speedMBs: 0,
            progress: 100,
            status: 'error',
            direction: 'receive',
            peerName: this.connectedPeer?.name || 'Émetteur',
            startTime: assembly.startTime,
            error: err.message || "Échec de validation SHA-256: Fichier corrompu rejeté."
          });
          this.currentAssembly = null;
        }
      }
    } else if (type === KaydoMessageType.TRANSFER_CANCEL) {
      this.currentAssembly = null;
      this.listener?.onError?.("Le transfert a été annulé par l'appareil distant.");
    }
  }

  // --- Discovery Public Methods ---

  public async fetchPeers() {
    try {
      const res = await fetch(`/api/discovery/peers?myId=${encodeURIComponent(this.localDevice.id)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.peers)) {
        this.discoveredPeers.clear();
        for (const peer of data.peers) {
          this.discoveredPeers.set(peer.id, {
            ...peer,
            rssi: 0 // Zero fake RSSI
          });
        }
        this.listener?.onPeersUpdated?.(Array.from(this.discoveredPeers.values()));
      }
    } catch {
      // offline
    }
  }

  public startDiscovery() {
    this.state = 'discovering';
    this.sendHeartbeat();
    this.fetchPeers();

    if (this.peerPollTimer) clearInterval(this.peerPollTimer);
    this.peerPollTimer = window.setInterval(() => {
      this.fetchPeers();
    }, 1500);
  }

  public startAdvertising() {
    this.state = 'advertising';
    this.sendHeartbeat();
    this.fetchPeers();

    if (this.peerPollTimer) clearInterval(this.peerPollTimer);
    this.peerPollTimer = window.setInterval(() => {
      this.fetchPeers();
    }, 1500);
  }

  public stopDiscovery() {
    if (this.peerPollTimer) {
      clearInterval(this.peerPollTimer);
      this.peerPollTimer = null;
    }
    this.state = 'disconnected';
  }

  public requestConnect(targetDevice: NearbyDevice): string {
    this.state = 'connecting';
    this.connectedPeer = targetDevice;
    this.isInitiator = true;

    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    this.currentPin = pin;

    this.sendSignal('CONNECT_REQUEST', {
      sender: this.localDevice,
      pin
    });

    return pin;
  }

  public acceptConnection(targetDevice: NearbyDevice) {
    this.state = 'connected';
    this.connectedPeer = targetDevice;
    this.isInitiator = false;

    this.sendSignal('CONNECT_ACCEPT', {
      sender: this.localDevice,
      pin: this.currentPin
    });

    this.listener?.onConnectionEstablished?.(targetDevice, this.currentPin);
  }

  public rejectConnection(targetDevice: NearbyDevice) {
    this.sendSignal('CONNECT_REJECT', {
      sender: this.localDevice
    });
    this.cleanupRtc();
    this.connectedPeer = null;
  }

  public getSecurityPin(): string {
    return this.currentPin;
  }

  public getConnectedPeer(): NearbyDevice | null {
    return this.connectedPeer;
  }

  public pauseTransfer() {
    this.isPaused = true;
  }

  public resumeTransfer() {
    this.isPaused = false;
  }

  public cancelTransfer() {
    this.isCancelled = true;
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      const buffer = new ArrayBuffer(6);
      const uint8 = new Uint8Array(buffer);
      uint8.set(KAYDO_MAGIC, 0);
      uint8[4] = 1;
      uint8[5] = KaydoMessageType.TRANSFER_CANCEL;
      this.dataChannel.send(buffer);
    }
  }

  /**
   * Sends files directly to the remote peer via RTCDataChannel.
   * ZERO file chunks pass through any server.
   */
  public async sendFiles(files: KaydoFile[], onProgress: (task: TransferTask) => void) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error("Canal P2P direct non ouvert. Établissez d'abord la connexion WebRTC avec l'autre appareil.");
    }

    this.isCancelled = false;
    this.isPaused = false;
    const chunkSize = 64 * 1024; // 64 KB raw binary chunks

    for (const file of files) {
      if (!file.blob) {
        throw new Error(`Le fichier "${file.name}" ne contient pas de données binaires réelles.`);
      }

      if (this.isCancelled) break;

      const totalSize = file.size;
      const totalChunks = Math.ceil(totalSize / chunkSize);

      // Compute actual SHA-256 before sending
      const wholeBuffer = await file.blob.arrayBuffer();
      const expectedSha256 = await calculateSha256(wholeBuffer);

      const manifest: FileManifest = {
        fileId: file.id,
        fileName: file.name,
        fileSize: totalSize,
        mimeType: file.type || 'application/octet-stream',
        expectedSha256,
        totalChunks,
        chunkSize
      };

      // Send Manifest Frame directly over DataChannel
      const manifestFrame = encodeManifestFrame(manifest);
      this.dataChannel.send(manifestFrame);

      const startTime = performance.now();
      let bytesSent = 0;

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (this.isCancelled) {
          throw new Error("Transfert annulé par l'utilisateur.");
        }

        // Wait if paused
        while (this.isPaused && !this.isCancelled) {
          await new Promise(r => setTimeout(r, 200));
        }

        const start = chunkIndex * chunkSize;
        const end = Math.min(totalSize, start + chunkSize);
        const slice = file.blob.slice(start, end);
        const chunkData = await slice.arrayBuffer();

        const chunkFrame = encodeChunkFrame(
          file.id,
          chunkIndex,
          totalChunks,
          start,
          chunkData
        );

        // Flow control: wait if RTCDataChannel buffer is full
        if (this.dataChannel.bufferedAmount > 4 * 1024 * 1024) {
          await new Promise(r => setTimeout(r, 50));
        }

        this.dataChannel.send(chunkFrame);
        bytesSent += chunkData.byteLength;

        const elapsedSeconds = (performance.now() - startTime) / 1000;
        const speedMBs = elapsedSeconds > 0 ? (bytesSent / (1024 * 1024)) / elapsedSeconds : 0;
        const progress = Math.min(100, Math.floor((bytesSent / totalSize) * 100));

        onProgress({
          id: file.id,
          fileName: file.name,
          fileSize: totalSize,
          transferredBytes: bytesSent,
          speedMBs: parseFloat(speedMBs.toFixed(2)),
          progress,
          status: 'transferring',
          direction: 'send',
          peerName: this.connectedPeer?.name || 'Destinataire',
          startTime: Math.floor(startTime),
          checksum: expectedSha256
        });

        // Small yield to allow event loop processing
        await new Promise(r => setTimeout(r, 5));
      }

      const totalTimeSeconds = (performance.now() - startTime) / 1000;
      const finalSpeed = totalTimeSeconds > 0 ? (totalSize / (1024 * 1024)) / totalTimeSeconds : 0;

      onProgress({
        id: file.id,
        fileName: file.name,
        fileSize: totalSize,
        transferredBytes: totalSize,
        speedMBs: parseFloat(finalSpeed.toFixed(2)),
        progress: 100,
        status: 'completed',
        direction: 'send',
        peerName: this.connectedPeer?.name || 'Destinataire',
        startTime: Math.floor(startTime),
        checksum: expectedSha256
      });
    }
  }

  private cleanupRtc() {
    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch {}
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      try { this.peerConnection.close(); } catch {}
      this.peerConnection = null;
    }
  }

  private getCategoryFromType(name: string, type: string) {
    if (name.endsWith('.apk')) return 'apps';
    if (type.startsWith('image/')) return 'photos';
    if (type.startsWith('video/')) return 'videos';
    if (type.startsWith('audio/')) return 'music';
    if (type.includes('pdf') || type.includes('document') || type.includes('text')) return 'documents';
    return 'downloads';
  }
}
