class AuthService {
  constructor() {
    this.currentUser = null;
    this.sessionTimeout = null;
  }

  async login(email, password) {
    const url = CONFIG.googleSheets.apiUrl;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({ 
          action: "login", 
          email: String(email).trim(), 
          password: String(password),
          origin: window.location.origin 
        })
      });
      const contentType = response.headers.get("Content-Type") || "";
      const text = await response.text();
      console.log("[Login] URL:", url, "| Status:", response.status, "| Content-Type:", contentType);
      console.log("[Login] Reponse complete:", text);
      const isJson = contentType.includes("application/json");
      let data;
      try {
        data = isJson ? JSON.parse(text) : { success: false, message: "Reponse invalide (pas JSON)" };
      } catch (parseErr) {
        console.error("[Login] Erreur parsing JSON:", parseErr);
        console.error("[Login] Corps recu:", text);
        data = { success: false, message: "Reponse invalide du serveur" };
      }

      if (data.success) {
        this.currentUser = data.data.user;
        this.saveSession(data.data.user);
        this.startSessionTimeout();
        this.logAuthEvent("LOGIN_SUCCESS", email);
        return { success: true, user: data.data.user };
      } else {
        console.log("[Login] Echec - donnees recues:", data);
        this.logAuthEvent("LOGIN_FAILED", email);
        return { success: false, message: data.message || "Identifiants incorrects" };
      }
    } catch (error) {
      console.error("[Login] Exception - erreur originale:", error);
      console.error("[Login] message:", error && error.message);
      console.error("[Login] stack:", error && error.stack);
      return { success: false, message: "Erreur de connexion" };
    }
  }

  saveSession(user) {
    sessionStorage.setItem("orchidee_user", JSON.stringify(user));
    sessionStorage.setItem("orchidee_login_time", Date.now().toString());
  }

  loadSession() {
    const userData = sessionStorage.getItem("orchidee_user");
    const loginTime = sessionStorage.getItem("orchidee_login_time");
    
    if (userData && loginTime) {
      const elapsed = Date.now() - parseInt(loginTime);
      if (elapsed < CONFIG.security.sessionTimeout) {
        this.currentUser = JSON.parse(userData);
        this.startSessionTimeout();
        return this.currentUser;
      }
    }
    return null;
  }

  startSessionTimeout() {
    if (this.sessionTimeout) clearTimeout(this.sessionTimeout);
    this.sessionTimeout = setTimeout(() => {
      this.logout();
      alert("Session expirée");
      window.location.href = "index.html";
    }, CONFIG.security.sessionTimeout);
  }

  logout() {
    if (this.currentUser) {
      this.logAuthEvent("LOGOUT", this.currentUser.email);
    }
    sessionStorage.clear();
    this.currentUser = null;
    if (this.sessionTimeout) clearTimeout(this.sessionTimeout);
  }

  async logAuthEvent(logAction, email) {
    try {
      await fetch(CONFIG.googleSheets.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({ 
          action: "logAuth", 
          email, 
          logAction,
          origin: window.location.origin 
        })
      });
    } catch (error) {
      console.log("Log auth error:", error);
    }
  }

  requireAuth(allowedRoles = []) {
    const user = this.loadSession();
    if (!user) {
      window.location.href = "index.html";
      return null;
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      alert("Accès non autorisé");
      window.location.href = this.getDefaultPage(user.role);
      return null;
    }
    return user;
  }

  getDefaultPage(role) {
    switch (role) {
      case CONFIG.roles.ADMIN:
        return "admin.html";
      case CONFIG.roles.AGENCY:
        return "app.html";
      case CONFIG.roles.CAISSIER:
        return "caisse.html";
      case CONFIG.roles.CUISINE:
      case CONFIG.roles.GESTIONNAIRE_STOCK:
        return "production.html";
      default:
        return "index.html";
    }
  }
}

const authService = new AuthService();