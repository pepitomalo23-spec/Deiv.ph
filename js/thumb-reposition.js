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
