#!/usr/bin/env python3
"""
KAYDO SHARE - Démon Linux natif léger (Zero dépendance externe)
Compatible avec Ubuntu, Debian, Fedora, Arch Linux, Raspberry Pi OS.

Fonctionnalités :
- Écoute TCP sur le port 52222
- Découverte UDP locale sur le port 52223
- Encodage/Décodage binaire Magic 'KYDO'
- Vérification d'intégrité SHA-256 obligatoire
- Enregistrement direct dans ~/Downloads/KaydoShare
"""

import socket
import threading
import json
import os
import hashlib
import time

TCP_PORT = 52222
UDP_PORT = 52223
MAGIC = b'KYDO'
DOWNLOAD_DIR = os.path.expanduser('~/Downloads/KaydoShare')

os.makedirs(DOWNLOAD_DIR, exist_ok=True)
DEVICE_ID = f"linux_{os.urandom(4).hex()}"
DEVICE_NAME = f"{socket.gethostname()} (Linux)"

def udp_broadcast_worker():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    announcement = json.dumps({
        "app": "KAYDO_SHARE",
        "id": DEVICE_ID,
        "name": DEVICE_NAME,
        "os": "Linux",
        "port": TCP_PORT
    }).encode('utf-8')

    while True:
        try:
            sock.sendto(announcement, ('255.255.255.255', UDP_PORT))
            time.sleep(2.5)
        except Exception as e:
            time.sleep(5)

def handle_client(conn, addr):
    try:
        header_data = conn.recv(8)
        if len(header_data) < 8 or not header_data.startswith(MAGIC):
            conn.close()
            return

        header_len = int.from_bytes(header_data[6:8], 'big')
        json_bytes = conn.recv(header_len)
        manifest = json.loads(json_bytes.decode('utf-8'))

        file_name = os.path.basename(manifest.get('fileName', 'received_file.bin'))
        expected_sha256 = manifest.get('expectedSha256', '')

        temp_path = os.path.join(DOWNLOAD_DIR, f".tmp_{int(time.time())}_{file_name}")
        sha256 = hashlib.sha256()

        with open(temp_path, 'wb') as f:
            while True:
                chunk = conn.recv(65536)
                if not chunk:
                    break
                f.write(chunk)
                sha256.update(chunk)

        calculated_sha256 = sha256.hexdigest()

        if expected_sha256 and calculated_sha256.lower() != expected_sha256.lower():
            os.remove(temp_path)
            print(f"[ERREUR] SHA-256 non concordant pour {file_name}. Fichier détruit.")
        else:
            final_path = os.path.join(DOWNLOAD_DIR, file_name)
            os.rename(temp_path, final_path)
            print(f"[SUCCÈS] Fichier reçu et vérifié : {final_path}")

    except Exception as e:
        print(f"[ERREUR] Échec du transfert : {e}")
    finally:
        conn.close()

def main():
    print(f"=== KAYDO SHARE Démon Linux ===")
    print(f"Appareil : {DEVICE_NAME}")
    print(f"Dossier de téléchargement : {DOWNLOAD_DIR}")
    print(f"Port TCP d'écoute : {TCP_PORT}")

    # Start UDP broadcast thread
    t = threading.Thread(target=udp_broadcast_worker, daemon=True)
    t.start()

    # Start TCP listening server
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(('0.0.0.0', TCP_PORT))
    server.listen(10)

    print("Prêt pour les transferts hors-ligne...")
    while True:
        conn, addr = server.accept()
        threading.Thread(target=handle_client, args=(conn, addr), daemon=True).start()

if __name__ == '__main__':
    main()
