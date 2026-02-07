const CONFIG = {
  app: {
    name: "Orchidée Nature Management System",
    title: "Orchidée Nature",
    header: "Orchidée NATURE",
    tagline: "Système de Gestion Multi-Agences",
    favicon: "images/logo.png",
    version: "2.0.0",
    currency: "CFA",
    locale: "fr-FR"
  },
  security: {
    sessionTimeout: 1800000,
    maxLoginAttempts: 5,
    lockoutDuration: 1800000,
    passwordMinLength: 1
  },
  googleSheets: {
    spreadsheetId: "",
    // API locale (SQLite) : même origine = /api. Lancer "npm start" puis ouvrir http://localhost:8000
    apiUrl: typeof window !== "undefined" && window.location ? (window.location.origin + "/api") : "/api"
  },
  notifications: {
    whatsapp: { enabled: false, apiUrl: "" },
    email: { enabled: false, from: "notifications@orchidenature.com" }
  },
  roles: {
    ADMIN: "admin",
    AGENCY: "agency",
    CAISSIER: "caissier",
    CUISINE: "cuisine",
    GESTIONNAIRE_STOCK: "gestionnaire_stock"
  },
  operations: {
    types: {
      VENTE: "Vente",
      RECEPTION: "Réception",
      RETOUR: "Retour",
      COMMANDE: "Commande"
    }
  },
  alerts: {
    stockThreshold: 10,
    cashierDiscrepancyWarning: 100,
    cashierDiscrepancyCritical: 500,
    sessionMaxDuration: 43200000
  }
};
