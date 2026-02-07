/**
 * Module SQLite pour Orchidé Nature
 * Base de données locale + backup
 */
const path = require("path");
const fs = require("fs");

const DB_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DB_DIR, "orchidee.db");
const BACKUP_DIR = path.join(DB_DIR, "backups");

let db = null;

function getDb() {
  if (!db) {
    try {
      const Database = require("better-sqlite3");
      if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
      db = new Database(DB_PATH);
      db.pragma("journal_mode = WAL");
      db.pragma("foreign_keys = ON");
      initSchema(db);
      seedIfEmpty(db);
      seedStockIfEmpty(db);
    } catch (e) {
      console.error("[DB] Erreur init SQLite:", e.message);
      throw e;
    }
  }
  return db;
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS comptes (
      email TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      nom TEXT,
      agence_id TEXT,
      statut TEXT DEFAULT 'ACTIF',
      last_login TEXT
    );
    CREATE TABLE IF NOT EXISTS agences (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      code TEXT
    );
    CREATE TABLE IF NOT EXISTS produits (
      id TEXT PRIMARY KEY,
      code TEXT,
      nom TEXT,
      description TEXT,
      unite TEXT,
      prix_ht REAL,
      prix_ttc REAL,
      actif INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS operations (
      id TEXT PRIMARY KEY,
      numero TEXT NOT NULL,
      agence_id TEXT NOT NULL,
      type TEXT NOT NULL,
      produit_id TEXT NOT NULL,
      quantite REAL NOT NULL,
      prix_unitaire REAL,
      montant_total REAL,
      date TEXT,
      heure TEXT,
      created_by TEXT,
      timestamp TEXT,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS stocks (
      id TEXT PRIMARY KEY,
      agence_id TEXT NOT NULL,
      produit_id TEXT NOT NULL,
      quantite_actuelle REAL DEFAULT 0,
      seuil_alerte REAL DEFAULT 0,
      updated_at TEXT,
      UNIQUE(agence_id, produit_id)
    );
    CREATE TABLE IF NOT EXISTS commandes (
      id TEXT PRIMARY KEY,
      numero TEXT NOT NULL,
      agence_id TEXT NOT NULL,
      type TEXT DEFAULT 'MANUELLE',
      date_commande TEXT,
      date_livraison TEXT,
      statut TEXT DEFAULT 'EN_ATTENTE',
      priorite TEXT DEFAULT 'NORMAL',
      created_by TEXT
    );
    CREATE TABLE IF NOT EXISTS lignes_commandes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      commande_id TEXT NOT NULL,
      produit_id TEXT NOT NULL,
      quantite REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions_caisse (
      id TEXT PRIMARY KEY,
      caissier_email TEXT NOT NULL,
      date_ouverture TEXT NOT NULL,
      date_fermeture TEXT,
      fond_caisse REAL DEFAULT 0,
      montant_attendu REAL,
      montant_reel REAL,
      ecart REAL,
      statut TEXT DEFAULT 'OUVERTE'
    );
    CREATE TABLE IF NOT EXISTS mouvements_caisse (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      montant REAL NOT NULL,
      description TEXT,
      timestamp TEXT,
      caissier_email TEXT
    );
    CREATE TABLE IF NOT EXISTS notifications_log (
      id TEXT PRIMARY KEY,
      type TEXT,
      id_reference TEXT,
      canal TEXT,
      destinataire TEXT,
      statut TEXT,
      date TEXT,
      valide INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS contacts_notifications (
      id TEXT PRIMARY KEY,
      nom TEXT,
      prenom TEXT,
      fonction TEXT,
      whatsapp TEXT,
      email TEXT,
      types TEXT DEFAULT 'TOUS',
      actif INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS parametres_admin (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS auth_logs (
      id TEXT PRIMARY KEY,
      email TEXT,
      log_action TEXT,
      date TEXT,
      ip TEXT,
      success INTEGER DEFAULT 1
    );
    /* --- GESTION STOCK ALIMENTAIRE (matières premières + recettes + FIFO) --- */
    CREATE TABLE IF NOT EXISTS matieres_premieres (
      id TEXT PRIMARY KEY,
      code TEXT,
      nom TEXT NOT NULL,
      unite TEXT NOT NULL DEFAULT 'kg',
      actif INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS recettes (
      id TEXT PRIMARY KEY,
      produit_id TEXT NOT NULL REFERENCES produits(id),
      UNIQUE(produit_id)
    );
    CREATE TABLE IF NOT EXISTS recette_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recette_id TEXT NOT NULL REFERENCES recettes(id),
      matiere_premiere_id TEXT NOT NULL REFERENCES matieres_premieres(id),
      quantite REAL NOT NULL,
      unite TEXT NOT NULL,
      UNIQUE(recette_id, matiere_premiere_id)
    );
    CREATE TABLE IF NOT EXISTS lots_mp (
      id TEXT PRIMARY KEY,
      matiere_premiere_id TEXT NOT NULL,
      agence_id TEXT NOT NULL,
      numero_lot TEXT NOT NULL,
      date_reception TEXT NOT NULL,
      date_peremption TEXT NOT NULL,
      quantite_restante REAL NOT NULL DEFAULT 0,
      unite TEXT NOT NULL,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS declarations_production (
      id TEXT PRIMARY KEY,
      agence_id TEXT NOT NULL,
      date TEXT NOT NULL,
      heure TEXT,
      created_by TEXT,
      timestamp TEXT,
      statut TEXT DEFAULT 'VALIDEE'
    );
    CREATE TABLE IF NOT EXISTS lignes_production (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      declaration_id TEXT NOT NULL REFERENCES declarations_production(id),
      produit_id TEXT NOT NULL,
      quantite REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS declarations_fdj (
      id TEXT PRIMARY KEY,
      agence_id TEXT NOT NULL,
      date TEXT NOT NULL,
      heure TEXT,
      created_by TEXT,
      timestamp TEXT,
      statut TEXT DEFAULT 'ENREGISTREE'
    );
    CREATE TABLE IF NOT EXISTS lignes_fdj (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      declaration_fdj_id TEXT NOT NULL REFERENCES declarations_fdj(id),
      matiere_premiere_id TEXT NOT NULL,
      quantite_theorique REAL NOT NULL DEFAULT 0,
      quantite_reelle REAL NOT NULL DEFAULT 0,
      ecart REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS lots_pf (
      id TEXT PRIMARY KEY,
      produit_id TEXT NOT NULL,
      agence_id TEXT NOT NULL,
      numero_lot TEXT NOT NULL,
      date_production TEXT NOT NULL,
      date_peremption TEXT NOT NULL,
      quantite_restante REAL NOT NULL DEFAULT 0,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS mouvements_pf (
      id TEXT PRIMARY KEY,
      agence_id TEXT NOT NULL,
      produit_id TEXT NOT NULL,
      type TEXT NOT NULL,
      quantite REAL NOT NULL,
      lot_id TEXT,
      date TEXT NOT NULL,
      heure TEXT,
      created_by TEXT,
      notes TEXT,
      timestamp TEXT
    );
  `);
}

function seedIfEmpty(database) {
  const count = database.prepare("SELECT COUNT(*) as n FROM comptes").get();
  if (count.n > 0) return;

  const now = new Date().toISOString();
  const uuid = () => require("crypto").randomUUID().replace(/-/g, "").substring(0, 8);

  database.prepare(
    "INSERT INTO comptes (email, password, role, nom, agence_id, statut) VALUES (?, ?, ?, ?, ?, ?)"
  ).run("admin@orchidenature.com", "admin123", "admin", "Administrateur", null, "ACTIF");

  database.prepare(
    "INSERT INTO comptes (email, password, role, nom, agence_id, statut) VALUES (?, ?, ?, ?, ?, ?)"
  ).run("agence1@orchidenature.com", "agence1", "agency", "Agence Principale", "AG1", "ACTIF");

  database.prepare(
    "INSERT INTO comptes (email, password, role, nom, agence_id, statut) VALUES (?, ?, ?, ?, ?, ?)"
  ).run("caissier@orchidenature.com", "caissier1", "caissier", "Caissier", null, "ACTIF");

  database.prepare(
    "INSERT INTO agences (id, nom, code) VALUES (?, ?, ?)"
  ).run("AG1", "Agence Principale", "AG1");

  database.prepare(
    "INSERT INTO produits (id, code, nom, prix_ht, prix_ttc, actif) VALUES (?, ?, ?, ?, ?, ?)"
  ).run("PRD-001", "ART-001", "Produit Démo", 1000, 1200, 1);

  database.prepare(
    "INSERT INTO stocks (id, agence_id, produit_id, quantite_actuelle, updated_at) VALUES (?, ?, ?, ?, ?)"
  ).run("STK-" + uuid(), "AG1", "PRD-001", 100, now);

  database.prepare(
    "INSERT INTO parametres_admin (key, value) VALUES (?, ?)"
  ).run("notif_chaque_op", "false");
  database.prepare(
    "INSERT INTO parametres_admin (key, value) VALUES (?, ?)"
  ).run("synthese_jour", "false");
  database.prepare(
    "INSERT INTO parametres_admin (key, value) VALUES (?, ?)"
  ).run("whatsapp", "true");
  database.prepare(
    "INSERT INTO parametres_admin (key, value) VALUES (?, ?)"
  ).run("commande_admin", "true");
  database.prepare(
    "INSERT INTO parametres_admin (key, value) VALUES (?, ?)"
  ).run("whatsapp_number", "");

  /* Comptes Cuisine et Gestionnaire Stock */
  database.prepare(
    "INSERT INTO comptes (email, password, role, nom, agence_id, statut) VALUES (?, ?, ?, ?, ?, ?)"
  ).run("cuisine@orchidenature.com", "cuisine1", "cuisine", "Cuisine", "AG1", "ACTIF");
  database.prepare(
    "INSERT INTO comptes (email, password, role, nom, agence_id, statut) VALUES (?, ?, ?, ?, ?, ?)"
  ).run("stock@orchidenature.com", "stock1", "gestionnaire_stock", "Gestionnaire Stock", "AG1", "ACTIF");

  /* Matières premières exemple */
  const mpExemples = [
    { id: "MP-FARINE", code: "FAR", nom: "Farine", unite: "kg" },
    { id: "MP-SUCRE", code: "SUC", nom: "Sucre", unite: "kg" },
    { id: "MP-BEURRE", code: "BEU", nom: "Beurre", unite: "kg" },
    { id: "MP-OEUF", code: "OEU", nom: "Œufs", unite: "unite" },
    { id: "MP-LAIT", code: "LAI", nom: "Lait", unite: "L" },
    { id: "MP-LEVURE", code: "LEV", nom: "Levure", unite: "kg" },
  ];
  const stmtMp = database.prepare("INSERT INTO matieres_premieres (id, code, nom, unite) VALUES (?, ?, ?, ?)");
  for (const m of mpExemples) stmtMp.run(m.id, m.code, m.nom, m.unite);

  /* Recette exemple pour Produit Démo */
  database.prepare("INSERT INTO recettes (id, produit_id) VALUES (?, ?)").run("REC-001", "PRD-001");
  database.prepare("INSERT INTO recette_ingredients (recette_id, matiere_premiere_id, quantite, unite) VALUES (?, ?, ?, ?)")
    .run("REC-001", "MP-FARINE", 0.5, "kg");
  database.prepare("INSERT INTO recette_ingredients (recette_id, matiere_premiere_id, quantite, unite) VALUES (?, ?, ?, ?)")
    .run("REC-001", "MP-SUCRE", 0.2, "kg");
  database.prepare("INSERT INTO recette_ingredients (recette_id, matiere_premiere_id, quantite, unite) VALUES (?, ?, ?, ?)")
    .run("REC-001", "MP-OEUF", 2, "unite");

  /* Stock initial matières premières (lots) pour AG1 */
  const jr = now.split("T")[0];
  const peremp = new Date();
  peremp.setDate(peremp.getDate() + 90);
  const perempStr = peremp.toISOString().split("T")[0];
  database.prepare(
    "INSERT INTO lots_mp (id, matiere_premiere_id, agence_id, numero_lot, date_reception, date_peremption, quantite_restante, unite, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run("LOT-MP-001", "MP-FARINE", "AG1", "LOT-FAR-001", jr, perempStr, 100, "kg", now);
  database.prepare(
    "INSERT INTO lots_mp (id, matiere_premiere_id, agence_id, numero_lot, date_reception, date_peremption, quantite_restante, unite, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run("LOT-MP-002", "MP-SUCRE", "AG1", "LOT-SUC-001", jr, perempStr, 50, "kg", now);
  database.prepare(
    "INSERT INTO lots_mp (id, matiere_premiere_id, agence_id, numero_lot, date_reception, date_peremption, quantite_restante, unite, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run("LOT-MP-003", "MP-OEUF", "AG1", "LOT-OEU-001", jr, perempStr, 500, "unite", now);

  console.log("[DB] Données initiales (seed) insérées.");
}

function seedStockIfEmpty(database) {
  const count = database.prepare("SELECT COUNT(*) as n FROM matieres_premieres").get();
  if (count.n > 0) return;
  const mpExemples = [
    { id: "MP-FARINE", code: "FAR", nom: "Farine", unite: "kg" },
    { id: "MP-SUCRE", code: "SUC", nom: "Sucre", unite: "kg" },
    { id: "MP-BEURRE", code: "BEU", nom: "Beurre", unite: "kg" },
    { id: "MP-OEUF", code: "OEU", nom: "Œufs", unite: "unite" },
    { id: "MP-LAIT", code: "LAI", nom: "Lait", unite: "L" },
    { id: "MP-LEVURE", code: "LEV", nom: "Levure", unite: "kg" },
  ];
  const stmt = database.prepare("INSERT INTO matieres_premieres (id, code, nom, unite) VALUES (?, ?, ?, ?)");
  for (const m of mpExemples) {
    try { stmt.run(m.id, m.code, m.nom, m.unite); } catch (e) { /* ignore dup */ }
  }
  try {
    database.prepare("INSERT INTO comptes (email, password, role, nom, agence_id, statut) VALUES (?, ?, ?, ?, ?, ?)")
      .run("cuisine@orchidenature.com", "cuisine1", "cuisine", "Cuisine", "AG1", "ACTIF");
  } catch (e) { /* ignore dup */ }
  try {
    database.prepare("INSERT INTO comptes (email, password, role, nom, agence_id, statut) VALUES (?, ?, ?, ?, ?, ?)")
      .run("stock@orchidenature.com", "stock1", "gestionnaire_stock", "Gestionnaire Stock", "AG1", "ACTIF");
  } catch (e) { /* ignore dup */ }
  console.log("[DB] Données stock (matières premières, comptes) initialisées.");
}

/** Agence RAMCO + produits FICHE DE FACTURATION */
function seedRamco(database) {
  database.prepare(
    "INSERT OR REPLACE INTO agences (id, nom, code) VALUES (?, ?, ?)"
  ).run("RAMCO", "RAMCO", "RAMCO");
  database.prepare(
    "INSERT OR REPLACE INTO comptes (email, password, role, nom, agence_id, statut) VALUES (?, ?, ?, ?, ?, ?)"
  ).run("ramco@orchidenature.com", "ramco1", "agency", "RAMCO", "RAMCO", "ACTIF");

  const produits = [
    { code: "TIRAMISU-CAFE", nom: "TIRAMISU CAFE", prix_ht: 2500, prix_ttc: 3850 },
    { code: "TIRAMISU-NUTELLA", nom: "TIRAMISU NUTELLA", prix_ht: 2500, prix_ttc: 3850 },
    { code: "TIRAMISU-SPECULOS", nom: "TIRAMISU SPECULOS", prix_ht: 2500, prix_ttc: 3850 },
    { code: "BROWNIES", nom: "BROWNIES", prix_ht: 800, prix_ttc: 1250 },
    { code: "CHOUQUETTE", nom: "CHOUQUETTE", prix_ht: 200, prix_ttc: 300 },
    { code: "COOKIES-CHOCO", nom: "COOKIES CHOCO", prix_ht: 800, prix_ttc: 1250 },
    { code: "COOKIES-MARBRE-RAISIN", nom: "COOKIES MARBRE AU RAISIN", prix_ht: 800, prix_ttc: 1250 },
    { code: "COOKIES-MARBRE-PEPITE", nom: "COOKIES MARBRE AU PEPITE", prix_ht: 800, prix_ttc: 1250 },
    { code: "COOKIES-MARBRE-PEPITE-NOIR", nom: "COOKIES MARBRE PEPITE NOIR", prix_ht: 800, prix_ttc: 1250 },
    { code: "CAKE-MARBRE", nom: "CAKE MARBRE", prix_ht: 900, prix_ttc: 1400 },
    { code: "CAKE-NATURE", nom: "CAKE NATURE", prix_ht: 900, prix_ttc: 1400 },
    { code: "CAKE-CHOCO", nom: "CAKE CHOCO", prix_ht: 900, prix_ttc: 1400 },
    { code: "DONUT", nom: "DONUT", prix_ht: 900, prix_ttc: 1400 },
    { code: "MINI-PIZZA-POISSON", nom: "MINI PIZZA AU POISSON", prix_ht: 200, prix_ttc: 300 },
    { code: "MINI-PIZZA-VIANDE", nom: "MINI PIZZA VIANDE", prix_ht: 200, prix_ttc: 300 },
    { code: "GRANDE-PIZZA-POISSON", nom: "GRANDE PIZZA POISSON", prix_ht: 700, prix_ttc: 1100 },
    { code: "GRANDE-PIZZA-VIANDE", nom: "GRANDE PIZZA VIANDE", prix_ht: 700, prix_ttc: 1100 },
    { code: "FEUILLETE-SAUCISSE", nom: "FEUILLETE AU SAUCISSE", prix_ht: 1000, prix_ttc: 1600 },
    { code: "PAIN-CHOCO-CHOCOLAT", nom: "PAIN CHOCO AU CHOCOLAT", prix_ht: 700, prix_ttc: 1100 },
    { code: "PAIN-CHOCO-CHOCOLAT-PETIT", nom: "PAIN CHOCO AU CHOCOLAT PETIT", prix_ht: 600, prix_ttc: 950 },
    { code: "PAIN-CHOCO-GRD", nom: "PAIN CHOCO GRD", prix_ht: 600, prix_ttc: 950 },
    { code: "PAIN-CHOCO-PETIT", nom: "PAIN CHOCO PETIT", prix_ht: 500, prix_ttc: 800 },
    { code: "CROISSANT-GRD", nom: "CROISSANT GRD", prix_ht: 600, prix_ttc: 950 },
    { code: "MINI-CROISSANT", nom: "MINI CROISSANT", prix_ht: 500, prix_ttc: 800 },
    { code: "FRIAND-POISSON", nom: "FRIAND POISSON", prix_ht: 1000, prix_ttc: 1600 },
    { code: "FRIAND-VIANDE", nom: "FRIAND VIANDE", prix_ht: 1000, prix_ttc: 1600 },
    { code: "PAIN-RAISIN-GRAND", nom: "PAIN RAISIN GRAND", prix_ht: 600, prix_ttc: 950 },
    { code: "PAIN-RAISIN-PETIT", nom: "PAIN RAISIN PETIT", prix_ht: 500, prix_ttc: 800 },
    { code: "CAKE-BANANE", nom: "CAKE BANANE", prix_ht: 900, prix_ttc: 1400 },
    { code: "PAIN-SESAME", nom: "PAIN AU SESAME", prix_ht: 200, prix_ttc: 300 },
    { code: "SANDWICH-THON", nom: "SANDWICH THON", prix_ht: 1000, prix_ttc: 1600 },
    { code: "SANDWICH-POULET", nom: "SANDWICH POULET", prix_ht: 1000, prix_ttc: 1600 },
    { code: "CAKE-EPINARD", nom: "CAKE AUX EPINARD", prix_ht: 300, prix_ttc: 500 },
    { code: "PAIN-CHOCOLATE", nom: "PAIN CHOCOLATE", prix_ht: 1000, prix_ttc: 1600 },
    { code: "MADELEINE", nom: "MADELEINE", prix_ht: 200, prix_ttc: 300 },
    { code: "PAIN", nom: "PAIN", prix_ht: 200, prix_ttc: 300 },
    { code: "BRIOCHE", nom: "BRIOCHE", prix_ht: 200, prix_ttc: 300 },
    { code: "PETIT-COOKIES-4-50", nom: "PETIT COOKIES 4×50", prix_ht: 200, prix_ttc: 300 },
    { code: "PAIN-SESAME-PISTACHE", nom: "PAIN SESAME PISTACHE", prix_ht: 400, prix_ttc: 600 },
    { code: "FROMAGE-CROISSANT", nom: "FROMAGE CROISSANT", prix_ht: 1000, prix_ttc: 1500 },
    { code: "PAIN-FLEUR", nom: "PAIN FLEUR", prix_ht: 300, prix_ttc: 500 },
    { code: "GATEAU-ENTIER", nom: "GATEAU ENTIER", prix_ht: 17500, prix_ttc: 24500 },
    { code: "CREPES-CHOCOLAT", nom: "CREPES CHOCOLAT", prix_ht: 600, prix_ttc: 950 },
    { code: "CREPES-NATURE", nom: "CREPES NATURE", prix_ht: 600, prix_ttc: 950 },
    { code: "CROISSANT-SAUCISSE-FROMAGE", nom: "CROISSANT SAUCISSE FROMAGE", prix_ht: 700, prix_ttc: 1000 },
    { code: "TARTE", nom: "TARTE", prix_ht: 2000, prix_ttc: 3300 },
    { code: "CROISSANT-PIZZA", nom: "CROISSANT PIZZA", prix_ht: 1200, prix_ttc: 1800 },
    { code: "PART-DE-GATEAU", nom: "PART DE GATEAU", prix_ht: 2000, prix_ttc: 3000 },
  ];
  const stmt = database.prepare(
    "INSERT OR REPLACE INTO produits (id, code, nom, description, unite, prix_ht, prix_ttc, actif) VALUES (?, ?, ?, ?, ?, ?, ?, 1)"
  );
  for (const p of produits) {
    stmt.run(p.code, p.code, p.nom, null, null, p.prix_ht, p.prix_ttc);
  }
  return { agence: "RAMCO", produits: produits.length };
}

function uuidShort() {
  return require("crypto").randomUUID().replace(/-/g, "").substring(0, 8);
}

function exportBackup() {
  const database = getDb();
  const tables = [
    "comptes", "agences", "produits", "operations", "stocks",
    "commandes", "lignes_commandes", "sessions_caisse", "mouvements_caisse",
    "notifications_log", "contacts_notifications", "parametres_admin", "auth_logs",
    "matieres_premieres", "recettes", "recette_ingredients", "lots_mp",
    "declarations_production", "lignes_production", "declarations_fdj", "lignes_fdj",
    "lots_pf", "mouvements_pf"
  ];
  const out = { version: 1, exportedAt: new Date().toISOString(), data: {} };
  for (const table of tables) {
    try {
      const rows = database.prepare(`SELECT * FROM ${table}`).all();
      out.data[table] = rows;
    } catch (e) {
      out.data[table] = [];
    }
  }
  return out;
}

function saveBackupFile() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const name = "backup_" + new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + ".json";
  const filePath = path.join(BACKUP_DIR, name);
  fs.writeFileSync(filePath, JSON.stringify(exportBackup(), null, 2), "utf8");
  return filePath;
}

function copyDbToBackup() {
  if (!fs.existsSync(DB_PATH)) return null;
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const name = "orchidee_" + new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + ".db";
  const dest = path.join(BACKUP_DIR, name);
  fs.copyFileSync(DB_PATH, dest);
  return dest;
}

module.exports = {
  getDb,
  DB_PATH,
  DB_DIR,
  BACKUP_DIR,
  uuidShort,
  exportBackup,
  saveBackupFile,
  copyDbToBackup,
  seedRamco
};
