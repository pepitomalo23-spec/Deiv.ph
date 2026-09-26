// Vídeo de un reel de Instagram, para verlo dentro de la web
// ---------------------------------------------------------------
// GET /api/reel-video?url=<enlace del reel de Instagram>
// Redirige (302) al archivo de vídeo que la página pública de "insertar"
// de Instagram da para ese reel. El reproductor de "Mis reels" (ver
// openViewer en js/reels.js) lo usa como fuente de un <video> normal:
// así el reel se ve a pantalla completa, sin la cabecera ni el pie de
// Instagram y sin que Instagram pida iniciar sesión. Como ese enlace de
// vídeo caduca, no se guarda: se vuelve a pedir aquí cada vez (con una
// hora de caché en Vercel). Si esto falla, el reproductor usa el de
// Instagram (el iframe oficial de "insertar").

const {
  instagramCode, isMediaHost, instagramEmbedHtml, instagramVideoFromHtml, reelUrlFromQuery
} = require('./_reel-sources');

async function handler(req, res){
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).json({ error: 'method-not-allowed' });
  const url = reelUrlFromQuery(req);
  const code = url && instagramCode(url);
  if (!code) return res.status(400).json({ error: 'unsupported' });

  let videoUrl = null;
  try{
    const html = await instagramEmbedHtml(code);
    videoUrl = html ? instagramVideoFromHtml(html) : null;
  }catch(e){
    videoUrl = null;
  }
  if (!videoUrl) return res.status(404).json({ error: 'not-found' });
  if (!isMediaHost(videoUrl)) return res.status(502).json({ error: 'unexpected-host' });

  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600');
  res.statusCode = 302;
  res.setHeader('Location', videoUrl);
  return res.end();
}

module.exports = handler;
