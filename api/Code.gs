/**
 * API Google Apps Script — Liste de démarchage de dons
 * Script LIÉ à la Google Sheet (Extensions > Apps Script).
 * Lecture : publique (GET). Écriture : code éditeur requis (POST).
 */
const CFG = { SHEET: "Démarchage", EDITORS: "Editeurs", LISTS: "Listes", LOG: "Historique", MAX_FAILS: 15 };
const HEADERS = ["ID", "Qui", "Où", "Démarché par", "Type de contact", "Réponse", "Montant du don", "Niveau de sponsoring", "Note", "Créé le", "Modifié le", "Modifié par"];

/* ---------- Installation (à lancer UNE fois) ---------- */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const get = n => ss.getSheetByName(n);
  const sh = get(CFG.SHEET) || ss.insertSheet(CFG.SHEET);
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold").setBackground("#0F6B6B").setFontColor("#ffffff");
  sh.setFrozenRows(1);
  ["A:F", "H:I", "L:L"].forEach(r => sh.getRange(r).setNumberFormat("@")); // texte : aucune formule interprétée
  sh.getRange("G:G").setNumberFormat("#,##0.00 \"€\"");
  sh.getRange("J:K").setNumberFormat("dd/MM/yyyy HH:mm");
  sh.setColumnWidths(1, 12, 150);

  let li = get(CFG.LISTS);
  if (!li) {
    li = ss.insertSheet(CFG.LISTS);
    li.getRange(1, 1, 6, 3).setValues([
      ["Type de contact", "Réponse", "Niveau de sponsoring"],
      ["Téléphone", "À contacter", "Aucun"],
      ["Email", "En attente", "Bronze"],
      ["Courrier", "Accepté", "Argent"],
      ["Visite", "Refusé", "Or"],
      ["Réseaux sociaux", "Sans réponse", "Platine"]]);
    li.getRange("A1:C1").setFontWeight("bold");
  }
  [["E", "A"], ["F", "B"], ["H", "C"]].forEach(([col, src]) => {
    const rule = SpreadsheetApp.newDataValidation().requireValueInRange(li.getRange(src + "2:" + src), true).setAllowInvalid(false).build();
    sh.getRange(col + "2:" + col).setDataValidation(rule);
  });

  let ed = get(CFG.EDITORS);
  if (!ed) {
    ed = ss.insertSheet(CFG.EDITORS);
    ed.getRange(1, 1, 2, 3).setValues([["Nom", "Code", "Actif (OUI/NON)"], ["Exemple", "CHANGEZ-MOI-2026", "NON"]]);
    ed.getRange("A1:C1").setFontWeight("bold");
    ed.getRange("B:B").setNumberFormat("@");
  }
  if (!get(CFG.LOG)) {
    const lg = ss.insertSheet(CFG.LOG);
    lg.getRange(1, 1, 1, 6).setValues([["Date", "Éditeur", "Action", "ID", "Avant", "Après"]]).setFontWeight("bold");
  }
}

/* ---------- Saisie directe dans la Sheet : ID + dates automatiques ---------- */
function onEdit(e) {
  const sh = e.range.getSheet();
  if (sh.getName() !== CFG.SHEET) return;
  const now = new Date(); now.setMilliseconds(0);
  for (let r = e.range.getRow(); r <= e.range.getLastRow(); r++) {
    if (r < 2) continue;
    const row = sh.getRange(r, 1, 1, 12).getValues()[0];
    if (!row.slice(1, 9).some(v => String(v).trim() !== "")) continue;
    if (!row[0]) sh.getRange(r, 1).setValue(Utilities.getUuid().slice(0, 8));
    if (!row[9]) sh.getRange(r, 10).setValue(now);
    sh.getRange(r, 11).setValue(now);
    sh.getRange(r, 12).setValue("Google Sheets");
  }
}

/* ---------- Points d entrée HTTP ---------- */
function doGet(e) {
  try {
    const a = (e && e.parameter && e.parameter.action) || "list";
    if (a === "list") return out({ ok: true, data: { rows: readAll(), lists: readLists() } });
    fail("Action inconnue.");
  } catch (err) { return out(errorOf(err)); }
}

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    const user = authenticate(b.token);
    if (b.action === "auth") return out({ ok: true, data: { name: user } });
    if (b.action === "create" || b.action === "update") return out(save(b, user));
    fail("Action inconnue.");
  } catch (err) { return out(errorOf(err)); }
}

/* ---------- Sécurité ---------- */
function authenticate(token) {
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get("fails") || 0);
  if (fails >= CFG.MAX_FAILS) fail("Trop de tentatives. Réessayez dans 10 minutes.");
  const t = String(token || "").trim();
  if (t.length >= 8) {
    const rows = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.EDITORS).getDataRange().getValues().slice(1);
    for (const r of rows) {
      if (String(r[1]).trim() === t && String(r[2]).trim().toUpperCase() === "OUI") return String(r[0]);
    }
  }
  cache.put("fails", fails + 1, 600);
  fail("Code invalide.");
}

/* ---------- Lecture ---------- */
function readAll() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.SHEET);
  if (sh.getLastRow() < 2) return [];
  const iso = v => v instanceof Date ? v.toISOString() : String(v || "");
  return sh.getRange(2, 1, sh.getLastRow() - 1, 12).getValues()
    .filter(r => r[0] && String(r[1]).trim())
    .map(r => ({
      id: String(r[0]), qui: String(r[1]), ou: String(r[2]), demarchePar: String(r[3]), type: String(r[4]),
      reponse: String(r[5]), montant: r[6] === "" ? "" : Number(r[6]), niveau: String(r[7]), note: String(r[8]),
      creeLe: iso(r[9]), modifieLe: iso(r[10]), modifiePar: String(r[11])
    }));
}

function readLists() {
  const li = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.LISTS);
  const v = li.getDataRange().getValues().slice(1);
  const col = i => v.map(r => String(r[i]).trim()).filter(Boolean);
  return { type: col(0), reponse: col(1), niveau: col(2) };
}

/* ---------- Écriture ---------- */
function save(b, user) {
  const d = clean(b.data || {});
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.SHEET);
    const now = new Date(); now.setMilliseconds(0);
    if (b.action === "create") {
      const id = Utilities.getUuid().slice(0, 8);
      sh.appendRow([id, d.qui, d.ou, d.demarchePar, d.type, d.reponse, d.montant, d.niveau, d.note, now, now, user]);
      log(user, "create", id, "", d);
      return { ok: true, data: { id } };
    }
    const id = String(b.data.id || "");
    const ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().flat().map(String) : [];
    const i = id ? ids.indexOf(id) : -1;
    if (i < 0) fail("Ligne introuvable (supprimée ?). Rechargez la page.");
    const r = i + 2;
    const cur = sh.getRange(r, 1, 1, 12).getValues()[0];
    const curMod = (cur[10] instanceof Date ? cur[10].toISOString() : String(cur[10])).slice(0, 19);
    if (String(b.data.modifieLe || "").slice(0, 19) !== curMod) fail("Cette ligne a été modifiée entre-temps. Rechargez la page.");
    sh.getRange(r, 1, 1, 12).setValues([[id, d.qui, d.ou, d.demarchePar, d.type, d.reponse, d.montant, d.niveau, d.note, cur[9], now, user]]);
    log(user, "update", id, cur.slice(1, 9), d);
    return { ok: true, data: { id } };
  } finally { lock.releaseLock(); }
}

function clean(x) {
  const L = readLists();
  const s = (v, max) => String(v == null ? "" : v).trim().slice(0, max);
  const d = { qui: s(x.qui, 200), ou: s(x.ou, 200), demarchePar: s(x.demarchePar, 100), type: s(x.type, 50), reponse: s(x.reponse, 50), niveau: s(x.niveau, 50), note: s(x.note, 2000) };
  if (!d.qui) fail("Le champ « Qui » est obligatoire.");
  if (d.type && L.type.indexOf(d.type) < 0) fail("Type de contact invalide.");
  if (d.reponse && L.reponse.indexOf(d.reponse) < 0) fail("Réponse invalide.");
  if (d.niveau && L.niveau.indexOf(d.niveau) < 0) fail("Niveau de sponsoring invalide.");
  if (x.montant === "" || x.montant == null) d.montant = "";
  else {
    const n = Number(String(x.montant).replace(",", "."));
    if (!isFinite(n) || n < 0 || n > 1e9) fail("Montant invalide.");
    d.montant = Math.round(n * 100) / 100;
  }
  return d;
}

/* ---------- Utilitaires ---------- */
function log(user, action, id, before, after) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.LOG)
    .appendRow([new Date(), user, action, id, before ? JSON.stringify(before) : "", JSON.stringify(after)]);
}
function fail(msg) { const e = new Error(msg); e.user = true; throw e; }
function errorOf(err) {
  if (!err.user) console.error(err);
  return { ok: false, error: err.user ? err.message : "Erreur serveur." };
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
