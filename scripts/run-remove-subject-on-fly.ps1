# Usage : run-remove-subject-on-fly.ps1 -ProviderId 217 -Value "ףורגא"           -> apercu
#         run-remove-subject-on-fly.ps1 -ProviderId 217 -Value "ףורגא" -Apply    -> applique
param([int]$ProviderId, [string]$Value, [switch]$Apply)
$ErrorActionPreference = 'Stop'
$app = 'homesherut-backend'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path $dir 'remove-subject.js'
$flybin = Join-Path $env:USERPROFILE '.fly\bin'
$flyctl = Join-Path $flybin 'flyctl.exe'
if (-not (Test-Path $flyctl)) { $c = Get-Command flyctl -ErrorAction SilentlyContinue; if ($c) { $flyctl = $c.Source } else { throw "flyctl introuvable." } }
$env:FLY_NO_UPDATE_CHECK = '1'
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($src))
$valB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Value))
$flag = if ($Apply) { '--yes' } else { '' }
$remote = "echo $b64 | base64 -d > /app/scripts/remove-subject.js && cd /app && node scripts/remove-subject.js $ProviderId $valB64 $flag"
& $flyctl ssh console -a $app -C "sh -c '$remote'"
