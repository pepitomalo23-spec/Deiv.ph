// ---------- Bloqueo de zoom (refuerzo en JS) ----------
// El viewport (maximum-scale=1, user-scalable=no) y el touch-action:pan-y
// del CSS ya bastan en la inmensa mayoría de navegadores móviles. Este
// bloque es solo un remate para los casos que los ignoran (algunas
// versiones de Chrome/Android por accesibilidad, Safari con el gesto de
// "pellizco" del sistema, o un trackpad/rueda con Ctrl en escritorio):
// nunca cambia el tamaño de nada, solo impide que el navegador amplíe.
(function(){
  // Pellizco con dos dedos en iOS Safari (evento propio de WebKit,
  // no pasa por touch-action porque es un gesto "de sistema").
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((evt) => {
    document.addEventListener(evt, (e) => e.preventDefault(), { passive: false });
  });

  // Segundo dedo en pantalla (pellizco) en cualquier navegador que no
  // respete touch-action:pan-y del todo.
  document.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  // Doble toque para ampliar: si dos toques caen a menos de 350ms uno
  // de otro, se descarta el segundo antes de que el navegador lo
  // interprete como "double tap to zoom".
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 350) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });

  // Pellizco con trackpad / Ctrl+rueda en Chrome, Edge y Firefox de
  // escritorio (disparan 'wheel' con ctrlKey a true).
  document.addEventListener('wheel', (e) => {
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });

  // Atajos de teclado de zoom (Ctrl/Cmd + '+', '-', '0').
  document.addEventListener('keydown', (e) => {
    const zoomKey = (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0');
    if ((e.ctrlKey || e.metaKey) && zoomKey) e.preventDefault();
  }, { passive: false });
})();
