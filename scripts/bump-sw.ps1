<#
  bump-sw.ps1 — sube la versión de caché del service worker (domino-vN -> v(N+1))
  para que los dispositivos con la PWA instalada tomen la versión nueva.
  Corre antes de publicar cambios en index.html.
#>
$Root = Split-Path $PSScriptRoot -Parent
$Sw = Join-Path $Root "sw.js"
if (-not (Test-Path $Sw)) { Write-Host "No existe $Sw" -ForegroundColor Red; exit 1 }
$content = Get-Content $Sw -Raw
$m = [regex]::Match($content, 'domino-v(\d+)')
if (-not $m.Success) { Write-Host "No encontré 'domino-vN' en sw.js" -ForegroundColor Red; exit 1 }
$n = [int]$m.Groups[1].Value; $next = $n + 1
$content = $content -replace "domino-v$n", "domino-v$next"
Set-Content -Path $Sw -Value $content -Encoding UTF8 -NoNewline
Write-Host "sw.js: domino-v$n -> domino-v$next" -ForegroundColor Green
