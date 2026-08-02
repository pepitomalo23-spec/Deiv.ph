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
  const viewEdiciones = document.getElementById('view-ediciones');
  const viewAjustes = document.getElementById('view-ajustes');
  const sceneWrap = document.getElementById('sceneWrap');
  const sceneTitle = document.getElementById('sceneTitle');
  const sceneHint = document.getElementById('sceneHint');
  const sceneProgress = document.getElementById('sceneProgress');

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
    sceneWrap.style.display = showingResumen ? '' : 'none';
    sceneTitle.style.display = showingResumen ? '' : 'none';
    sceneHint.style.display = showingResumen ? '' : 'none';
    if (sceneProgress) sceneProgress.style.display = showingResumen ? '' : 'none';

    viewSobreMi.classList.toggle('active', view === 'sobre-mi');
    viewEdiciones.classList.toggle('active', view === 'ediciones');
    viewAjustes.classList.toggle('active', view === 'ajustes');

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
