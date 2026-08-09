(function(){
  const fields = {
    bodyCaption: { el: document.getElementById('bodyCaption'), input: document.getElementById('textoCaption'), label: 'Frase de la pantalla de inicio' },
    about1:  { el: document.getElementById('aboutPara1'),  input: document.getElementById('textoAbout1'), label: '"Sobre mí" — párrafo 1' },
    about2:  { el: document.getElementById('aboutPara2'),  input: document.getElementById('textoAbout2'), label: '"Sobre mí" — párrafo 2' },
    about3:  { el: document.getElementById('aboutPara3'),  input: document.getElementById('textoAbout3'), label: '"Sobre mí" — párrafo 3' },
    // Correo e Instagram (botones de la esquina inferior izquierda, ver
    // #socialIcons en index.html): a diferencia de los campos de arriba,
    // no se editan como texto visible sino como el "href" del enlace, así
    // que llevan su propio getValue/setValue en vez del textContent por
    // defecto (ver applyTexts/defaults más abajo).
    socialEmail: {
      el: document.getElementById('socialEmailLink'),
      input: document.getElementById('textoEmail'),
      label: 'Correo de contacto',
      getValue: el => (el.getAttribute('href') || '').replace(/^mailto:/i, ''),
      // Al pulsar el botón, mailto: abre directamente un correo nuevo
      // dirigido a esta dirección -es justo lo que hace el atributo
      // href="mailto:correo@..." de toda la vida, sin necesitar nada más-.
      setValue: (el, val) => { el.setAttribute('href', 'mailto:' + (val || '').trim()); }
    },
    socialInstagram: {
      el: document.getElementById('socialInstagramLink'),
      input: document.getElementById('textoInstagram'),
      label: 'Instagram',
      getValue: el => el.getAttribute('href') || '',
      // Admite que se escriba solo el usuario (con o sin @) o ya la URL
      // completa; en ambos casos se guarda como un enlace completo y
      // válido en el href.
      setValue: (el, val) => {
        let v = (val || '').trim();
        if (!v) return;
        if (!/^https?:\/\//i.test(v)){
          v = v.replace(/^@/, '').replace(/^instagram\.com\//i, '');
          v = 'https://instagram.com/' + v;
        }
        el.setAttribute('href', v);
      }
    }
  };

  // Guardamos el valor original de fábrica una sola vez (texto o href,
  // según el campo), para poder restablecerlo aunque el usuario ya lo
  // haya sobrescrito.
  const defaults = {};
  Object.keys(fields).forEach(k => {
    const f = fields[k];
    if (!f.el) return;
    defaults[k] = f.getValue ? f.getValue(f.el) : f.el.textContent;
  });

  let cloudTexts = {};

  function applyTexts(){
    Object.keys(fields).forEach(k => {
      const f = fields[k];
      if (!f.el) return;
      const val = (typeof cloudTexts[k] === 'string' && cloudTexts[k].trim()) ? cloudTexts[k] : defaults[k];
      if (f.setValue) f.setValue(f.el, val);
      else f.el.textContent = val;
    });
  }
  window.applySiteTexts = applyTexts;

  // Rellena los campos de Ajustes con lo que hay actualmente aplicado.
  function fillEditor(){
    Object.keys(fields).forEach(k => {
      const f = fields[k];
      if (!f.input) return;
      f.input.value = (typeof cloudTexts[k] === 'string' && cloudTexts[k].trim()) ? cloudTexts[k] : defaults[k];
    });
  }

  if (window.CloudDB){
    window.CloudDB.onContentChange(data => {
      cloudTexts = {
        bodyCaption: data.bodyCaption, about1: data.about1, about2: data.about2, about3: data.about3,
        socialEmail: data.socialEmail, socialInstagram: data.socialInstagram
      };
      applyTexts();
      fillEditor();
    });
  } else {
    applyTexts();
    fillEditor();
  }

  const guardarBtn = document.getElementById('textosGuardar');
  const resetBtn   = document.getElementById('textosReset');
  const msg        = document.getElementById('textosMsg');

  if (guardarBtn){
    guardarBtn.addEventListener('click', async () => {
      const partial = {};
      let changed = [];
      Object.keys(fields).forEach(k => {
        const f = fields[k];
        if (!f.input) return;
        const val = f.input.value.trim();
        partial[k] = val || defaults[k];
        if (val && val !== defaults[k]) changed.push(f.label);
      });
      if (!window.CloudDB){
        flashMsg(msg, 'No se pudo guardar: la conexión con la nube no está lista.', false);
        return;
      }
      guardarBtn.disabled = true;
      try{
        // IMPORTANTE: antes esto no se esperaba ni se comprobaba, así que
        // el mensaje de "Textos guardados." aparecía SIEMPRE, aunque la
        // escritura real en Firestore fallase (sin conexión, permisos,
        // etc.) y el texto nunca llegara a guardarse. Ahora se espera la
        // respuesta real y, si falla, se muestra el motivo exacto en
        // pantalla en vez de un falso "guardado".
        await window.CloudDB.updateContent(partial);
        flashMsg(msg, 'Textos guardados.', true);
        window.CloudDB.logHistory('Textos editados', changed.length ? changed.join(', ') : 'Restablecidos a los originales');
      }catch(err){
        console.error('No se pudo guardar los textos:', err && err.message || err);
        flashMsg(msg, 'No se pudo guardar (' + (err && err.message || 'error de conexión') + ').', false);
      }finally{
        guardarBtn.disabled = false;
      }
    });
  }

  if (resetBtn){
    resetBtn.addEventListener('click', async () => {
      const partial = {};
      Object.keys(fields).forEach(k => { partial[k] = defaults[k]; });
      if (!window.CloudDB){
        flashMsg(msg, 'No se pudo restablecer: la conexión con la nube no está lista.', false);
        return;
      }
      resetBtn.disabled = true;
      try{
        await window.CloudDB.updateContent(partial);
        flashMsg(msg, 'Textos restablecidos a los originales.', true);
        window.CloudDB.logHistory('Textos restablecidos', 'Se volvió a los textos de ejemplo');
      }catch(err){
        console.error('No se pudo restablecer los textos:', err && err.message || err);
        flashMsg(msg, 'No se pudo restablecer (' + (err && err.message || 'error de conexión') + ').', false);
      }finally{
        resetBtn.disabled = false;
      }
    });
  }
})();
