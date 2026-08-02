(function(){
  if (!/(?:^|[?&])ajustes=1(?:&|$)/.test(location.search)) return;

  // Quita el parámetro de la URL sin recargar la página, para que un
  // refresco posterior (o compartir el enlace por error) no vuelva a
  // intentar abrir Ajustes cada vez.
  function cleanUrl(){
    const url = new URL(location.href);
    url.searchParams.delete('ajustes');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  function tryOpenAjustes(){
    if (window.isAdminDevice && typeof window.goToView === 'function'){
      window.goToView('ajustes');
      cleanUrl();
      return true;
    }
    return false;
  }

  // window.isAdminDevice lo fija cloud-db.js de forma asíncrona (en cuanto
  // Firebase confirma la sesión que se acaba de iniciar en admin.html), así
  // que puede que todavía no esté listo en este mismo instante: si no lo
  // está aún, se reintenta con el evento 'admin-auth-changed' y, como red
  // de seguridad por si ese evento llegara antes de que view-navigation.js
  // haya definido window.goToView, también al terminar de cargar la página.
  if (tryOpenAjustes()) return;
  let done = false;
  function retry(e){
    if (done) return;
    if (e && e.detail && !e.detail.loggedIn) return;
    if (tryOpenAjustes()){
      done = true;
      document.removeEventListener('admin-auth-changed', retry);
      window.removeEventListener('load', retry);
    }
  }
  document.addEventListener('admin-auth-changed', retry);
  window.addEventListener('load', retry);
})();
