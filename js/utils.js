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
 * Si la URL es una foto de Cloudinary, le añade una transformación "al
 * vuelo" (mismo servidor, misma foto, sin subir nada de nuevo) para que
 * el navegador descargue una versión mucho más ligera en vez del
 * original a tamaño completo:
 *   - f_auto: el formato más liviano que soporte el navegador (WebP/AVIF)
 *   - q_auto: calidad automática, recortando peso sin que se note
 *   - w_<maxWidth>: nunca más ancha de lo que realmente se va a ver
 * Si la URL no es de Cloudinary (por ejemplo el respaldo local en
 * Firestore cuando Cloudinary no está configurado), se devuelve tal cual,
 * sin tocarla.
 */
function optimizeCloudinaryUrl(url, maxWidth) {
  if (!url || typeof url !== 'string') return url;
  const marker = '/upload/';
  const idx = url.indexOf(marker);
  if (url.indexOf('res.cloudinary.com') === -1 || idx === -1) return url;
  const w = maxWidth ? ',w_' + Math.round(maxWidth) : '';
  const transform = 'f_auto,q_auto' + w;
  return url.slice(0, idx + marker.length) + transform + '/' + url.slice(idx + marker.length);
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
    // Prioridad alta: que el navegador la descargue antes que recursos
    // menos urgentes (fuentes, imágenes fuera de pantalla...), para que
    // esté lista lo antes posible. Los navegadores que no soportan
    // fetchPriority simplemente ignoran la propiedad, sin error.
    try { img.fetchPriority = 'high'; } catch(e){}
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
