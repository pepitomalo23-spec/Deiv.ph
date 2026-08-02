(function(){
  if (!window.CloudDB) return;

  const historialList  = document.getElementById('historialList');
  const historialVaciar= document.getElementById('historialVaciar');
  const exportBtn       = document.getElementById('cuentaExportar');
  const importInput     = document.getElementById('cuentaImportarInput');
  const backupMsg        = document.getElementById('cuentaBackupMsg');
  const cerrarSesionBtn = document.getElementById('cuentaCerrarSesion');
  const cambiarPassBtn  = document.getElementById('cuentaCambiarPass');
  const passActual      = document.getElementById('cuentaPassActual');
  const passNueva       = document.getElementById('cuentaPassNueva');
  const passNueva2      = document.getElementById('cuentaPassNueva2');
  const passMsg          = document.getElementById('cuentaPassMsg');

  function flashMsg(el, text, ok){
    if (!el) return;
    el.textContent = text;
    el.classList.remove('cuenta-msg--ok', 'cuenta-msg--err');
    el.classList.add(ok ? 'cuenta-msg--ok' : 'cuenta-msg--err', 'visible');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('visible'), 3200);
  }

  function formatDate(ts){
    try{
      return new Date(ts).toLocaleString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    }catch(e){ return ''; }
  }

  function renderHistorial(items){
    if (!historialList) return;
    if (!items || !items.length){
      historialList.innerHTML = '<li class="historial-empty">Todavía no hay cambios registrados.</li>';
      return;
    }
    historialList.innerHTML = items.map(it => `
      <li class="historial-item">
        <div class="historial-item-top">
          <span class="historial-item-action">${(it.action || '').replace(/</g,'&lt;')}</span>
          <span class="historial-item-time">${formatDate(it.t)}</span>
        </div>
        ${it.detail ? `<div class="historial-item-detail">${String(it.detail).replace(/</g,'&lt;')}</div>` : ''}
      </li>
    `).join('');
  }
  window.CloudDB.onHistoryChange(renderHistorial);

  if (historialVaciar){
    historialVaciar.addEventListener('click', () => {
      if (!confirm('¿Vaciar todo el historial de cambios? Esta acción no se puede deshacer.')) return;
      window.CloudDB.clearHistory();
    });
  }

  if (exportBtn){
    exportBtn.addEventListener('click', () => {
      window.CloudDB.exportBackup();
      flashMsg(backupMsg, 'Copia de seguridad descargada.', true);
    });
  }

  if (importInput){
    importInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try{
        await window.CloudDB.importBackup(file);
        flashMsg(backupMsg, 'Copia restaurada. Recargando…', true);
        setTimeout(() => location.reload(), 900);
      }catch(err){
        flashMsg(backupMsg, 'No se pudo leer ese archivo. ¿Es una copia de seguridad válida?', false);
      }
      importInput.value = '';
    });
  }

  if (cerrarSesionBtn){
    cerrarSesionBtn.addEventListener('click', async () => {
      if (!confirm('¿Cerrar sesión de administrador en este navegador?')) return;
      await window.CloudDB.logHistory('Cierre de sesión', '');
      await window.CloudDB.logout();
    });
  }

  if (cambiarPassBtn){
    cambiarPassBtn.addEventListener('click', async () => {
      const actual = passActual.value;
      const nueva  = passNueva.value;
      const nueva2 = passNueva2.value;
      if (!actual || !nueva || !nueva2){
        flashMsg(passMsg, 'Rellena los tres campos.', false);
        return;
      }
      if (nueva.length < 4){
        flashMsg(passMsg, 'La nueva contraseña debe tener al menos 4 caracteres.', false);
        return;
      }
      if (nueva !== nueva2){
        flashMsg(passMsg, 'Las dos contraseñas nuevas no coinciden.', false);
        return;
      }
      try{
        await window.CloudDB.changePassword(actual, nueva);
        window.CloudDB.logHistory('Contraseña actualizada', '');
        passActual.value = ''; passNueva.value = ''; passNueva2.value = '';
        flashMsg(passMsg, 'Contraseña actualizada correctamente.', true);
      }catch(err){
        flashMsg(passMsg, 'La contraseña actual no es correcta.', false);
      }
    });
  }

  // Muestra el correo de la cuenta con la sesión activa.
  const statusEl = document.querySelector('.cuenta-status span:last-child');
  document.addEventListener('admin-auth-changed', (e) => {
    if (statusEl && e.detail.loggedIn && e.detail.email){
      statusEl.textContent = `Sesión activa: ${e.detail.email}`;
    }
  });
  if (statusEl && window.CloudDB.currentUser && window.CloudDB.currentUser()){
    statusEl.textContent = `Sesión activa: ${window.CloudDB.currentUser().email}`;
  }
})();
