# Scripts del simulador (PowerShell)

Van dentro del repo del simulador, en `dominopro-simulator\scripts\`.
Usan rutas relativas a su propia ubicación (`$PSScriptRoot`), así que funcionan
igual en cualquier máquina sin editar nada. Al vivir en el repo, se sincronizan por git.

Si PowerShell bloquea la ejecución la primera vez:
    Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

- **serve.ps1**  — sirve el simulador en http://localhost:8080 para probar la PWA (offline/SW).
- **bump-sw.ps1** — sube la versión de caché del service worker (para refrescar instalaciones).
- **sync.ps1**   — `git pull` del repo (al empezar en cada máquina).
- **publish.ps1**— sube sw + commit + push en un paso (dispara el despliegue).

## Flujo típico
    .\scripts\sync.ps1                         # traer lo último
    .\scripts\serve.ps1                        # probar en local mientras editas index.html
    .\scripts\publish.ps1 -Message "cambios"   # publicar
