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
  // Ajustes se abre en este MISMO subdominio (panel.deivph.com/ajustes,
  // que el middleware sirve con index.html), no en deivph.com: Firebase
  // guarda la sesión por separado para cada dominio, así que la sesión
  // iniciada aquí no existe en deivph.com. Antes se mandaba a
  // deivph.com/?ajustes=1 y, según hubiera o no una sesión antigua
  // guardada también allí, unas veces entraba a Ajustes y otras se
  // quedaba en la web normal.
  function ajustesUrl(){
    return location.origin + '/ajustes';
  }

  if (window.__firebaseConfigured && window.CloudDB){
    window.CloudDB.onAuthChange((user) => {
      if (user) location.href = ajustesUrl();
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
    // Firebase, por defecto, avisa de forma distinta si el correo existe
    // o no (auth/user-not-found vs éxito) -así que dejar que ese error
    // decida qué alert() mostrar permitiría a cualquiera probar
    // direcciones una a una y descubrir cuáles son cuentas de admin
    // reales-. Por eso aquí SIEMPRE se muestra el mismo mensaje, exista
    // o no esa cuenta; el único caso que se trata aparte es un email con
    // formato inválido, ya que eso no revela si la cuenta existe.
    try{
      await window.CloudDB.resetPassword(email);
    }catch(err){
      if (err && err.code === 'auth/invalid-email'){
        alert('Ese correo no tiene un formato válido.');
        return;
      }
      // Cualquier otro error (incluido "no existe esa cuenta") se trata
      // igual que un envío correcto, a propósito.
    }
    alert('Si esa dirección tiene una cuenta, te hemos enviado un correo para restablecer la contraseña.');
  });
})();
