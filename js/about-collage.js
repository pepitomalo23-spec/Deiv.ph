(function(){
  const MAX_COLLAGE = 6;

  const collageGrid   = document.getElementById('aboutCollageGrid');
  const collageHint   = document.getElementById('aboutCollageHint');
  const goAjustesBtn  = document.getElementById('aboutCollageGoAjustes');

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
    if (typeof renderAjustesCollageGrid === 'function') renderAjustesCollageGrid();
    if (window.CloudDB){
      window.CloudDB.updateContent({ collageImages: cloudCollageImages }).catch(err => {
        console.error('No se pudo guardar el collage en la nube:', err.message || err);
        cloudCollageImages = previous;
        renderAboutCollage();
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
      if (typeof renderAjustesCollageGrid === 'function') renderAjustesCollageGrid();
    });
  }

  // ---- Collage en "Sobre mí" ----
  function renderAboutCollage(){
    if (!collageGrid) return;
    const images = loadImages();
    const isAdmin = !!window.isAdminDevice;

    // Cada número de fotos (1 a 5) tiene su propio mosaico cuidado en CSS
    // para que en móvil, tablet y escritorio se vea bien repartido y sin
    // fotos sueltas o descompensadas. Con 6 se usa la cuadrícula base.
    collageGrid.classList.remove(
      'about-collage-grid--n1', 'about-collage-grid--n2', 'about-collage-grid--n3',
      'about-collage-grid--n4', 'about-collage-grid--n5'
    );
    if (images.length >= 1 && images.length <= 5){
      collageGrid.classList.add(`about-collage-grid--n${images.length}`);
    }

    if (!images.length){
      // "Ajustes" es solo para el administrador: si no hay fotos, un
      // visitante normal no debe ver ninguna invitación a añadirlas. Al
      // admin sí le mostramos la tarjeta, para que sepa dónde subirlas.
      if (isAdmin){
        collageGrid.innerHTML = `
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
        if (collageHint) collageHint.style.display = '';
      } else {
        collageGrid.innerHTML = '';
        if (collageHint) collageHint.style.display = 'none';
      }
    } else {
      collageGrid.innerHTML = images.map(item => `
        <div class="about-collage-item">
          <img src="${item.img}" alt="Foto de David" loading="lazy" style="object-position:center ${item.pos ?? 50}%">
          <span class="about-collage-dot"></span>
        </div>`).join('');
      if (collageHint) collageHint.style.display = 'none';
    }

    const wrapper = collageGrid.closest('.about-collage');
    if (wrapper) wrapper.style.display = (!images.length && !isAdmin) ? 'none' : '';
  }
  window.renderAboutCollage = renderAboutCollage;

  function openAjustesCollage(){
    if (typeof window.goToView === 'function') window.goToView('ajustes');
    if (typeof window.setAjustesTab === 'function') window.setAjustesTab('collage');
    if (typeof window.renderAjustesCollageGrid === 'function') window.renderAjustesCollageGrid();
  }
  if (goAjustesBtn) goAjustesBtn.addEventListener('click', openAjustesCollage);

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
