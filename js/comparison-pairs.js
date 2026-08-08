(function(){
  const PLACEHOLDER_ICON = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2"/>
      <circle cx="8.5" cy="10" r="1.5"/>
      <path d="M21 15l-5-5-4 4-3-3-5 5"/>
    </svg>`;
  // Icono de "mover" (flechas) usado como pista dentro del badge
  // "Ajustar encuadre" (ver renderExpandEditor) y dentro del simulador.
  const MOVE_ICON_SMALL = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 5v14M8 9l4-4 4 4M8 15l4 4 4-4"/>
    </svg>`;

  /* =================================================================
     2) Comparaciones antes/después (el carrusel con flechas de la 4ª
        posición, justo encima de "Descubre mi trabajo")
     ================================================================= */
  const DEFAULT_PAIRS = [
    { id:'pair-1', before:null, after:null, beforePosY:50, afterPosY:50 },
    { id:'pair-2', before:null, after:null, beforePosY:50, afterPosY:50 }
  ];
  const PAIR_PLACEHOLDER_BEFORE = 'linear-gradient(160deg,#4a4d4f,#202325 55%,#0c0d0e)';
  const PAIR_PLACEHOLDER_AFTER = 'linear-gradient(150deg,#ffb27a 0%,#ff5a1f 32%,#7a2708 62%,#180a04 100%)';

  let currentPairs = DEFAULT_PAIRS.map(p => Object.assign({}, p));
  // Si la nube todavía no ha respondido la primera vez (ver "loaded" en
  // cloud-db.js), currentPairs sigue teniendo los valores por defecto
  // (before/after a null) aunque en realidad SÍ haya fotos guardadas: de
  // ahí que antes se viera el degradado de "sin foto" un instante justo
  // al cargar la página. Con esta bandera sabemos si ya podemos fiarnos
  // de que "sin foto" significa "sin foto de verdad".
  let cloudLoaded = false;

  const asBaBeforeEl = document.getElementById('asBaBefore');
  const asBaAfterEl = document.getElementById('asBaAfter');
  const asBaFrameEl = asBaBeforeEl ? asBaBeforeEl.closest('.ba-card-frame') : null;
  const asBaPrevBtn = document.getElementById('asBaPrev');
  const asBaNextBtn = document.getElementById('asBaNext');
  let aseIndex = 0;

  // Pone (o quita) el fondo de una ranura del comparador. Mientras la nube
  // no ha respondido todavía y no hay foto, no se pone NINGÚN fondo (ni
  // el degradado de "sin foto"): así el recuadro se queda simplemente en
  // blanco/cargando un instante, en vez de parecer que no se ha añadido
  // ninguna foto cuando en realidad solo está tardando en llegar.
  // Ancho máximo real al que se llega a ver esta foto en pantalla (el
  // recuadro tiene un tope de max-height:420px, a 4:3 como mucho, incluso
  // en pantallas grandes con más resolución/densidad): pedir una versión
  // ya recortada a ese tamaño (en vez del original a resolución de
  // cámara, que puede pesar varios MB) es lo que más acelera la carga.
  const BA_CARD_IMAGE_WIDTH = 900;

  function applySlotBg(el, url, placeholder){
    if (url){
      const fast = (typeof optimizeCloudinaryUrl === 'function') ? optimizeCloudinaryUrl(url, BA_CARD_IMAGE_WIDTH) : url;
      el.style.backgroundImage = "url('" + fast.replace(/'/g, "\\'") + "')";
      return;
    }
    el.style.backgroundImage = cloudLoaded ? placeholder : 'none';
  }

  // FIX 2: la versión anterior dejaba que el recuadro se amoldara a la
  // foto con un truco de CSS (width:max-content en el recuadro + una
  // <img> oculta -#asBaSizer- que cargaba la misma foto para que el
  // navegador "prestara" su tamaño real). En algunos móviles ese cálculo
  // encadenado (el ancho del recuadro depende del ancho de la img oculta,
  // que depende del ancho del recuadro...) no terminaba de resolverse
  // bien: el recuadro se quedaba a 0 o con la proporción de repuesto, así
  // que la foto no llegaba a verse, y con fotos muy anchas el resultado
  // dependía de qué media query de móvil ganara la pulsada de
  // especificidad, así que a veces se recortaba.
  //
  // Ahora el tamaño se calcula a mano, con números reales, en
  // sizeFrameToPhoto: mucho más predecible y sin depender de ningún
  // comportamiento "raro" del navegador. asBaWrapEl es el envoltorio que
  // pinta las "fotos fantasma" de detrás (ver .as-ba-photo-wrap en
  // styles.css); se mueve al mismo ancho que el recuadro para que esas
  // fotos fantasma sigan coincidiendo con su tamaño real.
  const asBaWrapEl = asBaFrameEl ? asBaFrameEl.closest('.as-ba-photo-wrap') : null;

  function sizeFrameToPhoto(naturalW, naturalH){
    if (!asBaFrameEl) return;
    if (!naturalW || !naturalH){
      // Sin foto real todavía (o falló la carga): se vuelve al tamaño de
      // repuesto que ya define el CSS (aspect-ratio 4/3, o 5/4 en móvil).
      asBaFrameEl.style.width = '';
      asBaFrameEl.style.height = '';
      if (asBaWrapEl) asBaWrapEl.style.width = '';
      return;
    }
    const container = asBaFrameEl.closest('.as-ba-gallery') || asBaFrameEl.parentElement;
    const rawAvailWidth = (container && container.clientWidth) || window.innerWidth;
    // Se reserva sitio a los dos lados para las flechas anteriores/
    // siguiente (as-ba-nav), que ahora viven FUERA de la foto, anclada
    // cada una al borde del escenario (.as-ba-stage, ver styles.css) y no
    // al de la propia foto. Sin este descuento, una foto muy panorámica
    // podría llegar a ocupar todo el ancho del escenario y solaparse con
    // las flechas; con él, la foto nunca crece más allá del hueco que
    // dejan libre a cada lado (círculo de la flecha + un pequeño margen).
    // En pantallas estrechas se dejan un poco más ajustadas -circulo
    // pegado casi al borde del escenario- para no comerle demasiado sitio
    // a la foto; en pantallas normales se deja más aire entre flecha y
    // foto.
    // En pantalla completa las flechas se ocultan del todo (ver
    // setAsBaFullscreen/CSS .is-fullscreen .as-ba-nav): sin ellas no hay
    // nada que "esquivar", así que aquí no se reserva ningún hueco y una
    // foto ancha puede llegar de verdad al borde del móvil.
    const NAV_CLEARANCE = asBaFullscreenOpen ? 0 : (window.innerWidth <= 480 ? 44 : 56);
    const availWidth = Math.max(0, rawAvailWidth - (NAV_CLEARANCE * 2));
    // Mismo tope de alto que ya usaba el CSS (clamp en escritorio, dvh en
    // móvil): se lee el que esté vigente ahora mismo en vez de duplicar
    // ese número aquí, así que si algún día cambia el CSS, este cálculo
    // lo sigue automáticamente.
    const maxHeightPx = parseFloat(getComputedStyle(asBaFrameEl).maxHeight) || Math.round(window.innerHeight * 0.6);
    const ratio = naturalW / naturalH;
    let width = maxHeightPx * ratio;
    let height = maxHeightPx;
    // Foto muy ancha: si a la altura máxima no cabría de ancho en la
    // pantalla, se manda por el ancho disponible en su lugar (nunca se
    // sale ni se recorta, solo se queda algo menos alta).
    if (availWidth && width > availWidth){
      width = availWidth;
      height = width / ratio;
    }
    width = Math.round(width);
    height = Math.round(height);
    asBaFrameEl.style.width = width + 'px';
    asBaFrameEl.style.height = height + 'px';
    if (asBaWrapEl) asBaWrapEl.style.width = width + 'px';
  }

  // Vuelve a encajar la foto vigente si cambia el tamaño de la ventana
  // (girar el móvil, teclado que aparece/desaparece, etc.): sin esto, el
  // recuadro se quedaba con el tamaño calculado para la orientación
  // anterior hasta que se cambiaba de pareja.
  let lastPhotoRatio = null;
  let refitTimer = null;
  function refitFramePhoto(){
    if (!lastPhotoRatio) return;
    sizeFrameToPhoto(lastPhotoRatio.w, lastPhotoRatio.h);
  }
  window.addEventListener('resize', () => {
    clearTimeout(refitTimer);
    refitTimer = setTimeout(refitFramePhoto, 120);
  });
  window.addEventListener('orientationchange', refitFramePhoto);

  // Token de carrera: si el usuario pasa a la siguiente pareja antes de
  // que termine de cargar la foto anterior, la respuesta tardía de esa
  // foto vieja se ignora en vez de aplicarse por encima de la nueva.
  let frameRequestSeq = 0;
  function setFrameAspect(url){
    if (!asBaFrameEl) return;
    const fast = url && typeof optimizeCloudinaryUrl === 'function' ? optimizeCloudinaryUrl(url, BA_CARD_IMAGE_WIDTH) : url;
    asBaFrameEl.classList.toggle('has-photo', !!url);
    const myToken = ++frameRequestSeq;
    if (!fast){
      lastPhotoRatio = null;
      sizeFrameToPhoto(0, 0);
      return;
    }
    const probe = new Image();
    probe.onload = function(){
      if (myToken !== frameRequestSeq) return;
      lastPhotoRatio = { w: probe.naturalWidth, h: probe.naturalHeight };
      sizeFrameToPhoto(probe.naturalWidth, probe.naturalHeight);
    };
    probe.onerror = function(){
      if (myToken !== frameRequestSeq) return;
      lastPhotoRatio = null;
      sizeFrameToPhoto(0, 0);
    };
    probe.src = fast;
  }

  function renderPairsPublic(i){
    if (!asBaBeforeEl || !asBaAfterEl) return;
    if (!currentPairs.length){
      applySlotBg(asBaBeforeEl, null, PAIR_PLACEHOLDER_BEFORE);
      applySlotBg(asBaAfterEl, null, PAIR_PLACEHOLDER_AFTER);
      if (asBaFrameEl) asBaFrameEl.classList.toggle('is-loading', !cloudLoaded);
      return;
    }
    aseIndex = ((i % currentPairs.length) + currentPairs.length) % currentPairs.length;
    const pair = currentPairs[aseIndex];
    applySlotBg(asBaBeforeEl, pair.before, PAIR_PLACEHOLDER_BEFORE);
    applySlotBg(asBaAfterEl, pair.after, PAIR_PLACEHOLDER_AFTER);
    // Encuadre ↕ guardado desde Ajustes (por defecto 50%, centrado): así se
    // puede corregir una foto en la que el recorte automático se coma una
    // cara u otra parte importante, igual que ya se podía en la galería
    // que se expande.
    asBaBeforeEl.style.backgroundPosition = 'center ' + (pair.beforePosY != null ? pair.beforePosY : 50) + '%';
    asBaAfterEl.style.backgroundPosition = 'center ' + (pair.afterPosY != null ? pair.afterPosY : 50) + '%';
    // El recuadro deja de tener siempre la misma proporción fija: se
    // ajusta a la forma real de la foto "después" (o la de "antes" si
    // esa no existe), dentro del máximo de alto que ya definía el CSS.
    if (asBaFrameEl) asBaFrameEl.classList.toggle('is-loading', !cloudLoaded && !pair.before && !pair.after);
    setFrameAspect(pair.after || pair.before || null);
    // Reinicia la barra de comparar al centro en cada cambio de pareja
    // (ver __baResetCompare en before-after-card.js): así el tirador
    // siempre "funciona" de forma predecible en todas las fotos, en vez
    // de heredar la posición en la que se hubiera quedado en la pareja
    // anterior.
    if (asBaFrameEl && typeof asBaFrameEl.__baResetCompare === 'function') asBaFrameEl.__baResetCompare();
  }
  // Red de seguridad para móvil: en algunos Safari/iOS, si el toque queda
  // cerca del límite de lo que el gesto de scroll de la página vigila a
  // nivel de window (ver onTouchStart/onTouchMove en scroll-engine.js), el
  // "click" sintético puede no llegar a disparar aunque el botón sea el
  // objetivo real del toque. Escuchando "touchend" directamente en el
  // propio botón nos aseguramos de que el cambio de imagen ocurra siempre,
  // sin depender de que ese click sintético llegue o no. stopPropagation
  // evita que el mismo toque se cuente dos veces si el click sí llega.
  function bindTapSafety(btn, action){
    if (!btn) return;
    let handled = false;
    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handled = true;
      action();
      setTimeout(() => { handled = false; }, 400);
    }, { passive:false });
    btn.addEventListener('click', (e) => {
      if (handled) { e.preventDefault(); return; }
      action();
    });
  }
  bindTapSafety(asBaPrevBtn, () => renderPairsPublic(aseIndex - 1));
  bindTapSafety(asBaNextBtn, () => renderPairsPublic(aseIndex + 1));

  /* ================= Pantalla completa del comparador =================
     Mismo comparador (misma barrita de arrastre, mismas flechas
     siguiente/anterior), solo que agrandado a un overlay que cubre toda
     la pantalla -no es una vista ni unas imágenes aparte, así que no
     hace falta duplicar nada: basta con mover el propio nodo
     .as-ba-gallery-.
     Por qué se REPARENTA en vez de solo añadir position:fixed: este
     comparador vive dentro de #afterStoryHeader, que tiene su propio
     transform (translate, ver .after-story-header en styles.css) para
     acompañar el gesto de scroll de la historia -y un ancestro con
     transform rompe position:fixed para sus descendientes (quedaría
     "fijo" respecto a ese ancestro, no respecto a la ventana, así que
     nunca llegaría a cubrir toda la pantalla). Sacándolo a <body> ese
     problema desaparece, y al cerrar se devuelve exactamente a su sitio
     original (mismo padre, mismo hermano siguiente) para no alterar el
     resto del layout. */
  const asBaGalleryEl = document.getElementById('asBaGallery');
  const asBaExpandBtn = document.getElementById('asBaExpand');
  const AS_BA_EXPAND_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';
  const AS_BA_COLLAPSE_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3v3a2 2 0 0 1-2 2H4"/><path d="M15 3v3a2 2 0 0 0 2 2h3"/><path d="M9 21v-3a2 2 0 0 0-2-2H4"/><path d="M15 21v-3a2 2 0 0 1 2-2h3"/></svg>';
  let asBaFullscreenOpen = false;
  let asBaOriginalParent = null;
  let asBaOriginalNextSibling = null;

  function setAsBaFullscreen(open){
    if (!asBaGalleryEl || !asBaExpandBtn || open === asBaFullscreenOpen) return;
    asBaFullscreenOpen = open;
    if (open){
      // Guarda dónde vivía (su padre real y el hermano justo después,
      // que puede ser null si era el último hijo) para poder devolverlo
      // exactamente al mismo sitio al cerrar.
      asBaOriginalParent = asBaGalleryEl.parentNode;
      asBaOriginalNextSibling = asBaGalleryEl.nextSibling;
      document.body.appendChild(asBaGalleryEl);
    } else if (asBaOriginalParent){
      asBaOriginalParent.insertBefore(asBaGalleryEl, asBaOriginalNextSibling);
    }
    asBaGalleryEl.classList.toggle('is-fullscreen', open);
    document.body.classList.toggle('as-ba-fullscreen-open', open);
    asBaExpandBtn.innerHTML = open ? AS_BA_COLLAPSE_ICON : AS_BA_EXPAND_ICON;
    asBaExpandBtn.setAttribute('aria-label', open ? 'Salir de pantalla completa' : 'Ver a pantalla completa');
    // --as-ba-frame-max-h cambia al entrar/salir (ver styles.css), así
    // que hay que volver a encajar la foto a su nuevo alto máximo -si no,
    // se quedaría con el tamaño calculado para el modo normal hasta el
    // siguiente cambio de pareja o de tamaño de ventana-. Un frame de
    // margen para que el navegador ya haya aplicado la clase (y por
    // tanto la nueva variable CSS) antes de medir.
    requestAnimationFrame(refitFramePhoto);
  }

  bindTapSafety(asBaExpandBtn, () => setAsBaFullscreen(!asBaFullscreenOpen));

  // Tecla Escape como salida rápida, además del propio botón (que hace
  // de "cerrar" una vez dentro, ver el cambio de icono arriba).
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && asBaFullscreenOpen) setAsBaFullscreen(false);
  });

  const pairListEl = document.getElementById('pairEditorList');
  const pairEmptyEl = document.getElementById('pairEditorEmpty');
  const pairAddBtn = document.getElementById('pairAddBtn');
  const pairSaveBtn = document.getElementById('pairGuardarBtn');
  const pairResetBtn = document.getElementById('pairResetBtn');
  const pairMsgEl = document.getElementById('pairMsg');
  const pairFileInput = document.getElementById('pairEditorFileInput');

  let pairDraft = [];
  let pairUploading = null; // { index, slot }
  let pairPending = null; // { index, slot }

  function renderSlotBox(pair, index, slot){
    const url = pair[slot];
    const isUploading = pairUploading && pairUploading.index === index && pairUploading.slot === slot;
    const label = slot === 'before' ? 'Sin editar' : 'Editada';
    let inner;
    if (isUploading) inner = '<span>Subiendo…</span>';
    else if (url) inner = '<img src="' + escapeAttr(url) + '" alt="Foto ' + label + '">';
    else inner = PLACEHOLDER_ICON + '<span>' + label + '</span>';
    return (
      '<div class="ba-slot-box' + (url && !isUploading ? ' has-image' : '') + (isUploading ? ' is-uploading' : '') +
        '" data-index="' + index + '" data-slot="' + slot + '" role="button" tabindex="0" aria-label="Subir foto ' + label.toLowerCase() + '">' +
        inner +
      '</div>'
    );
  }

  // Mismo deslizador "Encuadre ↕" que ya tenía la galería que se expande
  // (reutiliza su misma clase .disc-editor-range-row), ahora también para
  // cada una de las dos fotos del comparador: antes solo se podía corregir
  // el recorte en la galería, no aquí.
  function renderSlotRange(pair, index, slot){
    const posY = pair[slot + 'PosY'] != null ? pair[slot + 'PosY'] : 50;
    return (
      '<div class="disc-editor-range-row">' +
        '<label>Encuadre ↕</label>' +
        '<input type="range" class="pair-editor-pos" min="0" max="100" value="' + posY + '" data-index="' + index + '" data-slot="' + slot + '">' +
      '</div>'
    );
  }

  function renderPairsEditor(){
    if (!pairListEl) return;
    const last = pairDraft.length - 1;
    pairListEl.innerHTML = pairDraft.map((p, i) => (
      '<div class="pair-editor-item" data-index="' + i + '">' +
        '<div class="ba-slots">' +
          '<div class="ba-slot">' + renderSlotBox(p, i, 'before') + renderSlotRange(p, i, 'before') + '</div>' +
          '<div class="ba-slot">' + renderSlotBox(p, i, 'after') + renderSlotRange(p, i, 'after') + '</div>' +
        '</div>' +
        '<div class="pair-editor-actions">' +
          '<button type="button" class="pair-editor-move" data-dir="up" ' + (i === 0 ? 'disabled' : '') + ' aria-label="Mover comparación hacia arriba">↑</button>' +
          '<button type="button" class="pair-editor-move" data-dir="down" ' + (i === last ? 'disabled' : '') + ' aria-label="Mover comparación hacia abajo">↓</button>' +
          '<button type="button" class="cat-editor-remove" aria-label="Quitar comparación">×</button>' +
        '</div>' +
      '</div>'
    )).join('');
    if (pairEmptyEl) pairEmptyEl.style.display = pairDraft.length ? 'none' : '';
  }

  function fillPairsEditor(){
    pairDraft = currentPairs.map(p => Object.assign({}, p));
    renderPairsEditor();
  }

  if (pairListEl){
    pairListEl.addEventListener('click', (e) => {
      const moveBtn = e.target.closest('.pair-editor-move');
      if (moveBtn){
        const row = moveBtn.closest('.pair-editor-item');
        const i = Number(row.dataset.index);
        const j = moveBtn.dataset.dir === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= pairDraft.length) return;
        [pairDraft[i], pairDraft[j]] = [pairDraft[j], pairDraft[i]];
        renderPairsEditor();
        return;
      }
      const removeBtn = e.target.closest('.cat-editor-remove');
      if (removeBtn){
        const row = removeBtn.closest('.pair-editor-item');
        const i = Number(row.dataset.index);
        pairDraft.splice(i, 1);
        renderPairsEditor();
        return;
      }
      const box = e.target.closest('.ba-slot-box');
      if (box && !pairUploading && pairFileInput){
        pairPending = { index: Number(box.dataset.index), slot: box.dataset.slot };
        pairFileInput.click();
      }
    });
    pairListEl.addEventListener('input', (e) => {
      if (!e.target.classList.contains('pair-editor-pos')) return;
      const i = Number(e.target.dataset.index);
      const slot = e.target.dataset.slot;
      if (!pairDraft[i]) return;
      pairDraft[i][slot + 'PosY'] = Number(e.target.value);
    });
    pairListEl.addEventListener('keydown', (e) => {
      const box = e.target.closest('.ba-slot-box');
      if (!box || pairUploading || !pairFileInput) return;
      if (e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        pairPending = { index: Number(box.dataset.index), slot: box.dataset.slot };
        pairFileInput.click();
      }
    });
  }

  if (pairFileInput){
    pairFileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      const target = pairPending;
      pairFileInput.value = '';
      pairPending = null;
      if (!file || !target || !pairDraft[target.index] || !window.CloudDB) return;
      pairUploading = target;
      renderPairsEditor();
      try{
        const url = await window.CloudDB.uploadImageAlways(file, 'antes-despues-parejas');
        if (pairDraft[target.index]) pairDraft[target.index][target.slot] = url;
      }catch(err){
        console.error('No se pudo subir la foto de la comparación:', err && err.message || err);
        alert('No se pudo subir la foto (' + (err && err.message || 'error de conexión') + '). Inténtalo de nuevo.');
      }finally{
        pairUploading = null;
        renderPairsEditor();
      }
    });
  }

  if (pairAddBtn){
    pairAddBtn.addEventListener('click', () => {
      pairDraft.push({ id: 'pair-' + Date.now() + '-' + Math.floor(Math.random() * 1000), before: null, after: null });
      renderPairsEditor();
    });
  }

  if (pairSaveBtn){
    pairSaveBtn.addEventListener('click', async () => {
      const cleaned = pairDraft.map(p => ({
        id: p.id || ('pair-' + Date.now()),
        before: p.before || null,
        after: p.after || null,
        beforePosY: p.beforePosY != null ? p.beforePosY : 50,
        afterPosY: p.afterPosY != null ? p.afterPosY : 50
      }));
      if (!window.CloudDB){
        flashMsg(pairMsgEl, 'No se pudo guardar: la conexión con la nube no está lista.', false);
        return;
      }
      pairSaveBtn.disabled = true;
      try{
        await window.CloudDB.updateContent({ baPairs: cleaned });
        flashMsg(pairMsgEl, cleaned.length ? 'Comparaciones guardadas.' : 'Guardado: no se muestra ninguna comparación.', true);
        window.CloudDB.logHistory('Comparaciones antes/después editadas', cleaned.length + ' pareja(s)');
      }catch(err){
        console.error('No se pudo guardar las comparaciones:', err && err.message || err);
        flashMsg(pairMsgEl, 'No se pudo guardar (' + (err && err.message || 'error de conexión') + ').', false);
      }finally{
        pairSaveBtn.disabled = false;
      }
    });
  }

  if (pairResetBtn){
    pairResetBtn.addEventListener('click', async () => {
      if (!window.CloudDB){
        flashMsg(pairMsgEl, 'No se pudo restablecer: la conexión con la nube no está lista.', false);
        return;
      }
      pairResetBtn.disabled = true;
      try{
        await window.CloudDB.updateContent({ baPairs: DEFAULT_PAIRS });
        flashMsg(pairMsgEl, 'Comparaciones restablecidas a las originales.', true);
        window.CloudDB.logHistory('Comparaciones antes/después restablecidas', '');
      }catch(err){
        console.error('No se pudo restablecer las comparaciones:', err && err.message || err);
        flashMsg(pairMsgEl, 'No se pudo restablecer (' + (err && err.message || 'error de conexión') + ').', false);
      }finally{
        pairResetBtn.disabled = false;
      }
    });
  }

  /* =================================================================
     3) Galería que se expande (tarjetas estrechas que se abren al pasar
        el ratón / al tocarlas), justo debajo de "Descubre mi trabajo"
     ================================================================= */
  const EXPAND_PLACEHOLDERS = [
    'linear-gradient(160deg,#4a4d4f,#202325 55%,#0c0d0e)',
    'linear-gradient(150deg,#ffb27a 0%,#ff5a1f 32%,#7a2708 62%,#180a04 100%)',
    'linear-gradient(165deg,#5b6470,#232830 55%,#0c0e10)',
    'linear-gradient(150deg,#e2b25a,#a8631f 50%,#2c1608)',
    'linear-gradient(160deg,#6b5b8f,#2b2140 55%,#0d0a15)'
  ];
  const DEFAULT_EXPAND = [
    { id:'exp-1', label:'Bodas', phrase:'Cada instante, para siempre.', img:null, posX:50, posY:50, fit:'cover' },
    { id:'exp-2', label:'Festivales', phrase:'Luz, sonido y energía.', img:null, posX:50, posY:50, fit:'cover' },
    { id:'exp-3', label:'Retratos', phrase:'Una mirada, mil historias.', img:null, posX:50, posY:50, fit:'cover' },
    { id:'exp-4', label:'Deportivos', phrase:'La acción, congelada.', img:null, posX:50, posY:50, fit:'cover' },
    { id:'exp-5', label:'Viajes', phrase:'El mundo, a través del lente.', img:null, posX:50, posY:50, fit:'cover' }
  ];

  const expandGrid = document.getElementById('asExpandGrid');
  let currentExpand = DEFAULT_EXPAND.map(c => Object.assign({}, c));

  /* Estilo de fondo de una foto de esta galería: LA MISMA función la usa
     tanto la tarjeta real (renderExpandPublic) como la vista previa de
     Ajustes (renderExpandEditor), para que lo que se ve al editar sea
     EXACTAMENTE lo que luego se ve en la web (mismo recorte, mismo
     margen), y no una aproximación aparte que se pueda desincronizar.
     "cover" recalcula el encuadre cada vez que cambia el ANCHO de la
     tarjeta (al expandirse al tocarla, o al cambiar de dispositivo/
     tamaño de pantalla), así que la misma foto se veía "más ampliada" o
     recortada de otro modo según el momento. Con "auto 100%" la foto se
     escala SIEMPRE al mismo alto (el de la tarjeta, que no cambia) y
     solo se revela más o menos anchura a los lados -nunca se reescala-,
     así se ve igual de "tamaño" en cualquier dispositivo y al abrirse/
     cerrarse.
     posX/posY: dónde queda encajada la foto dentro del recuadro. En
     Ajustes (ver attachFreeReposition) se arrastra la foto DIRECTAMENTE
     sobre el recuadro de vista previa -que ya reproduce el mismo
     recorte que la web- para moverla libremente hasta donde se quiera,
     tanto en modo "Cubrir recuadro" (posX mueve qué franja horizontal
     se ve; posY no tiene margen que recorrer porque el alto ya llena el
     recuadro entero) como en "Ver foto entera" (posX/posY mueven la
     foto dentro del margen que deja alrededor). */
  function expandCardBgStyle(c){
    if (!c.img) return '';
    const posX = c.posX != null ? c.posX : 50;
    const posY = c.posY != null ? c.posY : (c.fit === 'contain' ? 35 : 50);
    return 'background-image:url(\'' + escapeAttr(c.img) + '\');' +
      'background-size:' + (c.fit === 'contain' ? 'contain' : 'auto 100%') + ';' +
      'background-position:' + posX + '% ' + posY + '%';
  }

  /* Proporción (ancho ÷ alto) real de una tarjeta de esta galería cuando
     está ABIERTA (activa) en la web -que es el momento en que más se ve
     la foto y donde más importa que el encuadre esté bien-. Se mide en
     vivo sobre la propia fila pública (#asExpandGrid), que ya vive en la
     página aunque ahora mismo no se esté viendo esa sección: así el
     simulador de Ajustes SIEMPRE coincide con el tamaño real, incluso si
     algún día cambian las medidas fijas en styles.css (.as-expand-grid,
     flex-grow de .is-active) y aquí no hay que tocar nada. Si por lo que
     sea no se puede medir (aún no ha cargado, etc.), se usa como
     respaldo el cálculo a mano con los valores actuales de ese CSS: fila
     de 360×160px, 5 tarjetas con gap de 8px, activa con flex-grow:9
     frente a 0.35 de las otras 4. */
  function getExpandCardAspect(){
    try{
      const grid = document.getElementById('asExpandGrid');
      if (grid){
        const active = grid.querySelector('.as-expand-card.is-active') || grid.querySelector('.as-expand-card');
        if (active){
          const r = active.getBoundingClientRect();
          if (r.width > 4 && r.height > 4) return r.width / r.height;
        }
      }
    }catch(err){}
    const cardsWidth = 360 - 4 * 8; // ancho de fila fijo menos los 4 huecos
    const activeWidth = cardsWidth * (9 / (9 + 0.35 * 4));
    return activeWidth / 160;
  }

  let expSimIndex = null;
  let expSimSnapshot = null;
  let expSimEls = null;

  function ensureExpSimModal(){
    if (expSimEls) return expSimEls;
    const overlay = document.createElement('div');
    overlay.id = 'expSimOverlay';
    overlay.className = 'exp-sim-overlay';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="exp-sim-panel" role="dialog" aria-modal="true" aria-labelledby="expSimTitle">' +
        '<div class="exp-sim-head">' +
          '<p id="expSimTitle" class="exp-sim-title">Ajustar foto</p>' +
          '<button type="button" class="exp-sim-cancel" aria-label="Cancelar y cerrar">×</button>' +
        '</div>' +
        '<div class="exp-sim-stage"><div class="exp-sim-box" id="expSimBox"></div></div>' +
        '<p class="exp-sim-hint">Arrastra la foto para colocarla: así de grande y con esta forma se ve exactamente cuando esta tarjeta está abierta en la web.</p>' +
        '<div class="exp-sim-actions"><button type="button" class="exp-sim-done">Listo</button></div>' +
      '</div>';
    document.body.appendChild(overlay);
    const els = {
      overlay: overlay,
      panel: overlay.querySelector('.exp-sim-panel'),
      title: overlay.querySelector('#expSimTitle'),
      stage: overlay.querySelector('.exp-sim-stage'),
      cancelBtn: overlay.querySelector('.exp-sim-cancel'),
      doneBtn: overlay.querySelector('.exp-sim-done')
    };
    function close(){
      els.overlay.hidden = true;
      document.body.style.overflow = '';
      expSimIndex = null;
      expSimSnapshot = null;
      renderExpandEditor();
    }
    els.doneBtn.addEventListener('click', close);
    els.cancelBtn.addEventListener('click', () => {
      if (expSimIndex != null && expDraft[expSimIndex] && expSimSnapshot){
        expDraft[expSimIndex].posX = expSimSnapshot.x;
        expDraft[expSimIndex].posY = expSimSnapshot.y;
      }
      close();
    });
    // Tocar el fondo oscuro fuera del recuadro equivale a "Listo" (se
    // queda con lo ya arrastrado): solo la × cancela de verdad.
    els.overlay.addEventListener('click', (e) => {
      if (e.target === els.overlay) close();
    });
    expSimEls = els;
    window.addEventListener('resize', () => {
      if (els.overlay.hidden || expSimIndex == null) return;
      const box = els.stage.querySelector('#expSimBox');
      if (!box) return;
      const aspect = getExpandCardAspect();
      const maxW = Math.min(window.innerWidth - 56, 640);
      const maxH = window.innerHeight - 230;
      let boxW = maxW;
      let boxH = boxW / aspect;
      if (boxH > maxH){ boxH = Math.max(120, maxH); boxW = boxH * aspect; }
      box.style.width = Math.round(boxW) + 'px';
      box.style.height = Math.round(boxH) + 'px';
    });
    return els;
  }

  function openExpSimulator(index){
    const c = expDraft[index];
    if (!c || !c.img) return;
    const els = ensureExpSimModal();
    expSimIndex = index;
    expSimSnapshot = {
      x: c.posX != null ? c.posX : 50,
      y: c.posY != null ? c.posY : (c.fit === 'contain' ? 35 : 50)
    };
    els.title.textContent = 'Ajustar “' + (c.label || 'esta foto') + '”';

    // El tamaño disponible cambia según el dispositivo (móvil vs
    // ordenador), así que el recuadro del simulador se calcula cada vez
    // que se abre para aprovechar el hueco disponible sin desbordar,
    // mantiniendo SIEMPRE la misma proporción (forma) que la tarjeta
    // real -ver getExpandCardAspect-.
    const aspect = getExpandCardAspect();
    const maxW = Math.min(window.innerWidth - 56, 640);
    const maxH = window.innerHeight - 230;
    let boxW = maxW;
    let boxH = boxW / aspect;
    if (boxH > maxH){ boxH = Math.max(120, maxH); boxW = boxH * aspect; }

    // Se sustituye el recuadro por uno limpio (sin listeners de arrastre
    // de una apertura anterior) antes de dibujar y enganchar el arrastre,
    // para no acumular controladores repetidos entre foto y foto.
    const oldBox = els.stage.querySelector('#expSimBox');
    const box = oldBox.cloneNode(false);
    oldBox.replaceWith(box);
    box.style.cssText = 'width:' + Math.round(boxW) + 'px;height:' + Math.round(boxH) + 'px;background-repeat:no-repeat;background-color:#ffffff;' + expandCardBgStyle(c);

    window.attachFreeReposition(
      box,
      () => ({
        x: expDraft[index] && expDraft[index].posX != null ? expDraft[index].posX : 50,
        y: expDraft[index] && expDraft[index].posY != null ? expDraft[index].posY : (expDraft[index] && expDraft[index].fit === 'contain' ? 35 : 50)
      }),
      (pos) => {
        if (!expDraft[index]) return;
        expDraft[index].posX = pos.x;
        expDraft[index].posY = pos.y;
      },
      null
    );

    els.overlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function renderExpandPublic(){
    if (!expandGrid) return;
    expandGrid.innerHTML = currentExpand.map((c, i) => (
      '<div class="as-expand-card" style="' +
        (c.img
          ? expandCardBgStyle(c)
          : 'background:' + EXPAND_PLACEHOLDERS[i % EXPAND_PLACEHOLDERS.length]) +
        '" tabindex="0" role="button" aria-label="' + escapeAttr(c.label) + '">' +
        '<span class="as-expand-card-dot" aria-hidden="true"></span>' +
        '<div class="as-expand-card-shade"></div>' +
        '<div class="as-expand-card-info">' +
          '<p class="as-expand-card-label">' + escapeHtml(c.label) + '</p>' +
          '<p class="as-expand-card-phrase">' + escapeHtml(c.phrase || '') + '</p>' +
        '</div>' +
      '</div>'
    )).join('');
    restartExpandAutoplay();
  }

  /* ---- Paso automático de la galería que se expande ----
     Siempre activa: va abriendo una tarjeta tras otra sola, en bucle,
     sin que haga falta tocar nada. Al tocar/pulsar una tarjeta a mano
     se abre esa al instante (igual que antes) y el ciclo automático
     simplemente continúa a partir de ahí, en vez de pelearse con el
     toque del usuario. */
  const EXPAND_AUTOPLAY_MS = 2600;
  let expandAutoplayTimer = null;
  let expandAutoIndex = 0;

  function activateExpandIndex(idx){
    if (!expandGrid) return;
    const cards = expandGrid.querySelectorAll('.as-expand-card');
    if (!cards.length) return;
    const safeIdx = ((idx % cards.length) + cards.length) % cards.length;
    cards.forEach(el => el.classList.remove('is-active'));
    cards[safeIdx].classList.add('is-active');
    expandAutoIndex = safeIdx;
  }

  function restartExpandAutoplay(){
    if (!expandGrid) return;
    clearInterval(expandAutoplayTimer);
    const cards = expandGrid.querySelectorAll('.as-expand-card');
    if (!cards.length) return;
    activateExpandIndex(expandAutoIndex);
    expandAutoplayTimer = setInterval(() => {
      activateExpandIndex(expandAutoIndex + 1);
    }, EXPAND_AUTOPLAY_MS);
  }

  /* Única función que "toma el mando" manualmente, tanto para un toque
     en móvil como para pasar el ratón por encima en escritorio (ya no
     hay ningún :hover suelto en el CSS -ver arriba-, así nunca hay dos
     tarjetas peleándose por abrirse ni un hueco en el que ninguna esté
     activa). Reinicia el temporizador para que la tarjeta elegida se
     quede visible un ciclo completo antes de que el paso automático siga
     solo, sin interrumpir nunca ese paso automático -sigue funcionando
     siempre, tanto si el usuario interactúa como si no-. */
  function userActivateExpandIndex(idx){
    activateExpandIndex(idx);
    clearInterval(expandAutoplayTimer);
    expandAutoplayTimer = setInterval(() => {
      activateExpandIndex(expandAutoIndex + 1);
    }, EXPAND_AUTOPLAY_MS);
  }

  if (expandGrid){
    expandGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.as-expand-card');
      if (!card) return;
      const cards = Array.from(expandGrid.querySelectorAll('.as-expand-card'));
      userActivateExpandIndex(cards.indexOf(card));
    });
    // "mouseover" (con delegación, a diferencia de "mouseenter") para que
    // pasar el ratón de una tarjeta a otra en escritorio mueva el mando
    // manual igual que un toque, sin depender de CSS :hover.
    expandGrid.addEventListener('mouseover', (e) => {
      const card = e.target.closest('.as-expand-card');
      if (!card) return;
      const cards = Array.from(expandGrid.querySelectorAll('.as-expand-card'));
      const idx = cards.indexOf(card);
      if (idx === expandAutoIndex) return; // ya es la activa, no reinicia el temporizador sin necesidad
      userActivateExpandIndex(idx);
    });
  }

  const expListEl = document.getElementById('expEditorList');
  const expEmptyEl = document.getElementById('expEditorEmpty');
  const expAddBtn = document.getElementById('expAddBtn');
  const expSaveBtn = document.getElementById('expGuardarBtn');
  const expResetBtn = document.getElementById('expResetBtn');
  const expMsgEl = document.getElementById('expMsg');
  const expFileInput = document.getElementById('expEditorFileInput');

  let expDraft = [];
  let expUploadingIndex = null;

  function renderExpandEditor(){
    if (!expListEl) return;
    const last = expDraft.length - 1;
    expListEl.innerHTML = expDraft.map((c, i) => {
      const isUploading = expUploadingIndex === i;
      const fit = c.fit === 'contain' ? 'contain' : 'cover';
      const hasImage = !!(c.img && !isUploading);
      let boxInner;
      if (isUploading) boxInner = '<span>Subiendo…</span>';
      else if (!c.img) boxInner = PLACEHOLDER_ICON;
      // Con foto puesta, el recuadro es solo una vista previa: el ajuste
      // de verdad se hace en el simulador a pantalla completa (ver
      // openExpSimulator más abajo), que se abre solo con subir la foto o
      // tocando el botón "Ajustar encuadre".
      else boxInner = '<span class="disc-editor-adjust-badge">' + MOVE_ICON_SMALL + ' Ajustar encuadre</span>';
      // La vista previa usa la MISMA función que la tarjeta real
      // (expandCardBgStyle) en vez de un <img> aparte con object-fit: así
      // el recuadro de Ajustes muestra pixel a pixel el mismo recorte (o
      // el mismo margen, en modo "Ver foto entera") que luego se ve en la
      // web, y no una versión aproximada que podía no coincidir.
      const previewBg = hasImage ? expandCardBgStyle(c) : '';
      return (
        '<div class="disc-editor-item" data-index="' + i + '">' +
          '<div class="disc-editor-box' + (hasImage ? ' has-image' : '') + (isUploading ? ' is-uploading' : '') +
            '" data-index="' + i + '" style="' + previewBg + '" role="button" tabindex="0" aria-label="' +
            (hasImage ? 'Ajustar el encuadre de ' + escapeAttr(c.label) : 'Subir foto para ' + escapeAttr(c.label)) +
            '">' +
            boxInner +
          '</div>' +
          '<div class="disc-editor-fields">' +
            '<input type="text" class="disc-editor-label" value="' + escapeAttr(c.label) + '" placeholder="Nombre (ej. Bodas)">' +
            '<input type="text" class="disc-editor-phrase" value="' + escapeAttr(c.phrase || '') + '" placeholder="Frase corta">' +
            '<div class="disc-editor-fit-row">' +
              '<span>Ajuste de la foto</span>' +
              '<button type="button" class="disc-editor-fit-btn' + (fit === 'cover' ? ' active' : '') + '" data-fit="cover">Cubrir recuadro</button>' +
              '<button type="button" class="disc-editor-fit-btn' + (fit === 'contain' ? ' active' : '') + '" data-fit="contain">Ver foto entera</button>' +
            '</div>' +
            (hasImage ? '<button type="button" class="disc-editor-replace-link" data-index="' + i + '">Cambiar foto</button>' : '') +
          '</div>' +
          '<div class="pair-editor-actions">' +
            '<button type="button" class="pair-editor-move" data-dir="up" ' + (i === 0 ? 'disabled' : '') + ' aria-label="Mover foto hacia arriba">↑</button>' +
            '<button type="button" class="pair-editor-move" data-dir="down" ' + (i === last ? 'disabled' : '') + ' aria-label="Mover foto hacia abajo">↓</button>' +
            '<button type="button" class="cat-editor-remove" aria-label="Quitar foto">×</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');
    if (expEmptyEl) expEmptyEl.style.display = expDraft.length ? 'none' : '';
  }

  function fillExpandEditor(){
    expDraft = currentExpand.map(c => Object.assign({}, c));
    renderExpandEditor();
  }

  let expPendingIndex = null;
  if (expListEl){
    expListEl.addEventListener('input', (e) => {
      const row = e.target.closest('.disc-editor-item');
      if (!row) return;
      const i = Number(row.dataset.index);
      if (!expDraft[i]) return;
      if (e.target.classList.contains('disc-editor-label')) expDraft[i].label = e.target.value;
      if (e.target.classList.contains('disc-editor-phrase')) expDraft[i].phrase = e.target.value;
    });
    expListEl.addEventListener('click', (e) => {
      const moveBtn = e.target.closest('.pair-editor-move');
      if (moveBtn){
        const row = moveBtn.closest('.disc-editor-item');
        const i = Number(row.dataset.index);
        const j = moveBtn.dataset.dir === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= expDraft.length) return;
        [expDraft[i], expDraft[j]] = [expDraft[j], expDraft[i]];
        renderExpandEditor();
        return;
      }
      const removeBtn = e.target.closest('.cat-editor-remove');
      if (removeBtn){
        const row = removeBtn.closest('.disc-editor-item');
        const i = Number(row.dataset.index);
        expDraft.splice(i, 1);
        renderExpandEditor();
        return;
      }
      const fitBtn = e.target.closest('.disc-editor-fit-btn');
      if (fitBtn){
        const row = fitBtn.closest('.disc-editor-item');
        const i = Number(row.dataset.index);
        if (!expDraft[i]) return;
        expDraft[i].fit = fitBtn.dataset.fit === 'contain' ? 'contain' : 'cover';
        renderExpandEditor();
        return;
      }
      // Recuadro sin foto → subir una nueva. Recuadro CON foto → abrir el
      // simulador a pantalla completa para ajustar su encuadre (ver
      // openExpSimulator más abajo).
      const emptyBox = e.target.closest('.disc-editor-box:not(.has-image)');
      if (emptyBox && expUploadingIndex === null && expFileInput){
        expPendingIndex = Number(emptyBox.dataset.index);
        expFileInput.click();
        return;
      }
      const filledBox = e.target.closest('.disc-editor-box.has-image');
      if (filledBox){
        openExpSimulator(Number(filledBox.dataset.index));
        return;
      }
      const replaceLink = e.target.closest('.disc-editor-replace-link');
      if (replaceLink && expUploadingIndex === null && expFileInput){
        expPendingIndex = Number(replaceLink.dataset.index);
        expFileInput.click();
      }
    });
    expListEl.addEventListener('keydown', (e) => {
      const box = e.target.closest('.disc-editor-box');
      if (!box) return;
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (box.classList.contains('has-image')){
        openExpSimulator(Number(box.dataset.index));
      } else if (expUploadingIndex === null && expFileInput){
        expPendingIndex = Number(box.dataset.index);
        expFileInput.click();
      }
    });
  }

  if (expFileInput){
    expFileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      const i = expPendingIndex;
      expFileInput.value = '';
      expPendingIndex = null;
      if (!file || i === null || !expDraft[i] || !window.CloudDB) return;
      expUploadingIndex = i;
      renderExpandEditor();
      let uploadedOk = false;
      try{
        const url = await window.CloudDB.uploadImageAlways(file, 'galeria-expandible');
        if (expDraft[i]){ expDraft[i].img = url; uploadedOk = true; }
      }catch(err){
        console.error('No se pudo subir la foto de la galería expandible:', err && err.message || err);
        alert('No se pudo subir la foto (' + (err && err.message || 'error de conexión') + '). Inténtalo de nuevo.');
      }finally{
        expUploadingIndex = null;
        renderExpandEditor();
        // Justo al añadir la foto, se abre el simulador a pantalla
        // completa para que se coloque bien desde el primer momento (en
        // vez de dejarla con el encuadre por defecto sin que se note).
        if (uploadedOk) openExpSimulator(i);
      }
    });
  }

  if (expAddBtn){
    expAddBtn.addEventListener('click', () => {
      expDraft.push({ id: 'exp-' + Date.now() + '-' + Math.floor(Math.random() * 1000), label: 'Nueva foto', phrase: '', img: null, posX: 50, posY: 50, fit: 'cover' });
      renderExpandEditor();
      const boxes = expListEl ? expListEl.querySelectorAll('.disc-editor-label') : [];
      const last = boxes[boxes.length - 1];
      if (last){ last.focus(); last.select(); }
    });
  }

  if (expSaveBtn){
    expSaveBtn.addEventListener('click', async () => {
      const cleaned = expDraft.map(c => ({
        id: c.id || ('exp-' + Date.now()),
        label: (c.label || '').trim() || 'Sin nombre',
        phrase: (c.phrase || '').trim(),
        img: c.img || null,
        posX: c.posX != null ? c.posX : 50,
        posY: c.posY != null ? c.posY : 35,
        fit: c.fit === 'contain' ? 'contain' : 'cover'
      }));
      if (!window.CloudDB){
        flashMsg(expMsgEl, 'No se pudo guardar: la conexión con la nube no está lista.', false);
        return;
      }
      expSaveBtn.disabled = true;
      try{
        await window.CloudDB.updateContent({ expandGallery: cleaned });
        flashMsg(expMsgEl, cleaned.length ? 'Galería guardada.' : 'Guardado: no se muestra ninguna foto.', true);
        window.CloudDB.logHistory('Galería que se expande editada', cleaned.map(c => c.label).join(', ') || 'Lista vacía');
      }catch(err){
        console.error('No se pudo guardar la galería expandible:', err && err.message || err);
        flashMsg(expMsgEl, 'No se pudo guardar (' + (err && err.message || 'error de conexión') + ').', false);
      }finally{
        expSaveBtn.disabled = false;
      }
    });
  }

  if (expResetBtn){
    expResetBtn.addEventListener('click', async () => {
      if (!window.CloudDB){
        flashMsg(expMsgEl, 'No se pudo restablecer: la conexión con la nube no está lista.', false);
        return;
      }
      expResetBtn.disabled = true;
      try{
        await window.CloudDB.updateContent({ expandGallery: DEFAULT_EXPAND });
        flashMsg(expMsgEl, 'Galería restablecida a la original.', true);
        window.CloudDB.logHistory('Galería que se expande restablecida', '');
      }catch(err){
        console.error('No se pudo restablecer la galería expandible:', err && err.message || err);
        flashMsg(expMsgEl, 'No se pudo restablecer (' + (err && err.message || 'error de conexión') + ').', false);
      }finally{
        expResetBtn.disabled = false;
      }
    });
  }

  /* ---- Conexión con la nube ---- */
  if (window.CloudDB){
    window.CloudDB.onContentChange((data, loaded) => {
      cloudLoaded = !!loaded;
      const cloudPairs = Array.isArray(data.baPairs) && data.baPairs.length
        ? data.baPairs
        : DEFAULT_PAIRS;
      currentPairs = cloudPairs.map(p => ({
        id: p.id,
        before: p.before || null,
        after: p.after || null,
        beforePosY: p.beforePosY != null ? p.beforePosY : 50,
        afterPosY: p.afterPosY != null ? p.afterPosY : 50
      }));
      renderPairsPublic(0);
      fillPairsEditor();

      const cloudExpand = Array.isArray(data.expandGallery) && data.expandGallery.length
        ? data.expandGallery
        : DEFAULT_EXPAND;
      currentExpand = cloudExpand.map(c => ({ id: c.id, label: c.label, phrase: c.phrase || '', img: c.img || null, posX: c.posX != null ? c.posX : 50, posY: c.posY != null ? c.posY : 35, fit: c.fit === 'contain' ? 'contain' : 'cover' }));
      renderExpandPublic();
      fillExpandEditor();
    });
  } else {
    cloudLoaded = true;
    renderPairsPublic(0);
    fillPairsEditor();
    renderExpandPublic();
    fillExpandEditor();
  }

  // ---- Pantalla de entrada: que espere a estas fotos ----
  // Antes solo se esperaba a la pareja que se ve nada más entrar
  // (currentPairs[0]), así que en cuanto se abría "Mis ediciones" el
  // resto -la segunda pareja del comparador y, sobre todo, las 5 fotos
  // de la galería que se expande, que se ven TODAS a la vez en la
  // rejilla- seguían sin descargar y tardaban de más, el fallo que se
  // seguía viendo. Ahora se espera a todo el contenido de esta pantalla,
  // igual que ya hace el carrusel de cámaras con las suyas.
  if (typeof registerAssetReady === 'function'){
    const readyForEdiciones = (window.CloudDB ? window.CloudDB.ready : Promise.resolve())
      .then(() => {
        if (typeof preloadImages !== 'function') return null;
        const optimize = (u) => (u && typeof optimizeCloudinaryUrl === 'function') ? optimizeCloudinaryUrl(u, BA_CARD_IMAGE_WIDTH) : u;
        const pairUrls = currentPairs.reduce((acc, p) => acc.concat([optimize(p.before), optimize(p.after)]), []);
        const expandUrls = currentExpand.map(c => c.img);
        return preloadImages(pairUrls.concat(expandUrls));
      });
    registerAssetReady(readyForEdiciones);
  }
})();
