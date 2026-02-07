/**
 * Seed : agence RAMCO + produits FICHE DE FACTURATION
 * Lancer : npm run seed:ramco  ou  node server/seed-ramco.js
 */
const { getDb, seedRamco } = require("./db.js");

getDb(); // crée la base si besoin
const result = seedRamco(getDb());
console.log("Agence créée :", result.agence);
console.log("Produits insérés / mis à jour :", result.produits);
console.log("Terminé. RAMCO et", result.produits, "produits sont disponibles.");
