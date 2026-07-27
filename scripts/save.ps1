<#
  save.ps1 — guarda en git SIN desplegar en Netlify (commit con [skip ci]).
  Para respaldo y sincronizar entre máquinas durante el desarrollo.
  Publicar en Netlify se hace aparte con publish.ps1 (solo en hitos).
#>
param([string]$Message = "wip")
$Root = Split-Path $PSScriptRoot -Parent
git -C $Root add -A
$pending = git -C $Root status --porcelain
if ([string]::IsNullOrWhiteSpace($pending)) {
  Write-Host "Nada que guardar." -ForegroundColor DarkGray
} else {
  git -C $Root commit -m "$Message [skip ci]"
  git -C $Root push
  Write-Host "Guardado en git (sin deploy)." -ForegroundColor Green
}
