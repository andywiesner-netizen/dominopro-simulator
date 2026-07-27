# Integrar el simulador en dominopro

El simulador es un módulo autónomo. Se recomienda mantenerlo en **su propio
directorio** (carpeta en el monorepo, p.ej. `/simulator`, o un repo aparte) para
que pueda desplegarse solo y a la vez enchufarse como add-on.

Regla de oro: el simulador **no importa** nada del `frontend/` de dominopro.
La comunicación es en un solo sentido y opcional: el host (dominopro) puede
inyectar configuración de backend; el simulador la detecta y la usa si está.

---

## Opción A — Embed por iframe (agnóstico: React, Vue o vanilla)

Es la de menor acoplamiento y funciona hoy con cualquier stack.

```html
<!-- dentro de una página/vista de dominopro -->
<iframe
  src="/simulator/index.html"          <!-- o la URL de despliegue del módulo -->
  title="Simulador de dominó"
  style="width:100%;height:100vh;border:0"
  allow="clipboard-write"></iframe>
```

Para pasarle la config de backend al iframe, usa `postMessage` (opcional):

```js
const frame = document.querySelector('iframe');
frame.addEventListener('load', () => {
  frame.contentWindow.postMessage({
    type: 'DOMINOPRO_CONFIG',
    apiBase: 'https://api.dominopro.tld',
    token: '<jwt-de-sesión>'
  }, location.origin);
});
```

## Opción B — Ruta / componente (si el frontend es React/Vue)

Monta el módulo como ruta con carga diferida. Lo más simple sigue siendo
envolver el iframe en un componente; si prefieres integrarlo "nativo", habría
que portar `index.html` a componentes (más trabajo y más acoplamiento).

```jsx
// React — ruta perezosa que embebe el módulo
const Simulador = () => (
  <iframe src="/simulator/index.html" title="Simulador"
          style={{width:'100%',height:'100%',border:0}} />
);
```

---

## Detección del backend (feature-detection)

El simulador arranca en **modo local** (localStorage). Si detecta configuración
de dominopro, cambia a **modo backend** para guardar/leer partidas.

El host puede inyectar la config de dos formas:

1. Variable global antes de cargar el simulador:
   ```html
   <script>window.DOMINOPRO = { apiBase: "https://api.dominopro.tld", token: "..." };</script>
   ```
2. `postMessage` (ver arriba, para iframes).

Si `window.DOMINOPRO?.apiBase` no existe o la API no responde → cae a local.

---

## Contrato de API (a implementar en el backend Python de dominopro)

Recurso: **partidas/fotos del simulador**. Sugerencia de rutas bajo `/api/sim`.

Cabecera de auth (si hay token): `Authorization: Bearer <token>`.

### Modelo `Position` (JSON)

```json
{
  "id": "opcional-al-crear",
  "name": "Reparto 2026-07-19",
  "createdAt": "2026-07-19T21:30:00Z",
  "position": {
    "hands": [["6-6","4-2"], ["..."], ["..."], ["..."]],
    "ends": [6, 4],
    "sequence": [[6,6],[6,3]],
    "current": 1,
    "passes": 0,
    "starter": 2,
    "dealMode": "aleatoria"
  },
  "meta": { "app": "domino-sim", "version": 1 }
}
```

- `hands`: array de 4 manos (asientos 0=Sur/TÚ, 1=Este/RD, 2=Norte/CO, 3=Oeste/RI),
  cada mano lista de fichas `"a-b"` con `a<=b`.
- `sequence`: fichas jugadas en orden izquierda→derecha, como `[a,b]`.
- `ends`: valores de las dos puntas `[izq, der]`.
- `current`: asiento al que le toca. `starter`: asiento que salió. `passes`: pases seguidos.

### Endpoints

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| `GET`    | `/api/sim/positions`      | — | `[{id,name,createdAt,summary}]` |
| `POST`   | `/api/sim/positions`      | `Position` (sin id) | `{id}` (201) |
| `GET`    | `/api/sim/positions/{id}` | — | `Position` completa |
| `DELETE` | `/api/sim/positions/{id}` | — | `204` |

`summary` (para la lista) sugerido: `{ played: <nº fichas jugadas>, starter: <0..3> }`.

### Comportamiento del cliente (simulador)

- Guardar/Cargar usan la API si hay backend; si falla la red, escriben/leen en
  `localStorage` como respaldo (para no perder datos offline).
- La cola offline (sincronizar cuando vuelva la red) es una mejora opcional posterior.

---

## Notas de despliegue

- Standalone: la carpeta se sirve como estático (GitHub Pages, Netlify, etc.).
- Como add-on dentro de dominopro: sirve `/simulator/` desde el mismo dominio
  (evita CORS y permite compartir el token por `postMessage` con `location.origin`).
- Si va en dominio distinto, habilita CORS en el backend para el origen del simulador.
