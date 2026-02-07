const user = authService.requireAuth([CONFIG.roles.CAISSIER]);
let currentSession = null;
let products = [];
let mouvements = [];
let calcExpression = "0";

function formatCurrency(amount) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", minimumFractionDigits: 0 }).format(amount || 0);
}

async function init() {
  if (!user) return;
  document.getElementById("caissierName").textContent = user.nom || user.email;
  await loadProducts();
  document.querySelectorAll(".calc-btn").forEach((btn) => {
    if (btn.id === "calcEquals") btn.addEventListener("click", calcEquals);
    else if (btn.id === "calcClear") btn.addEventListener("click", calcClear);
    else if (btn.id === "calcClearAll") btn.addEventListener("click", calcClearAll);
    else btn.addEventListener("click", () => appendCalc(btn.getAttribute("data-val")));
  });
  document.getElementById("venteForm").addEventListener("submit", submitVente);
  document.getElementById("openSessionForm").addEventListener("submit", submitOpenSession);
  document.getElementById("closeSessionForm").addEventListener("submit", submitCloseSession);
  document.getElementById("mouvementForm").addEventListener("submit", submitMouvement);
  document.getElementById("produitVente").addEventListener("change", onProduitChange);
  document.getElementById("quantiteVente").addEventListener("input", calcRendu);
  document.getElementById("montantRecuVente").addEventListener("input", calcRendu);
  document.getElementById("montantReelInput").addEventListener("input", function() {
    const attendu = parseFloat(document.getElementById("montantAttenduInput").value) || 0;
    const reel = parseFloat(this.value) || 0;
    const ecart = reel - attendu;
    document.getElementById("ecartDisplay").value = formatCurrency(ecart);
    document.getElementById("ecartDisplay").style.color = ecart === 0 ? "#27ae60" : ecart > 0 ? "#3498db" : "#e74c3c";
  });
  await checkSession();
}

async function loadProducts() {
  const r = await apiService.getProducts();
  if (r.success && r.data.products) products = r.data.products;
  const sel = document.getElementById("produitVente");
  sel.innerHTML = "<option value=''>Sélectionner...</option>";
  products.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.setAttribute("data-prix", p.prix_ttc);
    opt.textContent = p.nom + " - " + formatCurrency(p.prix_ttc);
    sel.appendChild(opt);
  });
}

function onProduitChange() {
  const sel = document.getElementById("produitVente");
  const opt = sel.options[sel.selectedIndex];
  document.getElementById("prixVente").value = opt ? opt.getAttribute("data-prix") || "" : "";
  calcRendu();
}

function calcRendu() {
  const q = parseFloat(document.getElementById("quantiteVente").value) || 0;
  const p = parseFloat(document.getElementById("prixVente").value) || 0;
  const recu = parseFloat(document.getElementById("montantRecuVente").value) || 0;
  const total = q * p;
  const rendu = recu - total;
  document.getElementById("renduVente").textContent = formatCurrency(rendu);
  document.getElementById("renduVente").style.color = rendu >= 0 ? "#27ae60" : "#e74c3c";
}

async function checkSession() {
  const r = await apiService.getSessions(user.email);
  if (r.success && r.data.sessions && r.data.sessions.length > 0) {
    const active = r.data.sessions.find((s) => s.statut === "OUVERTE");
    if (active) {
      currentSession = active;
      await loadMouvements();
      showSessionView();
    }
  }
}

async function loadMouvements() {
  if (!currentSession || !currentSession.id) return;
  const r = await apiService.getMouvementsCaisse(currentSession.id);
  mouvements = (r.success && r.data.mouvements) ? r.data.mouvements : [];
  let ca = 0;
  mouvements.forEach((m) => {
    if (m.type === "VENTE") ca += parseFloat(m.montant) || 0;
  });
  const el = document.getElementById("caJour");
  if (el) el.textContent = formatCurrency(ca);
  const attendu = computeMontantAttendu();
  const elAtt = document.getElementById("montantAttendu");
  if (elAtt) elAtt.textContent = formatCurrency(attendu);
  const listEl = document.getElementById("mouvementsList");
  if (listEl) {
    listEl.innerHTML = "";
    mouvements.slice(-20).reverse().forEach((m) => {
      const div = document.createElement("div");
      div.className = "mouvement-item " + (m.type === "DEPENSE" ? "depense" : m.type === "APPORT" ? "apport" : "vente");
      div.innerHTML = "<span>" + (m.type || "") + "</span> " + (m.description || "") + " <strong>" + formatCurrency(m.montant) + "</strong>";
      listEl.appendChild(div);
    });
  }
}

function computeMontantAttendu() {
  if (!currentSession) return 0;
  let total = parseFloat(currentSession.fond_caisse) || 0;
  mouvements.forEach((m) => {
    const mt = parseFloat(m.montant) || 0;
    if (m.type === "VENTE") total += mt;
    if (m.type === "DEPENSE") total -= mt;
    if (m.type === "APPORT") total += mt;
  });
  return total;
}

function showSessionView() {
  document.getElementById("noSessionView").style.display = "none";
  document.getElementById("sessionView").style.display = "block";
  document.getElementById("sessionInfo").style.display = "block";
  document.getElementById("fondCaisse").textContent = formatCurrency(currentSession.fond_caisse);
  updateSessionTimer();
  loadMouvements();
}

function updateSessionTimer() {
  if (!currentSession || !currentSession.date_ouverture) return;
  const start = new Date(currentSession.date_ouverture);
  const now = new Date();
  const diff = now - start;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const el = document.getElementById("dureeSession");
  if (el) el.textContent = [h, m, s].map((x) => String(x).padStart(2, "0")).join(":");
  setTimeout(updateSessionTimer, 1000);
}

function openSessionModal() {
  document.getElementById("openSessionModal").classList.add("active");
}

function closeSessionModal() {
  const attendu = computeMontantAttendu();
  document.getElementById("montantAttenduInput").value = attendu;
  document.getElementById("montantReelInput").value = "";
  document.getElementById("ecartDisplay").value = "";
  document.getElementById("closeSessionModal").classList.add("active");
}

function openMouvementModal(type) {
  document.getElementById("mouvementType").value = type;
  document.getElementById("mouvementModalTitle").textContent = type === "DEPENSE" ? "Dépense" : "Apport caisse";
  document.getElementById("mouvementForm").reset();
  document.getElementById("mouvementType").value = type;
  document.getElementById("mouvementModal").classList.add("active");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("active");
}

async function submitOpenSession(e) {
  e.preventDefault();
  const fond = parseFloat(document.getElementById("fondCaisseInput").value) || 0;
  const r = await apiService.openCaisseSession({ caissier_email: user.email, fond_caisse: fond });
  if (r.success) {
    currentSession = { id: r.data.session_id, caissier_email: user.email, date_ouverture: new Date(), fond_caisse: fond, statut: "OUVERTE" };
    mouvements = [];
    closeModal("openSessionModal");
    showSessionView();
  } else alert("Erreur: " + (r.message || ""));
}

async function submitVente(e) {
  e.preventDefault();
  const produit_id = document.getElementById("produitVente").value;
  const quantite = parseFloat(document.getElementById("quantiteVente").value) || 0;
  const prix = parseFloat(document.getElementById("prixVente").value) || 0;
  const montant = quantite * prix;
  const p = products.find((x) => x.id === produit_id);
  const desc = (p ? p.nom : produit_id) + " x" + quantite;
  const r = await apiService.addMouvementCaisse({ session_id: currentSession.id, type: "VENTE", montant, description: desc, caissier_email: user.email });
  if (r.success) {
    document.getElementById("venteForm").reset();
    document.getElementById("prixVente").value = "";
    loadMouvements();
  } else alert("Erreur: " + (r.message || ""));
}

async function submitMouvement(e) {
  e.preventDefault();
  const type = document.getElementById("mouvementType").value;
  const montant = parseFloat(document.getElementById("mouvementMontant").value) || 0;
  const description = document.getElementById("mouvementDesc").value.trim();
  const r = await apiService.addMouvementCaisse({ session_id: currentSession.id, type, montant, description, caissier_email: user.email });
  if (r.success) {
    closeModal("mouvementModal");
    loadMouvements();
  } else alert("Erreur: " + (r.message || ""));
}

async function submitCloseSession(e) {
  e.preventDefault();
  const montant_reel = parseFloat(document.getElementById("montantReelInput").value) || 0;
  const montant_attendu = parseFloat(document.getElementById("montantAttenduInput").value) || 0;
  const ecart = montant_reel - montant_attendu;
  const r = await apiService.closeCaisseSession({
    session_id: currentSession.id,
    montant_attendu,
    montant_reel,
    ecart
  });
  if (r.success) {
    currentSession = null;
    mouvements = [];
    closeModal("closeSessionModal");
    document.getElementById("sessionView").style.display = "none";
    document.getElementById("sessionInfo").style.display = "none";
    document.getElementById("noSessionView").style.display = "block";
  } else alert("Erreur: " + (r.message || ""));
}

function appendCalc(val) {
  if (calcExpression === "0" && val !== ".") calcExpression = "";
  calcExpression += val;
  document.getElementById("calcDisplay").textContent = calcExpression;
}

function calcEquals() {
  try {
    let expr = calcExpression.replace(/×/g, "*").replace(/÷/g, "/");
    calcExpression = String(eval(expr));
    document.getElementById("calcDisplay").textContent = calcExpression;
  } catch (err) {
    calcExpression = "0";
    document.getElementById("calcDisplay").textContent = "Erreur";
  }
}

function calcClear() {
  calcExpression = calcExpression.slice(0, -1) || "0";
  document.getElementById("calcDisplay").textContent = calcExpression;
}

function calcClearAll() {
  calcExpression = "0";
  document.getElementById("calcDisplay").textContent = calcExpression;
}

function handleLogout() {
  if (currentSession) {
    alert("Fermez la session avant de vous déconnecter.");
    return;
  }
  authService.logout();
  window.location.href = "index.html";
}

init();
