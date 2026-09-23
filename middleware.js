// Panel de administración en su propio subdominio (panel.deivph.com)
// ---------------------------------------------------------------
// El proyecto ya tiene un index.html en la raíz, y en Vercel un archivo
// que existe en el sistema de ficheros se sirve ANTES de que se evalúen
// las reglas de "rewrites" de vercel.json -así que un rewrite normal
// basado en el host nunca llegaba a aplicarse aquí, siempre ganaba
// index.html-. El Routing Middleware de Vercel sí se ejecuta antes que
// el sistema de ficheros, así que es el sitio correcto para decidir,
// según el host de la petición, si servir la web normal o el panel.
import { rewrite } from '@vercel/functions';

// Se ejecuta para TODAS las rutas (no solo "/"): tanto para poder
// decidir el panel en la raíz del subdominio, como para poder redirigir
// cualquier ruta (incluido /yo.html) si alguien llega por el alias
// interno de Vercel en vez de por el dominio real (ver más abajo).
export const config = {
  matcher: '/(.*)',
};

export default function middleware(request) {
  const url = new URL(request.url);
  // Normalizamos el host: quitamos un posible punto final (FQDN) y
  // cualquier puerto, para que la comparación no falle por variaciones
  // que a veces añaden ciertos resolutores DNS o proxies intermedios.
  const host = (url.hostname || '').toLowerCase().replace(/\.$/, '');

  if (host === 'panel.deivph.com'){
    // Solo "/" y "/ajustes" se reescriben; el resto de rutas
    // (styles.css, js/*.js, assets/...) siguen su camino normal para no
    // romper los archivos estáticos que cargan yo.html e index.html.
    // "/" es el formulario de login (yo.html) y "/ajustes" es la web
    // completa (index.html) abierta directamente en Ajustes. Ajustes se
    // sirve TAMBIÉN desde panel.deivph.com, y no desde deivph.com, porque
    // Firebase guarda la sesión por separado para cada dominio: la sesión
    // iniciada aquí no existe en deivph.com, así que al mandar al usuario
    // allí unas veces (si también tenía sesión antigua en deivph.com)
    // entraba a Ajustes y otras se quedaba en la web normal.
    // Con barra final ("/ajustes/") las rutas relativas de index.html
    // (js/..., assets/...) se resolverían bajo /ajustes/ y fallarían:
    // se redirige a la versión sin barra.
    if (url.pathname === '/ajustes/') {
      return Response.redirect(new URL('/ajustes' + url.search, request.url), 308);
    }
    const target = url.pathname === '/' ? '/yo.html'
                 : url.pathname === '/ajustes' ? '/index.html'
                 : null;
    if (target) {
      const res = rewrite(new URL(target, request.url));
      // IMPORTANTE: deivph.com y panel.deivph.com son dos dominios
      // sobre el MISMO deployment de Vercel. La Edge Network de Vercel
      // cachea archivos estáticos por ruta ("/") hasta 31 días, y una
      // respuesta ya cacheada se sirve directamente SIN volver a pasar
      // por este middleware. Si esa caché llegara a guardar alguna vez
      // el index.html normal para la ruta "/", panel.deivph.com podría
      // mostrar la web en vez del panel de forma intermitente, aunque
      // el código de aquí sea correcto. Para evitarlo del todo, fijamos
      // explícitamente "no cachear" en la propia respuesta reescrita,
      // en vez de depender solo de las reglas de vercel.json (que no
      // siempre se aplican de forma fiable a una respuesta reescrita
      // por middleware).
      res.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.headers.set('CDN-Cache-Control', 'no-store');
      res.headers.set('Vercel-CDN-Cache-Control', 'no-store');
      return res;
    }
    return;
  }

  // Vercel asigna automáticamente un alias público del tipo
  // "deiv-ph-pablo-jesus.vercel.app" a este proyecto -y ese alias sirve
  // exactamente el mismo contenido que deivph.com, incluido yo.html-.
  // Nadie lo enlaza a propósito, pero puede filtrarse (como pasó aquí:
  // apareció en las propias etiquetas Open Graph del código) y quedar
  // como una segunda puerta de entrada a la web, paralela al dominio
  // real y sin las mismas protecciones pensadas para panel.deivph.com.
  // Para cerrarla, cualquier host que acabe en vercel.app se redirige
  // siempre al dominio de verdad, conservando la ruta y los parámetros
  // (por si alguien llega con un enlace a una página concreta).
  if (host.endsWith('.vercel.app')){
    return Response.redirect(new URL(url.pathname + url.search, 'https://deivph.com'), 308);
  }
}
