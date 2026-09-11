"use strict";
/* ================= REPARTO SOBRE LA MESA =================
   Sustituye la pantalla de reposo del simulador: en vez de "Elige un modo
   arriba", muestra las 28 fichas en el centro y deja repartirlas a las
   cuatro bandas.

   Se carga DESPUÉS de ui.js y solo redefine simIdle y el botón Al Azar.
   Para quitarlo basta con borrar sus dos líneas de index.html.

   Arrastre con eventos de puntero, no con el arrastre nativo de HTML:
   el nativo solo responde al ratón y en un teléfono no pasa nada. Con
   pointerdown/move/up el ratón, el dedo y el lápiz van por el mismo
   camino. */

(function () {
  // banda -> posición en pantalla (0 abajo, 1 derecha, 2 arriba, 3 izquierda)
  const POS_DE_BANDA = { bandS: 0, bandE: 1, bandN: 2, bandW: 3 };
  const BANDAS = Object.keys(POS_DE_BANDA);

  const asientoDe = (idBanda) => seatAtPos(POS_DE_BANDA[idBanda]);
  const contar = (p) => Object.values(owner).filter((v) => v === p).length;
  const libres = () =>
    allTiles()
      .map((t) => key(t[0], t[1]))
      .filter((k) => owner[k] === undefined);

  let arrastre = null;
  let elegida = null;        // para el modo dos toques
  let huboArrastre = false;  // evita que el clic posterior repita la acción
  const UMBRAL = 8;          // px antes de considerarlo arrastre y no toque

  /* ---------- pintado ---------- */

  function pintarReparto() {
    const dc = document.getElementById("dcenter");
    if (!dc) return;

    const pendientes = libres();
    const total = 28 - pendientes.length;

    dc.innerHTML =
      `<div class="dealtitulo">Reparto · <b>${total}</b>/28` +
      (elegida ? ` · toca un jugador para darle ${elegida}` : "") +
      `</div>` +
      `<div class="dealgrid" id="dealGrid"></div>` +
      (pendientes.length
        ? `<div class="dealbotones">` +
          `<button class="btn gold" id="dealResto">🎲 Repartir resto al azar</button>` +
          (total ? `<button class="btn ghost" id="dealLimpiar">🧹 Limpiar</button>` : "") +
          `</div>`
        : "") +
      `<div class="dealpie">Arrastra una ficha a un jugador, o tócala y luego tócalo a él` +
      (total ? ` · toca una ya repartida para devolverla al montón` : "") +
      `</div>`;

    const bResto = document.getElementById("dealResto");
    if (bResto) bResto.onclick = repartirResto;
    const bLimpiar = document.getElementById("dealLimpiar");
    if (bLimpiar) bLimpiar.onclick = limpiar;

    const g = document.getElementById("dealGrid");
    pendientes.forEach((k) => {
      const t = kt(k);
      const d = document.createElement("div");
      d.className = "pick dealtile" + (elegida === k ? " sel" : "");
      d.dataset.k = k;
      d.innerHTML = tileHTML(t[0], t[1], "sm");
      g.appendChild(d);
    });

    BANDAS.forEach(pintarBanda);
    pedirSalidor(total === 28);
  }

  function pintarBanda(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const pos = POS_DE_BANDA[id];
    const asiento = asientoDe(id);
    const n = contar(asiento);
    const suyas = Object.keys(owner).filter((k) => owner[k] === asiento);
    const dePie = pos === 0 || pos === 2;

    el.innerHTML = "";
    el.classList.add("zona");
    el.classList.toggle("llena", n >= 7);
    el.dataset.asiento = asiento;

    const lab = document.createElement("div");
    lab.className = "lbl";
    lab.innerHTML = `${ROLE[asiento]} · ${POS_COMPASS[pos]} · <b>${n}</b>/7`;

    const wrap = document.createElement("div");
    wrap.className = dePie ? "hand" : "handv";
    suyas.forEach((k) => {
      const t = kt(k);
      const d = document.createElement("div");
      d.className = "pick dealtile asignada";
      d.dataset.k = k;
      d.innerHTML = tileHTML(t[0], t[1], dePie ? "sm vert" : "sm");
      wrap.appendChild(d);
    });

    if (pos === 0) {
      el.appendChild(wrap);
      el.appendChild(lab);
    } else {
      el.appendChild(lab);
      el.appendChild(wrap);
    }
  }

  /* ---------- asignar y quitar ---------- */

  function asignar(k, asiento) {
    if (owner[k] === asiento) return;
    if (contar(asiento) >= 7) {
      // Rebote: la ficha se queda donde estaba (montón o banda de origen).
      // owner no se toca, así que no se pierde ni se duplica.
      toast(`${ROLE[asiento]} ya tiene 7`);
      rebotar(asiento);
      return;
    }
    simDealMode = "manual";
    owner[k] = asiento;
    completarSiFalta();
    pintarReparto();
  }

  function devolver(k) {
    if (owner[k] === undefined) return;
    delete owner[k];
    simStarter = null;
    pintarReparto();
  }

  function rebotar(asiento) {
    const id = BANDAS.find((b) => asientoDe(b) === asiento);
    const el = id && document.getElementById(id);
    if (!el) return;
    el.classList.remove("rebota");
    void el.offsetWidth; // fuerza el reinicio de la animación
    el.classList.add("rebota");
    setTimeout(() => el.classList.remove("rebota"), 400);
  }

  // Reparte lo que siga en el montón entre las manos incompletas hasta dejar
  // las cuatro a 7. Un hueco por cada sitio libre: así el sorteo no puede
  // pasarse del tope ni dejar a nadie corto.
  function repartirResto() {
    const pendientes = shuffle(libres());
    if (!pendientes.length) {
      toast("El montón ya está vacío");
      return;
    }
    const huecos = [];
    [0, 1, 2, 3].forEach((p) => {
      for (let i = contar(p); i < 7; i++) huecos.push(p);
    });
    shuffle(huecos);
    const eranManuales = 28 - pendientes.length;
    pendientes.forEach((k, i) => (owner[k] = huecos[i]));
    simDealMode = eranManuales ? "manual" : "aleatoria";
    simStarter = null;
    elegida = null;
    pintarReparto();
    toast(
      eranManuales
        ? `${pendientes.length} fichas repartidas al azar`
        : "Repartido · elige quién sale"
    );
  }

  function limpiar() {
    owner = {};
    simStarter = null;
    elegida = null;
    pintarReparto();
  }

  // Con 21 repartidas, las 7 que quedan son forzosamente del cuarto jugador.
  // Repartirlas a mano no aporta nada y es donde se cometen errores.
  function completarSiFalta() {
    const pendientes = libres();
    if (pendientes.length !== 7) return;
    const falta = [0, 1, 2, 3].find((p) => contar(p) === 0);
    if (falta === undefined) return;
    pendientes.forEach((k) => (owner[k] = falta));
    toast(`Las últimas 7 son de ${ROLE[falta]}`);
  }

  /* ---------- quién sale ---------- */

  function pedirSalidor(completo) {
    if (!completo) {
      clearPanel();
      return;
    }
    const botones = [0, 1, 2, 3]
      .map(
        (p) =>
          `<button class="btn ${simStarter === p ? "gold" : "ghost"}" data-sale="${p}">` +
          `${ROLE[p]} · ${POS_COMPASS[posOf(p)]}</button>`
      )
      .join("");
    dpanel(
      `<div class="ovcard"><div class="center" style="margin-bottom:8px">¿Quién sale?</div>` +
        `<div class="btnrow grow">${botones}</div>` +
        `<div class="btnrow grow" style="margin-top:8px">` +
        `<button class="btn ghost" data-limpiar>🧹 Limpiar reparto</button></div></div>`
    );
    document.querySelectorAll("#dpanel button[data-sale]").forEach((b) => {
      b.onclick = () => {
        simStarter = +b.dataset.sale;
        clearPanel();
        startSimGame();
      };
    });
    const lim = document.querySelector("#dpanel button[data-limpiar]");
    if (lim) lim.onclick = limpiar;
  }

  /* ---------- arrastre con eventos de puntero ---------- */

  function bandaBajo(x, y) {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest(".band.zona") : null;
  }

  function enCentro(x, y) {
    const el = document.elementFromPoint(x, y);
    return !!(el && el.closest("#dcenter"));
  }

  function empezar(ev) {
    if (GS) return; // solo durante el reparto
    const ficha = ev.target.closest(".dealtile");
    if (!ficha) return;
    ev.preventDefault();

    const k = ficha.dataset.k;
    const t = kt(k);
    const fantasma = document.createElement("div");
    fantasma.className = "dealghost";
    fantasma.innerHTML = tileHTML(t[0], t[1], "md");
    document.body.appendChild(fantasma);

    arrastre = {
      k,
      fantasma,
      el: ficha,
      x0: ev.clientX,
      y0: ev.clientY,
      movido: false,
      desdeBanda: owner[k] !== undefined,
    };
    mover(ev);
    // Si el puntero ya no está activo (toques muy rápidos), capturar lanza.
    // Sin el try, el arrastre se quedaría a medias y el fantasma en pantalla.
    try { ficha.setPointerCapture?.(ev.pointerId); } catch (_) {}
    ficha.addEventListener("pointermove", mover);
    ficha.addEventListener("pointerup", soltar);
    ficha.addEventListener("pointercancel", soltar);
  }

  function mover(ev) {
    if (!arrastre) return;
    // Un toque con el dedo casi siempre mueve uno o dos píxeles. Sin umbral,
    // todo toque se tomaría por arrastre y el modo de dos toques no
    // funcionaría nunca.
    if (Math.hypot(ev.clientX - arrastre.x0, ev.clientY - arrastre.y0) > UMBRAL)
      arrastre.movido = true;
    // La ficha se dibuja POR ENCIMA del punto de contacto: si va debajo,
    // el pulgar la tapa y no ves lo que llevas.
    arrastre.fantasma.style.transform =
      `translate(${ev.clientX}px, ${ev.clientY}px) translate(-50%, -150%)`;
    const b = bandaBajo(ev.clientX, ev.clientY);
    document
      .querySelectorAll(".band.zona")
      .forEach((z) => z.classList.toggle("encima", z === b && !z.classList.contains("llena")));
  }

  function soltar(ev) {
    if (!arrastre) return;
    const { k, fantasma, el, movido, desdeBanda } = arrastre;
    fantasma.remove();
    document.querySelectorAll(".band.zona").forEach((z) => z.classList.remove("encima"));
    el.removeEventListener("pointermove", mover);
    el.removeEventListener("pointerup", soltar);
    el.removeEventListener("pointercancel", soltar);
    arrastre = null;
    huboArrastre = movido;

    if (!movido) {
      // Fue un toque, no un arrastre: dos toques es más cómodo que
      // arrastrar 28 veces con el dedo.
      if (desdeBanda) devolver(k);
      else {
        elegida = elegida === k ? null : k;
        pintarReparto();
      }
      return;
    }

    const b = bandaBajo(ev.clientX, ev.clientY);
    if (b) asignar(k, +b.dataset.asiento);
    else if (desdeBanda && enCentro(ev.clientX, ev.clientY)) devolver(k);
  }

  // Un toque en una banda entrega la ficha elegida (modo dos toques)
  function tocarBanda(ev) {
    if (huboArrastre) { huboArrastre = false; return; }
    if (GS || arrastre || !elegida) return;
    const b = ev.target.closest(".band.zona");
    if (!b) return;
    const k = elegida;
    elegida = null;
    asignar(k, +b.dataset.asiento);
  }

  document.addEventListener("pointerdown", empezar, { passive: false });
  document.addEventListener("click", tocarBanda);

  /* ---------- enganches ---------- */

  const idleOriginal = simIdle;
  simIdle = function () {
    idleOriginal();
    document.getElementById("simGame")?.classList.add("repartiendo");
    pintarReparto();
  };

  const renderOriginal = simRender;
  simRender = function () {
    if (GS) {
      document.getElementById("simGame")?.classList.remove("repartiendo");
      document.querySelectorAll(".band.zona").forEach((z) => {
        z.classList.remove("zona", "llena", "encima");
      });
    }
    renderOriginal();
  };

  // Al Azar reparte pero ya no arranca solo: el salidor lo eliges tú.
  const azar = document.getElementById("tbAzar");
  if (azar)
    azar.onclick = () => {
      owner = {};
      simDealMode = "aleatoria";
      simStarter = null;
      elegida = null;
      GS = null;
      shuffle(allTiles().map((x) => key(x[0], x[1]))).forEach(
        (k, i) => (owner[k] = Math.floor(i / 7))
      );
      simIdle();
      show("simGame");
      toast("Repartido · elige quién sale");
    };

  // ui.js llama a simIdle() al cargarse, cuando este fichero todavía no existe
  // y el enganche de arriba aún no está puesto: sin esto, al abrir la app se
  // ve la mesa vacía en vez del reparto.
  if (!GS && !document.getElementById("simGame")?.classList.contains("hidden"))
    simIdle();
})();
