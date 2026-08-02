(function(){
  const DEFAULT_CATEGORIES = [
    { id:'bodas', label:'Bodas', icon:'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="13" r="6"></circle><circle cx="16" cy="13" r="6"></circle><path d="M12 3.2 9.6 6.6"></path></svg>' },
    { id:'festivales', label:'Festivales', icon:'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 21V11.5C4 8.5 6.5 6 9.5 6h5C17.5 6 20 8.5 20 11.5V21"></path><path d="M4 21h16"></path><path d="M9 6V4.5A2.5 2.5 0 0 1 11.5 2h1A2.5 2.5 0 0 1 15 4.5V6"></path><path d="M9 13h6"></path></svg>' },
    { id:'deportivos', label:'Deportivos', icon:'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"></path><path d="M7 5H4a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4"></path><path d="M17 5h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4"></path><path d="M12 14v4"></path><path d="M8.5 21.5h7"></path><path d="M9.5 18h5l1 3.5h-7l1-3.5Z"></path></svg>' },
    { id:'retratos', label:'Retratos', icon:'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7H8l1.2-2h5.6L16 7h3.5A1.5 1.5 0 0 1 21 8.5v10A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5v-10Z"></path><circle cx="12" cy="13" r="3.4"></circle></svg>' }
  ];
  // Icono genérico para cualquier botón nuevo que se añada desde Ajustes
  // (no hace falta elegir un icono distinto cada vez).
  const GENERIC_ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3v18M3 12h18"></path></svg>';

  const navEl = document.getElementById('categoryButtons');
  const catTitulo = document.getElementById('categoriaTitulo');
  const catLead = document.getElementById('categoriaLead');

  let currentList = DEFAULT_CATEGORIES.map(c => Object.assign({}, c));

  function escapeHtml(s){
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function slugify(s){
    const base = (s || '').toString().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return base || ('cat-' + Date.now());
  }

  // ---- Botones públicos (portada) ----
  function renderPublicButtons(list){
    if (!navEl) return;
    navEl.innerHTML = list.map(c => (
      '<button type="button" class="category-btn" data-cat-id="' + escapeHtml(c.id) + '">' +
        '<span class="cat-icon">' + (c.icon || GENERIC_ICON) + '</span>' +
        '<span>' + escapeHtml(c.label) + '</span>' +
        '<span class="cat-arrow">→</span>' +
      '</button>'
    )).join('');
  }

  if (navEl){
    navEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.category-btn');
      if (!btn) return;
      const item = currentList.find(c => c.id === btn.dataset.catId);
      if (!item) return;
      if (catTitulo) catTitulo.textContent = item.label;
      if (catLead) catLead.textContent = 'Una selección de trabajos de ' + item.label.toLowerCase() + '.';
      if (typeof window.goToView === 'function') window.goToView('categoria');
    });
  }

  // ---- Editor (Ajustes → Categorías) ----
  const listEl = document.getElementById('catEditorList');
  const emptyEl = document.getElementById('catEditorEmpty');
  const addBtn = document.getElementById('catAddBtn');
  const saveBtn = document.getElementById('catGuardarBtn');
  const resetBtn = document.getElementById('catResetBtn');
  const msgEl = document.getElementById('catMsg');

  let editorDraft = [];

  function renderEditor(){
    if (!listEl) return;
    listEl.innerHTML = editorDraft.map((c, i) => (
      '<div class="cat-editor-item" data-index="' + i + '">' +
        '<input type="text" class="cat-editor-label" value="' + escapeHtml(c.label) + '" placeholder="Nombre del botón (ej. Bodas)">' +
        '<button type="button" class="cat-editor-remove" aria-label="Quitar botón">×</button>' +
      '</div>'
    )).join('');
    if (emptyEl) emptyEl.style.display = editorDraft.length ? 'none' : '';
  }

  function fillEditor(){
    editorDraft = currentList.map(c => Object.assign({}, c));
    renderEditor();
  }

  if (listEl){
    listEl.addEventListener('input', (e) => {
      const row = e.target.closest('.cat-editor-item');
      if (!row) return;
      const i = Number(row.dataset.index);
      if (e.target.classList.contains('cat-editor-label') && editorDraft[i]){
        editorDraft[i].label = e.target.value;
      }
    });
    listEl.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.cat-editor-remove');
      if (!removeBtn) return;
      const row = removeBtn.closest('.cat-editor-item');
      const i = Number(row.dataset.index);
      editorDraft.splice(i, 1);
      renderEditor();
    });
  }

  if (addBtn){
    addBtn.addEventListener('click', () => {
      editorDraft.push({ id: 'cat-' + Date.now() + '-' + Math.floor(Math.random() * 1000), label: 'Nueva categoría', icon: GENERIC_ICON });
      renderEditor();
      const inputs = listEl ? listEl.querySelectorAll('.cat-editor-label') : [];
      const last = inputs[inputs.length - 1];
      if (last){ last.focus(); last.select(); }
    });
  }

  function flashMsg(text, ok){
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.classList.remove('cuenta-msg--ok', 'cuenta-msg--err');
    msgEl.classList.add(ok ? 'cuenta-msg--ok' : 'cuenta-msg--err', 'visible');
    clearTimeout(msgEl._t);
    msgEl._t = setTimeout(() => msgEl.classList.remove('visible'), 2600);
  }

  if (saveBtn){
    saveBtn.addEventListener('click', async () => {
      const cleaned = editorDraft.map(c => ({
        id: c.id || slugify(c.label),
        label: (c.label || '').trim() || 'Sin nombre',
        icon: c.icon || GENERIC_ICON
      }));
      if (!window.CloudDB){
        flashMsg('No se pudo guardar: la conexión con la nube no está lista.', false);
        return;
      }
      saveBtn.disabled = true;
      try{
        await window.CloudDB.updateContent({ categoryButtons: cleaned });
        flashMsg(cleaned.length ? 'Botones guardados.' : 'Guardado: no se muestra ningún botón en la portada.', true);
        window.CloudDB.logHistory('Botones de categorías editados', cleaned.map(c => c.label).join(', ') || 'Lista vacía');
      }catch(err){
        console.error('No se pudo guardar los botones de categorías:', err && err.message || err);
        flashMsg('No se pudo guardar (' + (err && err.message || 'error de conexión') + ').', false);
      }finally{
        saveBtn.disabled = false;
      }
    });
  }

  if (resetBtn){
    resetBtn.addEventListener('click', async () => {
      if (!window.CloudDB){
        flashMsg('No se pudo restablecer: la conexión con la nube no está lista.', false);
        return;
      }
      resetBtn.disabled = true;
      try{
        await window.CloudDB.updateContent({ categoryButtons: DEFAULT_CATEGORIES });
        flashMsg('Botones restablecidos a los 4 originales.', true);
        window.CloudDB.logHistory('Botones de categorías restablecidos', 'Se volvió a Bodas, Festivales, Deportivos, Retratos');
      }catch(err){
        console.error('No se pudo restablecer los botones de categorías:', err && err.message || err);
        flashMsg('No se pudo restablecer (' + (err && err.message || 'error de conexión') + ').', false);
      }finally{
        resetBtn.disabled = false;
      }
    });
  }

  if (window.CloudDB){
    window.CloudDB.onContentChange(data => {
      const cloudList = Array.isArray(data.categoryButtons) && data.categoryButtons.length
        ? data.categoryButtons
        : DEFAULT_CATEGORIES;
      currentList = cloudList.map(c => ({ id: c.id, label: c.label, icon: c.icon }));
      renderPublicButtons(currentList);
      fillEditor();
    });
  } else {
    renderPublicButtons(currentList);
    fillEditor();
  }
})();
