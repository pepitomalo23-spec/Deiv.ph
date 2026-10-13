(async () => {
const APP = "https://test-pablo-jesus.vercel.app";
const w = (ms) => new Promise((r) => setTimeout(r, ms)),
norm = (s) => String(s || "").replace(/\s+/g, " ").trim(),
mk = (t, css, p) => {
const e = document.createElement(t);
if (css) e.style.cssText = css;
if (p) Object.assign(e, p);
return e;
},
esc = (s) =>
String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
["__pj_todo", "__pj_caja"].forEach((i) => {
const o = document.getElementById(i);
if (o) o.remove();
});
const P = mk(
"div",
"position:fixed;top:10px;right:10px;z-index:2147483647;background:rgba(20,20,20,.96);color:white;padding:14px 16px;border-radius:12px;font:15px/1.45 -apple-system,system-ui,sans-serif;width:330px;max-width:calc(100vw - 20px);max-height:calc(100vh - 20px);overflow:auto;box-sizing:border-box;text-align:left",
);
P.id = "__pj_todo";
const box = mk("div", "position:absolute;left:-100000px;top:0;width:900px");
box.id = "__pj_caja";
try {
const form = document.forms.formulario;
if (!form) {
alert("Abre la página con la lista de temas y tests (tob.test) y vuelve a pulsar el marcador.");
return;
}
const accion = new URL(form.getAttribute("action") || "", location.href).href;
const args = (s) => [...String(s).matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\(.)/g, "$1"));
const temas = {};
const tests = [];
const vistos = new Set();
document.querySelectorAll('[onclick*="seleccionaClase"]').forEach((a) => {
const g = args(a.getAttribute("onclick"));
if (g.length < 2) return;
const clave = g[0] + "|" + g[1],
titulo = norm(a.textContent).replace(/^Test\s*-\s*/i, "");
if (vistos.has(clave)) {
const ya = tests.find((t) => t.temaId + "|" + t.preguntas === clave);
if (ya && !ya.conTexto && titulo) Object.assign(ya, { titulo, conTexto: true });
return;
}
vistos.add(clave);
let tema = "";
for (let p = a, i = 0; i < 10 && p && !tema; i++) {
p = p.parentElement;
if (!p) break;
const h = p.querySelector("h1,h2,h3,h4,h5,.panel-title,.card-header,.panel-heading,button[data-toggle],a[data-toggle]");
if (h && !h.contains(a)) tema = norm(h.textContent);
}
if (!temas[g[0]]) temas[g[0]] = tema;
tests.push({
temaId: g[0],
preguntas: g[1],
esperadas: g[1].split(",").filter((x) => x.trim()).length,
tituloForm: g[2] || "",
fecha: g[3] || "",
titulo: titulo || norm(g[2]),
conTexto: !!titulo,
});
});
if (!tests.length) {
alert("No encuentro tests en esta página. Abre la lista de temas (tob.test).");
return;
}
// --- Elegir temas / tests ---
const grupos = [],
porTema = new Map();
tests.forEach((t) => {
let g = porTema.get(t.temaId);
if (!g) {
g = { nombre: temas[t.temaId] || "Tema " + t.temaId, tests: [] };
porTema.set(t.temaId, g);
grupos.push(g);
}
g.tests.push(t);
});
const KEY = "__pj_seleccion",
clv = (t) => t.temaId + "|" + t.preguntas;
let antes = null;
try {
antes = new Set(JSON.parse(localStorage.getItem(KEY) || "null"));
} catch (e) {}
document.body.append(P);
const elegidos = await new Promise((fin) => {
const btn = "font-size:15px;padding:8px 12px;border:0;border-radius:8px;color:white;cursor:pointer;margin:4px 6px 0 0;background:";
const cab = mk("div", "font-weight:600;margin-bottom:6px", {
textContent: "Elige qué sacar (" + tests.length + " tests en " + grupos.length + " temas)",
}),
lst = mk("div", "margin:6px 0 8px"),
bT = mk("button", btn + "#444", { type: "button", textContent: "Todos" }),
bN = mk("button", btn + "#444", { type: "button", textContent: "Ninguno" }),
bS = mk("button", btn + "#f07611", { type: "button" }),
bC = mk("button", btn + "dimgray", { type: "button", textContent: "Cancelar" }),
cajas = [];
const upd = () => {
grupos.forEach((g) => {
const n = g.cs.filter((c) => c.checked).length;
g.cb.checked = n === g.cs.length;
g.cb.indeterminate = n > 0 && n < g.cs.length;
g.num.textContent = n + "/" + g.cs.length;
});
const n = cajas.filter((c) => c.checked).length;
bS.textContent = "Sacar " + n + " test" + (n === 1 ? "" : "s");
bS.disabled = !n;
bS.style.opacity = n ? "1" : ".5";
};
grupos.forEach((g) => {
const fila = mk("div", "margin:4px 0;border-bottom:1px solid #333;padding-bottom:4px"),
top = mk("div", "display:flex;align-items:flex-start;gap:4px"),
ver = mk("button", "background:none;border:0;color:#aaa;cursor:pointer;font-size:14px;padding:2px 4px;flex:none", {
type: "button",
textContent: "▸",
title: "Ver tests",
}),
lab = mk("label", "display:flex;gap:8px;align-items:flex-start;cursor:pointer;flex:1"),
sub = mk("div", "display:none;padding:2px 0 4px 30px;font-size:13px");
g.cb = mk("input", "margin-top:4px;accent-color:#f07611;flex:none", { type: "checkbox" });
g.num = mk("span", "opacity:.6;font-size:13px;flex:none");
lab.append(g.cb, mk("span", "flex:1", { textContent: g.nombre }), g.num);
g.cs = g.tests.map((t) => {
const l = mk("label", "display:flex;gap:6px;align-items:flex-start;cursor:pointer;margin:3px 0"),
c = mk("input", "margin-top:3px;accent-color:#f07611;flex:none", { type: "checkbox", checked: !!antes && antes.has(clv(t)) });
c.t = t;
c.onchange = upd;
l.append(c, mk("span", "", { textContent: t.titulo || "Test" }));
sub.append(l);
cajas.push(c);
return c;
});
g.cb.onchange = () => {
g.cs.forEach((c) => (c.checked = g.cb.checked));
upd();
};
ver.onclick = () => {
const abrir = sub.style.display === "none";
sub.style.display = abrir ? "block" : "none";
ver.textContent = abrir ? "▾" : "▸";
};
top.append(ver, lab);
fila.append(top, sub);
lst.append(fila);
});
const todos = (v) => {
cajas.forEach((c) => (c.checked = v));
upd();
};
bT.onclick = () => todos(true);
bN.onclick = () => todos(false);
bC.onclick = () => fin(null);
bS.onclick = () => {
const s = new Set(cajas.filter((c) => c.checked).map((c) => c.t));
try {
localStorage.setItem(KEY, JSON.stringify([...s].map(clv)));
} catch (e) {}
fin(tests.filter((t) => s.has(t)));
};
P.append(cab, bT, bN, lst, bS, bC);
upd();
});
if (!elegidos || !elegidos.length) {
P.remove();
return;
}
tests.splice(0, tests.length, ...elegidos);
P.replaceChildren();
let stop = false;
const msg = mk("div", "white-space:pre-line;margin-bottom:10px"),
sb = mk("button", "font-size:15px;padding:8px 14px;border:0;border-radius:8px;background:crimson;color:white", {
textContent: "Parar (y enviar lo hecho)",
type: "button",
});
sb.onclick = () => {
stop = true;
};
P.append(msg, sb);
document.body.append(P, box);
const say = (t) => {
msg.textContent = t;
};
const cache = new Map();
let nImg = 0,
nImgMal = 0;
const imgSrc = (i) => {
const d = i.getAttribute("data-src") || i.getAttribute("data-original") || i.getAttribute("data-lazy-src");
return d ? new URL(d, location.href).href : i.currentSrc || i.src || "";
};
const okImg = (i) => !(i.naturalWidth && i.naturalWidth <= 24 && i.naturalHeight <= 24);
const leer = (b) =>
new Promise((ok, ko) => {
const f = new FileReader();
f.onload = () => ok(f.result);
f.onerror = ko;
f.readAsDataURL(b);
});
const tipoBytes = (u) =>
u[0] === 0x89 && u[1] === 0x50 ? "image/png"
: u[0] === 0xff && u[1] === 0xd8 ? "image/jpeg"
: u[0] === 0x47 && u[1] === 0x49 && u[2] === 0x46 ? "image/gif"
: u[0] === 0x52 && u[1] === 0x49 && u[8] === 0x57 && u[9] === 0x45 ? "image/webp"
: "";
const aPng = (b) =>
new Promise((ok) => {
const u = URL.createObjectURL(b),
im = new Image();
im.onload = () => {
try {
const c = document.createElement("canvas");
c.width = im.naturalWidth || 300;
c.height = im.naturalHeight || 150;
c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
ok(c.toDataURL("image/png"));
} catch (e) {
ok("");
}
URL.revokeObjectURL(u);
};
im.onerror = () => {
URL.revokeObjectURL(u);
ok("");
};
im.src = u;
});
const toData = async (s) => {
if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(s)) return s;
if (cache.has(s)) return cache.get(s);
let r = "";
for (let k = 0; k < 3 && !r; k++) {
try {
if (k) await w(600 * k);
const res = await fetch(s, { credentials: "include" });
if (!res.ok) continue;
const b = await res.blob(),
t = tipoBytes(new Uint8Array(await b.slice(0, 12).arrayBuffer()));
r = t ? await leer(new Blob([b], { type: t })) : /svg|bmp|tiff|icon/i.test(b.type) ? await aPng(b) : "";
if (!t && !r) break;
} catch (e) {
break; // otra web sin permiso (CORS): no se arregla reintentando
}
}
if (!r) nImgMal++;
r = r || s;
cache.set(s, r);
return r;
};
const imgH = async (i) => {
const s = imgSrc(i);
if (!s || !okImg(i)) return "";
nImg++;
return '<br><img src="' + esc(await toData(s)) + '"><br>';
};
const svgH = async (sv) => {
const r = sv.getBoundingClientRect();
if (r.width <= 24 && r.height <= 24) return "";
try {
const c = sv.cloneNode(true);
c.setAttribute("xmlns", "http://www.w3.org/2000/svg");
if (!c.getAttribute("width")) c.setAttribute("width", Math.round(r.width));
if (!c.getAttribute("height")) c.setAttribute("height", Math.round(r.height));
const d = await aPng(new Blob([new XMLSerializer().serializeToString(c)], { type: "image/svg+xml" }));
nImg++;
if (!d) {
nImgMal++;
return "";
}
return '<br><img src="' + d + '"><br>';
} catch (e) {
return "";
}
};
const rich = async (e) => {
if (!e) return "";
let h = "";
const nl = () => {
if (h && !/<br>$/.test(h)) h += "<br>";
};
const walk = async (n) => {
for (const c of n.childNodes) {
if (c.nodeType === 3) h += esc(c.textContent.replace(/\s+/g, " "));
else if (c.nodeType === 1) {
const t = c.tagName.toUpperCase();
if (t === "BR") h += "<br>";
else if (t === "IMG") {
nl();
h += (await imgH(c)).replace(/^<br>/, "");
} else if (t === "SVG") {
nl();
h += (await svgH(c)).replace(/^<br>/, "");
} else if (t === "SCRIPT" || t === "STYLE" || t === "NOSCRIPT" || (t === "I" && /\bfa/.test(c.className))) {
} else {
const b = /^(DIV|P|LI|TR|UL|OL|TABLE|H[1-6]|BLOCKQUOTE|DL|DT|DD)$/.test(t),
tg = /^(STRONG|B)$/.test(t) ? "b" : /^(EM|I)$/.test(t) ? "i" : t === "U" ? "u" : t === "SUB" ? "sub" : t === "SUP" ? "sup" : "";
if (b) nl();
if (t === "LI") h += "• ";
if ((t === "TD" || t === "TH") && h && !/(<br>|\s)$/.test(h)) h += " · ";
if (tg) h += "<" + tg + ">";
await walk(c);
if (tg) h += "</" + tg + ">";
if (b) nl();
}
}
}
};
await walk(e);
return h.replace(/(<br>\s*){3,}/g, "<br><br>").replace(/^(\s*<br>)+/, "").replace(/(<br>\s*)+$/, "").trim();
};
const dif = (q) => {
for (const e of [q, ...q.querySelectorAll("div")].slice(0, 8)) {
const cs = getComputedStyle(e);
if (parseFloat(cs.borderLeftWidth) < 3 || cs.borderLeftStyle === "none") continue;
const m = (cs.borderLeftColor.match(/[\d.]+/g) || []).map(Number);
if (m.length < 3 || (m.length > 3 && m[3] === 0)) continue;
const [r, g, b] = m.map((v) => v / 255),
mx = Math.max(r, g, b),
mn = Math.min(r, g, b),
d = mx - mn;
if (d < 0.15) continue;
let hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
hh = (hh * 60 + 360) % 360;
if (hh >= 75 && hh < 170) return "facil";
if (hh >= 28 && hh < 75) return "media";
if (hh < 28 || hh >= 330) return "dificil";
}
const cl = [q, ...q.children].map((e) => String(e.className)).join(" ").toLowerCase();
if (/f[aá]cil|verde/.test(cl)) return "facil";
if (/dif[ií]cil|rojo/.test(cl)) return "dificil";
if (/\bmedia\b|amarill/.test(cl)) return "media";
return "";
};
const pedir = async (t) => {
const fd = new URLSearchParams();
for (const el of form.elements) if (el.name && !(/^(checkbox|radio)$/.test(el.type) && !el.checked)) fd.set(el.name, el.value);
fd.set("idTema", t.temaId);
fd.set("preguntas", t.preguntas);
fd.set("titulo", t.tituloForm);
fd.set("fecha", t.fecha);
let err = null;
for (let k = 0; k < 3; k++) {
try {
if (k) await w(1500 * k);
const r = await fetch(accion, {
method: "POST",
credentials: "include",
headers: { "Content-Type": "application/x-www-form-urlencoded" },
body: fd.toString(),
});
if (!r.ok) throw new Error("HTTP " + r.status);
const cs = (/charset=([\w-]+)/i.exec(r.headers.get("content-type") || "") || [])[1] || document.characterSet || "utf-8";
const buf = await r.arrayBuffer();
try {
return new TextDecoder(cs).decode(buf);
} catch (e) {
return new TextDecoder().decode(buf);
}
} catch (e) {
err = e;
}
}
throw err;
};
const sacar = async (html) => {
const doc = new DOMParser().parseFromString(html, "text/html");
doc.querySelectorAll("script").forEach((s) => s.remove());
doc.querySelectorAll("img").forEach((i) => {
i.removeAttribute("loading");
const d = i.getAttribute("data-src") || i.getAttribute("data-original") || i.getAttribute("data-lazy-src");
if (d) i.setAttribute("src", d);
});
box.replaceChildren(...doc.head.querySelectorAll("style,link[rel=stylesheet]"), ...doc.body.childNodes);
const imgs = [...box.querySelectorAll("img")];
await Promise.all(
imgs.map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 8000); }))),
);
const qs = [...box.querySelectorAll("div[id^=pregunta]")].filter((e) => /^pregunta\d+$/.test(e.id));
const out = [],
av = { sinCorrecta: 0, sinExplicacion: 0, opcionVacia: 0, sinDificultad: 0 };
for (const q of qs) {
const k = q.id.slice(8);
const opts = [...q.querySelectorAll(".opcionPregunta")].map((o) => {
const tr = o.closest("tr");
let d = tr && tr.querySelector("div.respuesta");
if (!d && tr) {
d = tr.cloneNode(true);
d.querySelectorAll(".opcionPregunta").forEach((x) => (x.closest("td") || x).remove());
box.appendChild(d);
}
return {
L: norm(o.getAttribute("value") || o.textContent).toLowerCase(),
d,
oc: o.getAttribute("onclick") || "",
};
});
if (!opts.length) continue;
const mt = opts.map((x) => x.oc.match(/chequeaRespuestaTest\(\s*'[^']*'\s*,\s*'([a-zA-Z])'/)).find(Boolean);
let cor = mt ? mt[1].toLowerCase() : "";
if (cor && !opts.some((x) => x.L === cor)) cor = "";
const tt = q.querySelector(".pregunta"),
ex = box.querySelector("#explicacion" + k),
enOtra = (n) => n.closest(".cabeceraPregunta,.pregunta,div.respuesta,[id^=explicacion]");
let ex2 = "";
for (const im of q.querySelectorAll("img")) if (!enOtra(im)) ex2 += await imgH(im);
const ops = [];
for (const x of opts) {
const hh = await rich(x.d);
if (!norm(hh.replace(/<(?!img)[^>]*>/g, ""))) av.opcionVacia++;
ops.push({ l: x.L, html: hh });
}
const eh = ex ? await rich(ex) : "";
const df = dif(q);
if (!cor) av.sinCorrecta++;
if (!eh) av.sinExplicacion++;
if (!df) av.sinDificultad++;
out.push({
n: k,
enunciado: ((await rich(tt)) || esc("Pregunta " + k)) + ex2,
opciones: ops,
correcta: cor,
confirmada: !!cor,
explicacion: eh,
dificultad: df,
});
}
box.replaceChildren();
return { out, av };
};
const lote = [],
fallidos = [],
avisos = [];
let nPreg = 0;
for (let i = 0; i < tests.length && !stop; i++) {
const t = tests[i];
say("Test " + (i + 1) + " de " + tests.length + "\n" + t.titulo + "\n\nPreguntas: " + nPreg + " · Imágenes: " + nImg + (nImgMal ? " (" + nImgMal + " pendientes)" : ""));
try {
const malAntes = nImgMal;
const { out, av } = await sacar(await pedir(t));
if (!out.length) throw new Error("no salió ninguna pregunta (¿sesión caducada?)");
nPreg += out.length;
const a = [];
if (t.esperadas && out.length !== t.esperadas) a.push(out.length + " de " + t.esperadas + " preguntas");
if (av.sinCorrecta) a.push(av.sinCorrecta + " sin correcta");
if (av.opcionVacia) a.push(av.opcionVacia + " opciones vacías");
if (av.sinExplicacion) a.push(av.sinExplicacion + " sin explicación");
if (av.sinDificultad) a.push(av.sinDificultad + " sin dificultad");
if (nImgMal > malAntes) a.push(nImgMal - malAntes + " imágenes las descargará pj.fire");
if (a.length) avisos.push("«" + t.titulo + "»: " + a.join(", "));
lote.push({ temaId: t.temaId, tema: temas[t.temaId] || "", titulo: t.titulo, esperadas: t.esperadas, avisos: a, preguntas: out });
} catch (e) {
fallidos.push("«" + t.titulo + "»: " + e.message);
}
await w(250);
}
box.remove();
const paquete = { tipo: "pjfire-lote", v: 2, origen: location.href, total: tests.length, tests: lote };
sb.remove();
msg.textContent =
(stop ? "Parado. " : "¡Hecho! ") + lote.length + " de " + tests.length + " tests · " + nPreg + " preguntas · " + nImg + " imágenes";
const lista = (tit, xs, color) => {
if (!xs.length) return;
const d = mk("div", "margin:8px 0;font-size:13px;color:" + color);
d.append(mk("b", "", { textContent: tit }));
const ul = mk("ul", "margin:4px 0;padding-left:18px");
xs.forEach((x) => ul.append(mk("li", "", { textContent: x })));
d.append(ul);
P.append(d);
};
lista("No se pudieron sacar (vuelve a pasar el marcador):", fallidos, "#ff8a80");
lista("Revisa:", avisos, "#ffd180");
if (!fallidos.length && !avisos.length && !stop)
P.append(mk("div", "margin:8px 0;color:#b9f6ca", { textContent: "Todo completo: todas las preguntas, correctas, explicaciones e imágenes." }));
const est = mk("div", "margin:10px 0;font-weight:600"),
b0 = mk("button", "font-size:17px;padding:12px 16px;border:0;border-radius:8px;background:#f07611;color:white;margin-right:8px", {
textContent: "Enviar a pj.fire",
type: "button",
}),
b4 = mk("button", "font-size:17px;padding:12px 16px;border:0;border-radius:8px;background:dimgray;color:white", {
textContent: "Cerrar",
type: "button",
});
P.append(est, b0, b4);
b4.onclick = () => P.remove();
let enviado = false;
addEventListener("message", (e) => {
if (e.origin !== APP || !e.data) return;
if (e.data.tipo === "pjfire-listo" && !enviado) {
enviado = true;
e.source.postMessage(paquete, APP);
est.textContent = "Enviado: confirma en pj.fire.";
} else if (e.data.tipo === "pjfire-recibido") est.textContent = "¡pj.fire lo ha recibido!";
});
const enviar = () => {
enviado = false;
const v = window.open(APP + "/#importar-especifico", "_blank");
est.textContent = v ? "Abriendo pj.fire…" : "Pulsa «Enviar a pj.fire».";
return !!v;
};
b0.onclick = () => {
if (!enviar()) est.textContent = "El navegador no deja abrir pj.fire: permite las ventanas emergentes.";
};
if (lote.length) enviar();
} catch (e) {
box.remove();
P.remove();
alert("Error: " + e.message);
}
})();
void 0;
