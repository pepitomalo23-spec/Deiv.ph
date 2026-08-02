// ⚠️ PEGA AQUÍ los datos de TU proyecto de Firebase (Configuración del
  // proyecto → tus apps → SDK de Firebase, en console.firebase.google.com).
  // Firebase se usa para el login de admin, los textos y el historial.
  // Las fotos NO se guardan aquí: se guardan en Cloudinary (ver el bloque
  // cloudinaryConfig justo debajo).
  const firebaseConfig = {
    apiKey: "AIzaSyAKDZCGG8minjQlSeVdJ0gkTWD_ZSKszZw",
    authDomain: "deiv-ph.firebaseapp.com",
    projectId: "deiv-ph",
    storageBucket: "deiv-ph.firebasestorage.app",
    messagingSenderId: "349669275865",
    appId: "1:349669275865:web:0a51cb93915b54ed5b66c8"
  };
  window.__firebaseConfigured = false;
  try{
    if (typeof firebase !== 'undefined' && firebaseConfig.apiKey.indexOf('PEGA_AQUI') === -1){
      firebase.initializeApp(firebaseConfig);
      window.fb = {
        auth: firebase.auth(),
        db: firebase.firestore()
      };
      window.__firebaseConfigured = true;
    }
  }catch(e){
    console.error('No se pudo inicializar Firebase:', e);
  }

  // ⚠️ PEGA AQUÍ los datos de TU cuenta de Cloudinary (Dashboard → Cloud
  // name, y Settings → Upload → Upload presets → el preset "Unsigned"
  // que hayas creado). Aquí se guardan las fotos del carrusel y del
  // collage de "Sobre mí".
  const cloudinaryConfig = {
    cloudName: "nqxkgi5x",
    uploadPreset: "Deiv.ph"
  };
  window.__cloudinaryConfigured = cloudinaryConfig.cloudName.indexOf('PEGA_AQUI') === -1;
