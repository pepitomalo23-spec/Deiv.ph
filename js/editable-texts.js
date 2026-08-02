(function(){
  const fields = {
    bodyCaption: { el: document.getElementById('bodyCaption'), input: document.getElementById('textoCaption'), label: 'Frase de la pantalla de inicio' },
    about1:  { el: document.getElementById('aboutPara1'),  input: document.getElementById('textoAbout1'), label: '"Sobre mí" — párrafo 1' },
    about2:  { el: document.getElementById('aboutPara2'),  input: document.getElementById('textoAbout2'), label: '"Sobre mí" — párrafo 2' },
    about3:  { el: document.getElementById('aboutPara3'),  input: document.getElementById('textoAbout3'), label: '"Sobre mí" — párrafo 3' }
  };

  // Guardamos el texto original de fábrica una sola vez, para poder
  // restablecerlo aunque el usuario ya lo haya sobrescrito.
  const defaults = {};
  Object.keys(fields).forEach(k => {
    if (fields[k].el) defaults[k] = fields[k].el.textContent;
  });

  let cloudTexts = {};

  function applyTexts(){
    Object.keys(fields).forEach(k => {
      const f = fields[k];
      if (!f.el) return;
      f.el.textContent = (typeof cloudTexts[k] === 'string' && cloudTexts[k].trim()) ? cloudTexts[k] : defaults[k];
    });
  }
  window.applySiteTexts = applyTexts;

  // Rellena los textareas de Ajustes con lo que hay actualmente aplicado.
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
        bodyCaption: data.bodyCaption, about1: data.about1, about2: data.about2, about3: data.about3
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
