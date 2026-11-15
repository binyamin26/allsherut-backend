# Remplace le telephone du prestataire 217 par 0548961675 en prod.
# Lancer :  powershell -ExecutionPolicy Bypass -File .\backend\scripts\run-set-phone-217-on-fly.ps1
$ErrorActionPreference = 'Stop'
$app = 'homesherut-backend'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

$flyctl = Join-Path $env:USERPROFILE '.fly\bin\flyctl.exe'
if (-not (Test-Path $flyctl)) {
  $old = Join-Path $env:USERPROFILE '.fly\bin\flyctl.exe.old'
  if (Test-Path $old) { Copy-Item $old $flyctl -Force }
}
if (-not (Test-Path $flyctl)) { $c = Get-Command flyctl -ErrorAction SilentlyContinue; if ($c) { $flyctl = $c.Source } else { throw "flyctl introuvable." } }
$env:FLY_NO_UPDATE_CHECK = '1'

$rep = Read-Host "Ecrire en base ? Tape OUI, ou Entree pour un apercu"
$flag = if ($rep -eq 'OUI') { '' } else { '--dry' }
if ($flag) { Write-Host ">>> APERCU" } else { Write-Host ">>> ECRITURE" }

$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $dir 'set-phone-provider-217.js')))
$remote = "echo $b64 | base64 -d > /app/scripts/set-phone-provider-217.js && node /app/scripts/set-phone-provider-217.js $flag"
$out = & $flyctl ssh console -a $app -C "sh -c '$remote'"
Write-Host ($out -join "`n")
