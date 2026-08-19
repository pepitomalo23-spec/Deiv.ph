// ---------- Categorías de "Proyectos" (Deportes, Fiestas...) ----------
// Botones que aparecen arriba a la izquierda de "Proyectos" (ver
// #asCatButtons en index.html). Cada categoría se crea, renombra y borra
// desde Ajustes → Proyectos, y tiene su propia galería de fotos, que se
// abre a pantalla completa (#asCatLightbox) al tocar su botón.
//
// Dato guardado en Firestore: projectCategories = [
//   { id, label, photos: [url, url, ...] }, ...
// ]
// Mismo patrón de "borrador + Guardar/Restablecer" que ya usan el
// comparador de parejas y la galería que se expande (ver
// comparison-pairs.js), para que editar varias categorías seguidas no
// dispare un guardado en la nube por cada letra o cada foto.
(function(){
  const PLACEHOLDER_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M12 4l-4.5 4.5M12 4l4.5 4.5"/><path d="M4 16v2.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V16"/></svg>';

  let currentCategories = []; // última versión confirmada, la que viene de la nube
  // Distingue "todavía no ha respondido la nube" de "ya respondió y, de
  // verdad, no hay categorías guardadas". Sin esto, el primer pintado
  // (con currentCategories vacío por defecto, antes de que Firestore
  // conteste) ocultaba el bloque entero de "Fotos" con display:none, y en
  // conexiones lentas ese hueco vacío podía notarse un buen rato hasta
  // que llegaba la respuesta real y el bloque reaparecía de golpe. Mismo
  // patrón que ya usa el comparador de fotos (ver "cloudLoaded" en
  // comparison-pairs.js).
  let cloudLoaded = false;

  // ================= Vista pública: botones + galería a pantalla completa =================
  const catTopEl = document.getElementById('asCatTop');
  const catButtonsEl = document.getElementById('asCatButtons');
  const lightboxEl = document.getElementById('asCatLightbox');
  const lightboxTitleEl = document.getElementById('asCatLightboxTitle');
  const lightboxMoreEl = document.getElementById('asCatLightboxMore');
  const lightboxGridEl = document.getElementById('asCatLightboxGrid');
  const lightboxCloseBtn = document.getElementById('asCatLightboxClose');
  // Visor de una sola foto a pantalla completa (se abre al pulsar
  // cualquier foto del mosaico de arriba, ver más abajo).
  const photoViewerEl = document.getElementById('asPhotoViewer');
  const photoViewerImgEl = document.getElementById('asPhotoViewerImg');
  const photoViewerCloseBtn = document.getElementById('asPhotoViewerClose');

  function renderCatButtonsPublic(){
    if (!catButtonsEl) return;
    // Mientras la nube no ha respondido todavía (cloudLoaded === false) se
    // mantiene visible por defecto, para no ocultar/mostrar de golpe un
    // bloque que sí tiene categorías guardadas. Solo se oculta una vez
    // confirmado (cloudLoaded === true) que de verdad no hay ninguna.
    if (catTopEl) catTopEl.style.display = (!cloudLoaded || currentCategories.length) ? '' : 'none';
    catButtonsEl.innerHTML = currentCategories.map(c =>
      '<button type="button" class="as-cat-btn" data-id="' + escapeAttr(c.id) + '">' + escapeHtml(c.label || 'Sin nombre') + '</button>'
    ).join('');
  }

  function openLightbox(cat, btn){
    if (!lightboxEl || !cat) return;
    if (lightboxTitleEl) lightboxTitleEl.textContent = cat.label || '';
    if (lightboxMoreEl){
      const link = (cat.driveLink || '').trim();
      if (link){
        lightboxMoreEl.href = link;
        lightboxMoreEl.style.display = '';
      } else {
        lightboxMoreEl.removeAttribute('href');
        lightboxMoreEl.style.display = 'none';
      }
    }
    const photos = Array.isArray(cat.photos) ? cat.photos.filter(Boolean) : [];
    if (lightboxGridEl){
      lightboxGridEl.innerHTML = photos.length
        ? photos.map(url => '<img src="' + escapeAttr(optimizeCloudinaryUrl(url, 900)) + '" data-full="' + escapeAttr(url) + '" alt="' + escapeAttr(cat.label || '') + '" loading="lazy">').join('')
        : '<p class="as-cat-lightbox-empty">Todavía no hay fotos en esta categoría.</p>';
    }
    lightboxEl.classList.add('is-open');
    lightboxEl.setAttribute('aria-hidden', 'false');
    document.body.classList.add('as-cat-lightbox-open');
    // "is-visible" se añade un frame después de "is-open" a propósito:
    // display:none → flex no se puede animar, así que primero se pasa a
    // flex (todavía con opacity:0/scale menor, ver CSS) y solo en el
    // siguiente frame se activa la transición a opacidad 1 y escala
    // normal, para que la entrada se vea como un fundido+acercamiento
    // suave en vez de un cambio brusco. Doble rAF (en vez de uno solo)
    // para asegurar que el navegador ya ha pintado el frame "de partida"
    // antes de animar.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => lightboxEl.classList.add('is-visible'));
    });
    // Resalta en naranja el botón de la categoría que está abierta ahora
    // mismo (ver .as-cat-btn.is-active en styles.css), y quita ese
    // resalte de cualquier otro botón que lo tuviera puesto.
    if (catButtonsEl){
      catButtonsEl.querySelectorAll('.as-cat-btn.is-active').forEach(el => el.classList.remove('is-active'));
    }
    if (btn) btn.classList.add('is-active');
  }

  function closeLightbox(){
    if (!lightboxEl) return;
    lightboxEl.classList.remove('is-visible');
    lightboxEl.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('as-cat-lightbox-open');
    if (catButtonsEl){
      catButtonsEl.querySelectorAll('.as-cat-btn.is-active').forEach(el => el.classList.remove('is-active'));
    }
    // Espera a que termine el fundido de salida antes de quitar
    // "is-open" (lo que vuelve a poner display:none) -si se quitara ya
    // mismo, el cierre se vería de golpe en vez de con el mismo fundido
    // suave que la apertura-.
    const onFadeOut = (ev) => {
      if (ev.propertyName !== 'opacity') return;
      lightboxEl.removeEventListener('transitionend', onFadeOut);
      lightboxEl.classList.remove('is-open');
    };
    lightboxEl.addEventListener('transitionend', onFadeOut);
    setTimeout(() => lightboxEl.classList.remove('is-open'), 600);
  }

  // Abre una foto concreta del mosaico a pantalla completa, por encima
  // del propio mosaico (mismo patrón de fundido+escala que openLightbox/
  // closeLightbox: primero se pasa a flex con "is-open" y solo en el
  // siguiente frame se anima la entrada con "is-visible"). Pide la foto
  // a una resolución más alta que las miniaturas del mosaico (900px),
  // ya que aquí puede verse a tamaño de pantalla completa.
  function openPhotoViewer(url){
    if (!photoViewerEl || !photoViewerImgEl || !url) return;
    photoViewerImgEl.src = (typeof optimizeCloudinaryUrl === 'function') ? optimizeCloudinaryUrl(url, 1800) : url;
    photoViewerEl.classList.add('is-open');
    photoViewerEl.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => photoViewerEl.classList.add('is-visible'));
    });
  }

  function closePhotoViewer(){
    if (!photoViewerEl) return;
    photoViewerEl.classList.remove('is-visible');
    photoViewerEl.setAttribute('aria-hidden', 'true');
    const onFadeOut = (ev) => {
      if (ev.propertyName !== 'opacity') return;
      photoViewerEl.removeEventListener('transitionend', onFadeOut);
      photoViewerEl.classList.remove('is-open');
      if (photoViewerImgEl) photoViewerImgEl.src = '';
    };
    photoViewerEl.addEventListener('transitionend', onFadeOut);
    setTimeout(() => {
      photoViewerEl.classList.remove('is-open');
      if (photoViewerImgEl) photoViewerImgEl.src = '';
    }, 400);
  }

  // Efecto al pulsar una categoría: el BOTÓN se implosiona -se encoge
  // sobre sí mismo y desaparece- sin que el resto de la página se mueva
  // ni haga zoom en ningún momento (ver @keyframes asCatImplode y
  // .as-cat-btn.is-launching en styles.css). La galería aparece justo
  // después con su propio fundido+escala suave. Un pequeño solape entre
  // ambas -abrir la galería un poco antes de que termine del todo la
  // implosión- evita que se note un corte entre las dos animaciones.
  const CAT_IMPLODE_MS = 420; // debe coincidir con la duración de @keyframes asCatImplode
  const CAT_REVEAL_AT = 260; // instante -antes de que el botón acabe de implosionar- en el que se abre la galería

  if (catButtonsEl){
    catButtonsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.as-cat-btn');
      if (!btn || btn.classList.contains('is-launching')) return;
      const cat = currentCategories.find(c => c.id === btn.dataset.id);
      if (!cat) return;
      btn.classList.add('is-launching');
      btn.addEventListener('animationend', () => btn.classList.remove('is-launching'), { once:true });
      setTimeout(() => openLightbox(cat, btn), CAT_REVEAL_AT);
    });
  }
  if (lightboxCloseBtn) lightboxCloseBtn.addEventListener('click', closeLightbox);
  // Pulsar cualquier foto del mosaico la abre a pantalla completa en el
  // visor de una sola foto (ver openPhotoViewer más arriba).
  if (lightboxGridEl){
    lightboxGridEl.addEventListener('click', (e) => {
      const img = e.target.closest('img');
      if (!img) return;
      // Se usa data-full (la URL original, sin recortar a 900px) y no
      // src (la miniatura del mosaico, ya optimizada a ese ancho): así
      // la foto se ve nítida también al abrirse grande a pantalla
      // completa, no ampliada a partir de una versión pequeña.
      openPhotoViewer(img.dataset.full || img.getAttribute('src'));
    });
  }
  if (photoViewerCloseBtn) photoViewerCloseBtn.addEventListener('click', closePhotoViewer);
  // Pulsar el fondo oscuro también cierra el visor (pulsar la foto en sí
  // no, gracias a e.target === photoViewerEl: solo se cuenta el fondo).
  if (photoViewerEl){
    photoViewerEl.addEventListener('click', (e) => {
      if (e.target === photoViewerEl) closePhotoViewer();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (photoViewerEl && photoViewerEl.classList.contains('is-open')){ closePhotoViewer(); return; }
    if (lightboxEl && lightboxEl.classList.contains('is-open')) closeLightbox();
  });

  // ================= Editor en Ajustes → Proyectos =================
  const catListEl = document.getElementById('catEditorList');
  const catEmptyEl = document.getElementById('catEditorEmpty');
  const catAddBtn = document.getElementById('catAddBtn');
  const catSaveBtn = document.getElementById('catGuardarBtn');
  const catResetBtn = document.getElementById('catResetBtn');
  const catMsgEl = document.getElementById('catMsg');
  const catFileInput = document.getElementById('catEditorFileInput');

  let catDraft = [];
  let catUploading = null; // índice de categoría a la que se le están subiendo fotos ahora mismo
  let catPendingIndex = null; // índice de categoría que abrió el selector de archivos

  function renderCatEditor(){
    if (!catListEl) return;
    const last = catDraft.length - 1;
    catListEl.innerHTML = catDraft.map((c, i) => {
      const photos = Array.isArray(c.photos) ? c.photos : [];
      const isUploading = catUploading === i;
      const thumbs = photos.map((url, pi) =>
        '<div class="cat-editor-thumb">' +
          '<img src="' + escapeAttr(url) + '" alt="Foto ' + (pi + 1) + ' de ' + escapeAttr(c.label) + '">' +
          '<button type="button" data-index="' + i + '" data-photo="' + pi + '" aria-label="Quitar foto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg></button>' +
        '</div>'
      ).join('');
      const addBox = isUploading
        ? '<div class="cat-editor-add-photo is-uploading">Subiendo…</div>'
        : '<button type="button" class="cat-editor-add-photo" data-index="' + i + '" aria-label="Añadir fotos a ' + escapeAttr(c.label) + '">' + PLACEHOLDER_ICON + '</button>';
      return (
        '<div class="cat-editor-item" data-index="' + i + '">' +
          '<div class="cat-editor-item-head">' +
            '<input type="text" class="cat-editor-name" value="' + escapeAttr(c.label) + '" placeholder="Nombre (ej. Deportes)">' +
            '<div class="pair-editor-actions">' +
              '<button type="button" class="pair-editor-move" data-dir="up" ' + (i === 0 ? 'disabled' : '') + ' aria-label="Mover categoría hacia arriba">↑</button>' +
              '<button type="button" class="pair-editor-move" data-dir="down" ' + (i === last ? 'disabled' : '') + ' aria-label="Mover categoría hacia abajo">↓</button>' +
              '<button type="button" class="cat-editor-remove" aria-label="Quitar categoría">×</button>' +
            '</div>' +
          '</div>' +
          '<input type="url" class="cat-editor-link" value="' + escapeAttr(c.driveLink || '') + '" placeholder="Enlace de Drive con más fotos (opcional)">' +
          '<div class="cat-editor-photos">' + thumbs + addBox + '</div>' +
        '</div>'
      );
    }).join('');
    if (catEmptyEl) catEmptyEl.style.display = catDraft.length ? 'none' : '';
  }

  function fillCatEditor(){
    catDraft = currentCategories.map(c => Object.assign({}, c, { photos: (c.photos || []).slice() }));
    renderCatEditor();
  }

  if (catListEl){
    catListEl.addEventListener('input', (e) => {
      const row = e.target.closest('.cat-editor-item');
      if (!row) return;
      const i = Number(row.dataset.index);
      if (!catDraft[i]) return;
      if (e.target.classList.contains('cat-editor-name')){
        catDraft[i].label = e.target.value;
      } else if (e.target.classList.contains('cat-editor-link')){
        catDraft[i].driveLink = e.target.value;
      }
    });

    catListEl.addEventListener('click', (e) => {
      const moveBtn = e.target.closest('.pair-editor-move');
      if (moveBtn){
        const row = moveBtn.closest('.cat-editor-item');
        const i = Number(row.dataset.index);
        const j = moveBtn.dataset.dir === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= catDraft.length) return;
        [catDraft[i], catDraft[j]] = [catDraft[j], catDraft[i]];
        renderCatEditor();
        return;
      }
      const removeBtn = e.target.closest('.cat-editor-remove');
      if (removeBtn){
        const row = removeBtn.closest('.cat-editor-item');
        const i = Number(row.dataset.index);
        catDraft.splice(i, 1);
        renderCatEditor();
        return;
      }
      const removePhotoBtn = e.target.closest('.cat-editor-photos button[data-photo]');
      if (removePhotoBtn){
        const i = Number(removePhotoBtn.dataset.index);
        const pi = Number(removePhotoBtn.dataset.photo);
        if (catDraft[i] && catDraft[i].photos) catDraft[i].photos.splice(pi, 1);
        renderCatEditor();
        return;
      }
      const addBtn = e.target.closest('.cat-editor-add-photo:not(.is-uploading)');
      if (addBtn && catUploading === null && catFileInput){
        catPendingIndex = Number(addBtn.dataset.index);
        catFileInput.click();
      }
    });
  }

  if (catFileInput){
    catFileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      const i = catPendingIndex;
      catFileInput.value = '';
      catPendingIndex = null;
      if (!files.length || i === null || !catDraft[i] || !window.CloudDB) return;
      catUploading = i;
      renderCatEditor();
      const fallidas = [];
      for (const file of files){
        try{
          const url = await window.CloudDB.uploadImageAlways(file, 'proyectos-categorias');
          // Se relee catDraft[i] por si mientras tanto se reordenó la lista.
          if (catDraft[i]){
            if (!Array.isArray(catDraft[i].photos)) catDraft[i].photos = [];
            catDraft[i].photos.push(url);
          }
        }catch(err){
          console.error('No se pudo subir una foto de categoría:', err && err.message || err);
          fallidas.push((file.name || 'archivo') + ': ' + (err && err.message || 'error desconocido'));
        }
      }
      catUploading = null;
      renderCatEditor();
      if (fallidas.length) alert('No se pudieron añadir estas fotos:\n' + fallidas.join('\n'));
    });
  }

  if (catAddBtn){
    catAddBtn.addEventListener('click', () => {
      catDraft.push({ id: 'cat-' + Date.now() + '-' + Math.floor(Math.random() * 1000), label: 'Nueva categoría', photos: [], driveLink: '' });
      renderCatEditor();
      const inputs = catListEl ? catListEl.querySelectorAll('.cat-editor-name') : [];
      const last = inputs[inputs.length - 1];
      if (last){ last.focus(); last.select(); }
    });
  }

  if (catSaveBtn){
    catSaveBtn.addEventListener('click', async () => {
      const cleaned = catDraft.map(c => ({
        id: c.id || ('cat-' + Date.now()),
        label: (c.label || '').trim() || 'Sin nombre',
        photos: (c.photos || []).filter(Boolean),
        driveLink: (c.driveLink || '').trim()
      }));
      if (!window.CloudDB){
        flashMsg(catMsgEl, 'No se pudo guardar: la conexión con la nube no está lista.', false);
        return;
      }
      catSaveBtn.disabled = true;
      try{
        await window.CloudDB.updateContent({ projectCategories: cleaned });
        flashMsg(catMsgEl, cleaned.length ? 'Categorías guardadas.' : 'Guardado: no hay ninguna categoría.', true);
        window.CloudDB.logHistory('Categorías de Proyectos editadas', cleaned.map(c => c.label).join(', ') || 'Lista vacía');
      }catch(err){
        console.error('No se pudieron guardar las categorías:', err && err.message || err);
        flashMsg(catMsgEl, 'No se pudo guardar (' + (err && err.message || 'error de conexión') + ').', false);
      }finally{
        catSaveBtn.disabled = false;
      }
    });
  }

  if (catResetBtn){
    catResetBtn.addEventListener('click', async () => {
      if (!window.CloudDB){
        flashMsg(catMsgEl, 'No se pudo restablecer: la conexión con la nube no está lista.', false);
        return;
      }
      if (!confirm('¿Quitar todas las categorías? Esta acción no se puede deshacer.')) return;
      catResetBtn.disabled = true;
      try{
        await window.CloudDB.updateContent({ projectCategories: [] });
        flashMsg(catMsgEl, 'Restablecido: no hay ninguna categoría.', true);
        window.CloudDB.logHistory('Categorías de Proyectos restablecidas', '');
      }catch(err){
        console.error('No se pudieron restablecer las categorías:', err && err.message || err);
        flashMsg(catMsgEl, 'No se pudo restablecer (' + (err && err.message || 'error de conexión') + ').', false);
      }finally{
        catResetBtn.disabled = false;
      }
    });
  }

  // ================= Suscripción a la nube =================
  // Se dispara en cuanto se registra (con lo que haya en caché, aunque
  // sea vacío) y de nuevo cada vez que llega un cambio real de Firestore.
  if (window.CloudDB){
    window.CloudDB.onContentChange((data, loaded) => {
      cloudLoaded = !!loaded;
      currentCategories = Array.isArray(data.projectCategories) ? data.projectCategories : [];
      renderCatButtonsPublic();
      // Mismo patrón que el resto de editores de esta web (parejas del
      // comparador, galería que se expande, ver comparison-pairs.js):
      // el borrador se recarga en cada snapshot de la nube, no solo la
      // primera vez.
      fillCatEditor();
    });
  } else {
    cloudLoaded = true; // sin CloudDB no hay nube que esperar, no hay "cargando" que respetar
    renderCatButtonsPublic();
    fillCatEditor();
  }
})();
