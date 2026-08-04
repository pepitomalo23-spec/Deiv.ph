(function(){
  const canvas = document.getElementById('frameCanvas');
  const ctx = canvas.getContext('2d', { alpha:false });
  const sceneWrap = document.getElementById('sceneWrap');
  const loader = document.getElementById('loader');
  const loaderFill = document.getElementById('loaderFill');
  const loaderSpinner = document.getElementById('loaderSpinner');
  const sceneHint = document.getElementById('sceneHint');
  const menuToggleBtn = document.getElementById('menuToggle');
  const sceneProgress = document.getElementById('sceneProgress');
  const themeColorMeta = document.getElementById('themeColorMeta');
  const sceneTitle = document.getElementById('sceneTitle');
  const bodyCaption = document.getElementById('bodyCaption');

  // ---- FIX franjas/cortes blancos: variable --vh con el alto REAL del
  // viewport ----
  // Fallback clásico en píxeles (1% del alto real de window.innerHeight,
  // o del visualViewport si existe) para que .scene-wrap/.after-story-bg/
  // html,body puedan apoyarse en un valor siempre exacto, incluso en
  // navegadores que no soportan las unidades modernas svh/dvh (o que las
  // soportan de forma incompleta): esos navegadores simplemente ignoran
  // las líneas con svh/dvh en el CSS y se quedan con este cálculo. Se
  // recalcula ante cualquier evento que pueda cambiar el alto visible:
  // resize, cambio de orientación, y el resize del "visual viewport" -que
  // en iOS/Android se dispara aparte, al mostrarse/ocultarse la barra de
  // direcciones o el teclado, sin que siempre llegue un 'resize' normal
  // de window-.
  function syncViewportHeightVar(){
    const h = (window.visualViewport && window.visualViewport.height) || window.innerHeight || document.documentElement.clientHeight;
    document.documentElement.style.setProperty('--vh', (h * 0.01) + 'px');
    // Si cambia el alto real de pantalla (rotación, aparición/ocultación
    // del teclado o de la barra de Safari) mientras se está en reposo en
    // una parada, el scroll real tiene que recolocarse a la nueva posición
    // exacta de esa parada -si no, quedaría "a medio camino" entre dos
    // fotos sin que el usuario haya hecho nada-. Solo se toca si NO hay
    // ningún salto/arrastre en curso (eso ya gestiona su propia posición).
    if (typeof window.__resyncScrollToStep === 'function') window.__resyncScrollToStep();
  }
  // FIX: Safari intenta "recordar" la posición de scroll al recargar la
  // página (scroll restoration). Como el scroll ahora es real, eso podía
  // dejar la página abierta a mitad de una parada tras un refresco. Se
  // desactiva y se fuerza a empezar siempre en la parada 0.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  syncViewportHeightVar();
  window.addEventListener('resize', syncViewportHeightVar);
  window.addEventListener('orientationchange', syncViewportHeightVar);
  if (window.visualViewport){
    window.visualViewport.addEventListener('resize', syncViewportHeightVar);
    // FIX corte blanco al mostrarse/ocultarse la barra de Safari (pestaña
    // normal, no "modo app"): como esta página bloquea el scroll nativo
    // (overflow:hidden/touch-action:none, ver más abajo), Safari nunca ve
    // un evento de scroll "de verdad" en <html>, así que su barra puede
    // recogerse/desplegarse sin que --vh, el tinte de fondo (--bg/
    // theme-color) ni el resto de la escena se enteren a tiempo -dejando
    // ver, durante ese instante, el blanco de base en vez del color real
    // de la escena en ese punto-. visualViewport SÍ dispara su propio
    // 'scroll' cuando la barra anima (crece/encoge el visual viewport),
    // aunque el documento en sí no se haya movido ni un píxel; escuchamos
    // ese evento aparte para resincronizar todo de inmediato en cuanto
    // ocurre, en vez de esperar a que el usuario vuelva a tocar la escena.
    window.visualViewport.addEventListener('scroll', () => {
      syncViewportHeightVar();
      if (typeof updatePageBgForPostEnd === 'function') updatePageBgForPostEnd();
      if (typeof render === 'function') render();
    });
  }

  // ---- Auto-ajuste del tamaño de letra del texto de presentación ----
  // El bloque de texto (.body-caption) tiene un ancho fijo (vw) y, al ser
  // el texto bastante largo, en pantallas bajas o estrechas puede ocupar
  // más alto del que queda libre por debajo hasta el borde de la pantalla;
  // como el body tiene overflow:hidden, esa parte "de más" simplemente no
  // se ve (parece cortada). En vez de tocar el texto o el layout, medimos
  // en tiempo real cuánto alto real ocupa el bloque con el tamaño de letra
  // "ideal" (el definido por CSS/clamp) y, si no cabe en el hueco
  // disponible hasta el borde inferior de la pantalla, encogemos el
  // font-size (y con él el line-height, que es relativo) hasta que quepa
  // entero. Nunca lo agranda más allá de lo que ya define el CSS, solo lo
  // reduce cuando hace falta.
  const CAPTION_BOTTOM_MARGIN = 18; // aire mínimo respecto al borde inferior
  const CAPTION_MIN_SCALE = 0.5;    // no encoger la letra más de la mitad
  let captionBaseFontPx = null;

  function fitBodyCaption(){
    if (!bodyCaption) return;
    // Restaurar el tamaño "ideal" (el que marca el CSS/clamp) antes de medir,
    // para partir siempre del mismo punto de referencia.
    bodyCaption.style.fontSize = '';
    const computed = getComputedStyle(bodyCaption);
    const idealFontPx = parseFloat(computed.fontSize);
    if (!idealFontPx) return;
    captionBaseFontPx = idealFontPx;

    const top = bodyCaption.getBoundingClientRect().top;
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const available = viewportH - top - CAPTION_BOTTOM_MARGIN;
    if (available <= 0) return;

    const needed = bodyCaption.scrollHeight;
    if (needed <= available) return; // ya cabe con el tamaño ideal

    const scale = Math.max(available / needed, CAPTION_MIN_SCALE);
    bodyCaption.style.fontSize = (captionBaseFontPx * scale) + 'px';
  }

  const images = new Array(FRAME_COUNT);
  let loadedCount = 0;

  // ---- reproduce la animación de entrada (intro) y resuelve cuando
  // termina, o si algo falla, no bloquea más de unos segundos ----
  //
  // IMPORTANTE: esto YA NO es un <video>. Es una secuencia de 95
  // fotogramas (assets/loader-frames/f001.jpg ... f095.jpg, a 24fps,
  // ~3.9s) que se precargan y se pintan a mano en un <canvas> con
  // requestAnimationFrame, exactamente igual que la secuencia principal
  // de fotos de más abajo (loadAll/render).
  //
  // Por qué: un <video>, por perfecto que esté exportado (faststart,
  // muted, playsinline...), puede no arrancar solo si el dispositivo
  // tiene el Modo de Bajo Consumo activado -iOS bloquea el autoplay de
  // vídeo ahí sin excepciones- y en su lugar aparece el botón de play
  // nativo de Safari, rompiendo la sensación de "esto no es un vídeo".
  // Un <canvas> no es "un vídeo" para el sistema operativo: no hay
  // autoplay que bloquear, así que se reproduce siempre, sin importar
  // el modo de energía, el navegador o el dispositivo.
  const loaderCanvas = document.getElementById('loaderCanvas');
  const LOADER_FRAME_COUNT = 95;
  const LOADER_FPS = 24;
  function waitForLoaderVideo(){
    return new Promise((resolve) => {
      if (!loaderCanvas){ resolve(); return; }
      const lctx = loaderCanvas.getContext('2d');
      let done = false;
      const finish = () => { if (done) return; done = true; resolve(); };

      const loaderImages = new Array(LOADER_FRAME_COUNT);
      let loaderLoadedCount = 0;

      const reveal = () => {
        loaderCanvas.closest('.loader-video-wrap')?.classList.add('is-playing');
      };

      // Salvaguarda: si algo va mal cargando los fotogramas, nunca
      // dejamos al usuario esperando de más ni con nada roto en pantalla.
      const safety = setTimeout(finish, 6000);

      function drawFrame(i){
        const img = loaderImages[i];
        if (!img) return;
        lctx.clearRect(0, 0, loaderCanvas.width, loaderCanvas.height);
        lctx.drawImage(img, 0, 0, loaderCanvas.width, loaderCanvas.height);
      }

      function playSequence(){
        reveal();
        const startTime = performance.now();
        function step(now){
          const elapsed = (now - startTime) / 1000;
          let frameIndex = Math.floor(elapsed * LOADER_FPS);
          if (frameIndex >= LOADER_FRAME_COUNT){
            drawFrame(LOADER_FRAME_COUNT - 1);
            clearTimeout(safety);
            finish();
            return;
          }
          drawFrame(frameIndex);
          requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      }

      for (let i = 0; i < LOADER_FRAME_COUNT; i++){
        const img = new Image();
        const idx = i;
        const onDone = () => {
          loaderImages[idx] = img;
          loaderLoadedCount++;
          if (loaderLoadedCount === LOADER_FRAME_COUNT) playSequence();
        };
        img.onload = onDone;
        img.onerror = onDone; // si falta un fotograma, no bloquea la intro
        const n = String(idx + 1).padStart(3, '0');
        img.src = 'assets/loader-frames/f' + n + '.jpg';
      }
    });
  }

  // ---- tras la intro y las fotos principales, espera también a las
  // fotos que vienen de la nube (comparador antes/después, carrusel de
  // cámaras...) para no dejar la web a medio cargar nada más entrar ----
  //
  // Cada módulo que depende de fotos de la nube registra su propia
  // promesa en window.__assetReadyPromises (ver registerAssetReady en
  // utils.js, y su uso en comparison-pairs.js / camera-carousel.js).
  // Aquí simplemente se espera a que TODAS esas promesas resuelvan.
  //
  // Tope de seguridad: si la nube tarda demasiado (o algo falla), nunca
  // se deja a nadie esperando más de SITE_ASSETS_TIMEOUT_MS -pasado ese
  // tiempo se entra igual, con lo que haya llegado hasta entonces (cada
  // pantalla ya sabe mostrar su propio estado de "cargando"/"sin foto"
  // sin romperse, ver is-loading en styles.css). Se deja generoso a
  // propósito -20s-: la idea es que esto solo salte si de verdad hay un
  // problema (sin conexión, Firestore caído...), no como forma normal de
  // entrar a la web sin esperar a que las fotos reales hayan llegado.
  const SITE_ASSETS_TIMEOUT_MS = 20000;
  function waitForSiteAssets(){
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (done) return; done = true; resolve(); };
      const safety = setTimeout(finish, SITE_ASSETS_TIMEOUT_MS);
      Promise.all(window.__assetReadyPromises || [])
        .then(() => { clearTimeout(safety); finish(); })
        .catch(() => { clearTimeout(safety); finish(); });
    });
  }

  // ---- decode all frames from embedded base64 up front for a stutter-free scrub ----
  function loadAll(){
    return new Promise((resolve) => {
      for (let i = 0; i < FRAME_COUNT; i++){
        const img = new Image();
        const done = () => {
          loadedCount++;
          const pct = Math.round((loadedCount / FRAME_COUNT) * 100);
          loaderFill.style.width = pct + '%';
          if (loadedCount === FRAME_COUNT) resolve();
        };
        img.onload = () => {
          // decode() guarantees the bitmap is fully ready before we ever try to draw it
          if (img.decode) img.decode().then(done).catch(done);
          else done();
        };
        img.onerror = done;
        img.src = FRAMES_B64[i];
        images[i] = img;
      }
    });
  }

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let cw = 0, ch = 0;

  function resizeCanvas(){
    cw = canvas.clientWidth;
    ch = canvas.clientHeight;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // draw an image "contain"-fit inside the canvas box, WITHOUT ever
  // upscaling past its natural size. El fondo del vídeo es blanco, así que
  // no pasa nada si la imagen queda más pequeña dentro del hueco; lo
  // importante es que nunca se agrande/zoom al bajar el scroll.
  // En pantallas grandes (tablet/iPad en adelante) la imagen se pega lo más
  // posible a la izquierda sin recortarse; en móvil se mantiene centrada.
  const wideLayoutQuery = window.matchMedia('(min-width:768px)');

  // Los 31 fotogramas del vídeo original (salto 1) miden 900x1125 (4:5),
  // pero los 104 de la continuación (salto 2) se exportaron después "en
  // mayor calidad" con otra proporción, 900x1200 (3:4). Como drawCover
  // calculaba la escala a partir del tamaño NATURAL de cada imagen, ese
  // cambio de proporción hacía que, justo al arrancar el salto 2, el
  // factor de escala cambiase de golpe y la imagen se viera de repente
  // más pequeña/estrecha. Fijamos aquí la proporción de referencia (la
  // del salto 1) y recortamos cualquier fotograma que no la tenga ya,
  // para que todo el recorrido se dibuje siempre con el mismo "tamaño
  // lógico" de imagen.
  const REFERENCE_ASPECT = 900 / 1125; // ancho/alto de referencia (salto 1)

  function drawCover(img, alpha, shrinkScale){
    if (!img || !img.complete || img.naturalWidth === 0) return;
    const iw = img.naturalWidth, ih = img.naturalHeight;

    // Recorte para unificar la relación de aspecto entre los dos tramos de
    // fotogramas. El encuadre está siempre anclado por abajo (dy = ch - dh),
    // así que si el fotograma es más "alto" de lo que le toca, el sobrante
    // se recorta arriba (aire/fondo de más) y nunca toca pies ni producto;
    // si fuera más ancho de lo que le toca, se recorta por igual a los
    // lados. Con los fotogramas actuales (900x1200 vs 900x1125) siempre
    // entra por el primer caso.
    let sx = 0, sy = 0, sw = iw, sh = ih;
    const targetH = iw / REFERENCE_ASPECT;
    if (Math.abs(targetH - ih) > 0.5){
      if (targetH < ih){
        sh = targetH;
        // Recorte centrado. Comprobado por análisis píxel a píxel
        // comparando el último fotograma del salto 1 con el primero del
        // salto 2: el punto donde mejor coincide el contenido (persona,
        // suelo, fondo) es un recorte simétrico, no solo por arriba ni
        // con más peso arriba que abajo.
        sy = (ih - sh) / 2;
      } else {
        sw = ih * REFERENCE_ASPECT;
        sx = (iw - sw) / 2;
      }
    }

    let dw, dh, dx, dy;
    if (wideLayoutQuery.matches){
      // Tablet/escritorio: "contain" pegado a la izquierda, nunca se
      // recorta ni se agranda más allá del tamaño natural de la imagen.
      const scale = Math.min(cw / sw, ch / sh, 1);
      dw = sw * scale; dh = sh * scale;
      dx = 0;
      dy = ch - dh;
    } else {
      // Móvil: en pantallas muy altas y estrechas, "contain" dejaba un
      // hueco enorme arriba y la persona quedaba diminuta y pegada del
      // todo abajo. Con "cover" la imagen llena todo el ancho y alto
      // disponibles (recortando un poco los laterales si hace falta, o la
      // parte de arriba de la foto, que suele ser solo fondo), así la
      // persona se ve grande, bien encajada y sin ese hueco.
      const scale = Math.max(cw / sw, ch / sh);
      dw = sw * scale; dh = sh * scale;
      dx = (cw - dw) / 2;
      dy = ch - dh;
    }
    // Encogido de la escena (plano de "solo cámara" en móvil): en vez de
    // aplicar un transform:scale() en CSS al <canvas> completo -que lo
    // encoge desde el centro dejando huecos en blanco por los cuatro
    // lados, ya que el elemento sigue ocupando el 100% del layout-,
    // reducimos aquí mismo el tamaño de la imagen DENTRO del propio
    // canvas y la volvemos a anclar al borde inferior. El canvas en sí
    // nunca cambia de tamaño ni deja huecos: solo la foto dibujada dentro
    // se hace más pequeña, siempre pegada abajo y centrada.
    if (shrinkScale && shrinkScale !== 1){
      dw *= shrinkScale;
      dh *= shrinkScale;
      dx = (cw - dw) / 2;
      dy = ch - dh;
    }
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.globalAlpha = 1;

    // Se expone dónde ha quedado dibujada la foto en pantalla (en tablet/
    // iPad la imagen se pega a la izquierda, no queda centrada en toda la
    // pantalla) para que el carrusel de cámaras pueda centrarse debajo de
    // la FOTO en vez de debajo de toda la pantalla.
    window.__photoDX = dx;
    window.__photoDW = dw;
    window.__photoDY = dy;
    window.__photoDH = dh;
  }

  let currentFrameExact = 0; // frame realmente dibujado (unidades de índice de frame, no fracción)
  let animating = false;     // mientras es true, un gesto nuevo no interrumpe el salto en curso...
  let pendingDir = 0;        // ...pero SÍ se guarda aquí (-1 / 0 / +1) para dispararse solo en cuanto termine.
                             // Antes, deslizar rápido (nuevo gesto llegando durante la animación) hacía que
                             // ese gesto se descartara sin más, así que al bajar rápido no se notaba avance.

  // ---- scroll real y fluido tras la última parada ----
  // Antes, al llegar a la última parada (stepIndex === WAYPOINTS.length-1),
  // un gesto más hacia adelante disparaba una animación con tiempo fijo que
  // hacía subir una capa blanca desde abajo (un "salto" más, igual que el
  // resto de saltos entre fotogramas).
  // Ahora, en cuanto se llega a esa última parada (con el carrusel de las
  // dos cámaras ya visible), el gesto deja de saltar entre fotogramas y la
  // escena entera (foto + carrusel) empieza a subir en tiempo real, al
  // ritmo exacto del dedo (o de la rueda del ratón/trackpad): sin
  // animaciones de por medio, todo sigue el gesto de forma continua y
  // fluida, igual que un scroll normal de página.
  const whiteEnd = document.getElementById('whiteEnd');
  const cameraCarouselEl = document.getElementById('cameraCarousel');
  const equipoTitleForScroll = document.getElementById('equipoTitle');
  const equipoSubtitleForScroll = document.getElementById('equipoSubtitle');
  const afterStoryHeaderEl = document.getElementById('afterStoryHeader');
  const cameraNameLeftEl = document.getElementById('cameraNameLeft');
  const cameraNameRightEl = document.getElementById('cameraNameRight');
  let postEndOffset = 0; // px que realmente se está pintando en pantalla ahora mismo
  let postEndTarget = 0; // px que el gesto pide en cada instante (puede ir por delante del anterior)
  let postEndRaf = null;
  let pastEnd = false;   // true en cuanto postEndOffset > 0 (se mantiene por compatibilidad)
  // ---- Gesto de "vuelta" desde la zona negra hacia la 3ª posición ----
  // postEndGestureActive agrupa una racha de eventos de rueda/touch en un
  // único "gesto físico": mientras lleguen eventos sin una pausa real
  // (POST_END_GESTURE_GAP ms), se considera el MISMO gesto. postEndGestureStartOffset
  // guarda dónde estaba postEndTarget cuando ESE gesto concreto empezó: solo
  // si ya era 0 (la escena ya estaba asentada en la 3ª posición) se permite
  // que ese mismo gesto dispare el salto a la 2ª posición. Así, un gesto que
  // empieza dentro de la zona negra (offset > 0) solo puede cerrar el hueco,
  // por mucho que se siga subiendo dentro de ese mismo gesto -nunca encadena
  // el salto a la 2ª posición sin que el usuario suelte y vuelva a deslizar-.
  let postEndGestureActive = false;
  let postEndGestureStartOffset = 0;
  let postEndGestureTimer = null;
  const POST_END_GESTURE_GAP = 180; // mismo criterio de pausa que WHEEL_GESTURE_GAP
  // Máximo de px que la escena puede avanzar en un solo frame de pantalla,
  // aunque el gesto pida más de golpe (un swipe fuerte, o un salto grande
  // de rueda/trackpad). Sin este tope, un gesto brusco movía la escena esa
  // distancia entera en un único frame -> se veía "subir de un tirón". Con
  // el tope, ese mismo gesto se reparte en varios frames consecutivos (a
  // máxima velocidad permitida), así que siempre se percibe como un
  // desplazamiento continuo, nunca como un salto.
  const POST_END_MAX_STEP_PX = 34;
  // FIX 3: "que se deje correr, no que frene del tirón en el último tramo"
  // -el easing (fracción del hueco restante) SIEMPRE desacelera al
  // acercarse al objetivo, por poco que sea: por mucho que se suavizara,
  // seguía notándose un frenazo final. Se sustituye por velocidad
  // CONSTANTE (POST_END_SPEED_PX por frame, sin depender de "cuánto
  // falta"): el movimiento corre a ritmo fijo todo el trayecto y se
  // detiene de golpe, en seco, en el último frame -sin ninguna curva de
  // frenado-, en vez de ir perdiendo velocidad poco a poco al final.
  const POST_END_SPEED_PX = 40;

  function postEndMax(){
    const vh = window.innerHeight || (sceneWrap ? sceneWrap.clientHeight : 0) || 800;
    // Tope base: una pantalla completa (comportamiento de siempre, válido
    // mientras el bloque final quepa en una pantalla).
    let need = vh;
    // FIX "se corta por abajo": el bloque final (#afterStoryHeader) ya no
    // es solo un título -ahora incluye también el comparador Antes/Después,
    // "Descubre mi trabajo" y la galería que se expande-, así que en
    // muchos móviles su alto real supera una pantalla entera. Como este
    // valor es el tope máximo de arrastre (--pe nunca puede superarlo, ver
    // stepTowardPostEndTarget), si el bloque mide más que "vh" su parte de
    // abajo nunca llegaba a subir lo suficiente para dejar de estar tapada
    // por el borde inferior de la pantalla: se veía cortada sin remedio,
    // deslizara lo que deslizara el usuario.
    //
    // Solución: medir en tiempo real (scrollHeight, se recalcula cada vez
    // que se llama a esta función, así que ya tiene en cuenta la galería
    // una vez la ha pintado CloudDB) cuánto necesita subir el bloque -que
    // arranca en top:105vh, ver CSS de .after-story-header- para que su
    // borde inferior quede, como mucho, pegado (con un pequeño margen) al
    // borde inferior de la pantalla, y usar ese valor si es mayor que una
    // pantalla completa.
    if (afterStoryHeaderEl){
      const headerHeight = afterStoryHeaderEl.scrollHeight;
      const startTop = vh * 1.05;   // 105vh en px, ver .after-story-header
      const bottomMargin = vh * 0.04; // pequeño respiro bajo la galería
      const requiredOffset = (startTop + headerHeight) - vh + bottomMargin;
      if (requiredOffset > need) need = requiredOffset;
    }
    return need;
  }

  // ---- Color de fondo de la PÁGINA (no solo de la escena) ----
  // En móvil, el hueco que se ve por encima/alrededor de la escena fija
  // (detrás del notch, al rebotar el navegador, o al recogerse/mostrarse
  // la barra de direcciones) no es la escena ni el panel gris: es el
  // fondo real de <html>/<body>. Antes ese fondo era blanco fijo
  // (--bg:#ffffff), así que en cuanto la escena se acercaba al tramo gris
  // final, ese hueco seguía blanco mientras todo lo demás ya iba a gris
  // -> el corte que se notaba arriba en el móvil. La solución es teñir
  // ese fondo real (variable --bg) y también la barra del navegador
  // (meta theme-color) con el MISMO color que en cada instante tiene la
  // costura escena→panel gris, así do quiera que se asome ese hueco,
  // siempre es del color correcto para la parte del recorrido en la que
  // se está.
  const PAGE_BG_WHITE = [255, 255, 255];
  const PAGE_BG_AFTER = [255, 255, 255]; // mismo blanco que .after-story-bg (4ª posición invertida)

  function setPageBgColor(rgbArr){
    const c = `rgb(${rgbArr[0]},${rgbArr[1]},${rgbArr[2]})`;
    document.documentElement.style.setProperty('--bg', c);
    if (themeColorMeta) themeColorMeta.setAttribute('content', c);
  }

  // FIX: antes este tinte (blanco -> gris oscuro/negro) era el ÚNICO efecto
  // del sitio que cambiaba de forma lineal e inmediata -desde el primer
  // píxel deslizado más allá del final-, a diferencia de TODOS los demás
  // (el tinte de "solo cámara" en computePhotoBgT, el difuminado del
  // texto en captionOpacityForProgress, el fundido del recuadro Antes/
  // Después...), que arrancan más tarde y con una curva suave. Por eso se
  // notaba antes de tiempo y de forma más brusca que el resto. Ahora usa
  // exactamente el mismo patrón: un umbral (POST_END_BG_DELAY_FRACTION) que
  // ignora el primer tramo del arrastre -sigue blanco puro hasta ahí- y,
  // pasado ese punto, la misma curva "smoothstep" (arranca y termina a
  // velocidad cero, acelera en medio) que ya se usa en computePhotoBgT.
  // Al depender solo de postEndOffset -que ya se anima suavemente en ambas
  // direcciones, ver stepTowardPostEndTarget- el regreso (subir) revierte
  // exactamente por el mismo camino, así nunca se queda "pillado" en gris.
  // UNIFICACIÓN (fuente única de verdad): antes esta función calculaba su
  // propia curva (postEndBgT) a partir de postEndOffset -el arrastre real
  // más allá de la última parada-, mientras que el tinte del canvas y
  // --fade-opacity (ver render()/computePhotoBgT) se calculaban a partir de
  // currentFrameExact -en qué fotograma va la animación-. Son dos variables
  // de estado independientes que en teoría "deberían" llegar juntas al
  // mismo gris casi-negro, pero si el gesto es rápido una podía adelantarse
  // a la otra: el canvas ya mostraba su parte oscura (currentFrameExact ya
  // había llegado al final) pero el fondo real de <html> aún no había
  // avanzado (postEndOffset seguía en 0 justo al aterrizar), y viceversa
  // -de ahí el "corte" de color visible durante una fracción de segundo-.
  // Ahora ambos leen exactamente la misma variable (bgT, derivada solo de
  // currentFrameExact), así que es imposible que se desincronicen sea cual
  // sea la velocidad del gesto: el fondo de <html> ya está en su tono final
  // en el mismo instante en que el canvas/--fade-opacity llegan al suyo, y
  // el arrastre posterior (postEndOffset) solo revela ese fondo -ya
  // correcto- sin necesidad de animar su color por separado.
  function updatePageBgForPostEnd(){
    const t = computePhotoBgT(currentFrameExact);
    const r = Math.round(PAGE_BG_WHITE[0] + (PAGE_BG_AFTER[0] - PAGE_BG_WHITE[0]) * t);
    const g = Math.round(PAGE_BG_WHITE[1] + (PAGE_BG_AFTER[1] - PAGE_BG_WHITE[1]) * t);
    const b = Math.round(PAGE_BG_WHITE[2] + (PAGE_BG_AFTER[2] - PAGE_BG_WHITE[2]) * t);
    setPageBgColor([r, g, b]);
  }

  function applyPostEndOffset(){
    // Redondeado a píxel entero (Math.round) y translate3d en vez de
    // translateY: un desplazamiento en subpíxeles (p.ej. 42.37px, que puede
    // salir de un gesto táctil con coordenadas con decimales) hacía que el
    // navegador redondeara la escena y el panel gris de detrás
    // (.after-story-bg, que no se mueve) a subpíxeles ligeramente distintos
    // en cada frame -de ahí la línea blanca fina que a veces se veía
    // parpadear justo en la costura-. translate3d, además, fuerza a que la
    // escena viva siempre en su propia capa de composición GPU (igual que
    // el translateZ(0) de reposo en el CSS), así la costura queda estable
    // en vez de recalcularse de formas ligeramente distintas cada frame.
    const t = 'translate3d(0, ' + (-Math.round(postEndOffset)) + 'px, 0)';
    // La foto/vídeo (canvas) sube exactamente lo mismo que el dedo se mueve.
    sceneWrap.style.transform = t;
    // El carrusel tiene su propio transform (centrado horizontal + su
    // aparición deslizante); en vez de pisarlo, le sumamos el
    // desplazamiento a través de una variable CSS (ver regla
    // .camera-carousel.visible), así conserva su centrado y su animación
    // de entrada, y solo añadimos el desplazamiento vertical del scroll.
    if (cameraCarouselEl){
      cameraCarouselEl.style.transitionProperty = 'opacity'; // el desplazamiento debe notarse al instante, sin retraso
      cameraCarouselEl.style.setProperty('--pe', postEndOffset + 'px');
    }
    // El título "Mi material de trabajo" es parte del mismo bloque final que
    // el carrusel: debe subir exactamente igual, en el mismo instante y sin
    // transición retrasada, para que todo el contenido del último tramo se
    // desplace junto, como una sola pieza.
    if (equipoTitleForScroll){
      equipoTitleForScroll.style.transitionProperty = 'opacity';
      equipoTitleForScroll.style.setProperty('--pe', postEndOffset + 'px');
    }
    if (equipoSubtitleForScroll){
      equipoSubtitleForScroll.style.transitionProperty = 'opacity';
      equipoSubtitleForScroll.style.setProperty('--pe', postEndOffset + 'px');
    }
    if (cameraNameLeftEl) cameraNameLeftEl.style.setProperty('--pe', postEndOffset + 'px');
    if (cameraNameRightEl) cameraNameRightEl.style.setProperty('--pe', postEndOffset + 'px');
    // Título "Mis ediciones" (4ª posición): sube junto con el resto del
    // bloque final siguiendo el mismo arrastre (ver .after-story-header).
    if (afterStoryHeaderEl) afterStoryHeaderEl.style.setProperty('--pe', postEndOffset + 'px');
    // Ya no hace falta ninguna capa/difuminado que revelar aquí por JS: el
    // degradado que disimula la costura con el panel gris vive ahora,
    // permanentemente, en el propio .after-story-bg (ver su CSS), y se
    // revela solo por la traslación normal de la escena (más abajo en esta
    // misma función). Lo único que sigue haciendo falta en JS es mantener
    // --bg sincronizado (updatePageBgForPostEnd), que es justo la misma
    // fórmula matemática con la que se calculó ese degradado permanente.
    pastEnd = postEndOffset > 0;
    updatePageBgForPostEnd();
    if (stepIndex === WAYPOINTS.length - 1){
      updateProgressTrack(stepIndex + Math.min(1, postEndOffset / postEndMax()));
    }
  }

  // Bucle de "alcance": cada frame, postEndOffset se acerca a postEndTarget
  // como máximo POST_END_MAX_STEP_PX. En un gesto normal (lento o medio) el
  // objetivo está siempre a menos de ese tope, así que se alcanza en el
  // mismo frame -> sensación 1:1, sin ningún retraso perceptible. Solo en
  // un gesto fuerte/rápido, donde el objetivo salta mucho de golpe, el
  // tope entra en juego y reparte ese avance en 2-3 frames -> ya no se nota
  // como un salto brusco.
  // Bucle de "alcance": cada frame, postEndOffset se acerca a postEndTarget
  // como máximo POST_END_MAX_STEP_PX. En un gesto normal (lento o medio) el
  // objetivo está siempre a menos de ese tope, así que se alcanza en el
  // mismo frame -> sensación 1:1, sin ningún retraso perceptible. Solo en
  // un gesto fuerte/rápido, donde el objetivo salta mucho de golpe, el
  // tope entra en juego y reparte ese avance en 2-3 frames -> ya no se nota
  // como un salto brusco.
  //
  // FIX: "subir para ver la 3ª posición" ya no aterriza de un tirón en la 2ª.
  // ANTES, en cuanto el usuario -estando en el tramo negro/gris final- hacía
  // un gesto claro hacia arriba, se marcaba pendingReturnFromEnd=true y, en
  // cuanto postEndOffset terminaba de asentarse exactamente en 0 (la escena
  // ya colocada del todo en la 3ª posición), este mismo bucle disparaba
  // goPrev() automáticamente. El problema: ese mismo gesto físico (una rueda,
  // trackpad o dedo deslizando) sigue generando eventos DESPUÉS de que el
  // hueco se cierre, así que su propio impulso encadenaba el salto a la 2ª
  // posición sin que el usuario llegara a "quedarse" viendo la 3ª -exactamente
  // lo contrario de lo que se pedía-.
  // AHORA este bucle solo se encarga de acercar postEndOffset a su objetivo;
  // cerrar el hueco y saltar a la 2ª posición son dos acciones separadas que
  // decide cada manejador de gesto (rueda/touch/teclado, ver más abajo), y
  // cada uno exige que el gesto que dispara el salto sea uno NUEVO -uno que
  // ya empezaba con la escena asentada en la 3ª posición-, nunca el mismo que
  // acaba de cerrar el hueco.
  // FIX 4: "que siga deslizando cuando yo deslizo, sin pillarse ni
  // frenar" -CUALQUIER animación por frame (incluso a velocidad
  // constante) obliga a que el valor pintado vaya SIEMPRE detrás del
  // valor real del gesto durante uno o varios frames -de ahí la sensación
  // de "pillado"/lag que se notaba, sobre todo deslizando rápido con el
  // dedo-. En la última parada ya no hace falta ninguna animación: cada
  // evento de rueda/touch aporta directamente cuánto se ha movido el
  // gesto, así que el offset se aplica 1:1, en el mismo instante, sin
  // ningún paso intermedio ni límite de velocidad. El único "frenado" que
  // queda es el propio tope físico del recorrido (no se puede pasar de 0
  // ni del panel negro completo), nunca una curva de desaceleración.
  function setPostEndOffset(next){
    postEndTarget = Math.max(0, Math.min(postEndMax(), next));
    postEndOffset = postEndTarget;
    applyPostEndOffset();
  }

  // ---- Inercia nativa al soltar el dedo en el tramo 3ª parada <-> zona final ----
  // Antes, al levantar el dedo en mitad de este tramo, postEndOffset se
  // quedaba clavado donde estuviera (no había ningún manejo del "después"
  // salvo el caso ya cerrado del todo): el scroll se detenía en seco, a
  // diferencia de cualquier scroll nativo de iOS/Android o de Safari, donde
  // soltar el dedo deja que el contenido siga deslizando y frene poco a
  // poco. Para lograr esa misma sensación se lleva un pequeño historial de
  // {tiempo, offset} mientras se arrastra (postEndVelocitySamples) y, al
  // soltar, se calcula la velocidad real del gesto en ese instante
  // (px/ms) a partir de las últimas muestras (POST_END_VELOCITY_WINDOW).
  // Con esa velocidad se arranca una animación (postEndInertiaRaf) que
  // sigue moviendo postEndOffset/postEndTarget, perdiendo velocidad de
  // forma exponencial (fricción) cuadro a cuadro -igual que el scroll
  // nativo-, hasta agotarse o hasta tocar alguno de los dos límites del
  // tramo (0 = asentado en la 3ª parada, postEndMax() = zona final
  // completamente revelada).
  const POST_END_VELOCITY_WINDOW = 100; // ms: solo se mira el gesto más reciente
  const POST_END_FRICTION_PER_MS = 0.9985; // factor de frenado exponencial por ms
  const POST_END_MIN_VELOCITY = 0.02; // px/ms por debajo de esto se considera parado
  let postEndVelocitySamples = [];
  let postEndInertiaRaf = null;

  function resetPostEndVelocitySamples(startOffset){
    postEndVelocitySamples = [{ t: performance.now(), off: startOffset }];
  }

  function trackPostEndVelocitySample(offset){
    const now = performance.now();
    postEndVelocitySamples.push({ t: now, off: offset });
    // solo hace falta conservar la ventana reciente para calcular la
    // velocidad instantánea al soltar; se descarta lo demás.
    const cutoff = now - POST_END_VELOCITY_WINDOW;
    while (postEndVelocitySamples.length > 2 && postEndVelocitySamples[0].t < cutoff){
      postEndVelocitySamples.shift();
    }
  }

  function currentPostEndVelocity(){
    if (postEndVelocitySamples.length < 2) return 0;
    const first = postEndVelocitySamples[0];
    const last = postEndVelocitySamples[postEndVelocitySamples.length - 1];
    const dt = last.t - first.t;
    if (dt <= 0) return 0;
    return (last.off - first.off) / dt; // px por ms
  }

  function stopPostEndInertia(){
    if (postEndInertiaRaf !== null){ cancelAnimationFrame(postEndInertiaRaf); postEndInertiaRaf = null; }
  }

  function startPostEndInertia(initialVelocity){
    stopPostEndInertia();
    if (!isFinite(initialVelocity) || Math.abs(initialVelocity) < POST_END_MIN_VELOCITY) return;
    let v = initialVelocity; // px/ms, con signo (positivo = hacia la zona final)
    let lastT = performance.now();
    function step(now){
      const dt = Math.min(48, Math.max(0, now - lastT)); // tope de dt por si hay un frame perdido/pestaña en 2º plano
      lastT = now;
      v *= Math.pow(POST_END_FRICTION_PER_MS, dt); // frenado exponencial, independiente del framerate
      const rawNext = postEndTarget + v * dt;
      const max = postEndMax();
      const clamped = Math.max(0, Math.min(max, rawNext));
      postEndTarget = clamped;
      postEndOffset = clamped;
      applyPostEndOffset();
      const hitBound = clamped <= 0 || clamped >= max;
      if (hitBound || Math.abs(v) < POST_END_MIN_VELOCITY){
        postEndInertiaRaf = null;
        return;
      }
      postEndInertiaRaf = requestAnimationFrame(step);
    }
    postEndInertiaRaf = requestAnimationFrame(step);
  }

  // Expuesto para que otras vistas (menú, Ajustes, etc.) puedan resetear el
  // desplazamiento instantáneamente al salir de la sección "resumen".
  window.__resetWhiteEnd = function(){
    if (postEndRaf !== null){ cancelAnimationFrame(postEndRaf); postEndRaf = null; }
    stopPostEndInertia();
    postEndOffset = 0;
    postEndTarget = 0;
    pastEnd = false;
    postEndGestureActive = false;
    clearTimeout(postEndGestureTimer);
    if (sceneWrap) sceneWrap.style.transform = '';
    if (cameraCarouselEl) cameraCarouselEl.style.setProperty('--pe', '0px');
    if (equipoTitleForScroll) equipoTitleForScroll.style.setProperty('--pe', '0px');
    if (equipoSubtitleForScroll) equipoSubtitleForScroll.style.setProperty('--pe', '0px');
    if (cameraNameLeftEl) cameraNameLeftEl.style.setProperty('--pe', '0px');
    if (afterStoryHeaderEl) afterStoryHeaderEl.style.setProperty('--pe', '0px');
    if (cameraNameRightEl) cameraNameRightEl.style.setProperty('--pe', '0px');
    if (whiteEnd) whiteEnd.style.transform = 'translateY(100%)';
    setPageBgColor(PAGE_BG_WHITE);
  };

  // ---- paradas (waypoints) ----
  // Antes había un único salto de la primera a la última imagen. Ahora el
  // recorrido tiene 3 paradas: la pose inicial, el final del vídeo original
  // (que antes era "la última") y el final de la continuación añadida.
  // Cada gesto solo avanza/retrocede UNA parada, nunca salta el tramo entero.
  const OLD_FRAME_COUNT = 31; // longitud del clip original antes de la continuación
  const OLD_LAST_FRAME = OLD_FRAME_COUNT - 1; // 30: dónde antes "terminaba" el salto
  const WAYPOINTS = [0, OLD_LAST_FRAME, FRAME_COUNT - 1];
  let stepIndex = 0; // parada actual en reposo: 0, 1 o 2

  // ---- SCROLL NATIVO REAL (v2): reflejo del progreso sobre scrollY real ----
  // #storyTrack reserva 3 pantallas de alto real (una por parada, ver CSS).
  // Cada vez que el motor de arriba mueve el progreso de un salto o de un
  // arrastre -currentFrameExact, calculado siempre a partir de un valor "p"
  // entre 0 y 1 sobre un tramo (fromStep -> toStep)-, este helper escribe
  // ADEMÁS ese mismo progreso como scrollTop real del documento. La curva de
  // easing y la duración del salto no cambian nada (se conservan tal cual,
  // ver JUMP_DURATION*): lo único nuevo es que, en paralelo, el navegador ve
  // scroll de verdad durante todo el recorrido -no un transform-, así Safari
  // aplica su comportamiento nativo de barra inferior en todo momento,
  // también durante el salto animado, exactamente igual que en el resto de
  // apps de Apple.
  //
  // NOTA de alcance: por ahora esto cubre las 3 paradas de fotos (dentro de
  // #storyTrack). El carrusel de cámaras / "Mis ediciones" que aparecen tras
  // la 3ª parada siguen con el sistema anterior (postEndOffset) mientras se
  // confirma que el tacto de este primer tramo es correcto en dispositivo
  // real; se migran en un paso siguiente.
  function viewportPx(){
    return (window.visualViewport && window.visualViewport.height) || window.innerHeight || document.documentElement.clientHeight;
  }
  function stopScrollTop(step){
    return step * viewportPx();
  }
  // true mientras es NUESTRO propio código el que está moviendo scrollTop
  // (salto animado o arrastre en vivo): evita que el listener de 'scroll'
  // de más abajo se interprete a sí mismo como un gesto nuevo del usuario.
  let realScrollSyncActive = false;
  function syncRealScrollForStepPosition(stepPos){
    if (currentView !== 'resumen') return;
    const y = Math.max(0, Math.min(WAYPOINTS.length - 1, stepPos)) * viewportPx();
    realScrollSyncActive = true;
    window.scrollTo(0, y);
    requestAnimationFrame(() => { realScrollSyncActive = false; });
  }
  window.__resyncScrollToStep = function(){
    if (animating) return; // un salto en curso ya gestiona su propia posición
    syncRealScrollForStepPosition(stepIndex);
  };

  // ---- puntos de progreso (uno por parada + 1 por el tramo negro final) ----
  // PROGRESS_STOP_COUNT = las 3 paradas de fotos (WAYPOINTS) + 1 parada más
  // que representa el tramo negro/gris final: es un apartado propio del
  // recorrido, no una prolongación de la última foto, así que tiene su
  // propio punto al final de la fila.
  const PROGRESS_STOP_COUNT = WAYPOINTS.length + 1;
  const progressDots = [];
  const sceneProgressTrack = document.getElementById('sceneProgressTrack');
  const sceneProgressLine = document.getElementById('sceneProgressLine');
  const sceneProgressLineFill = document.getElementById('sceneProgressLineFill');
  if (sceneProgressTrack){
    for (let i = 0; i < PROGRESS_STOP_COUNT; i++){
      const d = document.createElement('span');
      d.className = 'dot';
      sceneProgressTrack.appendChild(d);
      progressDots.push(d);
    }
  }

  // Mide dónde caen realmente los puntos (centro del primero y del
  // último) para que la raya que los conecta, y su relleno naranja,
  // encajen exactamente con ellos aunque cambie el tamaño de pantalla.
  // Se recalcula al construir los puntos y en cada resize.
  let progressLineTop = 0;
  let progressSpanPx = 0;
  function recomputeProgressSpan(){
    if (progressDots.length < 2 || !sceneProgressLine) return;
    const first = progressDots[0];
    const last = progressDots[progressDots.length - 1];
    progressLineTop = first.offsetTop + first.offsetHeight / 2;
    progressSpanPx = (last.offsetTop + last.offsetHeight / 2) - progressLineTop;
    sceneProgressLine.style.top = progressLineTop + 'px';
    sceneProgressLine.style.height = progressSpanPx + 'px';
    if (sceneProgressLineFill) sceneProgressLineFill.style.top = progressLineTop + 'px';
  }
  recomputeProgressSpan();

  // Progreso continuo del recorrido, en la misma escala que las paradas
  // (0 = primera foto ... PROGRESS_STOP_COUNT-1 = final del tramo negro).
  // Se llama en CADA frame, tanto durante el salto animado entre paradas
  // como durante el arrastre en tiempo real del tramo final, así el
  // relleno naranja no salta de golpe de un punto a otro: fluye con el
  // mismo ritmo exacto que se ve en pantalla.
  function updateProgressTrack(progress){
    const clamped = Math.max(0, Math.min(PROGRESS_STOP_COUNT - 1, progress));
    if (sceneProgressLineFill){
      const frac = PROGRESS_STOP_COUNT > 1 ? clamped / (PROGRESS_STOP_COUNT - 1) : 0;
      sceneProgressLineFill.style.height = (frac * progressSpanPx) + 'px';
    }
    progressDots.forEach((d, i) => {
      d.classList.toggle('active', Math.round(clamped) === i);
      d.classList.toggle('passed', i < clamped - 0.02);
    });
  }

  // Se llama justo cuando se ATERRIZA en una parada (nunca a mitad de
  // salto): dejar el progreso encajado exactamente en esa parada.
  function updateEndOfPathUI(){
    updateProgressTrack(stepIndex);
  }

  // ---- non-linear progress -> frame mapping (solo para el 1er tramo) ----
  // El plano cambia de lente hacia los frames 6-19 del clip original; el
  // crossfade entre esos frames se ve blando/fantasma porque son muy
  // distintos entre sí. En vez de repartir el "tiempo" del salto en línea
  // recta entre frames, le damos a ese tramo solo una porción fina del
  // recorrido para que pase rápido, y más tiempo a los tramos tranquilos
  // antes/después. Esto solo aplica al tramo 0→1 (el vídeo original); el
  // tramo 1→2 (la continuación) es contenido nuevo sin ese cambio de lente,
  // así que se mueve con una interpolación simple.
  const SWAP_START_FRAME = 6;
  const SWAP_END_FRAME = 19;
  const T_BEFORE_SWAP = 0.36; // fracción de progreso donde empieza el tramo rápido
  const T_AFTER_SWAP = 0.64;  // fracción de progreso donde termina el tramo rápido
  const swapStartFrac = SWAP_START_FRAME / OLD_LAST_FRAME;
  const swapEndFrac = SWAP_END_FRAME / OLD_LAST_FRAME;

  function mapFirstSegmentProgress(p){
    let frac;
    if (p <= T_BEFORE_SWAP){
      frac = (p / T_BEFORE_SWAP) * swapStartFrac;
    } else if (p <= T_AFTER_SWAP){
      const local = (p - T_BEFORE_SWAP) / (T_AFTER_SWAP - T_BEFORE_SWAP);
      frac = swapStartFrac + local * (swapEndFrac - swapStartFrac);
    } else {
      const local = (p - T_AFTER_SWAP) / (1 - T_AFTER_SWAP);
      frac = swapEndFrac + local * (1 - swapEndFrac);
    }
    return frac * OLD_LAST_FRAME;
  }

  function render(){
    const idxFloat = currentFrameExact;
    const idx = Math.floor(idxFloat);
    const frac = idxFloat - idx;
    const a = images[idx];
    const b = images[Math.min(idx + 1, FRAME_COUNT - 1)];

    // Encogido del plano de "solo cámara": SOLO en móvil (en iPad/escritorio
    // la imagen no se achica, se queda a tamaño "contain" normal).
    const shrinkT = computeMobileShrinkT(currentFrameExact);
    const shrinkScale = 1 - shrinkT * (1 - MOBILE_SHRINK_END_SCALE);

    // Tinte de fondo: a diferencia del achicado, esto tiene que aplicar en
    // CUALQUIER pantalla (móvil, iPad, escritorio). El "contain" pegado a la
    // izquierda que se usa en pantallas anchas (ver drawCover) casi siempre
    // deja un hueco a la derecha (y a veces arriba) donde antes se veía el
    // blanco puro del canvas en vez del blanco real, ligeramente distinto,
    // de la foto -eso era el corte que se notaba en iPad-. Por eso el
    // progreso del tinte se calcula aparte, sin el filtro "solo móvil".
    const bgT = computePhotoBgT(currentFrameExact);

    // IMPORTANTE: el color de fondo hay que calcularlo y pintarlo ANTES de
    // dibujar la imagen. El <canvas> es opaco (alpha:false) y ocupa toda la
    // pantalla, así que si aquí se rellena con blanco puro fijo, ese blanco
    // puro es literalmente lo único que se ve alrededor de la foto encogida
    // -tapa por completo cualquier tinte que se le ponga al fondo de la
    // página por CSS, que queda debajo y nunca llega a pintarse-. Por eso
    // el "corte" entre blancos se veía: el canvas de verdad no ha se
    // adaptó nunca hasta ahora.
    const bgColor = sceneBgColor(bgT);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, cw, ch);

    // crossfade the two nearest frames so individual frames are never "seen" popping in
    drawCover(a, 1, shrinkScale);
    if (frac > 0.001) drawCover(b, frac, shrinkScale);

    // El mismo color también alimenta el difuminado inferior (::after de
    // .scene-pin), para que ambos elementos queden fundidos sin costura.
    scenePin.style.setProperty('--bg', bgColor);

    // Opacidad del degradado/viñeta del borde inferior (--fade-opacity, ver
    // :root): reutiliza exactamente la misma curva bgT -en 0 durante toda
    // la 1ª y la 2ª parada, y solo empieza a subir en el tramo final de la
    // continuación (los frames de "solo cámara")- así el degradado deja de
    // estar siempre pintado y aparece, de forma gradual, justo al llegar
    // al último fotograma de la 3ª posición (tras el 2º salto), que es
    // cuando de verdad hace falta para la costura con el panel oscuro.
    // Se fija en <html>, no solo en .scene-pin: el carrusel de cámaras y
    // su cabecera son elementos fixed hermanos de .scene-wrap (no hijos
    // suyos) y también necesitan heredar este valor para su propio halo
    // de contraste.
    document.documentElement.style.setProperty('--fade-opacity', bgT);

    // Misma fuente única de verdad (bgT, ver comentario en
    // updatePageBgForPostEnd): el fondo real de <html> se actualiza aquí,
    // en el mismo frame y a partir de la misma variable que el tinte del
    // canvas y --fade-opacity, así los tres quedan perfectamente
    // sincronizados sin importar la velocidad del gesto que los dispare.
    updatePageBgForPostEnd();
  }

  // ---- reducción de tamaño en móvil al llegar a los frames de "solo cámara" ----
  // Dentro de la continuación, a partir de cierto frame la escena deja de
  // mostrar a la persona y pasa a ser un plano de producto (solo la cámara
  // sobre fondo blanco). En móvil, ese plano se ve mejor si el encuadre se
  // va empequeñeciendo a la vez que avanza, como un ligero zoom-out, en vez
  // de quedarse pegado a los bordes de la pantalla igual que el resto.
  const CAMERA_ONLY_START_FRAME = 94; // recalculado proporcionalmente tras ampliar el tramo de la continuacion a 105 fotogramas
  const MOBILE_SHRINK_END_SCALE = 0.72; // escala final en el último frame: hace falta para que en móvil no se corte la imagen
  // El fondo de la foto en los frames de "solo cámara" no es blanco puro,
  // así que al achicar el encuadre se veía un rectángulo alrededor con el
  // blanco puro del fondo de la página. Mientras se achica, fundimos el
  // fondo de la escena hacia ese mismo tono, para que no se note el borde.
  const SCENE_BG_WHITE = [255, 255, 255];
  const SCENE_BG_CAMERA = [251, 251, 251]; // blanco exacto del fondo del último fotograma (medido por análisis de píxeles: es el color más repetido en su fondo, no una aproximación)
  const scenePin = sceneWrap.querySelector('.scene-pin');

  function computeMobileShrinkT(frameExact){
    if (wideLayoutQuery.matches) return 0; // el achicado en sí es solo para móvil
    return computePhotoBgT(frameExact);
  }

  // Progreso (0→1) dentro del tramo de "solo cámara", sin distinción de
  // pantalla: se usa para el tinte de fondo, que debe verse igual de bien
  // en móvil que en iPad o escritorio.
  // IMPORTANTE: antes esto era una rampa lineal, que arrancaba de golpe a
  // velocidad constante justo en CAMERA_ONLY_START_FRAME (se notaba como un
  // "corte": el encogido y el tinte empezaban a cambiar de la nada, sin
  // transición). Con smoothstep, el cambio empieza y termina con velocidad
  // cero (igual de tamaño que antes al arrancar) y acelera/decelera de
  // forma continua en medio, así el ojo no detecta un arranque brusco.
  function computePhotoBgT(frameExact){
    if (frameExact <= CAMERA_ONLY_START_FRAME) return 0;
    const range = (FRAME_COUNT - 1) - CAMERA_ONLY_START_FRAME;
    const linearT = Math.min(1, (frameExact - CAMERA_ONLY_START_FRAME) / range);
    return linearT * linearT * (3 - 2 * linearT); // smoothstep
  }

  // Progreso (0→1) de la aparición ANTICIPADA del bloque de "las dos
  // cámaras" (carrusel + título "Mi material de trabajo" + etiquetas de
  // cámara, ver camera-carousel.js): a diferencia del resto del contenido
  // del sitio, que aparece justo al aterrizar en su parada, este bloque
  // debe empezar a hacerse notar ANTES de que el 2º salto (2ª->3ª parada)
  // termine del todo, para que no aparezca de golpe al final sino que se
  // anticipe con el mismo espíritu "smoothstep" que ya usa el resto del
  // motor (ver computePhotoBgT arriba). Arranca en CAMERA_ONLY_START_FRAME
  // -el mismo punto en el que el plano pasa a ser "solo cámara"; antes de
  // eso aún se ve a la persona, así que revelar el carrusel ahí se vería
  // fuera de lugar- y llega al 100% mucho antes del último fotograma
  // (CAMERA_REVEAL_LEAD_FRACTION), no al aterrizar.
  const CAMERA_REVEAL_LEAD_FRACTION = 0.55;

  function computeCameraRevealP(frameExact){
    if (frameExact <= CAMERA_ONLY_START_FRAME) return 0;
    const range = (FRAME_COUNT - 1) - CAMERA_ONLY_START_FRAME;
    const raw = (frameExact - CAMERA_ONLY_START_FRAME) / range;
    const leadT = Math.min(1, raw / CAMERA_REVEAL_LEAD_FRACTION);
    return leadT * leadT * (3 - 2 * leadT); // smoothstep
  }

  // El tinte de fondo debe llegar a su color final ANTES de que el achicado
  // se note, para que cuando la imagen empieza a ser visiblemente más
  // pequeña, el fondo ya sea del mismo blanco (ligeramente distinto) que el
  // de la foto, y así no se note el "corte"/borde del encogido. Por eso el
  // tinte avanza mucho más rápido que el achicado: llega al 100% en solo el
  // primer tramo (BG_TINT_LEAD_FRACTION) del rango.
  const BG_TINT_LEAD_FRACTION = 0.25;
  // Una vez alcanzado, el tinte se queda fijo para siempre: no vuelve a
  // blanco puro aunque se deslice hacia atrás o se repita el gesto.
  let bgTintMaxT = 0;

  function sceneBgColor(rawT){
    const leadT = Math.min(1, rawT / BG_TINT_LEAD_FRACTION);
    bgTintMaxT = Math.max(bgTintMaxT, leadT);
    const t = bgTintMaxT;
    if (t === 0) return '#ffffff';
    const r = Math.round(SCENE_BG_WHITE[0] + (SCENE_BG_CAMERA[0] - SCENE_BG_WHITE[0]) * t);
    const g = Math.round(SCENE_BG_WHITE[1] + (SCENE_BG_CAMERA[1] - SCENE_BG_WHITE[1]) * t);
    const bl = Math.round(SCENE_BG_WHITE[2] + (SCENE_BG_CAMERA[2] - SCENE_BG_WHITE[2]) * t);
    return `rgb(${r},${g},${bl})`;
  }

  // ANTES: easeInOutQuad (arranca despacio, acelera en medio, frena al
  // final). Con eso, justo en el instante en que el usuario desliza, el
  // primer tramo de la animación apenas se movía -se notaba como si el
  // gesto tardase en "engancharse"-. Ahora usamos un ease-out (arranca
  // rápido desde el primer frame, con la máxima velocidad justo al
  // empezar, y va frenando de forma continua hasta parar suavemente en la
  // parada siguiente). La DURACIÓN total del salto no cambia (sigue siendo
  // JUMP_DURATION / JUMP_DURATION_CONTINUATION_DOWN / _UP); lo único que cambia es el
  // reparto del movimiento dentro de ese tiempo: el comienzo se siente
  // inmediato, no todo el proceso se acelera.
  function easeOutCubic(t){
    const inv = 1 - t;
    return 1 - inv * inv * inv;
  }

  // El texto nunca se desliza: solo cambia de opacidad, desapareciendo en su
  // sitio exacto, en sincronía con el primer salto. A partir de la primera
  // parada (frame 30) se queda invisible durante el resto del recorrido.
  //
  // ANTES la opacidad iba pegada 1:1 al fotograma (currentFrameExact /
  // OLD_LAST_FRAME), así que el texto tardaba TODO el salto en
  // desvanecerse del todo: llegaba casi legible hasta el último tramo,
  // justo cuando la imagen ya está encajando en la siguiente parada, y esa
  // mezcla de "texto todavía visible" + "foto ya casi asentada" se notaba
  // como una transición menos limpia. Ahora la opacidad se calcula aparte,
  // a partir del progreso "puro" del gesto (p, 0↔1 en el sentido
  // baja→alta parada, el mismo valor que ya manejan jumpTo/
  // applySegmentProgress), con su propio ritmo -mucho más rápido que el
  // del fotograma-: el texto queda totalmente invisible mucho antes de que
  // el salto termine, así la vista ya no tiene texto que leer cuando llega
  // el encaje final, y el cambio de sección se percibe mucho más fluido.
  const CAPTION_FADE_FRACTION = 0.1; // fracción del recorrido en la que el texto ya está del todo invisible/visible: muy pequeña a propósito, para que desaparezca nada más arrancar el salto y aparezca en cuanto se llega a la parada

  function captionOpacityForProgress(p){
    const t = Math.min(1, Math.max(0, p / CAPTION_FADE_FRACTION));
    return 1 - easeOutCubic(t);
  }

  function updateCaptionAndHint(progress){
    // progress: 0..1 a lo largo del tramo 0↔1 (0 = parada portada, texto
    // visible; 1 = parada 1, texto invisible). Si no se indica -fuera del
    // primer tramo, o al aterrizar exactamente en una parada- se calcula a
    // partir del fotograma actual, que en esos casos ya coincide con el
    // valor de reposo correcto.
    const p = (typeof progress === 'number')
      ? progress
      : Math.min(1, Math.max(0, currentFrameExact / OLD_LAST_FRAME));
    const captionOpacity = captionOpacityForProgress(p);
    sceneTitle.style.opacity = captionOpacity;
  }

  // ---- non-linear progress -> frame mapping para el tramo de la continuación ----
  // El plano de "solo cámara" (a partir de CAMERA_ONLY_START_FRAME) se veía
  // demasiado lento porque el movimiento ahí es sutil; le damos a esa parte
  // menos tiempo del recorrido para que pase más rápido, y más tiempo a la
  // parte con la persona, que necesita leerse con calma.
  const cameraOnlyStartFrac = (CAMERA_ONLY_START_FRAME - OLD_LAST_FRAME) / (FRAME_COUNT - 1 - OLD_LAST_FRAME);
  const T_CAMERA_ONLY_START = 0.72; // fracción de TIEMPO en la que se alcanza ese frame

  // ANTES: dos tramos rectos pegados (una recta más lenta hasta T_CAMERA_ONLY_START
  // y otra más rápida después). Eso deja un "codo": la velocidad de avance de
  // fotogramas cambia de golpe justo en ese punto, exactamente donde también
  // empieza el encogido/tinte -> se notaba como un corte/desenfoque en vez de
  // algo fluido. Ahora usamos un spline cúbico (Hermite monótono) que pasa por
  // los mismos 3 puntos (inicio, el frame de "solo cámara", fin) pero con la
  // MISMA velocidad a ambos lados del punto intermedio, así la transición de
  // ritmo es continua y no se percibe ningún salto.
  const CONT_H1 = T_CAMERA_ONLY_START;
  const CONT_H2 = 1 - T_CAMERA_ONLY_START;
  const CONT_M0 = cameraOnlyStartFrac / CONT_H1;        // ritmo del primer tramo
  const CONT_M1 = (1 - cameraOnlyStartFrac) / CONT_H2;  // ritmo del segundo tramo
  // ritmo compartido en el punto intermedio (media armónica ponderada, método
  // de Fritsch-Carlson): mantiene el spline monótono (nunca retrocede) y con
  // derivada continua en el punto de unión.
  const CONT_W1 = 2 * CONT_H2 + CONT_H1;
  const CONT_W2 = CONT_H1 + 2 * CONT_H2;
  const CONT_M_KNOT = (CONT_M0 * CONT_M1 > 0)
    ? (CONT_W1 + CONT_W2) / (CONT_W1 / CONT_M0 + CONT_W2 / CONT_M1)
    : 0;

  function hermiteSegment(t, y0, y1, dydt0, dydt1){
    const t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return h00 * y0 + h10 * dydt0 + h01 * y1 + h11 * dydt1;
  }

  function mapContinuationProgress(p){
    let frac;
    if (p <= T_CAMERA_ONLY_START){
      const t = p / CONT_H1;
      frac = hermiteSegment(t, 0, cameraOnlyStartFrac, CONT_M0 * CONT_H1, CONT_M_KNOT * CONT_H1);
    } else {
      const t = (p - T_CAMERA_ONLY_START) / CONT_H2;
      frac = hermiteSegment(t, cameraOnlyStartFrac, 1, CONT_M_KNOT * CONT_H2, CONT_M1 * CONT_H2);
    }
    return OLD_LAST_FRAME + frac * (FRAME_COUNT - 1 - OLD_LAST_FRAME);
  }

  // ---- salto animado entre paradas consecutivas ----
  // Una vez arranca, siempre termina el tramo completo hasta la siguiente
  // parada: no hay forma de quedarse a mitad. Mientras "animating" es true
  // se ignora cualquier gesto nuevo.
  const JUMP_DURATION = 1050;           // tramo 0↔1 (vídeo original)
  // Tramo 1↔2 (la continuación, la sección de "los saltos"): una única
  // duración FIJA para ambas direcciones. Da igual lo rápido, lo fuerte o
  // lo brusco que sea el gesto (rueda, trackpad o dedo): el salto siempre
  // tarda exactamente lo mismo en completarse, a la misma velocidad
  // estándar, tanto subiendo como bajando. El gesto solo decide SI se
  // dispara el salto (y hacia qué dirección), nunca a qué velocidad ni si
  // se "adelanta" o se salta algún fotograma.
  const JUMP_DURATION_CONTINUATION = 1800;
  const JUMP_DURATION_CONTINUATION_DOWN = JUMP_DURATION_CONTINUATION; // bajando (avanzando)
  const JUMP_DURATION_CONTINUATION_UP = JUMP_DURATION_CONTINUATION;   // subiendo (retrocediendo)
  let lastJumpDuration = JUMP_DURATION;

  function jumpTo(targetStep){
    if (animating || targetStep === stepIndex) return;
    if (targetStep < 0 || targetStep > WAYPOINTS.length - 1) return;
    animating = true;

    const toFrame = WAYPOINTS[targetStep];
    const fromStep = stepIndex; // se guarda aparte: stepIndex no cambia hasta que termina el salto
    const low = Math.min(fromStep, targetStep);
    const high = Math.max(fromStep, targetStep);
    // el tramo especial (con cambio de lente) es únicamente el que conecta
    // las paradas 0 y 1, en cualquier dirección
    const isFirstSegment = (stepIndex === 0 && targetStep === 1) || (stepIndex === 1 && targetStep === 0);
    const goingForward = targetStep > stepIndex;
    const duration = isFirstSegment
      ? JUMP_DURATION
      : (goingForward ? JUMP_DURATION_CONTINUATION_DOWN : JUMP_DURATION_CONTINUATION_UP);
    lastJumpDuration = duration;
    const startTime = performance.now();

    function step(now){
      const t = Math.min(1, (now - startTime) / duration);
      const eased = easeOutCubic(t);
      const p = goingForward ? eased : (1 - eased);

      if (isFirstSegment){
        currentFrameExact = mapFirstSegmentProgress(p);
      } else {
        currentFrameExact = mapContinuationProgress(p);
      }

      render();
      updateCaptionAndHint(isFirstSegment ? p : undefined);
      // "eased" ya representa, en sí mismo, la fracción completada del
      // salto (0 al empezar, 1 al llegar), en la dirección real del
      // gesto -sea hacia delante o hacia atrás-, así que sirve tal cual
      // para mover el relleno naranja entre fromStep y targetStep.
      updateProgressTrack(fromStep + (targetStep - fromStep) * eased);
      syncRealScrollForStepPosition(fromStep + (targetStep - fromStep) * eased);
      // "p" aquí ya es el progreso a lo largo del eje baja→alta parada
      // (igual que localP en applySegmentProgress), así que sirve tal
      // cual para el mismo cálculo de difuminado del recuadro Antes/Después.
      pushStep1Amount(step1AmountFromAxis(low, high, p));

      if (t < 1){
        requestAnimationFrame(step);
      } else {
        stepIndex = targetStep;
        currentFrameExact = toFrame;
        // FIX "negro permanente" al volver de la 3ª posición: mientras se
        // está en la zona negra (postEndOffset > 0) hay DOS bucles de
        // requestAnimationFrame corriendo a la vez -este salto (jumpTo,
        // que mueve currentFrameExact) y el que cierra postEndOffset
        // (stepTowardPostEndTarget)-. En teoría ambos convergen solos,
        // pero si por lo que sea uno se queda a medias (p.ej. el usuario
        // dispara otro gesto justo en ese instante), el --bg de la página
        // y/o el translate3d de la escena podían quedarse "a mitad de
        // camino" del tramo negro, aunque stepIndex ya no sea la última
        // parada. En vez de confiar en que ambos bucles siempre terminen
        // perfectamente sincronizados, aquí -en cuanto ATERRIZAMOS en una
        // parada que no es la última- forzamos explícitamente el mismo
        // reseteo que ya usa window.__resetWhiteEnd (postEndOffset a 0,
        // el translate de la escena a '', y --bg de vuelta a blanco): así
        // el negro de la 3ª posición nunca puede sobrevivir un viaje de
        // vuelta a la 2ª o a la 1ª, pase lo que pase con esos dos bucles.
        if (stepIndex !== WAYPOINTS.length - 1 && typeof window.__resetWhiteEnd === 'function'){
          window.__resetWhiteEnd();
        }
        render();
        updateCaptionAndHint();
        animating = false;
        // el aviso de "desliza" se muestra en cualquier parada que no sea la
        // última, para invitar a seguir deslizando
        sceneHint.classList.toggle('visible', stepIndex < WAYPOINTS.length - 1);
        updateEndOfPathUI();

        // Si durante esta animación llegó otro gesto (deslizar rápido), se
        // disparaba y se perdía; ahora se dispara aquí, justo al terminar.
        if (pendingDir !== 0){
          const dir = pendingDir;
          pendingDir = 0;
          if (dir > 0) goNext(); else goPrev();
        }
      }
    }
    requestAnimationFrame(step);
  }

  function goNext(){ jumpTo(Math.min(stepIndex + 1, WAYPOINTS.length - 1)); }
  function goPrev(){ jumpTo(Math.max(stepIndex - 1, 0)); }

  // ---- arrastre en vivo entre paradas (fotos) ----
  // A diferencia del salto por gesto corto (jumpTo, disparado por rueda),
  // en táctil ahora la escena sigue el dedo en tiempo real mientras se
  // desliza -igual que ya hacía el tramo final tras la última foto-, y el
  // punto de progreso lateral se mueve exactamente al mismo ritmo (ver
  // updateProgressTrack más abajo). Al soltar, si se arrastró lo bastante
  // se completa el salto hasta la siguiente parada; si no, la escena
  // vuelve suavemente a la parada de la que salió. En ambos casos la
  // animación de cierre arranca desde el punto exacto donde se soltó el
  // dedo, nunca desde cero, así no hay ningún "salto atrás" visible.
  function segmentLocalP(fromStep, toStep, p){
    // p = progreso del gesto (0..1) yendo de fromStep hacia toStep.
    // Las funciones mapFirstSegmentProgress/mapContinuationProgress están
    // definidas siempre de la parada más baja (low) a la más alta (high),
    // así que si el gesto va "hacia atrás" (fromStep > toStep) hay que
    // invertir p para consultarlas correctamente.
    return fromStep < toStep ? p : 1 - p;
  }

  // FIX: hay contenido que solo debe verse pegado a la parada 1 (el
  // recuadro "Antes/Después"). Antes solo aparecía o desaparecía de golpe
  // al completar el salto -stepIndex no cambia hasta que el salto termina
  // del todo-, así que un arrastre lento y sin soltar el dedo lo dejaba
  // totalmente visible hasta el último instante, sin ningún difuminado
  // intermedio. Ahora se calcula, en cada frame del gesto (tanto en el
  // arrastre en vivo como en la animación de asentado), cuánto "se está"
  // en la parada 1 -de 0 a 1, según el progreso a lo largo del eje
  // baja→alta parada (localP)- y se empuja ese valor a quien lo necesite
  // (ver el panel Antes/Después más abajo), para que se difumine en tiempo
  // real al mismo ritmo exacto del gesto, sin esperar a que el salto acabe.
  function step1AmountFromAxis(low, high, axisP){
    if (low === 1) return 1 - axisP;   // la parada 1 es el extremo "bajo" de este tramo
    if (high === 1) return axisP;      // la parada 1 es el extremo "alto" de este tramo
    return 0;                          // este tramo no toca la parada 1
  }
  function pushStep1Amount(amount){
    if (typeof window.__setStep1Amount === 'function') window.__setStep1Amount(amount);
  }

  function applySegmentProgress(fromStep, toStep, p){
    const low = Math.min(fromStep, toStep);
    const high = Math.max(fromStep, toStep);
    const localP = segmentLocalP(fromStep, toStep, p);
    const isFirstSegment = (low === 0 && high === 1);
    currentFrameExact = isFirstSegment ? mapFirstSegmentProgress(localP) : mapContinuationProgress(localP);
    render();
    updateCaptionAndHint(isFirstSegment ? localP : undefined);
    updateProgressTrack(fromStep + (toStep - fromStep) * p);
    syncRealScrollForStepPosition(fromStep + (toStep - fromStep) * p);
    pushStep1Amount(step1AmountFromAxis(low, high, localP));
  }

  // Termina, animado, el tramo que ya se venía arrastrando: sigue desde
  // "startP" (donde se soltó el dedo) hasta 1 (si se confirma el salto) o
  // hasta 0 (si se cancela y se vuelve a la parada de origen). La duración
  // se reparte solo sobre lo que falta por recorrer, para que la velocidad
  // se sienta continua con el arrastre que la precedió, no como un salto
  // nuevo que arranca de golpe.
  //
  // ANTES esto se probó forzando SIEMPRE la duración completa calibrada al
  // confirmar (commit), para evitar que un gesto rápido "adelantara" el
  // salto. Pero eso ya no hace falta -y además causaba un problema nuevo-:
  // ahora la velocidad del arrastre EN VIVO ya está limitada (ver
  // dragDisplayP/dragStepLoop más arriba), así que cuando se suelta el
  // dedo, "startP" nunca puede estar más avanzado de lo que el ritmo
  // calibrado permite. Forzar encima la duración completa aquí solo
  // añadía una espera de más al aterrizar -sobre todo notoria justo al
  // final del 2º salto, la conexión con la 4ª parte, que se sentía
  // "pillada"-. Con la duración repartida sobre lo que falta, si ya casi
  // se había llegado (porque el límite de velocidad ya dejó que pasara
  // el tiempo necesario), el cierre es corto y fluido; si se soltó recién
  // empezado el gesto, el cierre reparte el resto del tiempo calibrado.
  function settleSegment(fromStep, toStep, startP, commit){
    animating = true;
    const isFirstSegment = (Math.min(fromStep, toStep) === 0 && Math.max(fromStep, toStep) === 1);
    // Igual que en jumpTo: la dirección real del salto que se está
    // completando es toStep > fromStep (bajando) o toStep < fromStep
    // (subiendo), independientemente de "commit" (que solo dice si se
    // confirma el salto o se vuelve al origen). Así el arrastre táctil
    // respeta la misma velocidad por dirección que el salto por rueda.
    const settlingForward = toStep > fromStep;
    const fullDuration = isFirstSegment
      ? JUMP_DURATION
      : (settlingForward ? JUMP_DURATION_CONTINUATION_DOWN : JUMP_DURATION_CONTINUATION_UP);
    const target = commit ? 1 : 0;
    const remaining = Math.max(0.001, Math.abs(target - startP));
    const duration = Math.max(160, fullDuration * remaining);
    lastJumpDuration = duration;
    const startTime = performance.now();

    function step(now){
      const t = Math.min(1, (now - startTime) / duration);
      const eased = easeOutCubic(t);
      const p = startP + (target - startP) * eased;
      applySegmentProgress(fromStep, toStep, p);

      if (t < 1){
        requestAnimationFrame(step);
      } else {
        stepIndex = commit ? toStep : fromStep;
        currentFrameExact = WAYPOINTS[stepIndex];
        // Mismo FIX que en jumpTo (ver el comentario largo ahí): al
        // aterrizar en una parada que no es la última, forzamos el
        // reseteo del estado de la zona negra para que nunca quede
        // "pillado" el fondo oscuro tras un arrastre táctil de vuelta.
        if (stepIndex !== WAYPOINTS.length - 1 && typeof window.__resetWhiteEnd === 'function'){
          window.__resetWhiteEnd();
        }
        render();
        updateCaptionAndHint();
        animating = false;
        sceneHint.classList.toggle('visible', stepIndex < WAYPOINTS.length - 1);
        updateEndOfPathUI();
        if (pendingDir !== 0){
          const dir = pendingDir;
          pendingDir = 0;
          if (dir > 0) goNext(); else goPrev();
        }
      }
    }
    requestAnimationFrame(step);
  }

  // ---- detección del gesto: basta un movimiento pequeño para disparar el
  // salto completo (no hace falta "arrastrar" todo el recorrido). ----
  const WHEEL_THRESHOLD = 8;
  const TOUCH_THRESHOLD = 12;
  let wheelLock = false;

  // ---- FIX: un solo gesto de scroll ya no encadena los dos saltos ----
  // Un gesto de rueda/trackpad dispara MUCHOS eventos "wheel" seguidos
  // mientras dura (y su inercia). Antes, cualquiera de esos eventos que
  // llegara durante una animación en curso se guardaba en "pendingDir" y
  // se disparaba en cuanto esa animación terminaba; como un solo gesto
  // físico de scroll suele durar más que la animación de un salto, el
  // propio gesto quedaba "re-armando" pendingDir una y otra vez y acababa
  // encadenando el segundo salto automáticamente -> un solo scroll te
  // dejaba abajo del todo en vez de parar en la parada intermedia (antes
  // hacían falta dos gestos de scroll independientes para llegar abajo).
  // Ahora solo se atiende el PRIMER evento "wheel" de cada gesto; el resto
  // de eventos de ESE MISMO gesto se ignoran. Hace falta una pausa real
  // (sin eventos "wheel", WHEEL_GESTURE_GAP ms) para que el siguiente
  // evento cuente como un gesto nuevo y pueda disparar el siguiente salto.
  const WHEEL_GESTURE_GAP = 180;
  let wheelGestureActive = false;
  let wheelGestureTimer = null;

  function onWheel(e){
    if (currentView !== 'resumen') return;
    e.preventDefault();

    // ---- Última parada: scroll real, continuo y fluido ----
    // En vez de saltar entre fotogramas, cada evento de rueda desplaza la
    // escena exactamente lo que indica deltaY, igual que un scroll normal.
    if (!animating && stepIndex === WAYPOINTS.length - 1){
      // Si la escena todavía estaba deslizando por la inercia de un toque
      // anterior, un evento de rueda/trackpad real retoma el control al
      // instante (igual que hace un nuevo touchstart).
      stopPostEndInertia();
      // Agrupa esta racha de eventos de rueda en un único gesto físico (ver
      // postEndGestureActive arriba). Solo en el PRIMER evento de un gesto
      // nuevo (tras una pausa real) se anota desde dónde partía, para saber
      // si ese gesto en concreto ya empezaba con la escena asentada en la
      // 3ª posición o si viene de dentro de la zona negra.
      if (!postEndGestureActive){
        postEndGestureStartOffset = postEndTarget;
      }
      postEndGestureActive = true;
      clearTimeout(postEndGestureTimer);
      postEndGestureTimer = setTimeout(() => { postEndGestureActive = false; }, POST_END_GESTURE_GAP);

      const attempted = postEndTarget + e.deltaY;
      if (attempted <= 0){
        setPostEndOffset(0);
        // Solo se dispara el salto a la 2ª posición si este gesto YA
        // empezaba con la escena en la 3ª posición (postEndGestureStartOffset
        // <= 0): así, "por mucho que se suba" dentro de un gesto que viene
        // de la zona negra, la escena se queda quieta en la 3ª posición en
        // cuanto se cierra el hueco -hace falta soltar y deslizar de nuevo
        // para seguir subiendo hacia la 2ª-.
        if (postEndGestureStartOffset <= 0 && e.deltaY <= -WHEEL_THRESHOLD && !wheelLock){
          wheelLock = true;
          goPrev();
          setTimeout(() => { wheelLock = false; }, lastJumpDuration + 150);
        }
      } else {
        setPostEndOffset(attempted);
      }
      return;
    }

    if (Math.abs(e.deltaY) < WHEEL_THRESHOLD) return;

    clearTimeout(wheelGestureTimer);
    wheelGestureTimer = setTimeout(() => { wheelGestureActive = false; }, WHEEL_GESTURE_GAP);
    if (wheelGestureActive) return; // sigue siendo el mismo gesto: se ignora
    wheelGestureActive = true;

    const dir = e.deltaY > 0 ? 1 : -1;

    // FIX "subida de tirón": antes, un gesto que llegaba mientras ya había
    // un salto en marcha se guardaba en pendingDir y se disparaba solo, sin
    // pausa, en cuanto terminaba ese salto -así, un scroll fuerte o largo
    // (o varios "golpes" seguidos de rueda/trackpad) podía encadenar los
    // dos saltos (parada 0 -> 1 -> 2) del tirón, sin llegar a notarse la
    // parada intermedia. Ahora, mientras hay una animación en curso, CUAL-
    // QUIER gesto nuevo se ignora sin más (no se guarda ni se dispara
    // luego): como mucho una parada por gesto físico, por fuerte que se
    // deslice; para seguir avanzando hace falta un gesto nuevo una vez la
    // escena ya se ha asentado en la parada.
    if (animating){
      return;
    }
    if (wheelLock) return;
    wheelLock = true;
    // usamos la duración del salto que se acaba de disparar (se sabrá justo
    // después de llamar a goNext/goPrev, que ya habrá actualizado lastJumpDuration)
    if (dir > 0) goNext(); else goPrev();
    setTimeout(() => { wheelLock = false; }, lastJumpDuration + 150);
  }

  let touchStartY = null;
  let touchStartOffset = 0;
  let touchInPostEnd = false; // true si el gesto empezó ya en la última parada: se sigue el dedo en tiempo real

  // ---- FIX: no confundir un toque/roce ligero sobre el contenido con un
  // gesto real de scroll ----
  // Antes, el primerísimo evento "touchmove" ya se interpretaba como scroll,
  // por mínimo que fuera el desplazamiento: tocar (o arrastrar sin querer
  // unos pocos píxeles) un botón u otro elemento del contenido mientras se
  // levantaba el dedo bastaba para que la escena se moviera un poco, porque
  // dragTargetP se calculaba directamente con esa distancia mínima y, en el
  // tramo final, setPostEndOffset() se aplicaba 1:1 desde el primer píxel.
  // Ahora se exige que el dedo recorra una distancia mínima real
  // (SCROLL_INTENT_THRESHOLD) antes de "confirmar" que el gesto es scroll:
  // por debajo de ese umbral no se llama a preventDefault() (así un tap o
  // clic sobre un botón funciona con normalidad) ni se mueve la escena.
  // Solo al superar el umbral se confirma el gesto (touchIntentConfirmed) y,
  // a partir de ahí, sí se bloquea el scroll nativo y se sigue el dedo como
  // antes.
  const SCROLL_INTENT_THRESHOLD = 10; // px mínimos de movimiento real
  let touchIntentConfirmed = false;

  // Arrastre en vivo entre paradas de fotos: mientras el dedo se mueve, la
  // escena y el punto de progreso lateral avanzan hacia la parada
  // siguiente/anterior. dragToStep es la parada hacia la que se está
  // tirando (stepIndex+1 o stepIndex-1).
  //
  // ANTES el avance seguía el dedo 1:1 (dragP = distancia recorrida por el
  // dedo / DRAG_RANGE), así que un dedo rápido hacía avanzar la escena a la
  // misma velocidad: cuanto más rápido el gesto, más rápido "el salto".
  // Ahora se separan dos valores: dragTargetP es el objetivo crudo que pide
  // el dedo (sin límite, puede llegar a 1 al instante si el gesto es muy
  // rápido), y dragDisplayP es lo que de verdad se pinta en pantalla, que
  // solo puede acercarse a dragTargetP a una velocidad máxima -la misma
  // duración calibrada del salto (JUMP_DURATION / _CONTINUATION_DOWN /
  // _CONTINUATION_UP)-. Así, por muy rápido que se mueva el dedo, la escena
  // nunca completa el tramo en menos tiempo que esa duración; si el dedo va
  // más despacio que ese límite, no se nota ningún freno (dragDisplayP
  // sigue al dedo con normalidad). El bucle que actualiza dragDisplayP
  // corre en requestAnimationFrame para poder seguir "poniéndose al día" a
  // ritmo limitado aunque el dedo se quede quieto tras un gesto brusco.
  let dragToStep = -1;
  let dragTargetP = 0;
  let dragDisplayP = 0;
  let dragRafId = null;
  let dragLastFrameTime = 0;
  const DRAG_RANGE = () => Math.max(220, window.innerHeight * 0.55);
  const DRAG_COMMIT_P = 0.24; // fracción mínima arrastrada para completar el salto al soltar

  function minDurationFor(fromStep, toStep){
    const isFirstSegment = (Math.min(fromStep, toStep) === 0 && Math.max(fromStep, toStep) === 1);
    const forward = toStep > fromStep;
    return isFirstSegment
      ? JUMP_DURATION
      : (forward ? JUMP_DURATION_CONTINUATION_DOWN : JUMP_DURATION_CONTINUATION_UP);
  }

  function stopDragRaf(){
    if (dragRafId !== null){ cancelAnimationFrame(dragRafId); dragRafId = null; }
  }

  function dragStepLoop(now){
    dragRafId = null;
    if (dragToStep === -1) return; // el gesto se canceló mientras tanto
    const dt = Math.max(0, now - dragLastFrameTime);
    dragLastFrameTime = now;
    const dur = minDurationFor(stepIndex, dragToStep);
    const maxDelta = dt / dur; // avance máximo permitido en este frame
    dragDisplayP = dragDisplayP < dragTargetP
      ? Math.min(dragTargetP, dragDisplayP + maxDelta)
      : dragTargetP;
    applySegmentProgress(stepIndex, dragToStep, dragDisplayP);
    // sigue el bucle mientras el dedo siga en pantalla, o mientras aún no
    // haya alcanzado el objetivo (para ponerse al día a ritmo limitado
    // incluso si el dedo ya se ha quedado quieto).
    if (touchStartY !== null || dragDisplayP < dragTargetP){
      dragRafId = requestAnimationFrame(dragStepLoop);
    }
  }

  function startDragRafIfNeeded(){
    if (dragRafId !== null) return;
    dragLastFrameTime = performance.now();
    dragRafId = requestAnimationFrame(dragStepLoop);
  }

  // FIX (ampliado): antes solo se protegía el tirador "Antes/Después"
  // (#beforeAfterCompare) o lo que se marcara a mano con
  // data-no-scene-drag. Pero cualquier otro contenido tocable dentro de la
  // escena -los botones de categorías, el carrusel de cámaras, o cualquier
  // botón/enlace/campo que se añada en el futuro- sufría el mismo
  // problema: tocarlo (o moverlo un poco, aunque fuera sin querer, al
  // levantar el dedo) se interpretaba como intención de scroll y hacía
  // avanzar/retroceder la historia en vez de dejar que el elemento
  // reaccionara con normalidad al toque. Esta lista cubre, de forma
  // genérica, cualquier elemento interactivo/de contenido tocable: no hace
  // falta acordarse de añadir data-no-scene-drag a cada botón nuevo, basta
  // con que sea (o esté dentro de) uno de estos selectores.
  const SCENE_DRAG_EXCLUDE_SELECTOR = [
    '[data-no-scene-drag]',
    'button',
    'a',
    'input',
    'textarea',
    'select',
    'label',
    '[role="button"]',
    '[contenteditable]',
    '#cameraCarousel',
    '.camera-carousel'
  ].join(', ');

  function onTouchStart(e){
    if (currentView !== 'resumen') return;
    // Si el gesto empieza sobre cualquiera de estos elementos, no se toma
    // como intención de navegar por la historia: ese elemento ya gestiona
    // su propio toque/arrastre (o simplemente es un botón/enlace que debe
    // poder pulsarse con normalidad) y no debe interpretarse nunca como un
    // scroll vertical de la escena. Sin este corte, tocar o mover el dedo
    // sobre ese contenido también hacía avanzar/retroceder las fotos,
    // porque ambos sistemas escuchaban el mismo touchstart/touchmove a
    // nivel de window.
    if (e.target && e.target.closest && e.target.closest(SCENE_DRAG_EXCLUDE_SELECTOR)) return;
    touchStartY = e.touches[0].clientY;
    touchInPostEnd = !animating && stepIndex === WAYPOINTS.length - 1;
    touchStartOffset = postEndTarget;
    touchIntentConfirmed = false;
    dragToStep = -1;
    dragTargetP = 0;
    dragDisplayP = 0;
    stopDragRaf();
    // Un nuevo toque siempre "agarra" el scroll donde esté: si venía
    // deslizando por inercia tras soltar antes, se cancela esa animación y
    // el arrastre retoma el control 1:1 desde este mismo instante -igual
    // que en cualquier scroll nativo-.
    stopPostEndInertia();
    if (touchInPostEnd) resetPostEndVelocitySamples(touchStartOffset);
  }

  function onTouchMove(e){
    if (currentView !== 'resumen') return;
    if (touchStartY === null) return;

    if (!touchIntentConfirmed){
      const rawDy = touchStartY - e.touches[0].clientY;
      if (Math.abs(rawDy) < SCROLL_INTENT_THRESHOLD){
        // Todavía no hay movimiento suficiente para saber si es un gesto de
        // scroll o solo un toque/roce sobre el contenido: no se bloquea el
        // comportamiento nativo (preventDefault) ni se mueve la escena.
        return;
      }
      touchIntentConfirmed = true;
    }

    e.preventDefault(); // ya confirmado como scroll: evita el scroll/rebote nativo
    if (touchInPostEnd && touchStartY !== null){
      // Seguimiento 1:1: la escena sube/baja exactamente lo mismo que se
      // mueve el dedo, en directo, fotograma a fotograma (sin animación).
      const dy = touchStartY - e.touches[0].clientY;
      setPostEndOffset(touchStartOffset + dy);
      // Se anota cada posición con su instante para poder calcular la
      // velocidad real del gesto en el momento de soltar (ver
      // startPostEndInertia en onTouchEnd).
      trackPostEndVelocitySample(postEndTarget);
      return;
    }
    if (animating || touchStartY === null) return;

    // Fuera del tramo final: seguimiento en vivo del dedo entre la parada
    // actual y la siguiente/anterior (según la dirección del gesto), con el
    // mismo mapeo de fotogramas que usa el salto animado, pero con el
    // límite de velocidad explicado arriba.
    const dy = touchStartY - e.touches[0].clientY;
    const dir = dy >= 0 ? 1 : -1;
    const target = stepIndex + dir;
    if (target < 0 || target > WAYPOINTS.length - 1){
      // ya no hay más paradas en esa dirección: nada que arrastrar
      dragToStep = -1;
      dragTargetP = 0;
      dragDisplayP = 0;
      stopDragRaf();
      return;
    }
    if (target !== dragToStep){
      // cambio de dirección a mitad de gesto: se reinicia el avance
      // (limitado) desde 0 hacia el nuevo objetivo.
      dragDisplayP = 0;
    }
    dragToStep = target;
    dragTargetP = Math.max(0, Math.min(1, Math.abs(dy) / DRAG_RANGE()));
    startDragRafIfNeeded();
  }

  function onTouchEnd(e){
    if (currentView !== 'resumen') return;
    if (touchStartY === null){ return; }
    const dy = touchStartY - e.changedTouches[0].clientY;
    touchStartY = null;
    const wasConfirmed = touchIntentConfirmed;
    touchIntentConfirmed = false;

    if (!wasConfirmed){
      // El gesto nunca llegó a moverse lo suficiente como para confirmarse
      // como scroll (fue un tap, o un roce mínimo sobre el contenido): la
      // escena no se movió, así que aquí no hay nada que asentar ni que
      // devolver a su sitio. Se deja que el navegador trate el toque como
      // un tap/clic normal sobre el elemento tocado.
      touchInPostEnd = false;
      dragToStep = -1;
      dragTargetP = 0;
      dragDisplayP = 0;
      return;
    }

    if (touchInPostEnd){
      touchInPostEnd = false;
      // FIX: "subir para ver la 3ª posición" ya no aterriza de un tirón en
      // la 2ª. Antes, cualquier deslizar hacia arriba que TERMINARA con la
      // escena en 0 (aunque hubiera empezado bien adentro de la zona negra)
      // pedía el regreso a la 2ª posición -así que un único swipe largo
      // desde el fondo negro te sacaba directo a la 2ª, sin parar en la 3ª-.
      // Ahora solo cuenta el swipe si YA empezaba con la escena asentada en
      // la 3ª posición (touchStartOffset <= 0): un gesto que empieza dentro
      // de la zona negra solo puede cerrar el hueco, por mucho que se suba
      // dentro de ese mismo gesto. Para seguir hasta la 2ª posición hace
      // falta soltar el dedo y deslizar de nuevo, ya con la escena quieta
      // en la 3ª.
      if (!animating && postEndTarget <= 0){
        setPostEndOffset(0);
        if (touchStartOffset <= 0 && dy <= -TOUCH_THRESHOLD){
          goPrev();
        }
        return;
      }
      // FIX (inercia nativa): antes, si se soltaba el dedo a mitad de este
      // tramo (ni del todo cerrado en 0 ni en el otro extremo), no pasaba
      // nada más: postEndOffset se quedaba clavado exactamente donde
      // estuviera el dedo al soltar -un frenazo en seco, distinto de
      // cualquier scroll nativo-. Ahora se calcula la velocidad real que
      // llevaba el gesto justo antes de soltar y se lanza una animación de
      // inercia (startPostEndInertia) que sigue deslizando la escena y va
      // frenando de forma progresiva, exactamente igual que el scroll con
      // inercia de Safari/iOS o de cualquier app nativa de Android, hasta
      // agotarse o hasta topar con alguno de los dos extremos del tramo.
      if (!animating){
        startPostEndInertia(currentPostEndVelocity());
      }
      return;
    }

    stopDragRaf();

    if (dragToStep === -1){
      // No hubo arrastre real (o iba hacia un lado sin más paradas): nada
      // que confirmar ni que devolver a su sitio.
      return;
    }
    const fromStep = stepIndex;
    const toStep = dragToStep;
    // La decisión de si el salto se confirma se toma con la distancia REAL
    // recorrida por el dedo (dragTargetP), no con dragDisplayP -que solo
    // representa lo que ya dio tiempo a pintar en pantalla, limitado a la
    // velocidad estándar del salto-. Así, un gesto corto y claro (mucho
    // menos de un cuarto de pantalla) basta para que se detecte la
    // intención y se dispare el salto, sin tener que mantener el dedo
    // apoyado esperando a que la animación "se ponga al día".
    const intentP = dragTargetP;
    const startP = dragDisplayP; // punto visual desde el que arranca el cierre, para que no dé un salto brusco
    dragToStep = -1;
    dragTargetP = 0;
    dragDisplayP = 0;

    if (animating) return;

    if (intentP >= DRAG_COMMIT_P){
      settleSegment(fromStep, toStep, startP, true);  // completa el salto hasta la siguiente parada
    } else {
      settleSegment(fromStep, toStep, startP, false); // vuelve suavemente a la parada de origen
    }
  }

  const KEY_SCROLL_STEP = 120; // px por pulsación, coherente con un scroll normal de página

  function onKeydown(e){
    if (currentView !== 'resumen') return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' '){
      e.preventDefault();
      if (!animating && stepIndex === WAYPOINTS.length - 1){
        stopPostEndInertia();
        setPostEndOffset(postEndTarget + KEY_SCROLL_STEP);
      } else if (animating){ /* se ignora mientras salta, ver FIX en onWheel */ } else { goNext(); }
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp'){
      e.preventDefault();
      if (!animating && stepIndex === WAYPOINTS.length - 1){
        stopPostEndInertia();
        if (postEndTarget > 0){
          // Todavía queda hueco por cerrar en la zona negra: esta pulsación
          // solo lo cierra, nunca encadena el salto a la 2ª posición aunque
          // lo deje exactamente en 0.
          setPostEndOffset(postEndTarget - KEY_SCROLL_STEP);
        } else {
          // Ya no quedaba hueco (la escena ya estaba asentada en la 3ª
          // posición): esta es una pulsación nueva y clara para seguir
          // subiendo, así que ahora sí se dispara el salto a la 2ª.
          goPrev();
        }
      } else if (animating){ /* se ignora mientras salta, ver FIX en onWheel */ } else { goPrev(); }
    }
  }

  window.addEventListener('wheel', onWheel, { passive:false });
  window.addEventListener('touchstart', onTouchStart, { passive:true });
  window.addEventListener('touchmove', onTouchMove, { passive:false });
  window.addEventListener('touchend', onTouchEnd, { passive:true });
  window.addEventListener('keydown', onKeydown);
  // IMPORTANTE: cuando la escena (.scene-wrap) está oculta -por estar en
  // Ediciones, Ajustes, Sobre mí, etc.- su clientWidth/clientHeight valen 0
  // (display:none). Si en ese momento se dispara un resize (por ejemplo al
  // enfocar un campo de texto en Ajustes y que el teclado mueva el
  // "visual viewport" en iPad/iPhone), resizeCanvas() dejaba el <canvas> a
  // 0x0 y el fotograma dibujado se perdía; al volver a la vista principal
  // el recuadro de las 3 posiciones aparecía en blanco, porque nada volvía
  // a redimensionar/redibujar. Por eso, mientras no estemos en "resumen",
  // el resize se ignora aquí -no hay nada visible que ajustar- y es
  // goToView() quien se encarga de recalcular todo al volver a mostrarla.
  function onSceneResize(){
    if (window.currentView && window.currentView !== 'resumen') return;
    resizeCanvas();
    render();
    if (typeof window.__resyncScrollToStep === 'function') window.__resyncScrollToStep();
  }
  window.addEventListener('resize', () => { onSceneResize(); fitBodyCaption(); recomputeProgressSpan(); });
  wideLayoutQuery.addEventListener('change', () => { render(); fitBodyCaption(); });
  // En iOS/Android, mostrar u ocultar la barra de direcciones dispara un
  // resize del "visual viewport" que a veces no llega por 'resize' normal;
  // lo escuchamos aparte para que el lienzo y el difuminado de abajo nunca
  // se queden desajustados.
  if (window.visualViewport){
    window.visualViewport.addEventListener('resize', () => { onSceneResize(); fitBodyCaption(); });
  }

  Promise.all([loadAll(), waitForLoaderVideo()]).then(() => {
    resizeCanvas();
    stepIndex = 0;
    currentFrameExact = 0;
    window.scrollTo(0, 0);
    render();
    updateCaptionAndHint();
    fitBodyCaption();
    sceneHint.classList.add('visible');
    recomputeProgressSpan();
    updateEndOfPathUI();
    pushStep1Amount(stepIndex === 1 ? 1 : 0);
    setPageBgColor(PAGE_BG_WHITE);

    // La intro ya terminó y se ha quedado congelada en su último
    // fotograma (drawFrame no se vuelve a limpiar tras el último "step",
    // ver playSequence más arriba). Si a estas alturas todavía faltan
    // fotos de la nube por llegar, se enseña el spinner debajo del logo
    // y NO se oculta el loader hasta que waitForSiteAssets() resuelva
    // -así nunca se ve la web "a medio cargar" nada más entrar-.
    if (loaderSpinner) loaderSpinner.classList.add('is-visible');
    waitForSiteAssets().then(() => {
      if (loaderSpinner) loaderSpinner.classList.remove('is-visible');
      loader.style.opacity = '0';
      // La hamburguesa se mantenía oculta durante toda la pantalla de
      // carga (ver clase inicial "intro-hidden" en el HTML); en cuanto
      // esa pantalla empieza a desvanecerse, ya estamos "dentro" de la
      // web propiamente dicha, así que se muestra.
      if (menuToggleBtn) menuToggleBtn.classList.remove('intro-hidden');
      setTimeout(() => { loader.style.display = 'none'; }, 500);
    });
  });

  // La tipografía Fraunces se carga de forma asíncrona (Google Fonts); en
  // cuanto termine de cargar, sus métricas reales pueden cambiar el alto
  // ocupado por el texto, así que volvemos a comprobar el ajuste.
  if (document.fonts && document.fonts.ready){
    document.fonts.ready.then(fitBodyCaption).catch(() => {});
  }

  // ---------- Menú de navegación ----------
  window.currentView = 'resumen';

  // Exponemos el paso actual de la historia para que el carrusel de
  // cámaras sepa cuándo mostrarse (solo en el último fotograma, parado).
  window.STORY_LAST_STEP = WAYPOINTS.length - 1;
  setInterval(() => {
    window.__storyStep = stepIndex;
    window.__storyAnimating = animating;
    // Progreso (0→1) de aparición anticipada del bloque "las dos cámaras":
    // ver computeCameraRevealP más arriba. Se recalcula aquí a partir de
    // currentFrameExact -la misma fuente única de verdad que usa render()-
    // así cubre por igual el salto animado, el arrastre en vivo y el
    // reposo, sin importar cuál de los tres está moviendo la escena.
    window.__storyCameraRevealP = computeCameraRevealP(currentFrameExact);
  }, 40);
})();
