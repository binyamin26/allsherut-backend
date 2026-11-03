# Usage : run-check-profile-on-fly.ps1 -Email prestataire@exemple.com
# Affiche ce qui manque au profil (photo, galerie, experience, description, langues) et son statut. Lecture seule.
param([Parameter(Mandatory = $true)][string]$Email)
$ErrorActionPreference = 'Stop'
if ($Email -notmatch '^[A-Za-z0-9._%+@-]+$') { throw "Email avec caracteres inattendus." }
$app = 'homesherut-backend'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path $dir 'check-profile-by-email.js'
$flybin = Join-Path $env:USERPROFILE '.fly\bin'
$flyctl = Join-Path $flybin 'flyctl.exe'
if (-not (Test-Path $flyctl)) {
  $old = Join-Path $flybin 'flyctl.exe.old'
  if (Test-Path $old) { Copy-Item $old $flyctl -Force }
}
if (-not (Test-Path $flyctl)) { $c = Get-Command flyctl -ErrorAction SilentlyContinue; if ($c) { $flyctl = $c.Source } else { throw "flyctl introuvable." } }
$env:FLY_NO_UPDATE_CHECK = '1'
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($src))
$remote = "echo $b64 | base64 -d > /app/scripts/check-by-email.js && cd /app && node scripts/check-by-email.js $Email"
& $flyctl ssh console -a $app -C "sh -c '$remote'"
