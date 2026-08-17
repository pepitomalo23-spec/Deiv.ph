(function(){
  const MAX_COLLAGE = 6;

  const collagePlaceholderWrap = document.getElementById('aboutCollage');

  const fileInput   = document.getElementById('ajustesCollageFileInput');
  const uploader    = document.getElementById('ajustesCollageUploader');
  const ajustesGrid = document.getElementById('ajustesCollageGrid');
  const ajustesEmpty= document.getElementById('ajustesCollageEmpty');
  const ajustesClear= document.getElementById('ajustesCollageClear');

  // Cada foto se guarda como { img: URL en Firebase Storage, pos: 0-100 }
  // (pos es el encuadre vertical, para cuando el recorte automático se
  // come una cara y hay que arrastrar la foto en Ajustes). Vive en la
  // nube (Firestore), igual en cualquier dispositivo.
  let cloudCollageImages = [];

  function loadImages(){
    return cloudCollageImages.slice(0, MAX_COLLAGE);
  }

  function saveImages(list){
    const previous = cloudCollageImages;
    cloudCollageImages = list.slice(0, MAX_COLLAGE);
    renderAboutCollage();
    if (typeof window.renderAboutMiniFloat === 'function') window.renderAboutMiniFloat();
    if (typeof renderAjustesCollageGrid === 'function') renderAjustesCollageGrid();
    if (window.CloudDB){
      window.CloudDB.updateContent({ collageImages: cloudCollageImages }).catch(err => {
        console.error('No se pudo guardar el collage en la nube:', err.message || err);
        cloudCollageImages = previous;
        renderAboutCollage();
        if (typeof window.renderAboutMiniFloat === 'function') window.renderAboutMiniFloat();
        if (typeof renderAjustesCollageGrid === 'function') renderAjustesCollageGrid();
        alert('No se pudo guardar el cambio en el collage (' + (err.message || 'error de conexión') + '). Inténtalo de nuevo.');
      });
    }
  }

  if (window.CloudDB){
    window.CloudDB.onContentChange(data => {
      cloudCollageImages = (data.collageImages || []).slice(0, MAX_COLLAGE).map(item => ({
        img: item.img, pos: (typeof item.pos === 'number' ? item.pos : 50)
      }));
      renderAboutCollage();
      if (typeof window.renderAboutMiniFloat === 'function') window.renderAboutMiniFloat();
      if (typeof renderAjustesCollageGrid === 'function') renderAjustesCollageGrid();
    });
  }

  // ---- Carrusel flotante 3D encima del título "Sobre mí" ----
  // Las fotos del collage se muestran GRANDES, de una en una: la que
  // está activa ocupa el centro a tamaño completo y las demás quedan
  // más pequeñas y difuminadas a los lados, como en un coverflow. Cada
  // pocos segundos avanza sola a la siguiente foto (deslizándose +
  // ampliándose), y además la pila entera se inclina en 3D siguiendo el
  // puntero/dedo. Si no hay fotos subidas, se queda oculta.
  const miniFloatWrap = document.getElementById('aboutMiniFloat');
  let miniFloatStage = null;
  let miniFloatItems = [];
  let miniFloatCurrent = 0;
  let miniFloatTimer = null;
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clearMiniFloatTimer(){
    if (miniFloatTimer){ clearInterval(miniFloatTimer); miniFloatTimer = null; }
  }

  function startMiniFloatCycle(count){
    clearMiniFloatTimer();
    if (count < 2 || prefersReducedMotion) return;
    miniFloatTimer = setInterval(() => {
      miniFloatCurrent = (miniFloatCurrent + 1) % count;
      updateMiniFloatPositions();
    }, 2600);
  }

  // Coloca cada foto según su distancia (offset) a la foto activa: la
  // activa (offset 0) va centrada, a tamaño completo y nítida; el resto
  // se van empequeñeciendo, difuminando y perdiendo opacidad cuanto más
  // lejos están, envolviendo el "camino corto" (p.ej. con 6 fotos, la
  // nº6 está más cerca de la nº1 pasando por detrás que dando toda la
  // vuelta) para que el giro se sienta natural en ambos sentidos.
  function updateMiniFloatPositions(){
    if (!miniFloatStage || !miniFloatItems.length) return;
    const count = miniFloatItems.length;
    const stageWidth = miniFloatWrap.getBoundingClientRect().width || 320;
    const spacing = Math.max(90, stageWidth * 0.30);

    miniFloatItems.forEach((el, i) => {
      let offset = i - miniFloatCurrent;
      if (offset > count / 2) offset -= count;
      if (offset < -count / 2) offset += count;
      const abs = Math.abs(offset);

      const scale = abs === 0 ? 1 : Math.max(0.42, 1 - abs * 0.26);
      const translateX = offset * spacing;
      const opacity = abs > 2.5 ? 0 : Math.max(0, 1 - abs * 0.38);
      const blur = abs === 0 ? 0 : Math.min(5, abs * 2);
      const rotate = offset * -8;

      el.style.zIndex = String(200 - Math.round(abs * 10));
      el.style.opacity = String(opacity);
      el.style.filter = blur ? `blur(${blur}px)` : '';
      el.style.transform = `translate(-50%, -50%) translateX(${translateX}px) rotate(${rotate}deg) scale(${scale})`;
      el.classList.toggle('is-active', abs === 0);
      el.style.pointerEvents = abs > 2.5 ? 'none' : '';
    });
  }

  function goToMiniFloat(i){
    const count = miniFloatItems.length;
    if (!count) return;
    miniFloatCurrent = ((i % count) + count) % count;
    updateMiniFloatPositions();
    startMiniFloatCycle(count);
  }

  function renderMiniFloat(){
    if (!miniFloatWrap) return;
    clearMiniFloatTimer();
    const images = loadImages().slice(0, 6);

    if (!images.length){
      miniFloatWrap.style.display = 'none';
      miniFloatWrap.innerHTML = '';
      miniFloatStage = null;
      miniFloatItems = [];
      return;
    }

    miniFloatWrap.style.display = 'block';
    miniFloatWrap.innerHTML = `
      <div class="mini-float-stage" id="miniFloatStage">
        ${images.map((item, i) => `
          <div class="mini-float-item" data-idx="${i}">
            <div class="mini-float-inner">
              <img src="${escapeAttr(item.img)}" alt="" loading="lazy" style="object-position:center ${item.pos ?? 50}%">
            </div>
          </div>`).join('')}
      </div>`;

    miniFloatStage = document.getElementById('miniFloatStage');
    miniFloatItems = Array.from(miniFloatStage.querySelectorAll('.mini-float-item'));
    miniFloatCurrent = 0;
    updateMiniFloatPositions();
    attachMiniFloatParallax();
    attachMiniFloatClicks();
    startMiniFloatCycle(images.length);
  }
  window.renderAboutMiniFloat = renderMiniFloat;

  // Tocar/clicar una de las fotos secundarias la trae al centro
  // directamente (además de reiniciar el ciclo automático desde ahí).
  let miniFloatClicksBound = false;
  function attachMiniFloatClicks(){
    if (miniFloatClicksBound || !miniFloatStage) return;
    miniFloatClicksBound = true;
    miniFloatStage.addEventListener('click', (e) => {
      const item = e.target.closest('.mini-float-item');
      if (!item) return;
      goToMiniFloat(parseInt(item.dataset.idx, 10));
    });
  }

  // Inclinación 3D suave según la posición del puntero dentro del bloque
  // (en táctil no hay "mousemove" continuo, así que se queda con el
  // efecto de carrusel solo). También pausa el avance automático
  // mientras el puntero está encima, para poder mirar bien la foto.
  let miniFloatParallaxBound = false;
  function attachMiniFloatParallax(){
    if (miniFloatParallaxBound || !miniFloatWrap) return;
    miniFloatParallaxBound = true;

    miniFloatWrap.addEventListener('mousemove', (e) => {
      if (!miniFloatStage) return;
      const rect = miniFloatWrap.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      miniFloatStage.style.setProperty('--tiltY', (nx * 12) + 'deg');
      miniFloatStage.style.setProperty('--tiltX', (ny * -9) + 'deg');
    });
    miniFloatWrap.addEventListener('mouseenter', clearMiniFloatTimer);
    miniFloatWrap.addEventListener('mouseleave', () => {
      miniFloatStage && miniFloatStage.style.removeProperty('--tiltY');
      miniFloatStage && miniFloatStage.style.removeProperty('--tiltX');
      startMiniFloatCycle(miniFloatItems.length);
    });
  }

  // ---- Collage en "Sobre mí" ----
  // Ya NO se insertan fotos sueltas junto a los párrafos del texto (eso
  // se ha retirado a petición explícita): las fotos subidas solo se
  // muestran en la tira flotante 3D de arriba (about-mini-float). Esta
  // función se limita ahora a la tarjeta de invitación para el admin
  // cuando aún no hay fotos.
  const aboutBody = document.getElementById('aboutBody');

  function clearInsertedPhotos(){
    document.querySelectorAll('.about-photo').forEach(el => {
      if (revealObserver) revealObserver.unobserve(el);
      el.remove();
    });
  }

  function renderAboutCollage(){
    if (!collagePlaceholderWrap) return;
    const images = loadImages();
    const isAdmin = !!window.isAdminDevice;

    // Por si quedara alguna foto de una versión anterior insertada en el
    // DOM (o en caché del navegador), se limpia siempre.
    clearInsertedPhotos();

    if (!images.length){
      // "Ajustes" es solo para el administrador: si no hay fotos, un
      // visitante normal no debe ver ninguna invitación a añadirlas. Al
      // admin sí le mostramos la tarjeta, para que sepa dónde subirlas.
      if (isAdmin){
        collagePlaceholderWrap.style.display = 'block';
        collagePlaceholderWrap.innerHTML = `
          <div class="about-collage-item is-placeholder" id="aboutCollagePlaceholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="8" height="8" rx="1.5"/>
              <rect x="13" y="3" width="8" height="8" rx="1.5"/>
              <rect x="3" y="13" width="8" height="8" rx="1.5"/>
              <rect x="13" y="13" width="8" height="8" rx="1.5"/>
            </svg>
            <span>Añade tus fotos desde Ajustes</span>
          </div>`;
        const placeholder = document.getElementById('aboutCollagePlaceholder');
        if (placeholder) placeholder.addEventListener('click', openAjustesCollage);
      } else {
        collagePlaceholderWrap.style.display = 'none';
      }
      return;
    }

    // Con fotos ya subidas no se muestra nada aquí: viven solo en la
    // tira flotante de arriba.
    collagePlaceholderWrap.style.display = 'none';
  }
  window.renderAboutCollage = renderAboutCollage;

  // Aparición al hacer scroll: cada foto empieza en opacity:0 (ver CSS,
  // estado por defecto) y solo gana la clase "is-visible" -que dispara la
  // transición de fundido+deslizamiento- cuando entra en el viewport. Se
  // deja de observar en cuanto aparece una vez (no tiene sentido que se
  // repita el gesto si el visitante hace scroll arriba y abajo).
  let revealObserver = null;
  if ('IntersectionObserver' in window){
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting){
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold:0.15, rootMargin:'0px 0px -8% 0px' });
  }

  function openAjustesCollage(){
    if (typeof window.goToView === 'function') window.goToView('ajustes');
    if (typeof window.setAjustesTab === 'function') window.setAjustesTab('collage');
    if (typeof window.renderAjustesCollageGrid === 'function') window.renderAjustesCollageGrid();
  }
  // ---- Gestión en Ajustes ----
  function renderAjustesCollageGrid(){
    if (!ajustesGrid) return;
    const images = loadImages();

    ajustesGrid.innerHTML = images.map((item, i) => `
      <div class="ajustes-thumb">
        <img src="${escapeAttr(item.img)}" alt="Foto ${i + 1}" data-index="${i}" style="object-position:center ${item.pos ?? 50}%">
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
        <button type="button" data-index="${i}" aria-label="Quitar foto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>
        </button>
      </div>
    `).join('');

    // Conecta el arrastre vertical de reencuadre en cada miniatura.
    ajustesGrid.querySelectorAll('img[data-index]').forEach(imgEl => {
      const idx = parseInt(imgEl.dataset.index, 10);
      attachThumbReposition(
        imgEl,
        () => (loadImages()[idx] || {}).pos ?? 50,
        (pos) => {
          const list = loadImages();
          if (!list[idx]) return;
          list[idx].pos = pos;
          saveImages(list);
          renderAboutCollage();
          if (typeof window.renderAboutMiniFloat === 'function') window.renderAboutMiniFloat();
        }
      );
    });

    const atMax = images.length >= MAX_COLLAGE;
    if (uploader) uploader.style.display = atMax ? 'none' : '';

    if (atMax){
      ajustesEmpty.textContent = `Ya tienes las ${MAX_COLLAGE} fotos máximas del collage. Quita alguna para poder subir otra.`;
    } else if (images.length){
      ajustesEmpty.textContent = `Estas son tus fotos (${images.length} de ${MAX_COLLAGE}). Se están usando en el collage de "Sobre mí".`;
    } else {
      ajustesEmpty.textContent = 'Ahora mismo se muestra una tarjeta de invitación en "Sobre mí".';
    }
    if (ajustesClear) ajustesClear.style.display = images.length ? '' : 'none';
  }
  window.renderAjustesCollageGrid = renderAjustesCollageGrid;

  // Igual que en el carrusel: tope duro por si algo se quedara colgado sin
  // dar ningún error, para que la pantalla nunca se quede "congelada" sin
  // explicación.
  function withHardTimeoutCollage(promise, ms, message){
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
    ]);
  }

  if (fileInput){
    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const startCount = loadImages().length;
      const remaining = Math.max(0, MAX_COLLAGE - startCount);
      const filesToAdd = files.slice(0, remaining);
      let added = 0;
      const fallidas = [];
      const textoOriginal = ajustesEmpty ? ajustesEmpty.textContent : '';
      for (let i = 0; i < filesToAdd.length; i++){
        const file = filesToAdd[i];
        if (ajustesEmpty) ajustesEmpty.textContent = `Subiendo foto ${i + 1} de ${filesToAdd.length}…`;
        try{
          // uploadImageAlways nunca rechaza la foto: si Cloudinary falla por
          // lo que sea, guarda la imagen igualmente en local (base64) para
          // que siempre quede añadida.
          const url = await withHardTimeoutCollage(
            window.CloudDB.uploadImageAlways(file, 'collage'),
            25000,
            'La subida ha tardado demasiado y se ha cancelado.'
          );
          // Guardamos foto a foto, releyendo el estado más reciente antes de
          // cada guardado: evita que fotogramas ya subidos "desaparezcan" si
          // sales de esta pantalla a media subida o si hay cambios desde
          // otro dispositivo mientras tanto.
          const latest = loadImages();
          latest.push({ img:url, pos:50 });
          saveImages(latest);
          added++;
        }catch(err){
          console.error('No se pudo añadir la foto:', err && err.message || err);
          fallidas.push((file.name || 'archivo') + ': ' + (err && err.message || 'error desconocido'));
        }
      }
      if (added && window.CloudDB) window.CloudDB.logHistory('Foto añadida al collage "Sobre mí"', `${added} foto(s) nueva(s)`);
      if (fallidas.length){
        alert('No se pudieron añadir estas fotos:\n' + fallidas.join('\n'));
      }
      if (!added && !fallidas.length && ajustesEmpty){
        ajustesEmpty.textContent = textoOriginal;
      }
      fileInput.value = '';
    });
  }

  if (ajustesGrid){
    ajustesGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-index]');
      if (!btn) return;
      const idx = parseInt(btn.dataset.index, 10);
      const images = loadImages();
      const removed = images[idx];
      images.splice(idx, 1);
      saveImages(images);
      if (removed && window.CloudDB) window.CloudDB.deleteImageUrl(removed.img);
      if (window.CloudDB) window.CloudDB.logHistory('Foto quitada del collage "Sobre mí"', '');
    });
  }

  if (ajustesClear){
    ajustesClear.addEventListener('click', () => {
      saveImages([]);
      if (window.CloudDB) window.CloudDB.logHistory('Collage "Sobre mí" restablecido', 'Se quitaron todas las fotos');
    });
  }

  renderAboutCollage();
  renderMiniFloat();
  renderAjustesCollageGrid();

  // ---- Pantalla de entrada: que espere también a estas fotos ----
  // Igual que hace el carrusel de cámaras y la primera pareja del
  // comparador (ver camera-carousel.js / comparison-pairs.js): si no se
  // espera aquí, estas fotos solo empiezan a descargarse cuando el
  // visitante entra por primera vez en "Sobre mí", y como son varias a
  // la vez (hasta 6), la carga se nota mucho más que en el resto de
  // pantallas -justo el fallo que se seguía viendo-. Se preparan TODAS,
  // no solo la primera, porque el collage entero se muestra de golpe en
  // cuanto se abre esa vista.
  if (typeof registerAssetReady === 'function'){
    const readyForCollage = (window.CloudDB ? window.CloudDB.ready : Promise.resolve())
      .then(() => (typeof preloadImages === 'function')
        ? preloadImages(loadImages().map(item => item.img))
        : null);
    registerAssetReady(readyForCollage);
  }
})();
