// Firma de subidas a Cloudinary (solo para el administrador)
// ---------------------------------------------------------------
// Hasta ahora las fotos se subían con un "upload preset" SIN firmar, cuyo
// nombre está a la vista en js/firebase-config.js: cualquiera que leyera
// el código podía subir archivos a la cuenta de Cloudinary (gastar su
// espacio, o alojar ahí lo que quisiera). Con esta función, el navegador
// pide primero una firma; solo se concede si llega el token de sesión de
// Firebase de un correo de administrador (ADMIN_EMAILS), y la firma se
// calcula aquí con el API secret, que nunca sale del servidor.
//
// Variables de entorno necesarias en Vercel (Settings → Environment
// Variables):
//   CLOUDINARY_API_KEY     → Cloudinary: Settings → API Keys
//   CLOUDINARY_API_SECRET  → Cloudinary: Settings → API Keys
//   ADMIN_EMAILS           → correo(s) del administrador, separados por comas
// Mientras falte alguna, responde 503 y la web sigue subiendo como antes
// (preset sin firmar), así que desplegar esto no rompe nada. Cuando estén
// puestas y se compruebe que las subidas funcionan, se puede borrar el
// preset sin firmar en Cloudinary para cerrar la puerta del todo.
const crypto = require('crypto');

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'nqxkgi5x';
// Clave web PÚBLICA de Firebase (la misma de js/firebase-config.js): solo
// sirve para preguntar a Google si un token de sesión es válido.
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyAKDZCGG8minjQlSeVdJ0gkTWD_ZSKszZw';

// Firma de Cloudinary: parámetros ordenados alfabéticamente, "clave=valor"
// unidos con "&", seguidos del API secret, en SHA-1 hexadecimal.
function signParams(params, secret){
  const toSign = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== '')
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + secret).digest('hex');
}

// Google valida el token (firma y caducidad) y devuelve el usuario.
async function lookupFirebaseUser(idToken){
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data && Array.isArray(data.users) ? data.users[0] : null;
}

async function handler(req, res){
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' });

  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const admins = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!apiKey || !apiSecret || !admins.length) return res.status(503).json({ error: 'not-configured' });

  const idToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!idToken) return res.status(401).json({ error: 'no-token' });

  let user = null;
  try { user = await lookupFirebaseUser(idToken); } catch (e) { user = null; }
  const email = user && user.email ? String(user.email).toLowerCase() : '';
  if (!email || !admins.includes(email)) return res.status(403).json({ error: 'forbidden' });

  const body = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : (req.body || {});
  // Solo letras, números, guiones y barras: la carpeta viaja dentro de lo
  // firmado, así que no se puede cambiar después sin invalidar la firma.
  const folder = String(body.folder || '').replace(/[^\w\-\/]/g, '').slice(0, 80);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signParams({ folder, timestamp }, apiSecret);
  return res.status(200).json({ cloudName: CLOUD_NAME, apiKey, timestamp, folder, signature });
}

module.exports = handler;
module.exports.signParams = signParams;
