// ---------- "Proyectos en YouTube" ----------
// Sección fija dentro de #afterStoryHeader, justo debajo del comparador
// antes/después (ver #youtubeSection en index.html). Cada entrada es
// { id, title, url }: la miniatura se saca automáticamente del propio
// enlace de YouTube (getYoutubeThumb), no hace falta subir ninguna foto.
// Al tocar una tarjeta se abre el vídeo real en YouTube en una pestaña
// nueva (target="_blank").
//
// Dato guardado en Firestore: youtubeVideos = [
//   { id, title, url }, ...
// ]
// Mismo patrón de "borrador + Guardar/Restablecer" que ya usan el
// comparador de parejas y las categorías de "Proyectos" (ver
// comparison-pairs.js / project-categories.js), para que editar varias
// entradas seguidas no dispare un guardado en la nube por cada letra.
(function(){
  const PLAY_ICON = '<svg viewBox="0 0 68 48" xmlns="http://www.w3.org/2000/svg"><path d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55C3.98 2.33 2.27 4.81 1.49 7.74.07 13.05 0 24 0 24s.07 10.95 1.49 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.93 34.95 68 24 68 24s-.07-10.95-1.48-16.26z" fill="rgba(0,0,0,0.75)"/><path d="M45 24 27 14v20" fill="#fff"/></svg>';

  // ================= Miniatura automática a partir del enlace =================
  // Cubre los formatos más comunes de enlace de YouTube:
  //   https://www.youtube.com/watch?v=ID
  //   https://youtu.be/ID
  //   https://www.youtube.com/shorts/ID
  //   https://www.youtube.com/embed/ID
  //   https://www.youtube.com/live/ID
  // hqdefault siempre existe para cualquier vídeo (a diferencia de
  // maxresdefault, que solo se genera para algunos); de ahí que se use
  // como tamaño por defecto, un buen equilibrio entre nitidez y peso.
  function getYoutubeId(url){
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{6,})/,
      /youtu\.be\/([\w-]{6,})/,
      /youtube\.com\/(?:shorts|embed|live)\/([\w-]{6,})/
    ];
    for (const re of patterns){
      const m = String(url).match(re);
      if (m) return m[1];
    }
    return null;
  }
  function getYoutubeThumb(url){
    const id = getYoutubeId(url);
    return id ? ('https://img.youtube.com/vi/' + id + '/hqdefault.jpg') : null;
  }
  window.getYoutubeThumb = getYoutubeThumb;

  // ================= Vista pública =================
  let currentVideos = [];
  // Igual que en project-categories.js: distingue "todavía no ha
  // respondido la nube" de "ya respondió y, de verdad, no hay ningún
  // vídeo guardado", para no mostrar el estado vacío de golpe mientras
  // Firestore todavía está cargando.
  let cloudLoaded = false;

  const sectionEl = document.getElementById('youtubeSection');
  // Portada única + botón "Ver todos" (sobre la escena, dentro de
  // #afterStoryHeader): sustituye a la cuadrícula completa que antes
  // vivía aquí mismo.
  const coverEl = document.getElementById('youtubeCover');
  const coverThumbEl = document.getElementById('youtubeCoverThumb');
  const coverTitleEl = document.getElementById('youtubeCoverTitle');
  const seeAllBtn = document.getElementById('youtubeSeeAllBtn');
  // Cuadrícula completa: ahora vive en su propia página (#view-mis-videos),
  // a la que lleva el botón "Ver todos los vídeos" de arriba.
  const gridFullEl = document.getElementById('youtubeGridFull');

  function renderPublic(){
    if (!coverEl && !gridFullEl) return;
    // Mismo criterio que renderCatButtonsPublic (project-categories.js):
    // mientras la nube no ha respondido todavía se deja visible por
    // defecto (para no ocultar de golpe una sección que sí tiene vídeos
    // guardados); solo se oculta del todo una vez confirmado que, de
    // verdad, no hay ninguno.
    if (sectionEl) sectionEl.style.display = (!cloudLoaded || currentVideos.length) ? '' : 'none';
    if (!cloudLoaded || !currentVideos.length){
      if (coverThumbEl) coverThumbEl.style.backgroundImage = '';
      if (coverTitleEl) coverTitleEl.textContent = '';
      if (coverEl) coverEl.setAttribute('href', '#');
      if (gridFullEl) gridFullEl.innerHTML = '';
      return;
    }

    // La portada siempre muestra el PRIMER vídeo de la lista (el orden
    // se controla desde el mismo editor de Ajustes, con las flechas
    // ↑/↓ que ya existían) y, al tocarla, abre ese vídeo real en
    // YouTube -igual que hacía antes cualquier tarjeta de la cuadrícula.
    const first = currentVideos[0];
    const firstThumb = getYoutubeThumb(first.url);
    if (coverThumbEl){
      coverThumbEl.style.backgroundImage = firstThumb ? "url('" + firstThumb + "')" : '';
    }
    if (coverTitleEl) coverTitleEl.textContent = first.title || '';
    if (coverEl) coverEl.setAttribute('href', first.url || '#');

    if (gridFullEl){
      gridFullEl.innerHTML = currentVideos.map(v => {
        const thumb = getYoutubeThumb(v.url);
        const bg = thumb ? 'background-image:url(\'' + escapeAttr(thumb) + '\');' : '';
        return (
          '<a class="youtube-card" href="' + escapeAttr(v.url || '#') + '" target="_blank" rel="noopener">' +
            '<div class="youtube-card-thumb" style="' + bg + '">' +
              '<span class="youtube-card-play" aria-hidden="true">' + PLAY_ICON + '</span>' +
            '</div>' +
            '<p class="youtube-card-title">' + escapeHtml(v.title || 'Sin título') + '</p>' +
          '</a>'
        );
      }).join('');
    }
  }

  // Botón "Ver todos los vídeos": lleva a la página propia con la
  // cuadrícula completa (#view-mis-videos), usando el mismo sistema de
  // navegación entre vistas que "Sobre mí"/"Ajustes" (ver goToView en
  // view-navigation.js).
  if (seeAllBtn){
    seeAllBtn.addEventListener('click', () => {
      if (typeof window.goToView === 'function') window.goToView('mis-videos');
    });
  }

  // ================= Editor en Ajustes → YouTube =================
  const ytListEl = document.getElementById('ytEditorList');
  const ytEmptyEl = document.getElementById('ytEditorEmpty');
  const ytAddBtn = document.getElementById('ytAddBtn');
  const ytSaveBtn = document.getElementById('ytGuardarBtn');
  const ytResetBtn = document.getElementById('ytResetBtn');
  const ytMsgEl = document.getElementById('ytMsg');

  let ytDraft = [];

  function renderYtEditor(){
    if (!ytListEl) return;
    const last = ytDraft.length - 1;
    ytListEl.innerHTML = ytDraft.map((v, i) => (
      '<div class="cat-editor-item" data-index="' + i + '">' +
        '<div class="cat-editor-item-head">' +
          '<input type="text" class="cat-editor-name" value="' + escapeAttr(v.title) + '" placeholder="Título del vídeo">' +
          '<div class="pair-editor-actions">' +
            '<button type="button" class="pair-editor-move" data-dir="up" ' + (i === 0 ? 'disabled' : '') + ' aria-label="Mover vídeo hacia arriba">↑</button>' +
            '<button type="button" class="pair-editor-move" data-dir="down" ' + (i === last ? 'disabled' : '') + ' aria-label="Mover vídeo hacia abajo">↓</button>' +
            '<button type="button" class="cat-editor-remove" aria-label="Quitar vídeo">×</button>' +
          '</div>' +
        '</div>' +
        '<input type="url" class="cat-editor-link" value="' + escapeAttr(v.url) + '" placeholder="Enlace del vídeo en YouTube">' +
      '</div>'
    )).join('');
    if (ytEmptyEl) ytEmptyEl.style.display = ytDraft.length ? 'none' : '';
  }

  function fillYtEditor(){
    ytDraft = currentVideos.map(v => Object.assign({}, v));
    renderYtEditor();
  }

  if (ytListEl){
    ytListEl.addEventListener('input', (e) => {
      const row = e.target.closest('.cat-editor-item');
      if (!row) return;
      const i = Number(row.dataset.index);
      if (!ytDraft[i]) return;
      if (e.target.classList.contains('cat-editor-name')){
        ytDraft[i].title = e.target.value;
      } else if (e.target.classList.contains('cat-editor-link')){
        ytDraft[i].url = e.target.value;
      }
    });

    ytListEl.addEventListener('click', (e) => {
      const moveBtn = e.target.closest('.pair-editor-move');
      if (moveBtn){
        const row = moveBtn.closest('.cat-editor-item');
        const i = Number(row.dataset.index);
        const j = moveBtn.dataset.dir === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= ytDraft.length) return;
        [ytDraft[i], ytDraft[j]] = [ytDraft[j], ytDraft[i]];
        renderYtEditor();
        return;
      }
      const removeBtn = e.target.closest('.cat-editor-remove');
      if (removeBtn){
        const row = removeBtn.closest('.cat-editor-item');
        const i = Number(row.dataset.index);
        ytDraft.splice(i, 1);
        renderYtEditor();
      }
    });
  }

  if (ytAddBtn){
    ytAddBtn.addEventListener('click', () => {
      ytDraft.push({ id: 'yt-' + Date.now() + '-' + Math.floor(Math.random() * 1000), title: '', url: '' });
      renderYtEditor();
      const inputs = ytListEl ? ytListEl.querySelectorAll('.cat-editor-name') : [];
      const last = inputs[inputs.length - 1];
      if (last){ last.focus(); }
    });
  }

  if (ytSaveBtn){
    ytSaveBtn.addEventListener('click', async () => {
      // Fuera los vídeos que se quedaron sin enlace real (no tendría
      // sentido guardar una tarjeta que no lleva a ningún sitio); un
      // título vacío, en cambio, se deja pasar con un texto de repuesto.
      const cleaned = ytDraft
        .filter(v => (v.url || '').trim())
        .map(v => ({
          id: v.id || ('yt-' + Date.now()),
          title: (v.title || '').trim() || 'Sin título',
          url: (v.url || '').trim()
        }));
      if (!window.CloudDB){
        flashMsg(ytMsgEl, 'No se pudo guardar: la conexión con la nube no está lista.', false);
        return;
      }
      ytSaveBtn.disabled = true;
      try{
        await window.CloudDB.updateContent({ youtubeVideos: cleaned });
        flashMsg(ytMsgEl, cleaned.length ? 'Vídeos guardados.' : 'Guardado: no hay ningún vídeo.', true);
        window.CloudDB.logHistory('Proyectos en YouTube editados', cleaned.map(v => v.title).join(', ') || 'Lista vacía');
      }catch(err){
        console.error('No se pudieron guardar los vídeos:', err && err.message || err);
        flashMsg(ytMsgEl, 'No se pudo guardar (' + (err && err.message || 'error de conexión') + ').', false);
      }finally{
        ytSaveBtn.disabled = false;
      }
    });
  }

  if (ytResetBtn){
    ytResetBtn.addEventListener('click', async () => {
      if (!window.CloudDB){
        flashMsg(ytMsgEl, 'No se pudo restablecer: la conexión con la nube no está lista.', false);
        return;
      }
      if (!confirm('¿Quitar todos los vídeos? Esta acción no se puede deshacer.')) return;
      ytResetBtn.disabled = true;
      try{
        await window.CloudDB.updateContent({ youtubeVideos: [] });
        flashMsg(ytMsgEl, 'Restablecido: no hay ningún vídeo.', true);
        window.CloudDB.logHistory('Proyectos en YouTube restablecidos', '');
      }catch(err){
        console.error('No se pudieron restablecer los vídeos:', err && err.message || err);
        flashMsg(ytMsgEl, 'No se pudo restablecer (' + (err && err.message || 'error de conexión') + ').', false);
      }finally{
        ytResetBtn.disabled = false;
      }
    });
  }

  // ================= Suscripción a la nube =================
  if (window.CloudDB){
    window.CloudDB.onContentChange((data, loaded) => {
      cloudLoaded = !!loaded;
      currentVideos = Array.isArray(data.youtubeVideos) ? data.youtubeVideos : [];
      renderPublic();
      fillYtEditor();
    });
  } else {
    cloudLoaded = true; // sin CloudDB no hay nube que esperar, no hay "cargando" que respetar
    renderPublic();
    fillYtEditor();
  }
})();
