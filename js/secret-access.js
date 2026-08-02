(function(){
  const btn = document.getElementById('secretAccessBtn');
  if (!btn) return;
  let taps = 0;
  let timer = null;
  function registerTap(){
    taps++;
    clearTimeout(timer);
    timer = setTimeout(() => { taps = 0; }, 1200);
    if (taps >= 3){
      taps = 0;
      clearTimeout(timer);
      if (typeof window.openAdminLogin === 'function') window.openAdminLogin();
    }
  }
  btn.addEventListener('click', registerTap);
})();
