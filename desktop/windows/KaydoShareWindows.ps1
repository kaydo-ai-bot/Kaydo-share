# KAYDO SHARE - Service Windows PowerShell Natif (.NET)
# Fonctionne directement sur Windows 10 & 11 sans installer aucun outil tiers.

$Port = 52222
$DownloadDir = [System.IO.Path]::Combine($env:USERPROFILE, "Downloads", "KaydoShare")
if (!(Test-Path $DownloadDir)) { New-Item -ItemType Directory -Path $DownloadDir | Out-Null }

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  KAYDO SHARE - Windows P2P Service" -ForegroundColor Yellow
Write-Host "  Dossier : $DownloadDir" -ForegroundColor White
Write-Host "  Port TCP : $Port" -ForegroundColor White
Write-Host "==========================================" -ForegroundColor Cyan

$Listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $Port)
$Listener.Start()
Write-Host "[OK] En attente de transferts entrants depuis Android, iPhone ou PC..." -ForegroundColor Green

try {
    while ($true) {
        $Client = $Listener.AcceptTcpClient()
        $Stream = $Client.GetStream()

        # Read Magic & Header
        $HeaderBytes = New-Object byte[] 8
        $ReadCount = $Stream.Read($HeaderBytes, 0, 8)

        if ($ReadCount -ge 8 -and $HeaderBytes[0] -eq 0x4B -and $HeaderBytes[1] -eq 0x59) {
            $HeaderLen = [System.BitConverter]::ToUInt16(@($HeaderBytes[7], $HeaderBytes[6]), 0)
            $JsonBytes = New-Object byte[] $HeaderLen
            $Stream.Read($JsonBytes, 0, $HeaderLen) | Out-Null
            $JsonStr = [System.Text.Encoding]::UTF8.GetString($JsonBytes)
            $Manifest = $JsonStr | ConvertFrom-Json

            $FileName = [System.IO.Path]::GetFileName($Manifest.fileName)
            $ExpectedHash = $Manifest.expectedSha256
            $TempPath = [System.IO.Path]::Combine($DownloadDir, (".tmp_" + [System.DateTime]::Now.Ticks + "_" + $FileName))

            Write-Host "[TRANSFERT] Réception en cours : $FileName ($($Manifest.fileSize) octets)" -ForegroundColor Cyan

            $FileStream = [System.IO.File]::Create($TempPath)
            $Buffer = New-Object byte[] 65536
            while (($bytesRead = $Stream.Read($Buffer, 0, $Buffer.Length)) -gt 0) {
                $FileStream.Write($Buffer, 0, $bytesRead)
            }
            $FileStream.Close()

            # Verify SHA-256
            $Sha256 = [System.Security.Cryptography.SHA256]::Create()
            $RawBytes = [System.IO.File]::ReadAllBytes($TempPath)
            $CalculatedHash = -join ($Sha256.ComputeHash($RawBytes) | ForEach-Object { "{0:x2}" -f $_ })

            if ($ExpectedHash -and $CalculatedHash.ToLower() -ne $ExpectedHash.ToLower()) {
                Remove-Item $TempPath -Force
                Write-Host "[ERREUR] Échec de vérification SHA-256 ! Fichier rejeté et détruit." -ForegroundColor Red
            } else {
                $FinalPath = [System.IO.Path]::Combine($DownloadDir, $FileName)
                Move-Item -Path $TempPath -Destination $FinalPath -Force
                Write-Host "[SUCCÈS] Fichier vérifié et enregistré : $FinalPath" -ForegroundColor Green
            }
        }
        $Client.Close()
    }
} finally {
    $Listener.Stop()
}
