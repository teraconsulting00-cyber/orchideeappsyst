/**
 * Serveur Orchidé Nature - API locale SQLite + backup
 * Résout CORS et remplace Google Apps Script
 */
const path = require("path");
const fs = require("fs");
const express = require("express");

const { getDb, uuidShort, exportBackup, saveBackupFile, copyDbToBackup, BACKUP_DIR } = require("./server/db.js");

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname)));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

function createResponse(success, message, data = null) {
  const out = { success, message };
  if (data != null) out.data = data;
  return out;
}

app.post("/api", (req, res) => {
  let body = req.body || {};
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { return res.json(createResponse(false, "JSON invalide")); }
  }
  const action = body.action || (req.query && req.query.action);
  if (!action) return res.json(createResponse(false, "Champ action manquant"));

  try {
    const db = getDb();
    let result;

    switch (action) {
      case "login":
        result = handleLogin(db, body);
        break;
      case "logAuth":
        result = handleLogAuth(db, body);
        break;
      case "getAgences":
        result = handleGetAgences(db);
        break;
      case "getOperations":
        result = handleGetOperations(db, body);
        break;
      case "createOperation":
        result = handleCreateOperation(db, body);
        break;
      case "updateOperation":
        result = handleUpdateOperation(db, body);
        break;
      case "getProducts":
        result = handleGetProducts(db);
        break;
      case "getStocks":
        result = handleGetStocks(db, body);
        break;
      case "getCommandes":
        result = handleGetCommandes(db, body);
        break;
      case "createCommande":
        result = handleCreateCommande(db, body);
        break;
      case "openCaisseSession":
        result = handleOpenCaisseSession(db, body);
        break;
      case "closeCaisseSession":
        result = handleCloseCaisseSession(db, body);
        break;
      case "addMouvementCaisse":
        result = handleAddMouvementCaisse(db, body);
        break;
      case "getSessions":
        result = handleGetSessions(db, body);
        break;
      case "getMouvementsCaisse":
        result = handleGetMouvementsCaisse(db, body);
        break;
      case "getNotificationsLog":
        result = handleGetNotificationsLog(db);
        break;
      case "validateNotification":
        result = handleValidateNotification(db, body);
        break;
      case "getContactsNotifications":
        result = handleGetContactsNotifications(db);
        break;
      case "getParametresAdmin":
        result = handleGetParametresAdmin(db);
        break;
      case "setParametresAdmin":
        result = handleSetParametresAdmin(db, body);
        break;
      case "sendNotification":
        result = handleSendNotification(db, body);
        break;
      default:
        result = createResponse(false, "Action inconnue");
    }
    res.json(result);
  } catch (err) {
    console.error("[API]", action, err);
    res.status(500).json(createResponse(false, "Erreur: " + (err.message || "serveur")));
  }
});

function handleLogin(db, data) {
  const email = String(data.email || "").trim();
  const password = String(data.password || "");
  if (!email || !password) return createResponse(false, "Identifiants incorrects");
  const row = db.prepare("SELECT email, password, role, nom, agence_id, statut FROM comptes WHERE email = ?").get(email);
  if (!row) return createResponse(false, "Identifiants incorrects");
  if (row.password !== password) return createResponse(false, "Identifiants incorrects");
  if ((row.statut || "").toUpperCase() !== "ACTIF") return createResponse(false, "Compte désactivé");
  db.prepare("UPDATE comptes SET last_login = ? WHERE email = ?").run(new Date().toISOString(), email);
  const user = { email: row.email, role: row.role, nom: row.nom || row.email, agence_id: row.agence_id, statut: row.statut };
  return createResponse(true, "Connexion réussie", { user });
}

function handleLogAuth(db, data) {
  const id = "LOG-" + uuidShort();
  db.prepare("INSERT INTO auth_logs (id, email, log_action, date, ip, success) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, data.email || "", data.logAction || data.action || "", new Date().toISOString(), data.ip || "N/A", 1);
  return createResponse(true, "Log enregistré");
}

function handleGetAgences(db) {
  const rows = db.prepare("SELECT id, nom, code FROM agences").all();
  const agences = rows.map((r) => ({ id: r.id, nom: r.nom, code: r.code || "" }));
  return createResponse(true, "OK", { agences });
}

function handleGetOperations(db, data) {
  let sql = "SELECT id, numero, agence_id, type, produit_id, quantite, prix_unitaire, montant_total, date, heure, created_by, timestamp, notes FROM operations WHERE 1=1";
  const params = [];
  if (data.agence_id) { sql += " AND agence_id = ?"; params.push(data.agence_id); }
  if (data.date_debut) { sql += " AND date >= ?"; params.push(data.date_debut); }
  if (data.date_fin) { sql += " AND date <= ?"; params.push(data.date_fin); }
  sql += " ORDER BY timestamp DESC";
  const rows = db.prepare(sql).all(...params);
  const operations = rows.map((r) => ({
    id: r.id, numero: r.numero, agence_id: r.agence_id, type: r.type, produit_id: r.produit_id,
    quantite: r.quantite, prix_unitaire: r.prix_unitaire, montant_total: r.montant_total,
    date: r.date, heure: r.heure, created_by: r.created_by, timestamp: r.timestamp, notes: r.notes || ""
  }));
  return createResponse(true, "OK", { operations });
}

function handleCreateOperation(db, data) {
  const id = "OP-" + uuidShort();
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().split(" ")[0];
  const numero = "OP-" + (data.agence_id || "") + "-" + now.getFullYear() + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0") + String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0") + String(now.getSeconds()).padStart(2, "0");
  db.prepare(
    "INSERT INTO operations (id, numero, agence_id, type, produit_id, quantite, prix_unitaire, montant_total, date, heure, created_by, timestamp, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, numero, data.agence_id, data.type, data.produit_id, data.quantite, data.prix_unitaire, data.montant_total, data.date || dateStr, data.heure || timeStr, data.created_by, now.toISOString(), data.notes || null);
  if (data.type === "VENTE" || data.type === "RETOUR") {
    const delta = data.type === "VENTE" ? -data.quantite : data.quantite;
    updateStock(db, data.agence_id, data.produit_id, delta);
  }
  if (data.type === "RECEPTION") updateStock(db, data.agence_id, data.produit_id, data.quantite);
  return createResponse(true, "Opération créée", { id, numero });
}

function updateStock(db, agence_id, produit_id, quantite) {
  const now = new Date().toISOString();
  const row = db.prepare("SELECT id, quantite_actuelle FROM stocks WHERE agence_id = ? AND produit_id = ?").get(agence_id, produit_id);
  if (row) {
    const newQty = row.quantite_actuelle + quantite;
    if (newQty < 0) throw new Error("Stock insuffisant pour cette agence/produit");
    db.prepare("UPDATE stocks SET quantite_actuelle = ?, updated_at = ? WHERE id = ?").run(newQty, now, row.id);
  } else {
    if (quantite < 0) throw new Error("Stock introuvable pour cette agence/produit");
    const id = "STK-" + uuidShort();
    db.prepare("INSERT INTO stocks (id, agence_id, produit_id, quantite_actuelle, updated_at) VALUES (?, ?, ?, ?, ?)").run(id, agence_id, produit_id, quantite, now);
  }
}

function handleUpdateOperation(db, data) {
  const id = data.operation_id;
  const row = db.prepare("SELECT id FROM operations WHERE id = ?").get(id);
  if (!row) return createResponse(false, "Opération non trouvée");
  const updates = [];
  const params = [];
  if (data.quantite !== undefined) { updates.push("quantite = ?"); params.push(data.quantite); }
  if (data.prix_unitaire !== undefined) { updates.push("prix_unitaire = ?"); params.push(data.prix_unitaire); }
  if (data.montant_total !== undefined) { updates.push("montant_total = ?"); params.push(data.montant_total); }
  if (data.notes !== undefined) { updates.push("notes = ?"); params.push(data.notes); }
  if (params.length) {
    params.push(id);
    db.prepare("UPDATE operations SET " + updates.join(", ") + " WHERE id = ?").run(...params);
  }
  return createResponse(true, "Opération mise à jour");
}

function handleGetProducts(db) {
  const rows = db.prepare("SELECT id, code, nom, prix_ht, prix_ttc FROM produits WHERE actif = 1").all();
  const products = rows.map((r) => ({ id: r.id, code: r.code, nom: r.nom, prix_ht: r.prix_ht, prix_ttc: r.prix_ttc }));
  return createResponse(true, "OK", { products });
}

function handleGetStocks(db, data) {
  let sql = "SELECT id, agence_id, produit_id, quantite_actuelle FROM stocks WHERE 1=1";
  const params = [];
  if (data.agence_id) { sql += " AND agence_id = ?"; params.push(data.agence_id); }
  const rows = db.prepare(sql).all(...params);
  const stocks = rows.map((r) => ({ id: r.id, agence_id: r.agence_id, produit_id: r.produit_id, quantite_actuelle: r.quantite_actuelle }));
  return createResponse(true, "OK", { stocks });
}

function handleGetCommandes(db, data) {
  let sql = "SELECT id, numero, agence_id, type, date_commande, date_livraison, statut FROM commandes WHERE 1=1";
  const params = [];
  if (data.agence_id) { sql += " AND agence_id = ?"; params.push(data.agence_id); }
  const rows = db.prepare(sql).all(...params);
  const commandes = rows.map((r) => ({ id: r.id, numero: r.numero, agence_id: r.agence_id, type: r.type, date_commande: r.date_commande, date_livraison: r.date_livraison, statut: r.statut }));
  return createResponse(true, "OK", { commandes });
}

function handleCreateCommande(db, data) {
  const id = "CMD-" + uuidShort();
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const numero = "CMD-" + (data.agence_id || "") + "-" + dateStr.replace(/-/g, "");
  db.prepare(
    "INSERT INTO commandes (id, numero, agence_id, type, date_commande, date_livraison, statut, priorite, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, numero, data.agence_id || null, data.type || "MANUELLE", data.date_commande || dateStr, data.date_livraison || null, data.statut || "EN_ATTENTE", data.priorite || "NORMAL", data.created_by || null);
  if (data.produit_id && data.quantite) {
    db.prepare("INSERT INTO lignes_commandes (commande_id, produit_id, quantite) VALUES (?, ?, ?)").run(id, data.produit_id, data.quantite);
  }
  return createResponse(true, "Commande créée", { id, numero });
}

function handleOpenCaisseSession(db, data) {
  const id = "SES-" + uuidShort();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO sessions_caisse (id, caissier_email, date_ouverture, fond_caisse, montant_attendu, montant_reel, ecart, statut) VALUES (?, ?, ?, ?, 0, 0, 0, 'OUVERTE')"
  ).run(id, data.caissier_email, now, data.fond_caisse || 0);
  return createResponse(true, "Session ouverte", { session_id: id });
}

function handleCloseCaisseSession(db, data) {
  const row = db.prepare("SELECT id FROM sessions_caisse WHERE id = ?").get(data.session_id);
  if (!row) return createResponse(false, "Session non trouvée");
  db.prepare(
    "UPDATE sessions_caisse SET date_fermeture = ?, montant_attendu = ?, montant_reel = ?, ecart = ?, statut = 'FERMEE' WHERE id = ?"
  ).run(new Date().toISOString(), data.montant_attendu, data.montant_reel, data.ecart, data.session_id);
  return createResponse(true, "Session fermée");
}

function handleAddMouvementCaisse(db, data) {
  const id = "MVT-" + uuidShort();
  db.prepare(
    "INSERT INTO mouvements_caisse (id, session_id, type, montant, description, timestamp, caissier_email) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, data.session_id, data.type, data.montant, data.description || "", new Date().toISOString(), data.caissier_email || "");
  return createResponse(true, "Mouvement ajouté", { id });
}

function handleGetSessions(db, data) {
  let sql = "SELECT id, caissier_email, date_ouverture, date_fermeture, fond_caisse, montant_attendu, montant_reel, ecart, statut FROM sessions_caisse WHERE 1=1";
  const params = [];
  if (data.caissier_email) { sql += " AND caissier_email = ?"; params.push(data.caissier_email); }
  sql += " ORDER BY date_ouverture DESC";
  const rows = db.prepare(sql).all(...params);
  const sessions = rows.map((r) => ({
    id: r.id, caissier_email: r.caissier_email, date_ouverture: r.date_ouverture, date_fermeture: r.date_fermeture,
    fond_caisse: r.fond_caisse, montant_attendu: r.montant_attendu, montant_reel: r.montant_reel, ecart: r.ecart, statut: r.statut
  }));
  return createResponse(true, "OK", { sessions });
}

function handleGetMouvementsCaisse(db, data) {
  const rows = db.prepare(
    "SELECT id, session_id, type, montant, description, timestamp, caissier_email FROM mouvements_caisse WHERE session_id = ? ORDER BY timestamp"
  ).all(data.session_id);
  const mouvements = rows.map((r) => ({ id: r.id, session_id: r.session_id, type: r.type, montant: r.montant, description: r.description, timestamp: r.timestamp, caissier_email: r.caissier_email }));
  return createResponse(true, "OK", { mouvements });
}

function handleGetNotificationsLog(db) {
  const rows = db.prepare("SELECT id, type, id_reference, canal, destinataire, statut, date, valide FROM notifications_log").all();
  const logs = rows.map((r) => ({ id: r.id, type: r.type, id_reference: r.id_reference, canal: r.canal, destinataire: r.destinataire, statut: r.statut, date: r.date, valide: !!r.valide }));
  return createResponse(true, "OK", { logs });
}

function handleValidateNotification(db, data) {
  const r = db.prepare("UPDATE notifications_log SET valide = 1 WHERE id = ?").run(data.log_id);
  if (r.changes === 0) return createResponse(false, "Log non trouvé");
  return createResponse(true, "Notification validée");
}

function handleGetContactsNotifications(db) {
  const rows = db.prepare("SELECT id, nom, prenom, fonction, whatsapp, email, types FROM contacts_notifications WHERE actif = 1").all();
  const contacts = rows.map((r) => ({ id: r.id, nom: r.nom, prenom: r.prenom, fonction: r.fonction, whatsapp: r.whatsapp, email: r.email, types: r.types || "TOUS" }));
  return createResponse(true, "OK", { contacts });
}

function handleGetParametresAdmin(db) {
  const rows = db.prepare("SELECT key, value FROM parametres_admin").all();
  const params = {};
  rows.forEach((r) => { params[r.key] = r.value; });
  return createResponse(true, "OK", { params });
}

function handleSetParametresAdmin(db, data) {
  const r = db.prepare("UPDATE parametres_admin SET value = ? WHERE key = ?").run(data.value, data.key);
  if (r.changes === 0) db.prepare("INSERT INTO parametres_admin (key, value) VALUES (?, ?)").run(data.key, data.value);
  return createResponse(true, "Paramètre enregistré");
}

function handleSendNotification(db, data) {
  const id = "NOT-" + uuidShort();
  db.prepare(
    "INSERT INTO notifications_log (id, type, id_reference, canal, destinataire, statut, date, valide) VALUES (?, ?, ?, ?, ?, 'ENVOYE', ?, 0)"
  ).run(id, data.type || "", data.id_reference || "", data.canal || "", data.destinataire || "", new Date().toISOString());
  return createResponse(true, "Notification envoyée", { id });
}

app.get("/api/backup", (req, res) => {
  try {
    const format = (req.query && req.query.format) || "json";
    if (format === "json") {
      const backup = exportBackup();
      res.setHeader("Content-Disposition", "attachment; filename=orchidee_backup_" + new Date().toISOString().slice(0, 10) + ".json");
      res.json(backup);
    } else {
      const dbPath = require("./server/db.js").DB_PATH;
      if (!fs.existsSync(dbPath)) return res.status(404).json(createResponse(false, "Base non trouvée"));
      res.download(dbPath, "orchidee_" + new Date().toISOString().slice(0, 10) + ".db");
    }
  } catch (e) {
    res.status(500).json(createResponse(false, e.message));
  }
});

app.post("/api/backup/save", (req, res) => {
  try {
    const filePath = saveBackupFile();
    const dbPath = copyDbToBackup();
    res.json(createResponse(true, "Sauvegarde créée", { json: filePath, db: dbPath }));
  } catch (e) {
    res.status(500).json(createResponse(false, e.message));
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, api: "orchidee-nature", version: "2.0.0" });
});

if (process.argv[2] === "backup") {
  try {
    saveBackupFile();
    copyDbToBackup();
    console.log("Backup créé dans", BACKUP_DIR);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
  process.exit(0);
}

app.listen(PORT, () => {
  console.log("Orchidé Nature – API locale: http://localhost:" + PORT);
  console.log("  Login: http://localhost:" + PORT + "/index.html");
  console.log("  Backup JSON: GET /api/backup?format=json");
  console.log("  Backup DB:   GET /api/backup?format=db");
});
