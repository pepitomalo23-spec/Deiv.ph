// ---------- "Reels" (vídeos verticales) ----------
// Mismo planteamiento que "Proyectos en YouTube" (youtube-videos.js):
// un botón "Reels" (#proyectosReelsBtn), al lado del de YouTube entre
// "Ediciones" y "Proyectos", que lleva a la página #view-mis-reels con
// la cuadrícula completa. Cada tarjeta es vertical (9:16).
// A diferencia del de YouTube, este botón se ve SIEMPRE, aunque todavía
// no haya ningún reel guardado: así el apartado existe desde el primer
// día, y su página, mientras esté vacía, invita a ver los reels en
// Instagram (ver renderEmpty).
//
// Ver el reel en la propia web: al tocar una tarjeta se abre encima de
// la página (#reelViewer) un reproductor, sin salir de la web:
//   - Instagram: un <video> normal con el vídeo del reel (lo da
//     /api/reel-video, ver api/reel-video.js), a pantalla completa y sin
//     la cabecera/pie de Instagram. Si falla, el reproductor oficial de
//     "insertar" de Instagram (iframe).
//   - TikTok y YouTube: su reproductor oficial (iframe).
// Si el enlace no se puede insertar (p. ej. un enlace corto de TikTok
// "vm.tiktok.com/..."), la tarjeta abre el reel en su red, en una
// pestaña nueva, como un enlace normal.
//
// Portada: dos opciones por reel, desde Ajustes → Reels:
//   - "De Instagram"/"De TikTok": la portada que el reel ya tiene allí.
//     Se trae con /api/reel-cover (ver api/reel-cover.js) y se sube a
//     Cloudinary como cualquier otra foto, porque los enlaces de imagen
//     de Instagram/TikTok caducan. Se pone sola al pegar el enlace.
//   - "Subir otra": una foto propia.
// En YouTube Shorts, sin portada guardada se usa la miniatura de YouTube.
//
// Dato guardado en Firestore: reels = [
//   { id, title, url, cover, coverSource, edited, created }, ...
// ]  (coverSource: 'platform' = la de la red, 'custom' = subida a mano)
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

  // Portada que se ve: la guardada (de la red o propia) o, si no hay, la
  // de YouTube Shorts (solo si el enlace es de YouTube).
  function coverUrl(reel, width){
    if (reel.cover) return typeof optimizeCloudinaryUrl === 'function' ? optimizeCloudinaryUrl(reel.cover, width) : reel.cover;
    return ytThumb(reel.url);
  }

  // Nombre de la red a la que lleva el enlace ("Ver en Instagram"...).
  function platformName(url){
    const u = String(url || '').toLowerCase();
    if (u.indexOf('instagram.com') !== -1 || u.indexOf('instagr.am') !== -1) return 'Instagram';
    if (u.indexOf('tiktok.com') !== -1) return 'TikTok';
    if (u.indexOf('youtube.com') !== -1 || u.indexOf('youtu.be') !== -1) return 'YouTube';
    return '';
  }

  // Redes de las que /api/reel-cover sabe traer la portada.
  function hasPlatformCover(url){
    const p = platformName(url);
    return p === 'Instagram' || p === 'TikTok';
  }

  // Reproductor oficial para ver el reel dentro de la web, o null si el
  // enlace no se puede insertar.
  //   Instagram: instagram.com/reel/CÓDIGO, /p/CÓDIGO, /usuario/reel/CÓDIGO
  //   TikTok:    tiktok.com/@usuario/video/NÚMERO
  //   YouTube:   cualquier enlace que entienda getYoutubeId (Shorts incluidos)
  function reelEmbed(url){
    const u = String(url || '');
    let m = u.match(/(?:instagram\.com|instagr\.am)\/(?:[\w.]+\/)?(?:reels?|p|tv)\/([A-Za-z0-9_-]+)/i);
    if (m) return { kind:'instagram', src:'https://www.instagram.com/p/' + m[1] + '/embed/' };
    m = u.match(/tiktok\.com\/(?:.*\/)?(?:video|embed\/v2|player\/v1)\/(\d+)/i);
    if (m) return { kind:'tiktok', src:'https://www.tiktok.com/player/v1/' + m[1] + '?autoplay=1&rel=0' };
    const ytId = typeof window.getYoutubeId === 'function' ? window.getYoutubeId(u) : null;
    if (ytId) return { kind:'youtube', src:'https://www.youtube-nocookie.com/embed/' + ytId + '?autoplay=1&playsinline=1&rel=0' };
    return null;
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
  // Igual que en youtube-videos.js: distingue "la nube todavía no ha
  // respondido" de "ya respondió y no hay ningún reel", para no enseñar
  // el aviso de página vacía mientras se está cargando.
  let cloudLoaded = false;

  const gridEl = document.getElementById('reelsGridFull');
  const reelsBtn = document.getElementById('proyectosReelsBtn');
  const reelsBtnThumb = document.getElementById('proyectosReelsBtnThumb');

  // Página sin ningún reel todavía: un aviso y un botón al perfil de
  // Instagram, en vez de una página en blanco. El enlace se toma del
  // icono de Instagram de la portada (#socialInstagramLink), que
  // editable-texts.js ya mantiene al día con el de Ajustes → Textos y
  // contacto (su suscripción a la nube se registra antes que esta, así
  // que cuando se pinta esto ya tiene el valor bueno).
  function renderEmpty(){
    if (!gridEl) return;
    const igLink = document.getElementById('socialInstagramLink');
    const igHref = safeHref(igLink ? igLink.getAttribute('href') : '');
    gridEl.innerHTML = (
      '<div class="reels-empty">' +
        '<span class="reels-empty-icon">' + REEL_ICON + '</span>' +
        '<p class="reels-empty-text">Muy pronto habrá reels aquí.</p>' +
        (igHref !== '#' ? '<a class="reels-empty-btn" href="' + escapeAttr(igHref) + '" target="_blank" rel="noopener">Ver mis reels en Instagram</a>' : '') +
      '</div>'
    );
  }

  function renderPublic(){
    // El botón se queda siempre visible (ver comentario de arriba).
    if (reelsBtn) reelsBtn.style.display = '';
    syncProyectosMediaRow();
    if (!cloudLoaded || !currentReels.length){
      if (reelsBtnThumb) reelsBtnThumb.style.backgroundImage = '';
      if (cloudLoaded) renderEmpty();
      else if (gridEl) gridEl.innerHTML = '';
      return;
    }

    // Miniatura del botón: la portada del PRIMER reel de la lista (el
    // orden se cambia en Ajustes con las flechas ↑/↓).
    const firstCover = coverUrl(currentReels[0], 96);
    if (reelsBtnThumb){
      reelsBtnThumb.style.backgroundImage = firstCover ? "url('" + firstCover + "')" : '';
    }

    if (gridEl){
      gridEl.innerHTML = currentReels.map((r, i) => {
        const cover = coverUrl(r, COVER_WIDTH);
        const bg = cover ? ' style="background-image:url(\'' + escapeAttr(cover) + '\')"' : '';
        const stickers = (
          (r.edited ? '<span class="youtube-card-sticker youtube-card-sticker--edited">Editado</span>' : '') +
          (r.created ? '<span class="youtube-card-sticker youtube-card-sticker--created">Creado</span>' : '')
        );
        const platform = platformName(r.url);
        const hint = reelEmbed(r.url) ? 'Toca para verlo' : (platform ? 'Ver en ' + platform : 'Toca para verlo');
        return (
          '<a class="reel-card" data-index="' + i + '" href="' + escapeAttr(safeHref(r.url)) + '" target="_blank" rel="noopener">' +
            '<div class="reel-card-cover' + (cover ? '' : ' reel-card-cover--empty') + '"' + bg + '>' +
              (cover ? '' : '<span class="reel-card-placeholder">' + REEL_ICON + '</span>') +
              (stickers ? '<div class="youtube-card-stickers">' + stickers + '</div>' : '') +
              '<span class="reel-card-play">' + PLAY_ICON + '</span>' +
              '<p class="reel-card-title">' + escapeHtml(r.title || 'Sin título') + '</p>' +
            '</div>' +
            '<span class="youtube-card-hint"><span class="youtube-card-hint-text">' + hint + '</span></span>' +
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

  // ================= Reproductor encima de la página =================
  const viewerEl = document.getElementById('reelViewer');
  const viewerFrameEl = document.getElementById('reelViewerFrame');
  const viewerTitleEl = document.getElementById('reelViewerTitle');
  const viewerLinkEl = document.getElementById('reelViewerLink');
  let viewerReturnFocus = null;

  function showIframe(reel, embed){
    viewerFrameEl.className = 'reel-viewer-frame reel-viewer-frame--' + embed.kind;
    viewerFrameEl.innerHTML = '<iframe src="' + escapeAttr(embed.src) + '" title="' + escapeAttr(reel.title || 'Reel') + '"' +
      ' allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write" allowfullscreen' +
      ' referrerpolicy="strict-origin-when-cross-origin"></iframe>';
  }

  // Instagram: primero el vídeo en un <video> propio; si no carga (el
  // vídeo no está disponible, Instagram cambió algo...), el iframe
  // oficial de "insertar". Se llama dentro del propio toque en la
  // tarjeta, así el navegador deja que empiece a sonar sin más.
  function showInstagramVideo(reel, embed){
    viewerFrameEl.className = 'reel-viewer-frame reel-viewer-frame--video';
    const poster = coverUrl(reel, 720);
    viewerFrameEl.innerHTML = '<video controls playsinline loop preload="auto"' +
      (poster ? ' poster="' + escapeAttr(poster) + '"' : '') +
      ' src="/api/reel-video?url=' + encodeURIComponent(reel.url) + '"></video>';
    const video = viewerFrameEl.querySelector('video');
    let fellBack = false;
    const fallBack = () => {
      if (fellBack || !viewerFrameEl.contains(video)) return;
      fellBack = true;
      showIframe(reel, embed);
    };
    video.addEventListener('error', fallBack);
    const p = video.play();
    if (p && typeof p.catch === 'function'){
      // Si el navegador no deja reproducir con sonido, se intenta en
      // silencio (el usuario puede activarlo en los controles). Un error
      // que no sea de ese tipo significa que el vídeo no carga.
      p.catch(err => {
        if (err && err.name === 'NotAllowedError'){
          video.muted = true;
          video.play().catch(() => {});
        } else {
          fallBack();
        }
      });
    }
  }

  function openViewer(reel, embed, fromEl){
    if (!viewerEl || !viewerFrameEl) return false;
    viewerReturnFocus = fromEl || null;
    if (embed.kind === 'instagram') showInstagramVideo(reel, embed);
    else showIframe(reel, embed);
    if (viewerTitleEl) viewerTitleEl.textContent = reel.title || '';
    if (viewerLinkEl){
      const platform = platformName(reel.url);
      viewerLinkEl.href = safeHref(reel.url);
      viewerLinkEl.textContent = platform ? 'Ver en ' + platform : 'Abrir el enlace';
    }
    viewerEl.hidden = false;
    document.body.classList.add('reel-viewer-open');
    const closeBtn = viewerEl.querySelector('.reel-viewer-close');
    if (closeBtn) closeBtn.focus();
    return true;
  }

  function closeViewer(){
    if (!viewerEl || viewerEl.hidden) return;
    viewerEl.hidden = true;
    // Quitar el vídeo/iframe es lo que para de verdad la reproducción (y
    // su sonido).
    if (viewerFrameEl){
      const video = viewerFrameEl.querySelector('video');
      if (video){ video.pause(); video.removeAttribute('src'); video.load(); }
      viewerFrameEl.innerHTML = '';
    }
    document.body.classList.remove('reel-viewer-open');
    if (viewerReturnFocus && typeof viewerReturnFocus.focus === 'function') viewerReturnFocus.focus();
    viewerReturnFocus = null;
  }

  if (viewerEl){
    viewerEl.addEventListener('click', (e) => {
      if (e.target.closest('[data-reel-close]')) closeViewer();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeViewer();
    });
    // Si se sale de "Mis reels" con el menú mientras está abierto.
    document.addEventListener('click', (e) => {
      if (e.target.closest('.menu-item')) closeViewer();
    });
  }

  // El reproductor de Instagram avisa de la altura que necesita (mensaje
  // "MEASURE", el mismo que usa su embed.js oficial): se ajusta el iframe
  // a esa altura para que no quede ni cortado ni con hueco en blanco.
  window.addEventListener('message', (e) => {
    if (e.origin !== 'https://www.instagram.com' || !viewerFrameEl) return;
    let data = e.data;
    if (typeof data === 'string'){
      try { data = JSON.parse(data); } catch (err) { return; }
    }
    const h = data && data.type === 'MEASURE' && data.details && Number(data.details.height);
    const iframe = viewerFrameEl.querySelector('iframe');
    if (h && iframe) iframe.style.height = Math.ceil(h) + 'px';
  });

  // Tocar una tarjeta: se abre el reproductor en vez de salir de la web.
  // La tarjeta sigue siendo un enlace normal (para abrirlo en otra
  // pestaña con el botón central, o si el enlace no se puede insertar).
  if (gridEl){
    gridEl.addEventListener('click', (e) => {
      const card = e.target.closest('.reel-card');
      if (!card || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
      const reel = currentReels[Number(card.dataset.index)];
      const embed = reel && reelEmbed(reel.url);
      if (embed && openViewer(reel, embed, card)) e.preventDefault();
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
  // Fila con una portada en camino (subiendo una foto o trayéndola de
  // Instagram/TikTok) y el texto que se enseña mientras tanto. Solo una a
  // la vez.
  let busyIndex = null;
  let busyText = '';
  let pendingIndex = null;
  // Enlaces cuya portada ya se intentó traer sola (para no repetirlo en
  // cada letra que se escriba si falló).
  const autoTried = new Set();

  // Recuadro vertical de la portada: vacío (icono + "Subir portada"),
  // ocupado, o con la foto y un aviso abajo de dónde sale.
  function coverBoxHtml(r, i){
    const isBusy = busyIndex === i;
    const cover = isBusy ? null : coverUrl(r, 160);
    const bg = cover ? ' style="background-image:url(\'' + escapeAttr(cover) + '\')"' : '';
    let inner;
    if (isBusy) inner = '<span class="reel-editor-cover-text">' + escapeHtml(busyText) + '</span>';
    else if (!cover) inner = REEL_ICON + '<span class="reel-editor-cover-text">Subir portada</span>';
    else {
      const badge = !r.cover ? 'Automática'
        : r.coverSource === 'platform' ? ('De ' + (platformName(r.url) || 'la red'))
        : 'Propia';
      inner = '<span class="reel-editor-cover-badge">' + escapeHtml(badge) + '</span>';
    }
    return (
      '<div class="reel-editor-cover' + (cover ? ' has-image' : '') + (isBusy ? ' is-uploading' : '') + '"' + bg +
        ' data-index="' + i + '" role="button" tabindex="0" aria-label="Subir una portada propia para ' + escapeAttr(r.title || 'este reel') + '">' +
        inner +
      '</div>'
    );
  }

  // Opciones de portada: la de la red (solo si el enlace es de Instagram
  // o TikTok) o una propia. La que está puesta sale marcada.
  function coverOptsHtml(r){
    const platform = platformName(r.url);
    const fromPlatform = !!r.cover && r.coverSource === 'platform';
    const custom = !!r.cover && r.coverSource !== 'platform';
    return (
      '<div class="reel-editor-cover-opts">' +
        '<span class="reel-editor-cover-label">Portada:</span>' +
        (hasPlatformCover(r.url)
          ? '<button type="button" class="reel-cover-opt' + (fromPlatform ? ' is-active' : '') + '" data-cover="platform" aria-pressed="' + fromPlatform + '">La de ' + platform + '</button>'
          : '') +
        '<button type="button" class="reel-cover-opt' + (custom ? ' is-active' : '') + '" data-cover="custom" aria-pressed="' + custom + '">' + (custom ? 'Propia · cambiar' : 'Subir otra') + '</button>' +
        (r.cover ? '<button type="button" class="reel-editor-cover-remove">Quitar</button>' : '') +
      '</div>'
    );
  }

  function rowHtml(r, i, last){
    return (
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
        coverOptsHtml(r) +
        '<div class="yt-tag-row">' +
          '<button type="button" class="yt-tag-toggle yt-tag-toggle--edited' + (r.edited ? ' is-active' : '') + '" data-tag="edited" aria-pressed="' + (r.edited ? 'true' : 'false') + '">Editado</button>' +
          '<button type="button" class="yt-tag-toggle yt-tag-toggle--created' + (r.created ? ' is-active' : '') + '" data-tag="created" aria-pressed="' + (r.created ? 'true' : 'false') + '">Creado</button>' +
        '</div>' +
      '</div>'
    );
  }

  function renderEditor(){
    if (!listEl) return;
    const last = draft.length - 1;
    listEl.innerHTML = draft.map((r, i) => rowHtml(r, i, last)).join('');
    if (emptyEl) emptyEl.style.display = draft.length ? 'none' : '';
  }

  // Repinta SOLO la portada y sus opciones de una fila, sin tocar los
  // campos de texto: así no se pierde el foco ni lo que se está
  // escribiendo mientras llega una portada.
  function refreshCover(i){
    if (!listEl) return;
    const row = listEl.querySelector('.cat-editor-item[data-index="' + i + '"]');
    if (!row || !draft[i]) return;
    const box = row.querySelector('.reel-editor-cover');
    if (box) box.outerHTML = coverBoxHtml(draft[i], i);
    const opts = row.querySelector('.reel-editor-cover-opts');
    if (opts) opts.outerHTML = coverOptsHtml(draft[i]);
  }

  function fillEditor(){
    draft = currentReels.map(r => Object.assign({}, r));
    renderEditor();
  }

  // Pone una portada nueva a la fila i a partir de un archivo (subido a
  // mano o traído de la red), por el mismo camino que el resto de fotos
  // de la web (uploadImageAlways: Cloudinary, o respaldo local si falla).
  // Se guarda la fila en sí (no su posición) por si se reordena algo
  // mientras tanto -de todas formas mover/quitar filas se bloquea-.
  async function setCoverFromFile(i, file, source){
    const target = draft[i];
    if (!target || !window.CloudDB) return false;
    busyIndex = i;
    busyText = 'Subiendo…';
    refreshCover(i);
    try{
      target.cover = await window.CloudDB.uploadImageAlways(file, 'reels');
      target.coverSource = source;
      return true;
    }catch(err){
      console.error('No se pudo subir la portada del reel:', err && err.message || err);
      flashMsg(msgEl, 'No se pudo subir la portada (' + (err && err.message || 'error de conexión') + ').', false, 5000);
      return false;
    }finally{
      busyIndex = null;
      refreshCover(draft.indexOf(target));
    }
  }

  // Trae la portada que el reel ya tiene en Instagram/TikTok.
  async function usePlatformCover(i, quiet){
    const r = draft[i];
    if (!r || busyIndex !== null) return;
    const url = normalizeUrl(r.url);
    if (!hasPlatformCover(url)){
      if (!quiet) flashMsg(msgEl, 'Pega primero el enlace del reel de Instagram o TikTok.', false, 4000);
      return;
    }
    const platform = platformName(url);
    busyIndex = i;
    busyText = 'Trayendo la de ' + platform + '…';
    refreshCover(i);
    let file = null;
    try{
      const res = await fetch('/api/reel-cover?url=' + encodeURIComponent(url));
      if (res.ok){
        const blob = await res.blob();
        if (/^image\//.test(blob.type)) file = new File([blob], 'portada-' + platform.toLowerCase() + '.jpg', { type: blob.type });
      }
    }catch(err){
      file = null;
    }
    busyIndex = null;
    refreshCover(draft.indexOf(r));
    if (!file){
      flashMsg(msgEl, 'No se pudo traer la portada de ' + platform + ' (¿el reel es público y el enlace está bien?). Puedes subir una con «Subir otra».', false, 6000);
      return;
    }
    await setCoverFromFile(draft.indexOf(r), file, 'platform');
  }

  function pickCover(i){
    if (busyIndex !== null || !fileInput || !draft[i]) return;
    pendingIndex = i;
    fileInput.click();
  }

  // Al pegar/escribir un enlace de Instagram o TikTok en un reel que aún
  // no tiene portada, se trae la de la red sola (un momento después de
  // dejar de escribir, y una sola vez por enlace).
  let autoTimer = null;
  function scheduleAutoCover(i){
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      const r = draft[i];
      if (!r || r.cover || busyIndex !== null) return;
      const url = normalizeUrl(r.url);
      if (!hasPlatformCover(url) || !reelEmbed(url) || autoTried.has(url)) return;
      autoTried.add(url);
      usePlatformCover(i, true);
    }, 700);
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
        // La miniatura de YouTube y el botón "La de Instagram/TikTok"
        // dependen del enlace: se actualizan al momento.
        if (busyIndex !== i) refreshCover(i);
        scheduleAutoCover(i);
      }
    });

    listEl.addEventListener('click', (e) => {
      const moveBtn = e.target.closest('.pair-editor-move');
      if (moveBtn){
        const i = Number(moveBtn.closest('.cat-editor-item').dataset.index);
        const j = moveBtn.dataset.dir === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= draft.length || busyIndex !== null) return;
        [draft[i], draft[j]] = [draft[j], draft[i]];
        renderEditor();
        return;
      }
      const removeBtn = e.target.closest('.cat-editor-remove');
      if (removeBtn){
        if (busyIndex !== null) return;
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
        tagBtn.classList.toggle('is-active', !!draft[i][tag]);
        tagBtn.setAttribute('aria-pressed', draft[i][tag] ? 'true' : 'false');
        return;
      }
      const optBtn = e.target.closest('.reel-cover-opt');
      if (optBtn){
        const i = Number(optBtn.closest('.cat-editor-item').dataset.index);
        if (optBtn.dataset.cover === 'platform') usePlatformCover(i, false);
        else pickCover(i);
        return;
      }
      const coverRemove = e.target.closest('.reel-editor-cover-remove');
      if (coverRemove){
        const i = Number(coverRemove.closest('.cat-editor-item').dataset.index);
        if (!draft[i] || busyIndex !== null) return;
        draft[i].cover = null;
        draft[i].coverSource = null;
        refreshCover(i);
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
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      const i = pendingIndex;
      fileInput.value = '';
      pendingIndex = null;
      if (!file || i === null || !draft[i]) return;
      setCoverFromFile(i, file, 'custom');
    });
  }

  if (addBtn){
    addBtn.addEventListener('click', () => {
      draft.push({ id: 'reel-' + Date.now() + '-' + Math.floor(Math.random() * 1000), title: '', url: '', cover: null, coverSource: null });
      renderEditor();
      // Primero el enlace: al pegarlo se trae sola la portada.
      const inputs = listEl ? listEl.querySelectorAll('.cat-editor-link') : [];
      const last = inputs[inputs.length - 1];
      if (last){ last.focus(); }
    });
  }

  if (saveBtn){
    saveBtn.addEventListener('click', async () => {
      if (busyIndex !== null){
        flashMsg(msgEl, 'Espera a que termine de ponerse la portada.', false);
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
          coverSource: r.cover ? (r.coverSource === 'platform' ? 'platform' : 'custom') : null,
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
      // Mientras llega una portada no se pisa el borrador con lo que
      // llegue de la nube: se perdería la portada en curso.
      if (busyIndex === null) fillEditor();
    });
  } else {
    cloudLoaded = true;
    renderPublic();
    fillEditor();
  }
})();
