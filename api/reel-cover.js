// Portada de un reel, sacada de la propia red social
// ---------------------------------------------------------------
// GET /api/reel-cover?url=<enlace del reel>
// Devuelve la imagen de portada (los bytes, no un enlace) que ese reel
// ya tiene en Instagram o TikTok. La usa Ajustes → Reels (ver
// js/reels.js): el navegador no puede leer Instagram/TikTok directamente
// (CORS), así que se pide aquí y luego se sube a Cloudinary igual que
// una foto subida a mano -se guarda una copia porque los enlaces de
// imagen de Instagram/TikTok caducan a los pocos días-. Cómo se saca de
// cada red: ver api/_reel-sources.js.

const {
  UA, instagramCode, isTikTok, isMediaHost,
  instagramEmbedHtml, instagramCoverFromHtml, tiktokCoverUrl, reelUrlFromQuery
} = require('./_reel-sources');

const MAX_BYTES = 8 * 1024 * 1024;

async function handler(req, res){
  if (req.method !== 'GET') return res.status(405).json({ error: 'method-not-allowed' });
  const url = reelUrlFromQuery(req);
  if (!url) return res.status(400).json({ error: 'bad-url' });

  let coverUrl = null;
  try{
    const code = instagramCode(url);
    if (code){
      const html = await instagramEmbedHtml(code);
      coverUrl = html ? instagramCoverFromHtml(html) : null;
    } else if (isTikTok(url)){
      coverUrl = await tiktokCoverUrl(url);
    } else {
      return res.status(400).json({ error: 'unsupported' });
    }
  }catch(e){
    coverUrl = null;
  }
  if (!coverUrl) return res.status(404).json({ error: 'not-found' });
  if (!isMediaHost(coverUrl)) return res.status(502).json({ error: 'unexpected-host' });

  try{
    const img = await fetch(coverUrl, { headers: { 'User-Agent': UA } });
    const type = String(img.headers.get('content-type') || '');
    if (!img.ok || !/^image\//i.test(type)) return res.status(502).json({ error: 'bad-image' });
    const buf = Buffer.from(await img.arrayBuffer());
    if (buf.length > MAX_BYTES) return res.status(502).json({ error: 'too-big' });
    res.setHeader('Content-Type', type);
    // Un día en la caché de Vercel: si se vuelve a pedir la misma portada
    // no hace falta ir otra vez a Instagram/TikTok.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400');
    return res.status(200).send(buf);
  }catch(e){
    return res.status(502).json({ error: 'fetch-failed' });
  }
}

module.exports = handler;
