<#
  sync.ps1 — trae los últimos cambios del repo (haz esto al empezar en cualquier máquina).
#>
$Root = Split-Path $PSScriptRoot -Parent
git -C $Root pull --ff-only
