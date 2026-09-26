// ---------- "Reels" (vídeos verticales) ----------
// Mismo planteamiento que "Proyectos en YouTube" (youtube-videos.js):
// un botón "Reels" (#proyectosReelsBtn), al lado del de YouTube entre
// "Ediciones" y "Proyectos", que lleva a la página #view-mis-reels con
// la cuadrícula completa. Cada tarjeta es vertical (9:16) y al tocarla
// abre el reel real en una pestaña nueva.
//
// La diferencia con YouTube es la portada: Instagram y TikTok no dejan
// sacar la miniatura a partir del enlace, así que cada reel lleva su
// propia foto de portada, subida desde Ajustes → Reels (a Cloudinary,
// igual que el resto de fotos de la web). Si el enlace es de YouTube
// Shorts y no se ha subido ninguna, se usa la miniatura de YouTube.
//
// Dato guardado en Firestore: reels = [
//   { id, title, url, cover, edited, created }, ...
// ]
// Mismo patrón de "borrador + Guardar/Restablecer" que el editor de
// YouTube.
(function(){
  const REEL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10.5 9.5v5l4-2.5-4-2.5Z" fill="currentColor" stroke="none"/></svg>';
  const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor"/></svg>';
  // Ancho máximo al que se pide cada portada a Cloudinary: la tarjeta
  // más ancha de la cuadrícula ronda los 240px, x2 para pantallas retina.
  const COVER_WIDTH = 480;

  function ytThumb(url){
    return typeof window.getYoutubeThumb === 'function' ? window.getYoutubeThumb(url) : null;
  }

  // Portada que se ve: la subida a mano o, si no hay, la de YouTube
  // Shorts (solo si el enlace es de YouTube; en Instagram/TikTok no hay).
  function coverUrl(reel, width){
    if (reel.cover) return typeof optimizeCloudinaryUrl === 'function' ? optimizeCloudinaryUrl(reel.cover, width) : reel.cover;
    return ytThumb(reel.url);
  }

  // Nombre de la red a la que lleva el enlace, para el aviso de debajo
  // de cada tarjeta ("Ver en Instagram"...).
  function platformName(url){
    const u = String(url || '').toLowerCase();
    if (u.indexOf('instagram.com') !== -1) return 'Instagram';
    if (u.indexOf('tiktok.com') !== -1) return 'TikTok';
    if (u.indexOf('youtube.com') !== -1 || u.indexOf('youtu.be') !== -1) return 'YouTube';
    return '';
  }

  // Enlace de la tarjeta: solo http(s). Si en Ajustes se pegó sin el
  // "https://" delante (p. ej. "instagram.com/reel/..."), el navegador lo
  // trataría como una ruta de esta misma web; se completa al guardar (ver
  // normalizeUrl) y, por si acaso, aquí nunca se enlaza otra cosa.
  function safeHref(url){
    return /^https?:\/\//i.test(url || '') ? url : '#';
  }
  function normalizeUrl(url){
    const u = String(url || '').trim();
    if (!u || /^https?:\/\//i.test(u)) return u;
    return 'https://' + u.replace(/^\/+/, '');
  }

  // ================= Vista pública =================
  let currentReels = [];
  // Igual que en youtube-videos.js: no se oculta el botón mientras la
  // nube todavía no ha respondido.
  let cloudLoaded = false;

  const gridEl = document.getElementById('reelsGridFull');
  const reelsBtn = document.getElementById('proyectosReelsBtn');
  const reelsBtnThumb = document.getElementById('proyectosReelsBtnThumb');

  function renderPublic(){
    if (reelsBtn) reelsBtn.style.display = (!cloudLoaded || currentReels.length) ? '' : 'none';
    syncProyectosMediaRow();
    if (!cloudLoaded || !currentReels.length){
      if (reelsBtnThumb) reelsBtnThumb.style.backgroundImage = '';
      if (gridEl) gridEl.innerHTML = '';
      return;
    }

    // Miniatura del botón: la portada del PRIMER reel de la lista (el
    // orden se cambia en Ajustes con las flechas ↑/↓).
    const firstCover = coverUrl(currentReels[0], 96);
    if (reelsBtnThumb){
      reelsBtnThumb.style.backgroundImage = firstCover ? "url('" + firstCover + "')" : '';
    }

    if (gridEl){
      gridEl.innerHTML = currentReels.map(r => {
        const cover = coverUrl(r, COVER_WIDTH);
        const bg = cover ? ' style="background-image:url(\'' + escapeAttr(cover) + '\')"' : '';
        const stickers = (
          (r.edited ? '<span class="youtube-card-sticker youtube-card-sticker--edited">Editado</span>' : '') +
          (r.created ? '<span class="youtube-card-sticker youtube-card-sticker--created">Creado</span>' : '')
        );
        const platform = platformName(r.url);
        return (
          '<a class="reel-card" href="' + escapeAttr(safeHref(r.url)) + '" target="_blank" rel="noopener">' +
            '<div class="reel-card-cover' + (cover ? '' : ' reel-card-cover--empty') + '"' + bg + '>' +
              (cover ? '' : '<span class="reel-card-placeholder">' + REEL_ICON + '</span>') +
              (stickers ? '<div class="youtube-card-stickers">' + stickers + '</div>' : '') +
              '<span class="reel-card-play">' + PLAY_ICON + '</span>' +
              '<p class="reel-card-title">' + escapeHtml(r.title || 'Sin título') + '</p>' +
            '</div>' +
            '<span class="youtube-card-hint"><span class="youtube-card-hint-text">' + (platform ? 'Ver en ' + platform : 'Toca para verlo') + '</span></span>' +
          '</a>'
        );
      }).join('');
    }
  }

  if (reelsBtn){
    reelsBtn.addEventListener('click', () => {
      if (typeof window.goToView === 'function') window.goToView('mis-reels');
    });
  }

  // ================= Editor en Ajustes → Reels =================
  const listEl = document.getElementById('reelsEditorList');
  const emptyEl = document.getElementById('reelsEditorEmpty');
  const addBtn = document.getElementById('reelsAddBtn');
  const saveBtn = document.getElementById('reelsGuardarBtn');
  const resetBtn = document.getElementById('reelsResetBtn');
  const msgEl = document.getElementById('reelsMsg');
  const fileInput = document.getElementById('reelsEditorFileInput');

  let draft = [];
  let uploadingIndex = null;
  let pendingIndex = null;

  // Recuadro vertical de la portada: vacío (icono + "Subir portada"),
  // subiendo, o con la foto y un aviso de "Cambiar" abajo. Si no hay
  // portada propia pero el enlace es de YouTube, enseña esa miniatura con
  // el aviso "Automática", para que se vea que ya tiene una.
  function coverBoxHtml(r, i){
    const isUploading = uploadingIndex === i;
    const cover = isUploading ? null : coverUrl(r, 160);
    const bg = cover ? ' style="background-image:url(\'' + escapeAttr(cover) + '\')"' : '';
    let inner;
    if (isUploading) inner = '<span class="reel-editor-cover-text">Subiendo…</span>';
    else if (!cover) inner = REEL_ICON + '<span class="reel-editor-cover-text">Subir portada</span>';
    else inner = '<span class="reel-editor-cover-badge">' + (r.cover ? 'Cambiar' : 'Automática') + '</span>';
    return (
      '<div class="reel-editor-cover' + (cover ? ' has-image' : '') + (isUploading ? ' is-uploading' : '') + '"' + bg +
        ' data-index="' + i + '" role="button" tabindex="0" aria-label="' +
        (r.cover ? 'Cambiar la portada' : 'Subir portada') + ' de ' + escapeAttr(r.title || 'este reel') + '">' +
        inner +
      '</div>'
    );
  }

  function renderEditor(){
    if (!listEl) return;
    const last = draft.length - 1;
    listEl.innerHTML = draft.map((r, i) => (
      '<div class="cat-editor-item" data-index="' + i + '">' +
        coverBoxHtml(r, i) +
        '<div class="cat-editor-item-head">' +
          '<input type="text" class="cat-editor-name" value="' + escapeAttr(r.title) + '" placeholder="Título del reel">' +
          '<div class="pair-editor-actions">' +
            '<button type="button" class="pair-editor-move" data-dir="up" ' + (i === 0 ? 'disabled' : '') + ' aria-label="Mover reel hacia arriba">↑</button>' +
            '<button type="button" class="pair-editor-move" data-dir="down" ' + (i === last ? 'disabled' : '') + ' aria-label="Mover reel hacia abajo">↓</button>' +
            '<button type="button" class="cat-editor-remove" aria-label="Quitar reel">×</button>' +
          '</div>' +
        '</div>' +
        '<input type="url" class="cat-editor-link" value="' + escapeAttr(r.url) + '" placeholder="Enlace del reel (Instagram, TikTok o YouTube)">' +
        '<div class="yt-tag-row">' +
          '<button type="button" class="yt-tag-toggle yt-tag-toggle--edited' + (r.edited ? ' is-active' : '') + '" data-tag="edited" aria-pressed="' + (r.edited ? 'true' : 'false') + '">Editado</button>' +
          '<button type="button" class="yt-tag-toggle yt-tag-toggle--created' + (r.created ? ' is-active' : '') + '" data-tag="created" aria-pressed="' + (r.created ? 'true' : 'false') + '">Creado</button>' +
          (r.cover ? '<button type="button" class="reel-editor-cover-remove">Quitar portada</button>' : '') +
        '</div>' +
      '</div>'
    )).join('');
    if (emptyEl) emptyEl.style.display = draft.length ? 'none' : '';
  }

  function fillEditor(){
    draft = currentReels.map(r => Object.assign({}, r));
    renderEditor();
  }

  function pickCover(i){
    if (uploadingIndex !== null || !fileInput || !draft[i]) return;
    pendingIndex = i;
    fileInput.click();
  }

  if (listEl){
    listEl.addEventListener('input', (e) => {
      const row = e.target.closest('.cat-editor-item');
      if (!row) return;
      const i = Number(row.dataset.index);
      if (!draft[i]) return;
      if (e.target.classList.contains('cat-editor-name')){
        draft[i].title = e.target.value;
      } else if (e.target.classList.contains('cat-editor-link')){
        draft[i].url = e.target.value;
        // Sin portada propia, un enlace de YouTube trae la suya: se
        // actualiza el recuadro al momento (sin repintar la fila, para no
        // perder el foco del campo que se está escribiendo).
        if (!draft[i].cover){
          const box = row.querySelector('.reel-editor-cover');
          if (box) box.outerHTML = coverBoxHtml(draft[i], i);
        }
      }
    });

    listEl.addEventListener('click', (e) => {
      const moveBtn = e.target.closest('.pair-editor-move');
      if (moveBtn){
        const i = Number(moveBtn.closest('.cat-editor-item').dataset.index);
        const j = moveBtn.dataset.dir === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= draft.length || uploadingIndex !== null) return;
        [draft[i], draft[j]] = [draft[j], draft[i]];
        renderEditor();
        return;
      }
      const removeBtn = e.target.closest('.cat-editor-remove');
      if (removeBtn){
        if (uploadingIndex !== null) return;
        const i = Number(removeBtn.closest('.cat-editor-item').dataset.index);
        draft.splice(i, 1);
        renderEditor();
        return;
      }
      const tagBtn = e.target.closest('.yt-tag-toggle');
      if (tagBtn){
        const i = Number(tagBtn.closest('.cat-editor-item').dataset.index);
        if (!draft[i]) return;
        const tag = tagBtn.dataset.tag; // 'edited' | 'created'
        draft[i][tag] = !draft[i][tag];
        renderEditor();
        return;
      }
      const coverRemove = e.target.closest('.reel-editor-cover-remove');
      if (coverRemove){
        const i = Number(coverRemove.closest('.cat-editor-item').dataset.index);
        if (!draft[i]) return;
        draft[i].cover = null;
        renderEditor();
        return;
      }
      const box = e.target.closest('.reel-editor-cover');
      if (box) pickCover(Number(box.dataset.index));
    });

    listEl.addEventListener('keydown', (e) => {
      const box = e.target.closest('.reel-editor-cover');
      if (!box || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      pickCover(Number(box.dataset.index));
    });
  }

  if (fileInput){
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      const i = pendingIndex;
      fileInput.value = '';
      pendingIndex = null;
      if (!file || i === null || !draft[i] || !window.CloudDB) return;
      // Se guarda la fila en sí (no su posición): si mientras sube se
      // edita otra cosa, la portada acaba igualmente en su reel.
      const target = draft[i];
      uploadingIndex = i;
      renderEditor();
      try{
        target.cover = await window.CloudDB.uploadImageAlways(file, 'reels');
      }catch(err){
        console.error('No se pudo subir la portada del reel:', err && err.message || err);
        alert('No se pudo subir la portada (' + (err && err.message || 'error de conexión') + '). Inténtalo de nuevo.');
      }finally{
        uploadingIndex = null;
        renderEditor();
      }
    });
  }

  if (addBtn){
    addBtn.addEventListener('click', () => {
      draft.push({ id: 'reel-' + Date.now() + '-' + Math.floor(Math.random() * 1000), title: '', url: '', cover: null });
      renderEditor();
      const inputs = listEl ? listEl.querySelectorAll('.cat-editor-name') : [];
      const last = inputs[inputs.length - 1];
      if (last){ last.focus(); }
    });
  }

  if (saveBtn){
    saveBtn.addEventListener('click', async () => {
      if (uploadingIndex !== null){
        flashMsg(msgEl, 'Espera a que termine de subir la portada.', false);
        return;
      }
      // Igual que en YouTube: fuera los reels sin enlace (una tarjeta que
      // no lleva a ningún sitio no tiene sentido); un título vacío se
      // guarda con un texto de repuesto.
      const cleaned = draft
        .filter(r => (r.url || '').trim())
        .map(r => ({
          id: r.id || ('reel-' + Date.now()),
          title: (r.title || '').trim() || 'Sin título',
          url: normalizeUrl(r.url),
          cover: r.cover || null,
          edited: !!r.edited,
          created: !!r.created
        }));
      if (!window.CloudDB){
        flashMsg(msgEl, 'No se pudo guardar: la conexión con la nube no está lista.', false);
        return;
      }
      saveBtn.disabled = true;
      try{
        await window.CloudDB.updateContent({ reels: cleaned });
        flashMsg(msgEl, cleaned.length ? 'Reels guardados.' : 'Guardado: no hay ningún reel.', true);
        window.CloudDB.logHistory('Reels editados', cleaned.map(r => r.title).join(', ') || 'Lista vacía');
      }catch(err){
        console.error('No se pudieron guardar los reels:', err && err.message || err);
        flashMsg(msgEl, 'No se pudo guardar (' + (err && err.message || 'error de conexión') + ').', false);
      }finally{
        saveBtn.disabled = false;
      }
    });
  }

  if (resetBtn){
    resetBtn.addEventListener('click', async () => {
      if (!window.CloudDB){
        flashMsg(msgEl, 'No se pudo restablecer: la conexión con la nube no está lista.', false);
        return;
      }
      if (!confirm('¿Quitar todos los reels? Esta acción no se puede deshacer.')) return;
      resetBtn.disabled = true;
      try{
        await window.CloudDB.updateContent({ reels: [] });
        flashMsg(msgEl, 'Restablecido: no hay ningún reel.', true);
        window.CloudDB.logHistory('Reels restablecidos', '');
      }catch(err){
        console.error('No se pudieron restablecer los reels:', err && err.message || err);
        flashMsg(msgEl, 'No se pudo restablecer (' + (err && err.message || 'error de conexión') + ').', false);
      }finally{
        resetBtn.disabled = false;
      }
    });
  }

  // ================= Suscripción a la nube =================
  if (window.CloudDB){
    window.CloudDB.onContentChange((data, loaded) => {
      cloudLoaded = !!loaded;
      currentReels = Array.isArray(data.reels) ? data.reels : [];
      renderPublic();
      // Mientras se sube una portada no se pisa el borrador con lo que
      // llegue de la nube: se perdería la subida en curso.
      if (uploadingIndex === null) fillEditor();
    });
  } else {
    cloudLoaded = true;
    renderPublic();
    fillEditor();
  }
})();
