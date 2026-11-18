# Télécharge l'image ISO de Brume OS depuis les releases GitHub de ton dépôt (Windows).
#
#   powershell -ExecutionPolicy Bypass -File telecharger-iso.ps1 -Owner ton-nom-github
#   (options : -Repo brume-os  -Dest C:\Dossier)
#
# - Prend l'ISO de la release la plus récente qui en a une.
# - Reprend là où il s'était arrêté si la connexion coupe : relance simplement la même commande.
# - Vérifie le fichier (empreinte SHA-256 donnée par GitHub) avant de le déclarer prêt.
# - Dépôt privé : crée un jeton sur github.com/settings/tokens, puis dans PowerShell :
#     $env:GITHUB_TOKEN = "ton_jeton"   avant de lancer la commande.
param(
  [Parameter(Mandatory = $true, HelpMessage = "Ton nom GitHub")][string]$Owner,
  [string]$Repo = 'brume-os',
  [string]$Dest = ''
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # la barre de PowerShell ralentit énormément les téléchargements
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}

function Stop-Brume([string]$msg) { Write-Host ''; Write-Host $msg -ForegroundColor Red; exit 1 }
function Format-Go([double]$b) {
  if ($b -ge 1e9) { $s = '{0:0.00} Go' -f ($b / 1e9) } else { $s = '{0:0} Mo' -f ($b / 1e6) }
  return $s.Replace('.', ',')
}
function Get-Size([string]$p) { if (Test-Path -LiteralPath $p) { return (Get-Item -LiteralPath $p).Length } else { return 0 } }

$api = 'https://api.github.com'
if ($env:BRUME_API) { $api = $env:BRUME_API }
$token = $env:GITHUB_TOKEN
if (-not $token) { $token = $env:GH_TOKEN }

# Dossier de destination : Téléchargements
if (-not $Dest) {
  try { $Dest = (New-Object -ComObject Shell.Application).NameSpace('shell:Downloads').Self.Path } catch { $Dest = '' }
  if (-not $Dest -or -not (Test-Path -LiteralPath $Dest)) { $Dest = Join-Path $HOME 'Downloads' }
  if (-not (Test-Path -LiteralPath $Dest)) { $Dest = (Get-Location).Path }
}
if (-not (Test-Path -LiteralPath $Dest -PathType Container)) { Stop-Brume "Le dossier « $Dest » n'existe pas." }
$Dest = (Resolve-Path -LiteralPath $Dest).Path

# (le User-Agent passe par -UserAgent : Windows PowerShell 5.1 le refuse dans -Headers)
$headers = @{ 'Accept' = 'application/vnd.github+json' }
if ($token) { $headers['Authorization'] = "Bearer $token" }

Write-Host "Recherche de l'image dans $Owner/$Repo…"
try {
  $resp = Invoke-RestMethod -UseBasicParsing -UserAgent 'brume-os-iso' -Uri "$api/repos/$Owner/$Repo/releases?per_page=20" -Headers $headers
} catch {
  $code = $null
  try { if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode } } catch {}
  switch ($code) {
    404 { Stop-Brume "Dépôt « $Owner/$Repo » introuvable. Vérifie ton nom GitHub et le nom du dépôt (s'il est privé, ajoute un jeton : voir en tête de ce fichier)." }
    401 { Stop-Brume "Le jeton GitHub est refusé (GITHUB_TOKEN)." }
    403 { Stop-Brume "GitHub limite les demandes pour le moment. Réessaie dans une heure, ou ajoute un jeton." }
    429 { Stop-Brume "GitHub limite les demandes pour le moment. Réessaie dans une heure, ou ajoute un jeton." }
    $null { Stop-Brume "Impossible de joindre GitHub. Vérifie ta connexion à Internet." }
    default { Stop-Brume "GitHub a répondu avec l'erreur $code." }
  }
}
# (passer par le tuyau « déplie » la liste, comme Windows PowerShell 5.1 la rend d'un seul bloc)
$rels = @($resp | Where-Object { $_ -and -not $_.draft })
if ($rels.Count -eq 0) { Stop-Brume "Ce dépôt n'a pas encore de release. Crée-en une (Releases → Draft a new release) : GitHub fabrique alors l'ISO, en 30 à 60 minutes." }

$latest = $rels[0].tag_name
$rel = $null; $asset = $null
foreach ($r in $rels) {
  $a = @($r.assets | Where-Object { $_.name -like '*.iso' }) | Select-Object -First 1
  if ($a) { $rel = $r; $asset = $a; break }
}
if (-not $asset) { Stop-Brume "La release $latest n'a pas encore d'ISO : sa fabrication est peut-être en cours (onglet Actions du dépôt). Réessaie quand elle est terminée." }
$name = [string]$asset.name
if ($name -match '[\\/]' -or $name.StartsWith('..')) { Stop-Brume "Nom de fichier inattendu dans la release : « $name »." }
$size = [int64]$asset.size
if ($rel.tag_name -ne $latest) { Write-Host "La release $latest n'a pas encore son ISO (fabrication en cours ?) : je prends celle de $($rel.tag_name)." }
Write-Host ("Image : {0} ({1}), release {2}" -f $name, (Format-Go $size), $rel.tag_name)

$file = Join-Path $Dest $name
$part = "$file.part"

if ((Get-Size $file) -eq $size) {
  Write-Host "Déjà téléchargée : $file"
} elseif ((Get-Size $part) -eq $size) {
  Move-Item -LiteralPath $part -Destination $file -Force
} else {
  $root = [System.IO.Path]::GetPathRoot($Dest)
  try { $free = (New-Object System.IO.DriveInfo($root)).AvailableFreeSpace } catch { $free = $null }
  $need = $size - (Get-Size $part) + 100MB
  if ($free -ne $null -and $free -lt $need) { Stop-Brume ("Pas assez de place dans « $Dest » : il faut {0} de libre." -f (Format-Go $need)) }
  if ((Get-Size $part) -gt 0) { Write-Host ("Reprise du téléchargement à {0}." -f (Format-Go (Get-Size $part))) }
  Write-Host "Téléchargement vers $Dest"
  if ($token) { $url = [string]$asset.url } else { $url = [string]$asset.browser_download_url }

  $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
  if ($curl) {
    # curl.exe (fourni avec Windows 10 et 11) : barre de progression et reprise (-C -), jusqu'à 5 fois
    $cargs = @('-L', '--fail', '--retry', '3', '--retry-delay', '3', '-C', '-', '-#', '-o', $part, '-H', 'User-Agent: brume-os-iso')
    if ($token) { $cargs += @('-H', "Authorization: Bearer $token", '-H', 'Accept: application/octet-stream') }
    $cargs += $url
    $n = 0
    while ($true) {
      $ErrorActionPreference = 'Continue'
      & $curl.Source @cargs
      $ok = ($LASTEXITCODE -eq 0)
      $ErrorActionPreference = 'Stop'
      if ($ok) { break }
      $n++
      if ($n -ge 5) { Stop-Brume "Le téléchargement s'est arrêté. Relance la même commande : il reprendra où il en était." }
      Write-Host "Connexion interrompue : reprise dans 3 secondes (essai $n sur 4)…"
      Start-Sleep -Seconds 3
    }
  } else {
    # Sans curl.exe (Windows ancien) : téléchargement d'un bloc, sans reprise
    Write-Host "Téléchargement en cours, sans barre de progression : patience…"
    $h = @{}
    if ($token) { $h['Authorization'] = "Bearer $token"; $h['Accept'] = 'application/octet-stream' }
    try { Invoke-WebRequest -UseBasicParsing -UserAgent 'brume-os-iso' -Uri $url -Headers $h -OutFile $part }
    catch { Stop-Brume "Le téléchargement s'est arrêté. Relance la même commande." }
  }
  if ((Get-Size $part) -ne $size) { Stop-Brume "Le fichier reçu n'a pas la bonne taille. Supprime « $part » et relance la commande." }
  Move-Item -LiteralPath $part -Destination $file -Force
}

# Vérification : l'empreinte SHA-256 que GitHub calcule pour chaque fichier de release
$digest = [string]$asset.digest
if ($digest -like 'sha256:*') {
  Write-Host "Vérification du fichier…"
  $sum = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
  if ($sum -ine $digest.Substring(7)) {
    Move-Item -LiteralPath $file -Destination "$file.abime" -Force
    Stop-Brume "Le fichier est abîmé (empreinte différente) : je l'ai renommé « $name.abime ». Supprime-le et relance la commande."
  }
  Write-Host "Fichier vérifié (SHA-256)." -ForegroundColor Green
} else {
  Write-Host "GitHub ne donne pas d'empreinte pour ce fichier : taille vérifiée seulement."
}

Write-Host ''
Write-Host "Image prête : $file" -ForegroundColor Green
Write-Host "Pour la mettre sur une clé USB : Rufus (rufus.ie) ; règle une « partition persistante » pour garder tes fichiers."
Write-Host "Pour l'essayer sans rien toucher : une machine virtuelle VirtualBox (Linux, Debian 64-bit)."
