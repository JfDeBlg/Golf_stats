<#
.SYNOPSIS
  Régénère data/index.json à partir des fichiers .zip présents dans data/.

.DESCRIPTION
  GitHub Pages ne liste pas un dossier : data/index.json est la seule source des
  sauvegardes que l'app propose au démarrage (base vide) ou depuis Réglages >
  Sauvegarde/Partage > "Restaurer depuis le serveur". Ce script reconstruit
  index.json à partir des ZIP effectivement présents.

  Garde-fou de confidentialité (le dépôt est public) : tout ZIP dont le JSON
  d'export contient encore un player.firstName ou player.lastName non vide est
  REFUSÉ (non ajouté à index.json) avec un message d'alerte — ces champs n'existent
  plus depuis la 1.2.58 (remplacés par Player.trigram), mais un export plus ancien
  peut encore les porter.

.USAGE
  powershell -ExecutionPolicy Bypass -File tools/update-data-index.ps1
#>

Add-Type -AssemblyName System.IO.Compression.FileSystem

$dataDir = Join-Path $PSScriptRoot "..\data"
$indexPath = Join-Path $dataDir "index.json"

if (-not (Test-Path $dataDir)) {
    Write-Error "Dossier introuvable : $dataDir"
    exit 1
}

$zipFiles = Get-ChildItem -Path $dataDir -Filter "*.zip" -File
$backups = @()
$rejected = @()

foreach ($zip in $zipFiles) {
    $archive = [System.IO.Compression.ZipFile]::OpenRead($zip.FullName)
    try {
        $jsonEntry = $archive.Entries | Where-Object { $_.FullName -like "*.json" } | Select-Object -First 1
        if (-not $jsonEntry) {
            Write-Warning "Ignoré (pas de JSON trouvé dans le ZIP) : $($zip.Name)"
            continue
        }

        $reader = New-Object System.IO.StreamReader($jsonEntry.Open())
        $jsonText = $reader.ReadToEnd()
        $reader.Close()

        $data = $jsonText | ConvertFrom-Json
        $player = $data.data.player

        $hasFirstName = $player -and $player.PSObject.Properties.Name -contains "firstName" -and $player.firstName -and $player.firstName.Trim() -ne ""
        $hasLastName = $player -and $player.PSObject.Properties.Name -contains "lastName" -and $player.lastName -and $player.lastName.Trim() -ne ""

        if ($hasFirstName -or $hasLastName) {
            Write-Warning "REFUSÉ (nom non vide trouvé dans l'export) : $($zip.Name) -- retirez firstName/lastName (ou réexportez depuis une version >= 1.2.58) avant de déposer ce fichier ici."
            $rejected += $zip.Name
            continue
        }

        $hasClubs = $data.data.clubs -and $data.data.clubs.Count -gt 0
        $content = if ($player -or $hasClubs) { "full" } else { "courses" }

        $backups += [PSCustomObject]@{
            file    = $zip.Name
            label   = $zip.BaseName
            date    = $zip.LastWriteTime.ToString("yyyy-MM-dd")
            content = $content
        }
    } catch {
        Write-Warning "Ignoré (ZIP/JSON invalide) : $($zip.Name) -- $($_.Exception.Message)"
    } finally {
        $archive.Dispose()
    }
}

$indexData = [PSCustomObject]@{ backups = $backups }
$indexData | ConvertTo-Json -Depth 5 | Set-Content -Path $indexPath -Encoding utf8

Write-Host ""
Write-Host "index.json régénéré : $($backups.Count) sauvegarde(s) référencée(s)." -ForegroundColor Green
if ($rejected.Count -gt 0) {
    Write-Host "$($rejected.Count) fichier(s) REFUSÉ(S) (nom non vide, voir avertissements ci-dessus) :" -ForegroundColor Red
    $rejected | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
}
