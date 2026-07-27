# Simulador de Dominó (por parejas) — módulo independiente

Módulo **autónomo** de simulación/análisis de dominó doble-6 por parejas.
Está pensado para **correr solo** (PWA instalable, offline) **o** enchufarse
como **add-on** dentro de la app de torneos *dominopro* (ver `INTEGRATION.md`).

Es una única página sin dependencias externas ni build: HTML + CSS + JS en
`index.html`, más el manifest, el service worker y los iconos para PWA.

## Contenido

- `index.html` — la app (asistente en vivo, simulador de mesa, IA, Monte Carlo, guardar/cargar).
- `manifest.webmanifest`, `sw.js`, `icon-*.png`, `apple-touch-icon.png` — PWA (instalable + offline).
- `INTEGRATION.md` — cómo embeberlo en dominopro y el contrato de API para guardar partidas.

## Correr solo (standalone)

Sirve la carpeta como estático (cualquier host):

- GitHub Pages: sube estos archivos a la raíz del repo/rama de Pages → queda en tu URL.
- Local para probar: `python3 -m http.server 8080` dentro de esta carpeta → http://localhost:8080/
  (el service worker necesita http/https; con `file://` la app funciona pero no se registra el SW.)

Instalar como app: en Android/Chrome "Instalar app"; en iPhone/Safari Compartir → "Añadir a pantalla de inicio".

> Al publicar una versión nueva de `index.html`, incrementa la versión de caché en `sw.js`
> (`domino-vN`) para que los dispositivos instalados se actualicen.

## Diseño de acoplamiento (importante)

Para que sirva "sola o como add-on":

1. **No depende del frontend de dominopro** (cero imports cruzados). Se integra por iframe o ruta.
2. **Funciona 100% local/offline** por defecto (guardados en `localStorage`).
3. Si el host le inyecta una configuración de backend (`window.DOMINOPRO`), entonces
   **usa la API de dominopro** para guardar/leer partidas. Ver `INTEGRATION.md`.
