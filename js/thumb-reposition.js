function attachThumbReposition(imgEl, getPos, setPos){
  const wrap = imgEl.closest('.ajustes-thumb');
  if (!wrap) return;
  let dragging = false;
  let startY = 0;
  let startPos = 50;

  function clamp(v){ return Math.max(0, Math.min(100, v)); }
  function apply(pos){ imgEl.style.objectPosition = `center ${pos}%`; }

  apply(getPos());

  function onDown(e){
    dragging = true;
    startY = e.clientY;
    startPos = getPos();
    wrap.classList.add('is-dragging');
    try{ imgEl.setPointerCapture(e.pointerId); }catch(err){}
    e.preventDefault();
  }
  function onMove(e){
    if (!dragging) return;
    const h = wrap.getBoundingClientRect().height || 1;
    const dy = e.clientY - startY;
    const pos = clamp(startPos - (dy / h) * 100);
    apply(pos);
  }
  function onUp(e){
    if (!dragging) return;
    dragging = false;
    wrap.classList.remove('is-dragging');
    const h = wrap.getBoundingClientRect().height || 1;
    const dy = e.clientY - startY;
    const pos = clamp(startPos - (dy / h) * 100);
    setPos(pos);
  }

  imgEl.addEventListener('pointerdown', onDown);
  imgEl.addEventListener('pointermove', onMove);
  imgEl.addEventListener('pointerup', onUp);
  imgEl.addEventListener('pointercancel', onUp);
}
window.attachThumbReposition = attachThumbReposition;

/* Arrastre LIBRE (horizontal + vertical) para recuadros con imagen de
   fondo (background-image), en vez de un <img> con object-position.
   Se usa en el editor de "Proyectos" (galería que se expande, ver
   comparison-pairs.js): el propio recuadro de vista previa -que ya
   muestra el mismo recorte que se ve en la web- se convierte en el
   control de encuadre: se coge la foto con la mano y se mueve
   libremente hasta donde se quiera, sin deslizadores aparte.
   Distingue un TOQUE (sin apenas movimiento) de un ARRASTRE real: por
   debajo de TAP_THRESHOLD px se considera un toque y dispara onTap (se
   usa para poder seguir tocando el recuadro para cambiar la foto),
   por encima se considera arrastre y mueve el encuadre en su lugar. */
function attachFreeReposition(boxEl, getPos, setPos, onTap){
  const TAP_THRESHOLD = 6;
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let startPos = { x: 50, y: 50 };

  function clamp(v){ return Math.max(0, Math.min(100, v)); }
  function apply(pos){ boxEl.style.backgroundPosition = `${pos.x}% ${pos.y}%`; }
  function posAt(e){
    const rect = boxEl.getBoundingClientRect();
    const w = rect.width || 1;
    const h = rect.height || 1;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    return { x: clamp(startPos.x - (dx / w) * 100), y: clamp(startPos.y - (dy / h) * 100) };
  }

  function onDown(e){
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    startPos = getPos();
    boxEl.classList.add('is-dragging');
    try{ boxEl.setPointerCapture(e.pointerId); }catch(err){}
    e.preventDefault();
  }
  function onMove(e){
    if (!dragging) return;
    if (!moved){
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) < TAP_THRESHOLD && Math.abs(dy) < TAP_THRESHOLD) return;
      moved = true;
    }
    apply(posAt(e));
  }
  function onUp(e){
    if (!dragging) return;
    dragging = false;
    boxEl.classList.remove('is-dragging');
    if (moved){
      setPos(posAt(e));
    } else if (onTap){
      onTap();
    }
  }
  function onCancel(){
    dragging = false;
    boxEl.classList.remove('is-dragging');
  }

  boxEl.addEventListener('pointerdown', onDown);
  boxEl.addEventListener('pointermove', onMove);
  boxEl.addEventListener('pointerup', onUp);
  boxEl.addEventListener('pointercancel', onCancel);
}
window.attachFreeReposition = attachFreeReposition;
