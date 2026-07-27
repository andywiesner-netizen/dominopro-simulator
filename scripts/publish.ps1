<#
  publish.ps1 — publica cambios del simulador en un paso:
    (1) sube la versión del service worker  (salta con -NoBump)
    (2) git add + commit + push  → dispara el despliegue (Netlify/GitHub Pages)
  Uso:  .\scripts\publish.ps1 -Message "mesa: giro en esquinas"
        .\scripts\publish.ps1                 (mensaje por defecto)
        .\scripts\publish.ps1 -NoBump         (sin tocar sw.js)
#>
param([string]$Message = "update simulador", [switch]$NoBump)
$Root = Split-Path $PSScriptRoot -Parent
if (-not $NoBump) { & (Join-Path $PSScriptRoot "bump-sw.ps1") }
git -C $Root add -A
# commit solo si hay cambios
$pending = git -C $Root status --porcelain
if ([string]::IsNullOrWhiteSpace($pending)) {
  Write-Host "No hay cambios que publicar." -ForegroundColor DarkGray
} else {
  git -C $Root commit -m $Message
  git -C $Root push
  Write-Host "Publicado. El despliegue se actualizará en 1-2 min." -ForegroundColor Green
}
