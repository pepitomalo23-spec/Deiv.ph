// ---------- Utilidades compartidas ----------
// Antes vivían copiadas (y ligeramente desincronizadas) dentro de
// camera-carousel.js, category-view.js, comparison-pairs.js,
// about-collage.js, account-panel.js y editable-texts.js.
// Se cargan aquí una sola vez, antes que el resto de módulos.

/**
 * Escapa texto para insertarlo como contenido HTML seguro (previene XSS).
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

/**
 * Escapa texto para insertarlo dentro de un atributo HTML entre comillas dobles.
 */
function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}

/**
 * Muestra un mensaje de estado temporal (éxito/error) sobre un elemento,
 * usado en los distintos paneles de Ajustes.
 */
function flashMsg(el, text, ok, duration = 2600) {
  if (!el) return;
  el.textContent = text;
  el.classList.remove('cuenta-msg--ok', 'cuenta-msg--err');
  el.classList.add(ok ? 'cuenta-msg--ok' : 'cuenta-msg--err', 'visible');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('visible'), duration);
}
