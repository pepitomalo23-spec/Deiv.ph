(function(){
  const tabs = Array.from(document.querySelectorAll('#ajustesTabs .ajustes-tab'));
  const panels = Array.from(document.querySelectorAll('#view-ajustes .ajustes-panel'));

  function activateTab(target){
    tabs.forEach(t => {
      const isActive = t.dataset.tab === target;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    panels.forEach(p => p.classList.toggle('active', p.dataset.panel === target));
    // En móvil las pestañas son una fila deslizable: se desplaza SOLO esa
    // fila (no la página) para que la pestaña activa quede a la vista.
    const active = tabs.find(t => t.dataset.tab === target);
    const bar = active && active.parentElement;
    if (bar && bar.scrollWidth > bar.clientWidth){
      const left = active.offsetLeft - (bar.clientWidth - active.offsetWidth) / 2;
      bar.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => activateTab(tab.dataset.tab));
  });

  window.setAjustesTab = activateTab;

  // Deslizadores de Ajustes (p. ej. "Encuadre"): la parte ya recorrida de
  // la pista se pinta en cian vía --range-fill (ver input[type="range"]
  // en styles.css). Se actualiza al moverlos y cuando los editores vuelven
  // a pintar sus filas.
  const view = document.getElementById('view-ajustes');
  if (view){
    const paint = r => {
      const min = Number(r.min) || 0, max = Number(r.max) || 100;
      r.style.setProperty('--range-fill', ((Number(r.value) - min) / (max - min || 1) * 100) + '%');
    };
    const paintAll = () => view.querySelectorAll('input[type="range"]').forEach(paint);
    view.addEventListener('input', e => { if (e.target.matches('input[type="range"]')) paint(e.target); });
    new MutationObserver(paintAll).observe(view, { childList:true, subtree:true });
    paintAll();
  }
})();
