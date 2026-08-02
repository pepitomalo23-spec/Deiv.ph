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
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => activateTab(tab.dataset.tab));
  });

  window.setAjustesTab = activateTab;
})();
