// Utilidades compartidas por api/reel-cover.js y api/reel-video.js
// ---------------------------------------------------------------
// El "_" delante del nombre hace que Vercel NO lo publique como una
// función más (/api/_reel-sources): solo lo usan las otras dos.
//
// Instagram: la página pública de "insertar" de cada publicación
// (instagram.com/p/CÓDIGO/embed/captioned/) se puede leer sin iniciar
// sesión y trae tanto la portada como el enlace al vídeo. Esos enlaces
// de imagen/vídeo van firmados y caducan a los pocos días, por eso no se
// guardan: la portada se copia a Cloudinary y el vídeo se vuelve a pedir
// cada vez que alguien lo ve.
// TikTok: su API pública oEmbed devuelve la miniatura.

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// Solo se reenvían imágenes/vídeos de los propios servidores de
// Instagram/TikTok, para que estas funciones no sirvan de proxy para
// cualquier otra cosa.
const MEDIA_HOST_RE = /(^|\.)(cdninstagram\.com|fbcdn\.net|tiktokcdn\.com|tiktokcdn-[a-z]+\.com|ibyteimg\.com)$/i;

function instagramCode(url){
  const m = String(url).match(/(?:instagram\.com|instagr\.am)\/(?:[\w.]+\/)?(?:reels?|p|tv)\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
}

function isTikTok(url){
  return /^https?:\/\/([a-z0-9-]+\.)*tiktok\.com\//i.test(String(url));
}

function isMediaHost(url){
  try { return MEDIA_HOST_RE.test(new URL(url).hostname); } catch (e) { return false; }
}

// Deshace el escapado de una cadena que viene dentro de un JSON que a su
// vez va dentro de otra cadena de JavaScript (por eso a veces trae las
// barras escapadas dos veces: https:\\\/\\\/...).
function unescapeJsonString(raw){
  let s = raw;
  for (let i = 0; i < 3 && s.indexOf('\\') !== -1; i++){
    try { s = JSON.parse('"' + s + '"'); } catch (e) { break; }
  }
  return s;
}

function decodeHtmlAttr(s){
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

// Valor de un campo ("display_url", "video_url"...) del JSON que lleva
// la página de "insertar".
function jsonField(html, name){
  const m = html.match(new RegExp(name + '\\\\*"\\s*:\\s*\\\\*"(.+?)\\\\*"'));
  return m ? unescapeJsonString(m[1]) : null;
}

async function instagramEmbedHtml(code){
  const res = await fetch(`https://www.instagram.com/p/${code}/embed/captioned/`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9' },
    redirect: 'follow'
  });
  return res.ok ? res.text() : null;
}

function instagramCoverFromHtml(html){
  // 1) La imagen que la propia página enseña (portada del vídeo).
  const img = html.match(/class="EmbeddedMediaImage"[^>]*?\ssrc="([^"]+)"/);
  if (img) return decodeHtmlAttr(img[1]);
  // 2) Respaldo: el dato "display_url" del JSON de la página.
  return jsonField(html, 'display_url');
}

function instagramVideoFromHtml(html){
  return jsonField(html, 'video_url');
}

async function tiktokCoverUrl(url){
  const res = await fetch('https://www.tiktok.com/oembed?url=' + encodeURIComponent(url), {
    headers: { 'User-Agent': UA }
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data && data.thumbnail_url ? String(data.thumbnail_url) : null;
}

// Enlace del reel que llega en ?url=..., o null si no es un enlace web.
function reelUrlFromQuery(req){
  const url = String((req.query && req.query.url) || '').trim().slice(0, 500);
  return /^https?:\/\//i.test(url) ? url : null;
}

module.exports = {
  UA, instagramCode, isTikTok, isMediaHost,
  instagramEmbedHtml, instagramCoverFromHtml, instagramVideoFromHtml,
  tiktokCoverUrl, reelUrlFromQuery
};
