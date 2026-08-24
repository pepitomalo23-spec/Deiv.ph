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
  const host = (url.hostname || '').toLowerCase();

  if (host === 'panel.deivph.com'){
    // Solo en la raíz del subdominio se sirve el panel; el resto de
    // rutas (styles.css, js/*.js...) siguen su camino normal para no
    // romper los archivos estáticos que carga yo.html.
    if (url.pathname === '/') return rewrite(new URL('/yo.html', request.url));
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
