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

// Solo hace falta que este middleware se ejecute para la home ("/"):
// el resto de rutas (styles.css, js/*.js, assets/...) deben seguir
// sirviéndose tal cual, sin pasar por aquí, para no interferir con
// esos archivos estáticos.
export const config = {
  matcher: '/',
};

export default function middleware(request) {
  const host = (request.headers.get('host') || '').toLowerCase();
  if (host === 'panel.deivph.com' || host.startsWith('panel.deivph.com:')) {
    return rewrite(new URL('/yo.html', request.url));
  }
  // Cualquier otro host (deivph.com, previews de Vercel...) sigue su
  // camino normal: al no devolver nada aquí, la petición continúa hacia
  // el sistema de ficheros / rewrites de siempre.
}
