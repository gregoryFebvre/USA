(() => {
"use strict";
const API = window.CONFIG.API_URL;
const COLS = [
  { k: "qui", t: "Qui" }, { k: "ou", t: "Où" }, { k: "demarchePar", t: "Démarché par" },
  { k: "type", t: "Type de contact" }, { k: "reponse", t: "Réponse" },
  { k: "montant", t: "Don", num: true }, { k: "niveau", t: "Sponsoring" }, { k: "note", t: "Note" }
];
const $ = s => document.querySelector(s);
const st = { rows: [], lists: { type: [], reponse: [], niveau: [] }, q: "", f: { type: "", reponse: "", niveau: "", demarchePar: "" },
  sort: { k: "modifieLe", dir: -1 }, page: 1, size: 25, token: sessionStorage.getItem("tok") || "", user: sessionStorage.getItem("usr") || "" };
const esc = s => String(s ?? "").replace(/[&<>"\x27]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "\x27": "&#39;" }[c]));
const norm = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const eur = n => n === "" || n == null ? "" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

async function call(body) {
  let r;
  try {
    r = await fetch(body ? API : API + "?action=list",
      body ? { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) } : undefined);
  } catch { throw new Error("Connexion impossible. Vérifiez votre réseau."); }
  let j;
  try { j = await r.json(); } catch { throw new Error("Réponse invalide du serveur."); }
  if (!j.ok) throw new Error(j.error || "Erreur inconnue.");
  return j.data;
}

function toast(msg, bad) {
  const t = $("#toast"); t.textContent = msg; t.className = "show" + (bad ? " bad" : "");
  clearTimeout(toast.h); toast.h = setTimeout(() => t.className = "", 3500);
}

async function load() {
  try {
    const d = await call();
    st.rows = d.rows; st.lists = d.lists;
    $("#banner").hidden = true;
    fillFilters(); render();
  } catch (e) {
    $("#banner").hidden = false; $("#banner").textContent = e.message;
    $("#summary").textContent = "Données indisponibles.";
  }
}

function fillSelect(sel, label, values, keep) {
  sel.innerHTML = `<option value="">${esc(label)}</option>` + values.map(v => `<option>${esc(v)}</option>`).join("");
  sel.value = keep || "";
}
function fillFilters() {
  const people = [...new Set(st.rows.map(r => r.demarchePar).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  fillSelect($("#fType"), "Tous les types", st.lists.type, st.f.type);
  fillSelect($("#fReponse"), "Toutes les réponses", st.lists.reponse, st.f.reponse);
  fillSelect($("#fNiveau"), "Tous les niveaux", st.lists.niveau, st.f.niveau);
  fillSelect($("#fDemarchePar"), "Tous les démarcheurs", people, st.f.demarchePar);
  $("#dlPeople").innerHTML = people.map(p => `<option value="${esc(p)}">`).join("");
}

function view() {
  const q = norm(st.q);
  const r = st.rows.filter(x => (!q || norm(COLS.map(c => x[c.k]).join(" ")).includes(q)) &&
    Object.entries(st.f).every(([k, v]) => !v || x[k] === v));
  const { k, dir } = st.sort;
  r.sort(k === "montant"
    ? (a, b) => ((a[k] === "" ? -1 : a[k]) - (b[k] === "" ? -1 : b[k])) * dir
    : (a, b) => String(a[k] ?? "").localeCompare(String(b[k] ?? ""), "fr", { numeric: true }) * dir);
  return r;
}

function render() {
  const all = view();
  const pages = Math.max(1, Math.ceil(all.length / st.size));
  st.page = Math.min(st.page, pages);
  const slice = all.slice((st.page - 1) * st.size, st.page * st.size);
  const total = all.reduce((s, r) => s + (Number(r.montant) || 0), 0);
  $("#summary").textContent = `${all.length} contact${all.length > 1 ? "s" : ""}, ${eur(total) || "0 €"} de dons`;

  $("#thead").innerHTML = "<tr>" + COLS.map(c => {
    const s = st.sort.k === c.k ? (st.sort.dir > 0 ? "ascending" : "descending") : "none";
    return `<th class="${c.num ? "num" : ""}" aria-sort="${s}"><button data-sort="${c.k}">${c.t}</button></th>`;
  }).join("") + (st.token ? "<th></th>" : "") + "</tr>";

  $("#tbody").innerHTML = slice.length ? slice.map(r => "<tr>" + COLS.map(c => {
    if (c.k === "montant") return `<td class="num">${esc(eur(r.montant))}</td>`;
    if (c.k === "reponse" || c.k === "niveau" || c.k === "type") return `<td>${r[c.k] ? `<span class="tag${r[c.k] === "Accepté" ? " ok" : ""}">${esc(r[c.k])}</span>` : ""}</td>`;
    return `<td class="${c.k === "note" ? "note" : ""}">${esc(r[c.k])}</td>`;
  }).join("") + (st.token ? `<td><button class="ghost" data-edit="${esc(r.id)}">Modifier</button></td>` : "") + "</tr>").join("")
    : `<tr><td class="empty" colspan="9">Aucun contact ne correspond à cette recherche.</td></tr>`;

  $("#pageInfo").textContent = `Page ${st.page} sur ${pages}`;
  $("#prev").disabled = st.page <= 1; $("#next").disabled = st.page >= pages;
  $("#btnAdd").hidden = !st.token;
  $("#btnLogin").textContent = st.token ? "Se déconnecter" : "Espace éditeur";
  $("#who").textContent = st.user ? `Connecté : ${st.user}` : "";
}

/* ----- Authentification ----- */
function logout() { st.token = ""; st.user = ""; sessionStorage.clear(); render(); }
$("#btnLogin").onclick = () => { if (st.token) { logout(); toast("Vous êtes déconnecté."); } else { $("#loginErr").textContent = ""; $("#loginForm").reset(); $("#dlgLogin").showModal(); } };
$("#loginForm").onsubmit = async e => {
  e.preventDefault();
  const code = e.target.code.value.trim();
  try {
    const d = await call({ action: "auth", token: code });
    st.token = code; st.user = d.name;
    sessionStorage.setItem("tok", code); sessionStorage.setItem("usr", d.name);
    $("#dlgLogin").close(); render(); toast(`Bienvenue ${d.name}.`);
  } catch (err) { $("#loginErr").textContent = err.message; }
};

/* ----- Formulaire ----- */
function openForm(row) {
  const f = $("#form"); f.reset();
  fillSelect(f.type, "—", st.lists.type); fillSelect(f.reponse, "—", st.lists.reponse); fillSelect(f.niveau, "—", st.lists.niveau);
  $("#formTitle").textContent = row ? "Modifier le contact" : "Ajouter un contact";
  $("#formErr").textContent = "";
  const r = row || {};
  f.rid.value = r.id || ""; f.rmod.value = r.modifieLe || "";
  ["qui", "ou", "demarchePar", "type", "reponse", "niveau", "note"].forEach(k => f[k].value = r[k] || "");
  f.montant.value = r.montant === "" || r.montant == null ? "" : String(r.montant).replace(".", ",");
  $("#dlgForm").showModal();
}
$("#btnAdd").onclick = () => openForm(null);
$("#form").onsubmit = async e => {
  e.preventDefault();
  const f = e.target, err = $("#formErr");
  const d = { id: f.rid.value, modifieLe: f.rmod.value, qui: f.qui.value.trim(), ou: f.ou.value.trim(), demarchePar: f.demarchePar.value.trim(),
    type: f.type.value, reponse: f.reponse.value, niveau: f.niveau.value, note: f.note.value.trim(), montant: f.montant.value.trim() };
  if (!d.qui) { err.textContent = "Indiquez qui est démarché."; return; }
  const n = Number(d.montant.replace(",", "."));
  if (d.montant && (!isFinite(n) || n < 0)) { err.textContent = "Le montant doit être un nombre positif."; return; }
  const btn = $("#btnSave"); btn.disabled = true; btn.textContent = "Enregistrement…"; err.textContent = "";
  try {
    await call({ action: d.id ? "update" : "create", token: st.token, data: d });
    $("#dlgForm").close(); toast("Contact enregistré."); await load();
  } catch (ex) {
    err.textContent = ex.message;
    if (/Code invalide/.test(ex.message)) { $("#dlgForm").close(); logout(); toast("Session expirée : reconnectez-vous.", true); }
  } finally { btn.disabled = false; btn.textContent = "Enregistrer"; }
};
document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => b.closest("dialog").close());

/* ----- Événements liste ----- */
$("#q").oninput = e => { st.q = e.target.value; st.page = 1; render(); };
[["#fType", "type"], ["#fReponse", "reponse"], ["#fNiveau", "niveau"], ["#fDemarchePar", "demarchePar"]]
  .forEach(([id, k]) => $(id).onchange = e => { st.f[k] = e.target.value; st.page = 1; render(); });
$("#btnReset").onclick = () => { st.q = ""; $("#q").value = ""; Object.keys(st.f).forEach(k => st.f[k] = ""); fillFilters(); st.page = 1; render(); };
$("#prev").onclick = () => { st.page--; render(); };
$("#next").onclick = () => { st.page++; render(); };
$("#thead").onclick = e => {
  const k = e.target.dataset.sort; if (!k) return;
  st.sort = { k, dir: st.sort.k === k ? -st.sort.dir : 1 }; render();
};
$("#tbody").onclick = e => {
  const id = e.target.dataset.edit; if (!id) return;
  openForm(st.rows.find(r => r.id === id));
};

if (API.includes("COLLER_ICI")) { $("#banner").hidden = false; $("#banner").textContent = "Configuration manquante : renseignez API_URL dans frontend/config.js."; }
else load();
})();
