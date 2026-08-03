// ---------- Utilidades compartidas ----------
// Antes vivían copiadas (y ligeramente desincronizadas) dentro de
// camera-carousel.js, comparison-pairs.js, about-collage.js,
// account-panel.js y editable-texts.js.
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

/**
 * Precarga una lista de URLs de imagen y resuelve cuando TODAS han
 * terminado (cargada bien o con error: un error nunca deja la promesa
 * colgada, simplemente esa imagen en concreto no bloquea nada). Se usa
 * para que la pantalla de entrada (ver scroll-engine.js) pueda esperar a
 * que las fotos que vienen de la nube (Firestore/Cloudinary: comparador
 * antes/después, carrusel de cámaras...) ya estén descargadas de verdad
 * antes de dejar ver la web, en vez de que aparezcan "a trozos" según van
 * llegando.
 */
function preloadImages(urls) {
  const list = (urls || []).filter(Boolean);
  if (!list.length) return Promise.resolve();
  return Promise.all(list.map(url => new Promise(resolve => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = resolve;
    img.src = url;
  })));
}

/**
 * Registro global de promesas que la pantalla de entrada debe esperar
 * antes de dar paso a la web (ver "waitForSiteAssets" en
 * scroll-engine.js). Cada módulo que dependa de fotos de la nube
 * (comparison-pairs.js, camera-carousel.js...) añade aquí su propia
 * promesa -que resuelve en cuanto SUS fotos están listas- con
 * registerAssetReady(). Se declara en utils.js porque se carga antes que
 * cualquier otro script.
 */
window.__assetReadyPromises = window.__assetReadyPromises || [];
function registerAssetReady(promise) {
  window.__assetReadyPromises.push(promise);
}
