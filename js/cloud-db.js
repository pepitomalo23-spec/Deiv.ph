window.CloudDB = (function(){
  const contentRef = () => window.fb.db.collection('site').doc('main');
  const historyCol = () => window.fb.db.collection('historial');

  let cache = { bodyCaption:'', about1:'', about2:'', about3:'', carouselImages:[], collageImages:[], categoryButtons:[] };
  let historyCache = [];
  const contentListeners = [];
  const historyListeners = [];

  function onContentChange(cb){ contentListeners.push(cb); cb(cache); }
  function onHistoryChange(cb){ historyListeners.push(cb); cb(historyCache); }

  function startListeners(){
    contentRef().onSnapshot(doc => {
      if (doc.exists) cache = Object.assign({}, cache, doc.data());
      contentListeners.forEach(cb => cb(cache));
    }, err => console.error('Firestore (contenido):', err.message));

    historyCol().orderBy('t', 'desc').limit(300).onSnapshot(snap => {
      historyCache = snap.docs.map(d => Object.assign({ id:d.id }, d.data()));
      historyListeners.forEach(cb => cb(historyCache));
    }, err => console.error('Firestore (historial):', err.message));
  }
  if (window.__firebaseConfigured) startListeners();

  function getContent(){ return cache; }
  function updateContent(partial){
    return contentRef().set(partial, { merge:true });
  }

  function logHistory(action, detail){
    if (!window.__firebaseConfigured) return Promise.resolve();
    return historyCol().add({ action, detail: detail || '', t: Date.now() }).catch(()=>{});
  }
  function getHistory(){ return historyCache; }
  async function clearHistory(){
    const snap = await historyCol().get();
    const batch = window.fb.db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  // Sube el archivo a Cloudinary usando un "upload preset" sin firmar
  // (unsigned), pensado justo para subir directamente desde el navegador
  // sin exponer ninguna clave secreta. Devuelve la URL pública (https)
  // de la imagen ya subida, que es lo que se guarda en Firestore.
  function uploadImage(file, folder){
    if (!window.__cloudinaryConfigured){
      return Promise.reject(new Error('Cloudinary no está configurado todavía (falta pegar cloudinaryConfig).'));
    }
    // Usamos el endpoint "auto" (en vez de "image") para que Cloudinary acepte
    // cualquier formato que llegue desde la cámara o la galería del móvil
    // (incluidos HEIC/HEIF de iPhone/iPad, RAW, etc.) sin rechazarlo por el
    // tipo de archivo. Cloudinary detecta el tipo real y lo convierte solo.
    const url = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/auto/upload`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    formData.append('folder', folder);
    // IMPORTANTE: fetch() no tiene ningún límite de tiempo por defecto. Si
    // Cloudinary (o la red del dispositivo, un bloqueador de contenido de
    // Safari, etc.) nunca llega a contestar, la petición se queda esperando
    // para siempre y ni siquiera se llega a activar el respaldo local: la
    // subida entera se queda "colgada" sin ningún error visible. Con este
    // AbortController, si en 15s no ha habido respuesta, se cancela la
    // petición y se pasa al respaldo local en vez de esperar indefinidamente.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    return fetch(url, { method:'POST', body: formData, signal: controller.signal })
      .then(res => res.json().catch(() => ({})).then(data => ({ ok: res.ok, status: res.status, data })))
      .then(({ ok, status, data }) => {
        if (data && data.secure_url) return data.secure_url;
        // Mensaje más útil: si el preset no es "unsigned" (o no existe),
        // Cloudinary responde 401/400 y aquí queda registrado el motivo
        // exacto en vez de un genérico "Error subiendo la imagen".
        const reason = (data && data.error && data.error.message) || `HTTP ${status || '?'}`;
        throw new Error('Cloudinary rechazó la subida: ' + reason);
      })
      .catch(err => {
        if (err && err.name === 'AbortError'){
          throw new Error('Cloudinary no respondió a tiempo (15s). Puede que algo esté bloqueando la conexión a api.cloudinary.com.');
        }
        throw err;
      })
      .finally(() => clearTimeout(timeoutId));
  }

  // Reduce el tamaño del archivo ANTES de subirlo (a Cloudinary o, si eso
  // falla, como respaldo local en Firestore). Esto es clave por dos motivos:
  // 1) Las fotos de móvil actuales pesan varios MB, y Firestore rechaza
  //    cualquier documento que supere ~1 MB en total; si la subida a
  //    Cloudinary fallase (p.ej. el "upload preset" no está marcado como
  //    "Unsigned" en el Dashboard) el respaldo local metería la foto entera
  //    en Firestore y la escritura fallaría en silencio: la miniatura
  //    parecía añadirse pero nunca quedaba guardada de verdad.
  // 2) Aunque Cloudinary funcione, subir menos peso es más rápido y barato.
  // Si el navegador no puede decodificar el archivo como imagen (p.ej. un
  // HEIC que ese navegador no soporta), se devuelve el archivo original tal
  // cual para no romper la subida.
  function resizeImageFile(file, maxDim, quality){
    maxDim = maxDim || 1600;
    quality = quality || 0.82;
    return new Promise((resolve) => {
      let settled = false;
      // Salvavidas: en algunos navegadores/formatos (sobre todo HEIC de
      // iPhone que el navegador no logra decodificar) ni "onload" ni
      // "onerror" llegan a dispararse nunca, y la promesa se quedaba
      // colgada para siempre -> la subida entera parecía "no hacer nada"
      // al elegir la foto, aunque el selector de archivos funcionara bien.
      // Con este tope, si en 4s no ha pasado nada, seguimos con el archivo
      // tal cual (sin comprimir) en vez de bloquear la subida.
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(safety);
        resolve(result);
      };
      const safety = setTimeout(() => finish(file), 4000);
      try{
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          let { width, height } = img;
          if (!width || !height){ finish(file); return; }
          if (width <= maxDim && height <= maxDim){
            finish(file);
            return;
          }
          const scale = Math.min(maxDim / width, maxDim / height);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(width * scale);
          canvas.height = Math.round(height * scale);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(blob => {
            if (!blob){ finish(file); return; }
            finish(new File([blob], (file.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg', { type:'image/jpeg' }));
          }, 'image/jpeg', quality);
        };
        img.onerror = () => { URL.revokeObjectURL(objectUrl); finish(file); };
        img.src = objectUrl;
      }catch(e){ finish(file); }
    });
  }
  // Un "upload preset" sin firmar solo permite SUBIR, no borrar (borrar
  // requiere la API Secret, que nunca debe estar en el navegador porque
  // cualquiera podría verla y usarla). Por eso aquí simplemente dejamos
  // de referenciar la foto: desaparece de la web al instante, aunque el
  // archivo siga existiendo en tu Cloudinary (plan gratuito de sobra
  // para esto; si algún día quieres borrado real haría falta un pequeño
  // backend con esa clave secreta guardada de forma segura).
  function deleteImageUrl(url){
    return Promise.resolve();
  }

  // Respaldo para cuando subir a Cloudinary falla (Cloudinary no
  // configurado, sin conexión, error del servidor, formato raro, etc.):
  // en vez de rechazar la foto y no añadirla, la leemos directamente en
  // el navegador y la convertimos en una URL "data:" (la imagen va
  // incrustada en el propio dato guardado). Así la foto SIEMPRE se añade,
  // aunque no haya subido a la nube. Nota: al no estar en Cloudinary no se
  // podrá optimizar/servir tan rápido como las que sí suben bien, pero
  // nunca se pierde ni se rechaza una foto que el usuario quiso añadir.
  function readFileAsDataURL(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo.'));
      reader.readAsDataURL(file);
    });
  }

  // Intenta subir a Cloudinary y, si por lo que sea falla, cae automáticamente
  // en guardar la imagen en local (ver readFileAsDataURL) para que la subida
  // nunca se rechace de cara al usuario.
  // Antes de cualquiera de los dos caminos, se reduce el archivo (ver
  // resizeImageFile): esto es lo que evita que el respaldo local supere el
  // límite de tamaño de Firestore (~1 MB por documento) y la foto "desaparezca"
  // sin avisar tras guardarse.
  async function uploadImageAlways(file, folder){
    const smallFile = await resizeImageFile(file, 1600, 0.82);
    try{
      return await uploadImage(smallFile, folder);
    }catch(err){
      console.error('Subida a Cloudinary falló, se guarda la foto localmente en su lugar:', err.message || err);
      const dataUrl = await readFileAsDataURL(smallFile);
      // Cinturón de seguridad extra: si aun comprimida la imagen sigue
      // pesando demasiado para caber en un documento de Firestore, se avisa
      // aquí con un error claro en vez de guardar algo que luego fallará
      // en silencio al escribir en la nube.
      const approxBytes = dataUrl.length * 0.75;
      if (approxBytes > 700000){
        throw new Error('La foto sigue pesando demasiado incluso comprimida. Cloudinary no está aceptando la subida (revisa que el "upload preset" sea Unsigned) y sin él no hay sitio donde guardarla.');
      }
      return dataUrl;
    }
  }

  // ---- Autenticación (cuenta única de administrador) ----
  function login(email, pass){ return window.fb.auth.signInWithEmailAndPassword(email, pass); }
  function logout(){ return window.fb.auth.signOut(); }
  function resetPassword(email){ return window.fb.auth.sendPasswordResetEmail(email); }
  function onAuthChange(cb){ window.fb.auth.onAuthStateChanged(cb); }
  function currentUser(){ return window.fb.auth.currentUser; }
  async function changePassword(currentPass, newPass){
    const user = currentUser();
    if (!user) throw new Error('No hay sesión activa');
    const cred = firebase.auth.EmailAuthProvider.credential(user.email, currentPass);
    await user.reauthenticateWithCredential(cred);
    await user.updatePassword(newPass);
  }

  function exportBackup(){
    const payload = { exportadoEl: new Date().toISOString(), contenido: cache, historial: historyCache };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `copia-seguridad-web-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    logHistory('Copia de seguridad descargada', 'Incluye fotos, textos e historial');
  }

  function importBackup(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try{
          const parsed = JSON.parse(reader.result);
          const contenido = parsed.contenido || {};
          await updateContent(contenido);
          await logHistory('Copia de seguridad restaurada', file.name);
          resolve();
        }catch(e){ reject(e); }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  return {
    onContentChange, getContent, updateContent,
    logHistory, getHistory, onHistoryChange, clearHistory,
    uploadImage, uploadImageAlways, deleteImageUrl,
    login, logout, resetPassword, onAuthChange, currentUser, changePassword,
    exportBackup, importBackup
  };
})();

(function(){
  window.isAdminDevice = false;
  if (window.__firebaseConfigured){
    window.CloudDB.onAuthChange(user => {
      window.isAdminDevice = !!user;
      document.dispatchEvent(new CustomEvent('admin-auth-changed', { detail: { loggedIn: !!user, email: user ? user.email : null } }));
    });
  }
})();
