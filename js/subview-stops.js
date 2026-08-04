// ---------- Barra de progreso "por saltos" ----------
// Sustituye visualmente a la barra de scroll nativa dentro de las vistas
// secundarias que tienen puntos marcados con data-scroll-stop en su HTML
// (por ahora "Sobre mí" y "Ediciones"; "Ajustes" ya se navega por
// pestañas, así que no necesita esto). El scroll en sí no cambia nada:
// solo se añade, encima, un indicador que se puede ver y tocar.
(function(){
  const VIEWS_WITH_STOPS = ['sobre-mi', 'ediciones'];

  const barEl = document.getElementById('subviewStops');
  const trackEl = document.getElementById('subviewStopsTrack');
  const fillEl = document.getElementById('subviewStopsFill');
  const lineEl = trackEl ? trackEl.querySelector('.subview-stops-line') : null;
  if (!barEl || !trackEl || !fillEl || !lineEl) return;

  let currentSubview = null;   // el <section class="subview"> activo ahora mismo
  let stopEls = [];            // elementos [data-scroll-stop] de esa vista
  let dotEls = [];             // los botones-punto ya creados en la barra
  let activeIndex = -1;

  function clearDots(){
    dotEls.forEach(d => d.remove());
    dotEls = [];
  }

  // Distancia (en scrollTop del subview) a la que hay que llevar el
  // scroll para que "stopEl" quede justo arriba del todo. Se calcula con
  // getBoundingClientRect en vez de offsetTop porque algunos de estos
  // bloques están dentro de contenedores con su propio posicionamiento
  // (el collage, las tarjetas...): restando la posición del propio
  // subview se obtiene la distancia real, sin tener que perseguir la
  // cadena de offsetParent a mano.
  function scrollTargetFor(stopEl){
    const subviewTop = currentSubview.getBoundingClientRect().top;
    const stopTop = stopEl.getBoundingClientRect().top;
    // pequeño margen de aire arriba, para que el bloque no quede pegado
    // al borde superior nada más saltar
    return currentSubview.scrollTop + (stopTop - subviewTop) - 28;
  }

  function buildStopsFor(subviewEl){
    currentSubview = subviewEl;
    stopEls = Array.from(subviewEl.querySelectorAll('[data-scroll-stop]'));
    clearDots();

    if (stopEls.length < 2){
      // con 0 o 1 punto no hay "progreso" que marcar
      barEl.classList.remove('visible');
      return;
    }

    stopEls.forEach((stopEl, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'subview-stops-dot';
      dot.setAttribute('aria-label', 'Ir a: ' + stopEl.dataset.scrollStop);
      dot.addEventListener('click', () => {
        currentSubview.scrollTo({ top: Math.max(0, scrollTargetFor(stopEl)), behavior: 'smooth' });
      });
      trackEl.appendChild(dot);
      dotEls.push(dot);
      void i;
    });

    activeIndex = -1;
    barEl.classList.add('visible');
    updateActiveDot();
  }

  // El punto activo es el último cuya posición ya se ha alcanzado (con un
  // margen: se considera "alcanzado" en cuanto entra en el tercio
  // superior de la pantalla, no solo al llegar exactamente arriba del
  // todo, que es como se percibe de forma natural en qué bloque se está
  // mientras se lee).
  function updateActiveDot(){
    if (!currentSubview || !stopEls.length) return;
    const threshold = currentSubview.clientHeight * 0.3;
    const subviewTop = currentSubview.getBoundingClientRect().top;
    let next = 0;
    for (let i = 0; i < stopEls.length; i++){
      const stopTop = stopEls[i].getBoundingClientRect().top - subviewTop;
      if (stopTop <= threshold) next = i; else break;
    }
    if (next === activeIndex) return;
    activeIndex = next;

    dotEls.forEach((dot, i) => {
      dot.classList.toggle('active', i === activeIndex);
      dot.classList.toggle('passed', i < activeIndex);
    });

    // El relleno avanza a saltos, de punto en punto -no de forma continua
    // como el propio scroll-, que es justo lo que lo distingue de una
    // barra de scroll normal: de un vistazo se ve en qué bloque estás, no
    // un porcentaje sin más.
    const lineHeight = lineEl.getBoundingClientRect().height;
    const fraction = dotEls.length > 1 ? activeIndex / (dotEls.length - 1) : 0;
    fillEl.style.height = Math.round(lineHeight * fraction) + 'px';
  }

  function onScroll(){
    window.requestAnimationFrame(updateActiveDot);
  }

  function activateView(view){
    if (currentSubview) currentSubview.removeEventListener('scroll', onScroll);
    currentSubview = null;
    window.removeEventListener('resize', onScroll);

    if (VIEWS_WITH_STOPS.indexOf(view) === -1){
      barEl.classList.remove('visible');
      clearDots();
      return;
    }
    const subviewEl = document.getElementById('view-' + view);
    if (!subviewEl){
      barEl.classList.remove('visible');
      return;
    }
    buildStopsFor(subviewEl);
    subviewEl.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }

  // Se engancha a la función global que ya gestiona el cambio de vista
  // (ver window.goToView en view-navigation.js), en vez de duplicar la
  // lógica de qué vista está activa ahora mismo.
  const previousGoToView = window.goToView;
  if (typeof previousGoToView === 'function'){
    window.goToView = function(view){
      previousGoToView(view);
      activateView(view);
    };
  }

  // Estado inicial: la web arranca en "resumen", que no lleva barra.
  barEl.classList.remove('visible');
})();
