# Desplegar dominopro-simulator (repo aparte)

Sitio estático (una sola página + PWA). Sin build. Su carpeta LOCAL es indiferente;
lo que importa es la URL donde lo despliegas (esa será tu VITE_SIMULATOR_URL).

## Crear el repo (una vez)
    cd <donde-guardes-tus-repos>/dominopro-simulator
    git init
    git add .
    git commit -m "init: simulador de dominó (standalone/PWA)"
    git branch -M main
    git remote add origin https://github.com/andywiesner-netizen/dominopro-simulator.git
    git push -u origin main

## Desplegar
- Netlify: Add new site → Import from Git → este repo. Publish directory = "." (netlify.toml).
  URL resultante → tu VITE_SIMULATOR_URL.
- o GitHub Pages: activa Pages sobre main (raíz).

## Otras máquinas / máquina nueva
    git clone https://github.com/andywiesner-netizen/dominopro-simulator.git
Sin dependencias; se edita index.html directo. Al publicar cambios, sube la versión
de caché en sw.js (domino-vN → v(N+1)) para refrescar dispositivos instalados.
