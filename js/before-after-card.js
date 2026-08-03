(function(){
  // ---- Función compartida: monta el arrastre del tirador de una copia
  // del comparador (frame + clip + handle), dado un getter de posición
  // inicial. La usan las tarjetas de la galería "Mis ediciones". ----
  function crearComparador(frame, clip, handle){
    let pos = 50;
    function setPos(p){
      pos = Math.max(0, Math.min(100, p));
      // clip-path en vez de "width": el recuadro de recorte mantiene
      // siempre el tamaño completo del comparador (ambas fotos, la de
      // "antes" y la de "después", se quedan centradas y sin encogerse);
      // lo único que cambia es cuánto se ve de cada una a cada lado del
      // tirador.
      //
      // FIX: antes se revelaba "editada" desde la IZQUIERDA (creciendo
      // hacia la derecha), al revés que las etiquetas fijas de la tarjeta
      // (SIN EDITAR a la izquierda, EDITADA a la derecha, ver
      // .ba-card-label--before/--after en styles.css) -las dos fotos
      // aparecían intercambiadas respecto a lo que decían las etiquetas-.
      // Ahora se revela desde la DERECHA: a la izquierda del tirador se ve
      // "sin editar" (la capa base, sin recortar) y a la derecha "editada"
      // (la capa recortada), tal cual anuncian las etiquetas.
      clip.style.clipPath = `inset(0 0 0 ${pos}%)`;
      handle.style.left = pos + '%';
      handle.setAttribute('aria-valuenow', String(Math.round(pos)));
    }
    setPos(50);
    let dragging = false;
    function posFromClientX(clientX){
      const rect = frame.getBoundingClientRect();
      if (!rect.width) return pos;
      return ((clientX - rect.left) / rect.width) * 100;
    }
    function onPointerDown(e){
      dragging = true;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      setPos(posFromClientX(clientX));
    }
    function onPointerMove(e){
      if (!dragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      setPos(posFromClientX(clientX));
      e.preventDefault();
    }
    function onPointerUp(){ dragging = false; }
    frame.addEventListener('mousedown', onPointerDown);
    frame.addEventListener('touchstart', onPointerDown, { passive:true });
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('touchmove', onPointerMove, { passive:false });
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchend', onPointerUp);
    handle.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft'){ setPos(pos - 5); e.preventDefault(); }
      else if (e.key === 'ArrowRight'){ setPos(pos + 5); e.preventDefault(); }
    });
  }

  // ================= -1) Flechas del comparador de la 4ª posición =================
  // Navega entre VARIAS parejas antes/después dentro de la misma tarjeta
  // (#asBaGallery): las flechas solo cambian qué imágenes se muestran en
  // el recuadro; el arrastre para comparar cada pareja lo sigue llevando
  // crearComparador (ver más abajo), sin tocarlo. De momento son
  // degradados de muestra -sustitúyelos por tus fotos reales cambiando
  // "before"/"after" de cada objeto de ASE_PAIRS por la URL que quieras-.
  // Las parejas de este carrusel ahora se gestionan desde Ajustes → Mis
  // ediciones (con fotos reales, no degradados de muestra) y se guardan en
  // la nube: ver el bloque "Mis ediciones: categorías con foto + parejas
  // antes/después" más abajo, que rellena #asBaBefore/#asBaAfter y engancha
  // #asBaPrev/#asBaNext.

  // ================= 0) Galería de comparaciones "Mis ediciones" =================
  // Cada .ba-card de la vista "Ediciones" se engancha con la misma lógica
  // de arrastre que el comparador de la portada (crearComparador), pero
  // de forma independiente: no depende de CloudDB ni del panel de
  // Ajustes, solo necesita su propio frame/clip/handle dentro de la
  // tarjeta.
  (function(){
    document.querySelectorAll('#baGallery .ba-card, #asBaGallery .ba-card').forEach(card => {
      const frame = card.querySelector('.ba-card-frame');
      const clip = card.querySelector('.ba-card-after-clip');
      const handle = card.querySelector('.ba-card-handle');
      if (!frame || !clip || !handle) return;
      handle.setAttribute('tabindex', '0');
      handle.setAttribute('role', 'slider');
      handle.setAttribute('aria-label', 'Deslizar para comparar antes y después');
      handle.setAttribute('aria-valuemin', '0');
      handle.setAttribute('aria-valuemax', '100');
      crearComparador(frame, clip, handle);
    });
  })();

})();
