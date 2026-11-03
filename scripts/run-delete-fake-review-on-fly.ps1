# Usage : run-delete-fake-review-on-fly.ps1                         -> LISTE les avis recents de l'email
#         run-delete-fake-review-on-fly.ps1 -Ids "12" -Apply        -> supprime l'avis 12
param([string]$Email = 'binou.ben26@gmail.com', [string]$Ids = '', [switch]$Apply)
$ErrorActionPreference = 'Stop'
$app = 'homesherut-backend'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path $dir 'delete-fake-review.js'
$flybin = Join-Path $env:USERPROFILE '.fly\bin'
$flyctl = Join-Path $flybin 'flyctl.exe'
if (-not (Test-Path $flyctl)) {
  $old = Join-Path $flybin 'flyctl.exe.old'
  if (Test-Path $old) { Copy-Item $old $flyctl -Force }
}
if (-not (Test-Path $flyctl)) { $c = Get-Command flyctl -ErrorAction SilentlyContinue; if ($c) { $flyctl = $c.Source } else { throw "flyctl introuvable." } }
$env:FLY_NO_UPDATE_CHECK = '1'
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($src))
$extra = ''
if ($Apply -and $Ids) { $extra = "--ids=$Ids --yes" }
$remote = "echo $b64 | base64 -d > /app/scripts/delete-fake-review.js && cd /app && node scripts/delete-fake-review.js $Email $extra"
& $flyctl ssh console -a $app -C "sh -c '$remote'"
