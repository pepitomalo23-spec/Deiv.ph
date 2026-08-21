(function(){
  const emailInput = document.getElementById('adminLoginEmail');
  const passInput  = document.getElementById('adminLoginPass');
  const submitBtn  = document.getElementById('adminLoginSubmit');
  const errorMsg   = document.getElementById('adminLoginError');
  const forgotLink = document.getElementById('adminLoginForgot');

  function showError(text){
    errorMsg.textContent = text;
    errorMsg.classList.add('visible');
  }

  if (!window.__firebaseConfigured){
    showError('Esta web todavía no tiene configurada la cuenta en la nube (falta pegar firebaseConfig).');
  }

  // Si ya hay una sesión guardada en este dispositivo (Firebase la recuerda
  // entre visitas), no hace falta volver a escribir la contraseña cada vez:
  // se pasa directo a Ajustes. onAuthChange también dispara justo después
  // de un login recién hecho más abajo, así que este mismo listener cubre
  // los dos casos.
  // El login vive ahora en su propio subdominio (panel.deivph.com), pero
  // Ajustes y el resto de la web viven en el dominio principal
  // (deivph.com). Antes esto era 'index.html?ajustes=1' -una ruta
  // relativa-, lo cual funcionaba mientras el login vivía en la MISMA
  // web bajo /yo; ahora, servido desde un subdominio distinto, esa misma
  // ruta relativa llevaría de vuelta al propio subdominio (que no sirve
  // index.html, solo yo.html) en vez de al sitio principal. Se construye
  // aquí la URL absoluta al dominio principal quitando el prefijo
  // "panel." del host actual, para no dejar el dominio escrito a mano.
  function mainSiteAjustesUrl(){
    const host = location.hostname.replace(/^panel\./, '');
    return location.protocol + '//' + host + '/?ajustes=1';
  }

  if (window.__firebaseConfigured && window.CloudDB){
    window.CloudDB.onAuthChange((user) => {
      if (user) location.href = mainSiteAjustesUrl();
    });
  }

  async function submit(){
    if (!window.__firebaseConfigured) return;
    errorMsg.classList.remove('visible');
    if (!emailInput.value.trim() || !passInput.value){
      showError('Rellena el correo y la contraseña.');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Entrando…';
    try{
      await window.CloudDB.login(emailInput.value.trim(), passInput.value);
      window.CloudDB.logHistory('Inicio de sesión', emailInput.value.trim());
      // La redirección real la dispara el listener de onAuthChange de
      // arriba en cuanto Firebase confirma la sesión, así que aquí no hace
      // falta hacer nada más: solo queda esperar.
    }catch(err){
      showError('Correo o contraseña incorrectos.');
      passInput.value = '';
      passInput.focus();
      submitBtn.disabled = false;
      submitBtn.textContent = 'Entrar';
    }
  }

  submitBtn.addEventListener('click', submit);
  [emailInput, passInput].forEach((input) => {
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  });

  forgotLink.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!window.__firebaseConfigured) return;
    const email = emailInput.value.trim() || prompt('Escribe tu correo para enviarte el enlace de recuperación:');
    if (!email) return;
    try{
      await window.CloudDB.resetPassword(email);
      alert('Te hemos enviado un correo para restablecer tu contraseña.');
    }catch(err){
      alert('No se pudo enviar el correo. Comprueba que la dirección es correcta.');
    }
  });
})();
