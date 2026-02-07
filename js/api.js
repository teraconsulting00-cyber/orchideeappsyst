class ApiService {
  constructor() {
    this.baseUrl = CONFIG.googleSheets.apiUrl;
  }
  async request(action, data) {
    if (data === undefined) data = {};
    try {
      const body = JSON.stringify({ action: action, origin: window.location.origin, ...data });
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: body
      });
      const contentType = response.headers.get("Content-Type") || "";
      const text = await response.text();
      console.log("[API]", action, "| Status:", response.status, "| Content-Type:", contentType);
      console.log("[API]", action, "| Réponse complète:", text);
      if (!contentType.includes("application/json")) {
        console.warn("[API]", action, "| Réponse non JSON, corps complet:", text);
        return { success: false, message: "Réponse invalide" };
      }
      return JSON.parse(text);
    } catch (e) {
      console.error("[API]", action, "| Erreur originale:", e);
      console.error("[API]", action, "| message:", e && e.message);
      console.error("[API]", action, "| stack:", e && e.stack);
      return { success: false, message: "Erreur de connexion" };
    }
  }
  async getOperations(agence_id, date_debut, date_fin) {
    return await this.request("getOperations", { agence_id: agence_id || null, date_debut: date_debut || null, date_fin: date_fin || null });
  }
  async createOperation(operation) {
    return await this.request("createOperation", operation);
  }
  async updateOperation(operation_id, payload) {
    return await this.request("updateOperation", { operation_id: operation_id, ...payload });
  }
  async getProducts() {
    return await this.request("getProducts");
  }
  async getStocks(agence_id) {
    return await this.request("getStocks", { agence_id: agence_id || null });
  }
  async getAgences() {
    return await this.request("getAgences");
  }
  async createCommande(commande) {
    return await this.request("createCommande", commande);
  }
  async getCommandes(agence_id) {
    return await this.request("getCommandes", { agence_id: agence_id || null });
  }
  async openCaisseSession(data) {
    return await this.request("openCaisseSession", data);
  }
  async closeCaisseSession(data) {
    return await this.request("closeCaisseSession", data);
  }
  async addMouvementCaisse(data) {
    return await this.request("addMouvementCaisse", data);
  }
  async getSessions(caissier_email) {
    return await this.request("getSessions", { caissier_email: caissier_email || null });
  }
  async getMouvementsCaisse(session_id) {
    return await this.request("getMouvementsCaisse", { session_id: session_id });
  }
  async getNotificationsLog() {
    return await this.request("getNotificationsLog");
  }
  async validateNotification(log_id) {
    return await this.request("validateNotification", { log_id: log_id });
  }
  async getContactsNotifications() {
    return await this.request("getContactsNotifications");
  }
  async getParametresAdmin() {
    return await this.request("getParametresAdmin");
  }
  async setParametresAdmin(key, value) {
    return await this.request("setParametresAdmin", { key: key, value: value });
  }
  async sendNotification(data) {
    return await this.request("sendNotification", data);
  }
  /* --- Gestion stock alimentaire --- */
  async getMatieresPremieres() {
    return await this.request("getMatieresPremieres");
  }
  async getRecettes() {
    return await this.request("getRecettes");
  }
  async getRecetteByProduit(produit_id) {
    return await this.request("getRecetteByProduit", { produit_id });
  }
  async saveRecette(data) {
    return await this.request("saveRecette", data);
  }
  async getLotsMp(data) {
    return await this.request("getLotsMp", data || {});
  }
  async addLotMp(data) {
    return await this.request("addLotMp", data);
  }
  async declareProduction(data) {
    return await this.request("declareProduction", data);
  }
  async getDeclarationsProduction(data) {
    return await this.request("getDeclarationsProduction", data || {});
  }
  async declareFdj(data) {
    return await this.request("declareFdj", data);
  }
  async getDeclarationsFdj(data) {
    return await this.request("getDeclarationsFdj", data || {});
  }
  async getRapportEcarts(data) {
    return await this.request("getRapportEcarts", data || {});
  }
  async addMouvementPf(data) {
    return await this.request("addMouvementPf", data);
  }
  async getMouvementsPf(data) {
    return await this.request("getMouvementsPf", data || {});
  }
  async getLotsPf(data) {
    return await this.request("getLotsPf", data || {});
  }
  async getAlertesPeremption(data) {
    return await this.request("getAlertesPeremption", data || {});
  }
  async getStocksMpResume(data) {
    return await this.request("getStocksMpResume", data || {});
  }
}
const apiService = new ApiService();
