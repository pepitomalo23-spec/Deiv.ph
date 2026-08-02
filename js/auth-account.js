(function(){
  const overlay    = document.getElementById('adminLoginOverlay');
  const errorMsg   = document.getElementById('adminLoginError');
  const emailInput = document.getElementById('adminLoginEmail');
  const passInput  = document.getElementById('adminLoginPass');
  const submitBtn  = document.getElementById('adminLoginSubmit');
  const cancelBtn  = document.getElementById('adminLoginCancel');
  const forgotLink = document.getElementById('adminLoginForgot');

  function resetForm(){
    emailInput.value = '';
    passInput.value = '';
    errorMsg.classList.remove('visible');
  }

  function openAdminLogin(){
    resetForm();
    if (!window.__firebaseConfigured){
      errorMsg.textContent = 'Esta web todavía no tiene configurada la cuenta en la nube (falta pegar firebaseConfig).';
      errorMsg.classList.add('visible');
    }
    overlay.classList.add('open');
    setTimeout(() => emailInput.focus(), 50);
  }
  window.openAdminLogin = openAdminLogin;

  function closeAdminLogin(){
    overlay.classList.remove('open');
    resetForm();
  }

  cancelBtn.addEventListener('click', closeAdminLogin);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAdminLogin(); });
  document.addEventListener('admin-auth-changed', (e) => { if (e.detail.loggedIn) closeAdminLogin(); });

  async function submit(){
    if (!window.__firebaseConfigured) return;
    errorMsg.classList.remove('visible');
    if (!emailInput.value.trim() || !passInput.value){
      errorMsg.textContent = 'Rellena el correo y la contraseña.';
      errorMsg.classList.add('visible');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Entrando…';
    try{
      await window.CloudDB.login(emailInput.value.trim(), passInput.value);
      window.CloudDB.logHistory('Inicio de sesión', emailInput.value.trim());
      // Al iniciar sesión como admin, ir directo a Ajustes en vez de
      // quedarse en la vista en la que estuviera el visitante. Marcamos
      // isAdminDevice aquí mismo por si el listener de Firebase (que hace
      // lo mismo) todavía no ha disparado, para evitar una carrera que
      // nos devolvería al Resumen.
      window.isAdminDevice = true;
      if (typeof window.goToView === 'function') window.goToView('ajustes');
    }catch(err){
      errorMsg.textContent = 'Correo o contraseña incorrectos.';
      errorMsg.classList.add('visible');
      passInput.value = '';
      passInput.focus();
    }
    submitBtn.disabled = false;
    submitBtn.textContent = 'Entrar';
  }

  submitBtn.addEventListener('click', submit);
  [emailInput, passInput].forEach(input => {
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
