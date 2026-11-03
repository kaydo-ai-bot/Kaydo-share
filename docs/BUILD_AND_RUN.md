# GUIDE DE COMPILATION ET DÉPLOIEMENT : ANDROID & IOS

Ce guide fournit les étapes exactes pour compiler, installer et tester **KAYDO SHARE** sur des appareils physiques réels.

---

## 1. APPLICATION ANDROID NATIVE

### Prérequis
- **Android Studio** (Hedgehog, Iguana ou plus récent).
- **JDK 17**.
- Deux smartphones Android physiques avec Bluetooth et Wi-Fi activés.

### Étapes de compilation
1. Ouvrez **Android Studio**.
2. Choisissez **Open** et sélectionnez le dossier `/android`.
3. Laissez Gradle synchroniser les dépendances (`com.google.android.gms:play-services-nearby:19.3.0`, `NanoHTTPD`, Jetpack Compose).
4. Pour compiler en ligne de commande :
   ```bash
   cd android
   ./gradlew assembleDebug
   ```
5. L'APK généré se trouvera dans :
   `android/app/build/outputs/apk/debug/app-debug.apk`
6. Installez l'APK sur vos deux téléphones :
   ```bash
   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
   ```

### Test sur appareils réels :
- **Appareil A** : Appuyez sur **ENVOYER**. Acceptez les permissions Nearby et Bluetooth.
- **Appareil B** : Appuyez sur **RECEVOIR**.
- L'Appareil A apparaît instantanément sur le radar de l'Appareil B.
- Appuyez sur **Connecter** : la liaison directe Wi-Fi Direct s'établit sans aucun point d'accès Internet, et les fichiers sont transférés à vitesse maximale avec vérification SHA-256.

---

## 2. APPLICATION IOS NATIVE (IPHONE / IPAD)

### Prérequis
- **Mac** avec **macOS Sonoma** ou plus récent.
- **Xcode 15+**.
- Compte Apple Developer (gratuit ou payant pour le provisioning sur appareil physique).
- Deux iPhones physiques.

### Étapes de configuration et compilation
1. Ouvrez le dossier `/ios` dans Xcode ou générez le projet Xcode :
   - Fichiers source inclus :
     - `ios/KaydoShare/ContentView.swift`
     - `ios/KaydoShare/Protocol/KaydoProtocol.swift`
     - `ios/KaydoShare/Transfer/KaydoMultipeerManager.swift`
     - `ios/KaydoShare/Info.plist`
2. Dans l'onglet **Signing & Capabilities** de la cible :
   - Sélectionnez votre **Team de développement**.
   - Vérifiez que les clés `NSLocalNetworkUsageDescription` et `NSBonjourServices` sont bien présentes (fournies dans `Info.plist`).
3. Connectez votre iPhone par câble USB ou Wi-Fi.
4. Sélectionnez votre iPhone physique comme cible de build et appuyez sur **Cmd + R** (Run).

### Test sur appareils réels :
- **iPhone 1** : Appuyez sur **ENVOYER** (active l'annonce `MultipeerConnectivity`).
- **iPhone 2** : Appuyez sur **RECEVOIR** (active la recherche Bonjour).
- L'iPhone 1 apparaît immédiatement dans la liste.
- Appuyez sur **Connecter** : le transfert s'effectue en direct de pair à pair via Wi-Fi direct Apple (AWDL) et Bluetooth LE.

---

## 3. INTEROPÉRABILITÉ ANDROID ↔ IPHONE (HORS-LIGNE)

### Principe
Apple interdisant l'accès direct aux API Wi-Fi Direct aux applications tierces, KAYDO SHARE utilise la méthode éprouvée de Xender et SHAREit :

1. **Android vers iPhone** :
   - L'application Android démarre un **Point d'accès local (Local-Only Hotspot)** et le serveur HTTP binaire (`KaydoHotspotServer` sur le port `52222`).
   - L'application Android affiche le QR Code contenant :
     `WIFI:S:KAYDO_SHARE_XXXX;P:motdepasse;;URL:http://192.168.43.1:52222/download/...`
   - L'iPhone scanne le QR Code (via son appareil photo natif ou KAYDO SHARE iOS) : iOS se connecte automatiquement au Wi-Fi local de l'Android.
   - Le transfert de fichier s'exécute directement à haute vitesse (20-45 Mo/s) sans Internet.
   - Le SHA-256 est vérifié dès la fin du flux avant l'enregistrement.

2. **iPhone vers Android** :
   - L'iPhone active le partage de connexion local.
   - L'Android s'y connecte via QR Code et pousse les fichiers vers le point de terminaison `/upload` avec l'en-tête `X-KAYDO-SHA256`.
