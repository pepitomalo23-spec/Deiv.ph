(function(){
  const cameraCarousel = document.getElementById('cameraCarousel');
  const equipoTitle = document.getElementById('equipoTitle');
  // IMPORTANTE: estas declaraciones tienen que ir aquí, muy al principio.
  // Antes estaban más abajo en el archivo, y como el listener de
  // CloudDB.onContentChange() se dispara EN CUANTO se registra (unas
  // líneas más abajo) y llama de inmediato a buildMarquee() y a
  // renderAjustesGrid(), esas funciones intentaban usar estas variables
  // antes de que existieran todavía -> ReferenceError: Cannot access
  // '...' before initialization. Ese error rompía silenciosamente TODO
  // este bloque (el carrusel, la subida de fotos en Ajustes, todo), sin
  // avisar en pantalla. Por eso nunca aparecía nada, ni siquiera las 3
  // fotos de ejemplo.
  let marqueeTrack = document.getElementById('cameraMarqueeTrack');
  const fileInput = document.getElementById('ajustesFileInput');
  const ajustesUploader = document.getElementById('ajustesUploader');
  const ajustesGrid = document.getElementById('ajustesGrid');
  const ajustesEmpty = document.getElementById('ajustesEmpty');
  const ajustesClear = document.getElementById('ajustesClear');

  // Imágenes de ejemplo que se muestran mientras el usuario no haya
  // subido las suyas propias desde el menú "Ajustes". En el futuro estas
  // se sustituirán automáticamente por las que salgan del último
  // fotograma de la historia.
  // (El "name" es solo para identificarlas en Ajustes; ya no se muestra
  // ningún nombre encima del carrusel.)
  // Sin límite de imágenes: se pueden añadir tantas fotos propias como se
  // quiera y el carrusel las mostrará todas, en bucle continuo.
  const MAX_IMAGES = Infinity;
  // Estas 3 imágenes de ejemplo van incrustadas directamente (base64), no se
  // descargan de ningún servidor externo. Así el carrusel funciona siempre,
  // aunque el visitante tenga wifi inestable o se corte la conexión: el
  // archivo ya las lleva dentro y no depende de que un servidor externo
  // esté disponible en ese momento.
  const PLACEHOLDER_SLIDES = [
    { img:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiB2aWV3Qm94PSIwIDAgNDAwIDQwMCI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiNlOGU2ZTEiLz48cmVjdCB4PSI5MCIgeT0iMTUwIiB3aWR0aD0iMjIwIiBoZWlnaHQ9IjE0MCIgcng9IjE0IiBmaWxsPSIjM2EzYTNhIi8+PHJlY3QgeD0iOTAiIHk9IjE1MCIgd2lkdGg9IjIyMCIgaGVpZ2h0PSIzMCIgcng9IjYiIGZpbGw9IiMyYTJhMmEiLz48Y2lyY2xlIGN4PSIyMDAiIGN5PSIyMjUiIHI9IjU1IiBmaWxsPSIjMWExYTFhIi8+PGNpcmNsZSBjeD0iMjAwIiBjeT0iMjI1IiByPSIzOCIgZmlsbD0iIzRhNGE0YSIvPjxyZWN0IHg9IjI1NSIgeT0iMTY1IiB3aWR0aD0iMzAiIGhlaWdodD0iMTQiIHJ4PSIzIiBmaWxsPSIjNjY2Ii8+PC9zdmc+', name:'Cámara réflex', pos:50 },
    { img:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiB2aWV3Qm94PSIwIDAgNDAwIDQwMCI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiNlYWU3ZTIiLz48cmVjdCB4PSIxMjAiIHk9IjEyMCIgd2lkdGg9IjE2MCIgaGVpZ2h0PSIxMTAiIHJ4PSIxMCIgZmlsbD0iIzJmMmYyZiIvPjxjaXJjbGUgY3g9IjIwMCIgY3k9IjE3NSIgcj0iNDIiIGZpbGw9IiMxMTEiLz48Y2lyY2xlIGN4PSIyMDAiIGN5PSIxNzUiIHI9IjI4IiBmaWxsPSIjNTU1Ii8+PHJlY3QgeD0iMTUwIiB5PSIyMzAiIHdpZHRoPSIxMDAiIGhlaWdodD0iNjAiIHJ4PSI4IiBmaWxsPSIjMzMzIi8+PC9zdmc+', name:'Cámara mirrorless', pos:50 },
    { img:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiB2aWV3Qm94PSIwIDAgNDAwIDQwMCI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiNlNmU0ZGYiLz48cmVjdCB4PSIxNDAiIHk9IjE0MCIgd2lkdGg9IjEyMCIgaGVpZ2h0PSIxMjAiIHJ4PSI2MCIgZmlsbD0iIzJhMmEyYSIvPjxjaXJjbGUgY3g9IjIwMCIgY3k9IjIwMCIgcj0iNDUiIGZpbGw9IiMwMDAiLz48Y2lyY2xlIGN4PSIyMDAiIGN5PSIyMDAiIHI9IjMwIiBmaWxsPSIjNjY2Ii8+PC9zdmc+', name:'Objetivo gran angular', pos:50 },
  ];

  // Cada imagen propia se guarda como { img: URL en Firebase Storage, name:
  // 'texto que puso el usuario', pos: 0-100 (encuadre vertical, para cuando
  // el recorte automático se come una cara y hay que arrastrar la foto en
  // Ajustes) }. Vive en la nube (Firestore), así que se ve igual desde
  // cualquier dispositivo donde inicies sesión.
  let cloudCarouselImages = [];
  let nameSaveTimer = null;

  function loadUserImages(){
    return cloudCarouselImages.slice();
  }

  function saveUserImages(list, opts){
    opts = opts || {};
    const previous = cloudCarouselImages;
    cloudCarouselImages = list;
    buildMarquee();
    if (!opts.skipGridRender && typeof renderAjustesGrid === 'function') renderAjustesGrid();
    if (window.CloudDB){
      window.CloudDB.updateContent({ carouselImages: list }).catch(err => {
        // Si Firestore rechaza la escritura (documento demasiado grande,
        // sin permisos, sin conexión...) antes esto quedaba solo en la
        // consola y la miniatura parecía guardada aunque no lo estuviera.
        // Ahora se deshace el cambio local y se avisa de verdad.
        console.error('No se pudo guardar el carrusel en la nube:', err.message || err);
        cloudCarouselImages = previous;
        buildMarquee();
        if (typeof renderAjustesGrid === 'function') renderAjustesGrid();
        alert('No se pudo guardar el cambio en el carrusel (' + (err.message || 'error de conexión') + '). Inténtalo de nuevo.');
      });
    }
  }

  if (window.CloudDB){
    window.CloudDB.onContentChange(data => {
      cloudCarouselImages = (data.carouselImages || []).map(item => ({
        img: item.img, name: item.name || '', pos: (typeof item.pos === 'number' ? item.pos : 50)
      }));
      buildMarquee();
      if (typeof renderAjustesGrid === 'function') renderAjustesGrid();
    });
  }

  function currentSlides(){
    const userImages = loadUserImages();
    const base = userImages.length ? userImages : PLACEHOLDER_SLIDES;
    // tope de seguridad: nunca más de MAX_IMAGES, aunque el storage tuviera
    // guardadas más de las permitidas por una versión anterior
    return base.slice(0, MAX_IMAGES);
  }

  // Velocidad constante (px/segundo), para que la cinta vaya igual de
  // rápida tenga 3 fotos o más en el futuro; solo cambia cuánto tarda en
  // completar una vuelta (más fotos = vuelta más larga, misma velocidad).
  const MARQUEE_SPEED_PX_S = 40;

  // Cuántas fotos se ven a la vez, nítidas o difuminándose en los bordes.
  // Fijo a 3 según lo pedido: nunca debe asomar una cuarta.
  const VISIBLE_SLIDES = 3;

  // Calcula el ancho de "una foto" (foto + su margen a los dos lados) leyendo
  // el tamaño real ya aplicado por CSS (que cambia en el media query de
  // móvil), y fija el ancho del contenedor a exactamente VISIBLE_SLIDES
  // fotos. Así el viewport SOLO puede llegar a mostrar 3, y la máscara en
  // degradado (ver CSS) se encarga de que la de cada extremo entre/salga
  // ya desvanecida en vez de aparecer de golpe con un borde recto.
  function sizeCarousel(){
    const firstItem = marqueeTrack.querySelector('.marquee-item');
    if (!firstItem) return;
    const style = getComputedStyle(firstItem);
    const itemWidth = firstItem.getBoundingClientRect().width;
    const marginLeft = parseFloat(style.marginLeft) || 0;
    const marginRight = parseFloat(style.marginRight) || 0;
    const cellWidth = itemWidth + marginLeft + marginRight;
    const totalWidth = cellWidth * VISIBLE_SLIDES;
    cameraCarousel.style.width = totalWidth + 'px';
  }

  function buildMarquee(){
    const slides = currentSlides();
    // Se duplica el set completo una vez: la animación mueve la cinta
    // exactamente el 50% de su ancho total (que es el ancho de UN set),
    // así que al llegar ahí el segundo set queda pixel a pixel en el
    // mismo sitio que estaba el primero al empezar, y el salto de vuelta
    // a translateX(0) es invisible. Así se consigue un bucle infinito sin
    // parón ni salto, aunque solo haya 3 fotos.
    const html = slides.concat(slides).map(s => {
      const caption = s.name && s.name.trim()
        ? `<div class="marquee-caption">${escapeHtml(s.name.trim())}</div>`
        : '';
      const bgPos = (typeof s.pos === 'number' ? s.pos : 50);
      return `<div class="marquee-item">` +
        `<div class="marquee-slide" style="background-image:url('${s.img}'); background-position:center ${bgPos}%;"></div>` +
        caption +
        `</div>`;
    }).join('');
    marqueeTrack.innerHTML = html;

    // Duración = tiempo en recorrer un set completo (la mitad del ancho
    // real de la cinta, ya duplicada) a velocidad constante.
    requestAnimationFrame(() => {
      const fullWidth = marqueeTrack.scrollWidth / 2;
      const duration = Math.max(4, fullWidth / MARQUEE_SPEED_PX_S);
      marqueeTrack.style.animationDuration = duration + 's';
      sizeCarousel();
    });
  }

  buildMarquee();
  window.rebuildCameraCarousel = buildMarquee;
  // El tamaño real de cada foto cambia con el media query de móvil, así
  // que al girar el dispositivo o cambiar el ancho de ventana hay que
  // recalcular cuánto ocupan exactamente 3 fotos.
  window.addEventListener('resize', sizeCarousel);

  // El carrusel solo se muestra cuando la historia está parada en el
  // último fotograma (donde están las dos cámaras sobre las bandejas) y
  // estamos en la sección "Resumen" del menú.
  // Además, se centra horizontalmente bajo la FOTO real, no bajo toda la
  // pantalla: en tablet/iPad la imagen se pega a la izquierda (ver
  // drawCover), así que el centro de la pantalla no coincide con el
  // centro de la foto ni con el de las cámaras.
  function positionCarousel(){
    const dx = window.__photoDX || 0;
    const dw = window.__photoDW || window.innerWidth;
    cameraCarousel.style.left = (dx + dw / 2) + 'px';
  }
  window.addEventListener('resize', positionCarousel);

  // ---------- Nombres de las dos cámaras grandes de la foto ----------
  // Se colocan en base al recuadro real donde se dibuja la foto dentro del
  // canvas (dx/dw/dy/dh, ver drawCover), como fracción de su ancho y alto,
  // así el nombre queda siempre justo encima de cada cámara aunque cambie
  // el tamaño de pantalla o el encuadre se achique en móvil. Si algún
  // nombre no queda perfectamente centrado sobre su cámara, basta con
  // ajustar aquí estos 4 números (fracciones de 0 a 1).
  const cameraNameLeftEl2 = document.getElementById('cameraNameLeft');
  const cameraNameRightEl2 = document.getElementById('cameraNameRight');
  // yFrac corregido: medido sobre el propio fotograma final, el cuerpo de
  // las cámaras empieza aprox. en 0.35 (izquierda) / 0.42 (derecha) de la
  // altura de la foto. Antes yFrac era 0.40 en ambas, así que el texto
  // caía DENTRO de la cámara izquierda y casi tocando la derecha. Con
  // 0.29/0.32 la chip (más el hueco de 16px + conector que añade el CSS)
  // queda siempre por encima del objeto, con aire de sobra, en cualquier
  // tamaño de pantalla.
  const CAMERA_LABEL_POS = {
    left:  { xFrac: 0.30, yFrac: 0.29 },
    right: { xFrac: 0.70, yFrac: 0.32 }
  };
  function positionCameraNames(){
    const dx = window.__photoDX || 0;
    const dw = window.__photoDW || window.innerWidth;
    const dy = window.__photoDY || 0;
    const dh = window.__photoDH || window.innerHeight;
    if (cameraNameLeftEl2){
      cameraNameLeftEl2.style.left = (dx + dw * CAMERA_LABEL_POS.left.xFrac) + 'px';
      cameraNameLeftEl2.style.top  = (dy + dh * CAMERA_LABEL_POS.left.yFrac) + 'px';
    }
    if (cameraNameRightEl2){
      cameraNameRightEl2.style.left = (dx + dw * CAMERA_LABEL_POS.right.xFrac) + 'px';
      cameraNameRightEl2.style.top  = (dy + dh * CAMERA_LABEL_POS.right.yFrac) + 'px';
    }
  }
  window.addEventListener('resize', positionCameraNames);

  // ---------- Título "Mi material de trabajo": evita que se monte encima
  // de las etiquetas de las cámaras en pantallas grandes ----------
  // En escritorio (wideLayoutQuery), drawCover deja la foto pegada abajo
  // (dy = hueco en blanco por encima de la foto). El CSS posiciona
  // .equipo-header a un top:% fijo pensado para el caso típico, pero en
  // monitores muy anchos y con bastante alto disponible ese hueco (dy)
  // puede quedar más pequeño que lo que ocupa el título ya en dos líneas
  // grandes, así que el bloque título+frase invade la propia foto y se
  // monta encima de la chip "SONY ..." (ver captura reportada). En vez de
  // añadir más media queries por ancho, se centra el bloque dinámicamente
  // DENTRO del hueco real (0..dy) que deja la foto, así siempre queda por
  // encima de la cámara, sea cual sea el tamaño/proporción de la ventana.
  // Solo se activa cuando ese hueco es lo bastante grande como para tener
  // sentido (dy > 60px); si no, se deja el top:% normal del CSS (caso
  // móvil/tablet en columna, o escritorio con la foto a pantalla completa,
  // donde el diseño ya estaba bien).
  const equipoHeaderEl2 = document.getElementById('equipoHeader');
  const equipoWideQuery2 = window.matchMedia('(min-width:768px)');
  // Ancho mínimo de la franja libre a la derecha de la foto para que
  // merezca la pena mover ahí el bloque título+frase en vez de dejarlo
  // centrado arriba (con una franja más estrecha, el título en columna no
  // tendría aire de sobra y se vería apretado).
  const SIDE_MIN_GAP_PX = 260;
  function positionEquipoHeader(){
    if (!equipoHeaderEl2) return;
    const dx = window.__photoDX || 0;
    const dw = window.__photoDW || window.innerWidth;
    const dy = window.__photoDY || 0;
    const dh = window.__photoDH || window.innerHeight;
    const rightGap = window.innerWidth - (dx + dw);

    if (equipoWideQuery2.matches && rightGap >= SIDE_MIN_GAP_PX){
      // Sitio de sobra a la derecha de la foto: el bloque se mueve ahí,
      // en columna, vertical y horizontalmente dentro de esa franja libre
      // -nunca puede pisar la foto/cámaras, porque ni siquiera empieza
      // hasta pasado su borde derecho (dx+dw)-.
      equipoHeaderEl2.classList.add('equipo-header--side');
      const margin = Math.max(28, Math.round(rightGap * 0.08));
      const colWidth = Math.max(180, Math.min(rightGap - margin * 1.6, 440));
      equipoHeaderEl2.style.left = Math.round(dx + dw + margin) + 'px';
      equipoHeaderEl2.style.width = colWidth + 'px';
      equipoHeaderEl2.style.top = Math.round(dy + dh * 0.46) + 'px';
      return;
    }

    // Sin hueco real a la derecha (ventana más estrecha, o foto a pantalla
    // completa): se queda con el diseño centrado de siempre, pero evitando
    // que invada la foto por arriba cuando ese hueco superior (dy) es
    // pequeño frente a lo alto que es el propio título ya en dos líneas.
    equipoHeaderEl2.classList.remove('equipo-header--side');
    equipoHeaderEl2.style.left = '';
    equipoHeaderEl2.style.width = '';
    if (!equipoWideQuery2.matches || dy < 60){
      equipoHeaderEl2.style.top = '';
      return;
    }
    const headerH = equipoHeaderEl2.offsetHeight || 0;
    const top = Math.max(24, Math.round((dy - headerH) / 2));
    equipoHeaderEl2.style.top = top + 'px';
  }
  window.addEventListener('resize', positionEquipoHeader);

  setInterval(() => {
    // A diferencia del resto del contenido del sitio (que aparece justo al
    // aterrizar en su parada), este bloque se anticipa: se muestra en
    // cuanto __storyCameraRevealP llega a 1, lo cual ocurre ANTES de que
    // termine el 2º salto (2ª->3ª parada), no al término. Es el único
    // contenido de la escena con esta aparición adelantada -ver
    // computeCameraRevealP en scroll-engine.js-.
    const show = window.currentView === 'resumen'
      && (window.__storyCameraRevealP || 0) >= 1;
    cameraCarousel.classList.toggle('visible', show);
    if (equipoTitle) equipoTitle.classList.toggle('visible', show);
    const equipoSubtitle = document.getElementById('equipoSubtitle');
    if (equipoSubtitle) equipoSubtitle.classList.toggle('visible', show);
    if (cameraNameLeftEl2) cameraNameLeftEl2.classList.toggle('visible', show);
    if (cameraNameRightEl2) cameraNameRightEl2.classList.toggle('visible', show);
    positionCarousel();
    positionCameraNames();
    positionEquipoHeader();
  }, 40);

  // ---------- Ajustes: subir/quitar imágenes propias ----------
  function renderAjustesGrid(){
    const userImages = loadUserImages().slice(0, MAX_IMAGES);
    ajustesGrid.innerHTML = userImages.map((item, i) => `
      <div class="ajustes-thumb-wrap">
        <div class="ajustes-thumb">
          <img src="${item.img}" alt="Imagen ${i + 1}" data-index="${i}">
          <div class="ajustes-thumb-move" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3v18M3 12h18M7 7l-4 5 4 5M17 7l4 5-4 5M7 7l5-4 5 4M7 17l5 4 5-4"/>
            </svg>
          </div>
          <div class="ajustes-thumb-hint" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 5v14M8 9l4-4 4 4M8 15l4 4 4-4"/>
            </svg>
          </div>
          <button type="button" data-index="${i}" aria-label="Quitar imagen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>
          </button>
        </div>
        <input type="text" class="ajustes-thumb-name" data-index="${i}" placeholder="Nombre (opcional)" value="${escapeAttr(item.name)}">
      </div>
    `).join('');

    // Conecta el arrastre vertical de reencuadre en cada miniatura.
    ajustesGrid.querySelectorAll('img[data-index]').forEach(imgEl => {
      const idx = parseInt(imgEl.dataset.index, 10);
      attachThumbReposition(
        imgEl,
        () => (loadUserImages()[idx] || {}).pos ?? 50,
        (pos) => {
          const list = loadUserImages();
          if (!list[idx]) return;
          list[idx].pos = pos;
          saveUserImages(list);
          buildMarquee();
        }
      );
    });

    const hasOwn = userImages.length > 0;
    const atMax = userImages.length >= MAX_IMAGES;

    // El selector de archivos se oculta al llegar al máximo: con solo 3
    // huecos, no tiene sentido dejar que se sigan añadiendo fotos que
    // luego se recortarían sin más.
    if (ajustesUploader) ajustesUploader.style.display = atMax ? 'none' : '';

    if (atMax){
      ajustesEmpty.textContent = 'No se pueden añadir más imágenes.';
    } else if (hasOwn){
      ajustesEmpty.textContent = `Estas son tus imágenes (${userImages.length}). Se están usando en el carrusel del último fotograma. El nombre que le pongas a cada una aparecerá justo debajo de la foto en el carrusel; si lo dejas en blanco, la foto se mostrará sin texto.`;
    } else {
      ajustesEmpty.textContent = 'Ahora mismo se están mostrando unas imágenes de ejemplo en el carrusel.';
    }
    ajustesClear.style.display = hasOwn ? '' : 'none';
  }
  window.renderAjustesGrid = renderAjustesGrid;

  // Igual que en uploadImage/resizeImageFile: por si CUALQUIER otra cosa
  // imprevista se quedara colgada (nunca debería, con los dos límites de
  // tiempo ya puestos, pero así queda cubierto también lo desconocido),
  // ponemos un tope duro de 25s por foto. Pasado ese tiempo se avisa en
  // vez de dejar la pantalla "congelada" sin ninguna explicación.
  function withHardTimeout(promise, ms, message){
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
    ]);
  }

  fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const startCount = loadUserImages().length;
    // Solo se admiten hasta MAX_IMAGES en total: si ya hay alguna subida,
    // solo se cogen las que quepan hasta llegar al máximo y se ignora el
    // resto (el propio uploader ya se oculta al llegar al tope, esto es
    // solo un cinturón de seguridad extra).
    const remaining = Math.max(0, MAX_IMAGES - startCount);
    const filesToAdd = files.slice(0, remaining);
    let added = 0;
    const fallidas = [];
    const textoOriginal = ajustesEmpty.textContent;
    for (let i = 0; i < filesToAdd.length; i++){
      const file = filesToAdd[i];
      // Aviso visible en pantalla de que algo SÍ está pasando (antes solo
      // quedaba constancia en la consola, invisible en el móvil).
      ajustesEmpty.textContent = `Subiendo foto ${i + 1} de ${filesToAdd.length}…`;
      try{
        // uploadImageAlways nunca rechaza la foto: si Cloudinary falla por
        // lo que sea, guarda la imagen igualmente en local (base64) para
        // que siempre quede añadida.
        const url = await withHardTimeout(
          window.CloudDB.uploadImageAlways(file, 'carrusel'),
          25000,
          'La subida ha tardado demasiado y se ha cancelado.'
        );
        // Volvemos a leer el estado más reciente justo antes de guardar (y
        // guardamos foto a foto, no todas al final): así, si subes varias
        // fotos y sales de esta pantalla a media subida, las que ya
        // terminaron quedan guardadas y no "desaparecen"; y si otro
        // dispositivo cambió algo mientras tanto, no se pierde su cambio.
        const latest = loadUserImages();
        latest.push({ img:url, name:'', pos:50 });
        saveUserImages(latest);
        added++;
      }catch(err){
        console.error('No se pudo añadir la foto:', err && err.message || err);
        fallidas.push((file.name || 'archivo') + ': ' + (err && err.message || 'error desconocido'));
      }
    }
    if (added && window.CloudDB) window.CloudDB.logHistory('Foto añadida al carrusel', `${added} foto(s) nueva(s)`);
    if (fallidas.length){
      alert('No se pudieron añadir estas fotos:\n' + fallidas.join('\n'));
    }
    if (!added && !fallidas.length){
      ajustesEmpty.textContent = textoOriginal;
    }
    fileInput.value = '';
  });

  ajustesGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-index]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.index, 10);
    const userImages = loadUserImages();
    const removed = userImages[idx];
    userImages.splice(idx, 1);
    saveUserImages(userImages);
    if (removed && window.CloudDB) window.CloudDB.deleteImageUrl(removed.img);
    if (window.CloudDB) window.CloudDB.logHistory('Foto quitada del carrusel', '');
  });

  // Guarda el nombre que el usuario escriba para cada foto (solo se usa
  // como referencia en esta pantalla de Ajustes; el carrusel nunca
  // muestra ningún nombre).
  // IMPORTANTE: antes, cada pulsación de tecla llamaba a saveUserImages(),
  // que reconstruye toda la rejilla de Ajustes (todos los <input> se
  // vuelven a crear desde cero) y además guarda en la nube en cada letra.
  // Reconstruir los <input> te hacía perder el foco y el cursor con cada
  // letra, así que era imposible escribir un nombre seguido. Ahora se
  // actualiza el dato en el momento (sin redibujar la rejilla, para no
  // robarte el foco) y solo se guarda de verdad en la nube cuando pasa
  // un ratito sin que sigas escribiendo.
  ajustesGrid.addEventListener('input', (e) => {
    const input = e.target.closest('input.ajustes-thumb-name');
    if (!input) return;
    const idx = parseInt(input.dataset.index, 10);
    const userImages = loadUserImages();
    if (!userImages[idx]) return;
    userImages[idx].name = input.value;
    cloudCarouselImages = userImages;
    buildMarquee();
    clearTimeout(nameSaveTimer);
    nameSaveTimer = setTimeout(() => {
      saveUserImages(userImages, { skipGridRender: true });
    }, 600);
  });

  ajustesClear.addEventListener('click', () => {
    saveUserImages([]);
    renderAjustesGrid();
    buildMarquee();
    if (window.CloudDB) window.CloudDB.logHistory('Carrusel restablecido', 'Se quitaron todas las fotos propias');
  });

  renderAjustesGrid();
})();
