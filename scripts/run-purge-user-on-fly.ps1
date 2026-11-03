# Usage : run-purge-user-on-fly.ps1 -Search "RT Tester"        -> cherche + apercu (rien supprime)
#         run-purge-user-on-fly.ps1 -UserId 123                -> apercu pour cet id
#         run-purge-user-on-fly.ps1 -UserId 123 -Apply         -> supprime definitivement
param([string]$Search = '', [int]$UserId = 0, [switch]$Apply)
$ErrorActionPreference = 'Stop'
$app = 'homesherut-backend'
$flybin = Join-Path $env:USERPROFILE '.fly\bin'
$flyctl = Join-Path $flybin 'flyctl.exe'
if (-not (Test-Path $flyctl)) {
  $old = Join-Path $flybin 'flyctl.exe.old'
  if (Test-Path $old) { Copy-Item $old $flyctl -Force }
}
if (-not (Test-Path $flyctl)) { $c = Get-Command flyctl -ErrorAction SilentlyContinue; if ($c) { $flyctl = $c.Source } else { throw "flyctl introuvable." } }
$env:FLY_NO_UPDATE_CHECK = '1'
if ($UserId -gt 0) { $a = "--user-id=$UserId"; if ($Apply) { $a += ' --yes' } else { $a += ' --dry' } }
elseif ($Search) { $a = "--search=$Search --dry" }
else { throw "Donne -Search ou -UserId" }
& $flyctl ssh console -a $app -C "node /app/scripts/purge-user.js $a"
