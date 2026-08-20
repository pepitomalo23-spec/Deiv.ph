(function(){
  const menuToggle = document.getElementById('menuToggle');
  const menuPanel = document.getElementById('menuPanel');
  const menuToast = document.getElementById('menuToast');
  const menuItems = Array.from(document.querySelectorAll('.menu-item'));
  const ajustesMenuItem = document.querySelector('.menu-item[data-view="ajustes"]');
  if (ajustesMenuItem && window.isAdminDevice){
    ajustesMenuItem.style.display = '';
  }
  document.addEventListener('admin-auth-changed', (e) => {
    if (ajustesMenuItem) ajustesMenuItem.style.display = e.detail.loggedIn ? '' : 'none';
    if (!e.detail.loggedIn && window.currentView === 'ajustes' && typeof window.goToView === 'function'){
      window.goToView('resumen');
    }
  });
  const viewSobreMi = document.getElementById('view-sobre-mi');
  const viewAjustes = document.getElementById('view-ajustes');
  // "Mis vídeos": cuadrícula completa de "Proyectos en YouTube", a la
  // que lleva el botón "Ver todos los vídeos" de la portada (ver
  // youtube-videos.js). No tiene entrada propia en el menú principal
  // -se entra solo desde ese botón-, pero se sale igual que de
  // "Sobre mí": con el mismo menú de siempre.
  const viewMisVideos = document.getElementById('view-mis-videos');
  const sceneWrap = document.getElementById('sceneWrap');
  const sceneTitle = document.getElementById('sceneTitle');
  const sceneHint = document.getElementById('sceneHint');
  const sceneProgress = document.getElementById('sceneProgress');
  // BUGFIX: estos bloques (correo/Instagram, título "Ediciones" + sus
  // botones, "Proyectos", "Mis ediciones" y el carrusel de cámaras) viven
  // FUERA de #sceneWrap, como position:fixed propios a la altura de
  // <body> (ver index.html) -por eso antes, al entrar en Ajustes o Sobre
  // mí, solo se ocultaba sceneWrap/sceneTitle/sceneHint/sceneProgress y
  // estos otros se quedaban colgados encima de esas vistas, visibles y
  // -en los que tenían pointer-events:auto propio, como el correo/
  // Instagram o los botones de categorías- también clicables, aunque no
  // tuviera sentido ahí. Se agrupan aquí para ocultarlos/mostrarlos en
  // bloque junto con el resto de la escena.
  const sceneOverlayEls = [
    document.getElementById('socialIcons'),
    document.getElementById('equipoHeader'),
    document.getElementById('proyectosHeader'),
    document.getElementById('afterStoryHeader'),
    document.getElementById('cameraCarousel')
  ].filter(Boolean);

  let toastTimer = null;

  function showToast(text){
    menuToast.textContent = text;
    menuToast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      menuToast.classList.remove('visible');
    }, 1800);
  }

  function closeMenu(){
    menuPanel.classList.remove('open');
    menuToggle.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  }

  function openMenu(){
    menuPanel.classList.add('open');
    menuToggle.classList.add('open');
    menuToggle.setAttribute('aria-expanded', 'true');
  }

  menuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menuPanel.classList.contains('open')) closeMenu(); else openMenu();
  });

  document.addEventListener('click', (e) => {
    if (menuPanel.classList.contains('open') && !menuPanel.contains(e.target) && e.target !== menuToggle){
      closeMenu();
    }
  });

  function setActiveItem(view){
    menuItems.forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  }

  function goToView(view){
    if (view === 'ajustes' && !window.isAdminDevice) view = 'resumen';
    window.currentView = view;

    // En Ajustes no debe quedar ninguna forma de volver al sitio público
    // desde dentro (ni el botón que hubo antes, ni el menú general): la
    // única puerta de entrada y salida es la URL del sitio en sí.
    if (view === 'ajustes'){
      closeMenu();
      menuToggle.style.display = 'none';
    } else {
      menuToggle.style.display = '';
    }

    const showingResumen = view === 'resumen';
    // FIX "fotos fantasma al volver de Ajustes/Sobre mí" (ver
    // resetCameraOverlayVisibility en camera-carousel.js): se resetea
    // ANTES de aplicar display:none, así la cinta del carrusel queda
    // pausada (sin margen para que su animación CSS derive mientras está
    // oculta) durante toda la ausencia.
    if (!showingResumen && typeof window.__resetCameraOverlay === 'function') window.__resetCameraOverlay();
    sceneWrap.style.display = showingResumen ? '' : 'none';
    sceneTitle.style.display = showingResumen ? '' : 'none';
    sceneHint.style.display = showingResumen ? '' : 'none';
    if (sceneProgress) sceneProgress.style.display = showingResumen ? '' : 'none';
    // BUGFIX (ver comentario junto a sceneOverlayEls más arriba): sin
    // esto, correo/Instagram, "Ediciones"+categorías, "Proyectos", "Mis
    // ediciones" y el carrusel de cámaras se quedaban visibles -y los
    // que tienen su propio pointer-events:auto, también clicables-
    // encima de Ajustes o Sobre mí. display:none los saca del todo,
    // tanto visual como de interacción, pase lo que pase con su
    // opacity/pointer-events internos (que gestiona scroll-engine.js
    // para dentro de "resumen").
    sceneOverlayEls.forEach(el => { el.style.display = showingResumen ? '' : 'none'; });

    viewSobreMi.classList.toggle('active', view === 'sobre-mi');
    viewAjustes.classList.toggle('active', view === 'ajustes');
    if (viewMisVideos) viewMisVideos.classList.toggle('active', view === 'mis-videos');

    if (!showingResumen) window.scrollTo(0, 0);
    if (!showingResumen && typeof window.__resetWhiteEnd === 'function') window.__resetWhiteEnd();

    // Al volver a mostrar la escena, nos aseguramos de que el canvas tenga
    // el tamaño correcto y el fotograma esté dibujado: si estuvo oculta y
    // hubo algún resize mientras tanto, el lienzo pudo quedarse a 0x0 (ver
    // onSceneResize) y sin esto se vería en blanco hasta el próximo scroll.
    if (showingResumen && typeof resizeCanvas === 'function' && typeof render === 'function'){
      resizeCanvas();
      render();
    }
    // Igual que resizeCanvas/render arriba: recalcula ya mismo (con
    // display:'' ya aplicado, así que las medidas son correctas) en vez
    // de esperar al próximo requestAnimationFrame del bucle interno de
    // camera-carousel.js.
    if (showingResumen && typeof window.__resyncCameraOverlayNow === 'function') window.__resyncCameraOverlayNow();

    if (view === 'ajustes' && typeof window.renderAjustesGrid === 'function'){
      window.renderAjustesGrid();
    }
    if (view === 'ajustes' && typeof window.renderAjustesCollageGrid === 'function'){
      window.renderAjustesCollageGrid();
    }
    if (view === 'sobre-mi' && typeof window.renderAboutCollage === 'function'){
      // Se reconstruye cada vez que se entra en "Sobre mí" para que la
      // animación de entrada del collage se repita al volver a la sección.
      window.renderAboutCollage();
    }

    setActiveItem(view);
  }

  window.goToView = goToView;

  menuItems.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const view = btn.dataset.view;

      if (view === 'resumen' && window.currentView === 'resumen'){
        // ya estamos aquí: solo un aviso muy suave, sin navegar
        showToast('Estás en esta sección');
        closeMenu();
        return;
      }

      goToView(view);
      closeMenu();

      if (view === 'resumen'){
        showToast('Estás en esta sección');
      }
    });
  });
})();
