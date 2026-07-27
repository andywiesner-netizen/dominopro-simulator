# Scripts del simulador (PowerShell)

Van dentro del repo del simulador, en `dominopro-simulator\scripts\`.
Usan rutas relativas a su propia ubicación (`$PSScriptRoot`), así que funcionan
igual en cualquier máquina sin editar nada. Al vivir en el repo, se sincronizan por git.

Si PowerShell bloquea la ejecución la primera vez:
    Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

- **serve.ps1**  — sirve el simulador en http://localhost:8080 para probar la PWA (offline/SW).
- **bump-sw.ps1** — sube la versión de caché del service worker (para refrescar instalaciones).
- **sync.ps1**   — `git pull` del repo (al empezar en cada máquina).
- **save.ps1**   — guarda en git SIN desplegar (commit con [skip ci]) — respaldo y sync entre máquinas.
- **publish.ps1**— sube sw + commit + push en un paso (dispara el despliegue).

> Netlify NO despliega commits cuyo mensaje contenga [skip ci]. publish.ps1 sí despliega (bump sw + push sin skip).

## Flujo típico
    .\scripts\sync.ps1                         # traer lo último
    .\scripts\serve.ps1                        # probar en local mientras editas index.html
    .\scripts\publish.ps1 -Message "cambios"   # publicar
