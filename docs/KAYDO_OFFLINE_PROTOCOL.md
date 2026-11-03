# SPÉCIFICATION TECHNIQUE DU PROTOCOLE HORS-LIGNE KAYDO SHARE (v1.0)

## 1. Vue d'ensemble architecturale

KAYDO SHARE résout le défi fondamental du partage hors-ligne multiplateforme sans Internet entre Android et iOS.
Par conception de sécurité des systèmes d'exploitation :
- **Android vers Android** : Utilise **Google Nearby Connections API** (`Strategy.P2P_STAR`) ou **Wi-Fi Direct** (`WifiP2pManager`) pour un débit jusqu'à 50 Mo/s.
- **iPhone vers iPhone** : Utilise le framework natif Apple **MultipeerConnectivity** (Bluetooth LE + Wi-Fi Peer-to-Peer AWDL).
- **Android vers iPhone (et iPhone vers Android)** : Apple n'exposant pas l'API Wi-Fi Direct aux développeurs tiers, la solution universelle éprouvée (utilisée par Xender et SHAREit) consiste à créer un **Point d'accès local (Wi-Fi Hotspot local-only)** sur l'appareil émetteur, démarrer un micro-serveur HTTP/Socket binaire sur le port `52222`, et afficher un QR Code combiné contenant les identifiants Wi-Fi et l'URL de session.

Aucun fichier ne transite JAMAIS par un serveur distant ou Internet.

---

## 2. Structure de la trame binaire (Binary Framing)

Chaque échange de données est encadré par une trame binaire stricte évitant toute surcharge Base64 :

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                       Magic: "KYDO" (4 octets)                |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|    Version    |  Message Type |         Header Length         |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                         Type-Specific Data                    |
|                              ...                              |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

### Types de messages (`Message Type`) :
- `0x01` : **HANDSHAKE_REQUEST** (Demande de connexion avec code PIN de session)
- `0x02` : **HANDSHAKE_ACCEPT** (Acceptation du destinataire)
- `0x03` : **FILE_MANIFEST** (Métadonnées : Nom, Taille, Type MIME, SHA-256 attendu, Nombre de blocs)
- `0x04` : **FILE_CHUNK** (En-tête de bloc : Index UInt16, Décalage offset UInt32, suivi du flux binaire brut)
- `0x05` : **TRANSFER_COMPLETE** (Confirmation de fin d'envoi)
- `0x06` : **TRANSFER_CANCEL** (Interruption manuelle)
- `0x07` : **ERROR_CHECKSUM_FAILED** (Rejet formel pour non-concordance de hachage)

---

## 3. Matrice d'interopérabilité

| Scénario | Couche Découverte | Couche Transport | Débit estimé |
| :--- | :--- | :--- | :--- |
| **Android ↔ Android** | BLE / Nearby Connections | Wi-Fi Direct (P2P_STAR) | 30 – 60 Mo/s |
| **iPhone ↔ iPhone** | Bonjour / Multipeer | AWDL / Wi-Fi direct Apple | 25 – 50 Mo/s |
| **Android → iPhone** | QR Code (Wi-Fi Hotspot) | HTTP/TCP Socket (`:52222`) | 20 – 45 Mo/s |
| **iPhone → Android** | QR Code (Hotspot iOS) | HTTP/TCP Socket (`:52222`) | 20 – 45 Mo/s |
| **Web ↔ Web (PWA)** | QR Code / Local Signaling | WebRTC RTCDataChannel binaire | 15 – 35 Mo/s |

---

## 4. Politique stricte d'intégrité SHA-256

1. Avant tout envoi, l'émetteur lit le fichier brut et calcule le condensat cryptographique SHA-256.
2. Le condensat est transmis dans le `FILE_MANIFEST`.
3. Le récepteur assemble les blocs binaires à leurs décalages précis (`offset`).
4. À la réception du dernier bloc, le récepteur calcule de manière indépendante le SHA-256 du fichier assemblé.
5. **Règle absolue** : Si `hash_calcule != hash_attendu`, le fichier est **immédiatement détruit**, l'alerte de corruption est émise, et aucun téléchargement ni sauvegarde dans le stockage n'est autorisé.
