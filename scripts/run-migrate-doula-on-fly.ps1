# Envoie scripts/migrate-add-doula-service.js dans le conteneur Fly et l'execute.
# Lancer :  .\run-migrate-doula-on-fly.ps1
# Le script demande s'il doit ecrire ou juste faire un apercu.
#
$ErrorActionPreference = 'Stop'
$app = 'homesherut-backend'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path $dir 'migrate-add-doula-service.js'
if (-not (Test-Path $src)) { throw "Introuvable : $src" }

# --- localiser / reparer flyctl ---
$flybin = Join-Path $env:USERPROFILE '.fly\bin'
$flyctl = Join-Path $flybin 'flyctl.exe'
if (-not (Test-Path $flyctl)) {
  $old = Join-Path $flybin 'flyctl.exe.old'
  if (Test-Path $old) { Copy-Item $old $flyctl -Force }
}
if (-not (Test-Path $flyctl)) {
  $cmd = Get-Command flyctl -ErrorAction SilentlyContinue
  if ($cmd) { $flyctl = $cmd.Source } else { throw "flyctl introuvable." }
}
$env:FLY_NO_UPDATE_CHECK = '1'
Write-Host "flyctl : $flyctl"

# --- mode : apercu par defaut, ecriture si on tape OUI ---
$rep = Read-Host "Ecrire en base ? Tape OUI pour ecrire, ou Entree pour un simple apercu"
if ($rep -eq 'OUI') {
  $mode = ''
  Write-Host ">>> MODE ECRITURE : les ENUM service_type de la prod vont etre modifies (ajout de doula)."
} else {
  $mode = '--dry'
  Write-Host ">>> MODE APERCU (dry-run) : rien ne sera modifie."
}

# --- envoi + execution ---
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($src))
$remote = "echo $b64 | base64 -d > /app/scripts/migrate-doula.js && node /app/scripts/migrate-doula.js $mode"
& $flyctl ssh console -a $app -C "sh -c '$remote'"
