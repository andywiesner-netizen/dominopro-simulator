<#
  serve.ps1 — sirve el simulador localmente por HTTP para probarlo
  (el service worker / PWA no se registra con file://; necesita http).
  Uso:  .\scripts\serve.ps1            (puerto 8080)
        .\scripts\serve.ps1 -Port 5500
#>
param([int]$Port = 8080)
$Root = Split-Path $PSScriptRoot -Parent   # raíz del repo (carpeta padre de \scripts)
Write-Host "Sirviendo  $Root" -ForegroundColor Cyan
Write-Host "Abre       http://localhost:$Port/   (Ctrl+C para parar)" -ForegroundColor Yellow
if (Get-Command python -ErrorAction SilentlyContinue) {
  python -m http.server $Port --directory $Root
} elseif (Get-Command npx -ErrorAction SilentlyContinue) {
  npx --yes serve -l $Port $Root
} else {
  Write-Host "Necesitas Python o Node para servir localmente." -ForegroundColor Red
}
