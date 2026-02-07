const user = authService.requireAuth([CONFIG.roles.AGENCY]);
let products = [];
let operations = [];
let stocks = [];
let commandes = [];

function formatCurrency(amount) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", minimumFractionDigits: 0 }).format(amount || 0);
}

async function init() {
  if (!user) return;
  document.getElementById("userName").textContent = user.nom || user.email;
  document.getElementById("agenceName").textContent = user.nom || "Mon Agence";
  document.getElementById("agenceInfo").textContent = "ID: " + (user.agence_id || "");
  await loadProducts();
  document.querySelectorAll(".menu-item").forEach((el) => {
    el.addEventListener("click", () => {
      document.querySelectorAll(".menu-item").forEach((m) => m.classList.remove("active"));
      el.classList.add("active");
      const section = el.dataset.section;
      if (section === "dashboard") showDashboard();
      if (section === "operations") showOperations();
      if (section === "stocks") showStocks();
      if (section === "commandes") showCommandes();
    });
  });
  document.getElementById("operationForm").addEventListener("submit", submitOperation);
  document.getElementById("editOperationForm").addEventListener("submit", submitEditOperation);
  document.getElementById("commandeForm").addEventListener("submit", submitCommande);
  document.getElementById("produitOperation").addEventListener("change", onProduitChange);
  document.getElementById("quantiteOperation").addEventListener("input", calcRendu);
  document.getElementById("montantRecu").addEventListener("input", calcRendu);
  document.getElementById("typeOperation").addEventListener("change", () => { document.getElementById("renduWrap").style.display = document.getElementById("typeOperation").value === "VENTE" ? "block" : "none"; });
  showDashboard();
}

async function loadProducts() {
  const r = await apiService.getProducts();
  if (r.success && r.data.products) products = r.data.products;
  const sel = document.getElementById("produitOperation");
  sel.innerHTML = "<option value=''>Sélectionner...</option>";
  products.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.setAttribute("data-prix", p.prix_ttc);
    opt.textContent = p.nom + " - " + formatCurrency(p.prix_ttc);
    sel.appendChild(opt);
  });
  const selCmd = document.getElementById("commandeProduit");
  selCmd.innerHTML = "<option value=''>Sélectionner...</option>";
  products.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.nom;
    selCmd.appendChild(opt);
  });
}

function onProduitChange() {
  const sel = document.getElementById("produitOperation");
  const opt = sel.options[sel.selectedIndex];
  document.getElementById("prixOperation").value = opt ? opt.getAttribute("data-prix") || "" : "";
  calcRendu();
}

function calcRendu() {
  const q = parseFloat(document.getElementById("quantiteOperation").value) || 0;
  const p = parseFloat(document.getElementById("prixOperation").value) || 0;
  const recu = parseFloat(document.getElementById("montantRecu").value) || 0;
  const total = q * p;
  const rendu = recu - total;
  const wrap = document.getElementById("renduWrap");
  if (document.getElementById("typeOperation").value === "VENTE" && recu > 0) {
    wrap.style.display = "block";
    const el = document.getElementById("renduValue");
    el.textContent = formatCurrency(rendu);
    el.style.color = rendu >= 0 ? "#27ae60" : "#e74c3c";
  }
}

function showDashboard() {
  document.getElementById("content").innerHTML = "<div class='stats-grid'><div class='stat-card'><h3>Ventes du jour</h3><div class='value' id='ventesJour'>0 CFA</div></div><div class='stat-card'><h3>Opérations</h3><div class='value' id='nbOps'>0</div></div></div><div class='card'><h2>Actions rapides</h2><button type='button' class='btn btn-primary' onclick='openOperationModal()'>Nouvelle opération</button></div>";
  loadOperations().then(() => {
    const today = new Date().toISOString().split("T")[0];
    const ventesJour = operations.filter((o) => o.type === "VENTE" && (o.date || "").toString().substring(0, 10) === today).reduce((s, o) => s + (parseFloat(o.montant_total) || 0), 0);
    const el1 = document.getElementById("ventesJour");
    const el2 = document.getElementById("nbOps");
    if (el1) el1.textContent = formatCurrency(ventesJour);
    if (el2) el2.textContent = operations.length;
  });
}

async function loadOperations() {
  const r = await apiService.getOperations(user.agence_id);
  operations = (r.success && r.data.operations) ? r.data.operations : [];
  return r;
}

function showOperations() {
  loadOperations().then(() => {
    let html = "<div class='card'><div class='card-header'><h2>Opérations</h2><button type='button' class='btn btn-primary' onclick='openOperationModal()'>Nouvelle opération</button></div><div class='table-wrap'><table class='data-table'><thead><tr><th>Date</th><th>Type</th><th>Produit</th><th>Qté</th><th>Montant (CFA)</th><th>Actions</th></tr></thead><tbody>";
    operations.slice(0, 100).forEach((o) => {
      const produitNom = products.find((p) => p.id === o.produit_id);
      const nom = produitNom ? produitNom.nom : o.produit_id;
      html += "<tr><td>" + (o.date || "") + " " + (o.heure || "") + "</td><td>" + (o.type || "") + "</td><td>" + nom + "</td><td>" + (o.quantite || "") + "</td><td>" + formatCurrency(o.montant_total) + "</td><td>";
      if (user.role === CONFIG.roles.AGENCY) html += "<button type='button' class='btn btn-sm btn-secondary' onclick=\"openEditOp('" + o.id + "', " + o.quantite + ", " + (o.prix_unitaire || 0) + ", '" + (o.notes || "").replace(/'/g, "\\'") + "')\">Modifier</button>";
      html += "</td></tr>";
    });
    html += "</tbody></table></div></div>";
    document.getElementById("content").innerHTML = html;
  });
}

function openOperationModal() {
  document.getElementById("operationModal").classList.add("active");
  document.getElementById("operationForm").reset();
  document.getElementById("renduWrap").style.display = "none";
}

function openEditOp(id, qte, prix, notes) {
  document.getElementById("editOpId").value = id;
  document.getElementById("editQuantite").value = qte;
  document.getElementById("editPrix").value = prix;
  document.getElementById("editNotes").value = notes || "";
  document.getElementById("editOperationModal").classList.add("active");
}

async function submitOperation(e) {
  e.preventDefault();
  const type = document.getElementById("typeOperation").value;
  const produit_id = document.getElementById("produitOperation").value;
  const quantite = parseFloat(document.getElementById("quantiteOperation").value);
  const prix = parseFloat(document.getElementById("prixOperation").value);
  const montant_total = quantite * prix;
  const notes = document.getElementById("notesOperation").value.trim();
  const now = new Date();
  const result = await apiService.createOperation({
    agence_id: user.agence_id,
    type,
    produit_id,
    quantite,
    prix_unitaire: prix,
    montant_total,
    date: now.toISOString().split("T")[0],
    heure: now.toTimeString().split(" ")[0],
    created_by: user.email,
    notes
  });
  if (result.success) {
    closeModal("operationModal");
    showDashboard();
    if (document.querySelector(".menu-item.active").dataset.section === "operations") showOperations();
  } else alert("Erreur: " + (result.message || ""));
}

async function submitEditOperation(e) {
  e.preventDefault();
  const id = document.getElementById("editOpId").value;
  const quantite = parseFloat(document.getElementById("editQuantite").value);
  const prix = parseFloat(document.getElementById("editPrix").value);
  const notes = document.getElementById("editNotes").value.trim();
  const result = await apiService.updateOperation(id, { quantite, prix_unitaire: prix, montant_total: quantite * prix, notes });
  if (result.success) {
    closeModal("editOperationModal");
    showOperations();
  } else alert("Erreur: " + (result.message || ""));
}

async function showStocks() {
  const r = await apiService.getStocks(user.agence_id);
  stocks = (r.success && r.data.stocks) ? r.data.stocks : [];
  let html = "<div class='card'><h2>Stocks</h2><div class='table-wrap'><table class='data-table'><thead><tr><th>Produit</th><th>Quantité</th></tr></thead><tbody>";
  stocks.forEach((s) => {
    const p = products.find((pr) => pr.id === s.produit_id);
    html += "<tr><td>" + (p ? p.nom : s.produit_id) + "</td><td>" + (s.quantite_actuelle || 0) + "</td></tr>";
  });
  html += "</tbody></table></div></div>";
  document.getElementById("content").innerHTML = html;
}

async function showCommandes() {
  const r = await apiService.getCommandes(user.agence_id);
  commandes = (r.success && r.data.commandes) ? r.data.commandes : [];
  let html = "<div class='card'><div class='card-header'><h2>Commandes</h2><button type='button' class='btn btn-primary' onclick='openCommandeModal()'>Nouvelle commande</button></div><div class='table-wrap'><table class='data-table'><thead><tr><th>N°</th><th>Date</th><th>Livraison</th><th>Statut</th></tr></thead><tbody>";
  commandes.forEach((c) => {
    html += "<tr><td>" + (c.numero || c.id) + "</td><td>" + (c.date_commande || "") + "</td><td>" + (c.date_livraison || "") + "</td><td>" + (c.statut || "") + "</td></tr>";
  });
  html += "</tbody></table></div></div>";
  document.getElementById("content").innerHTML = html;
}

function openCommandeModal() {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  document.getElementById("dateLivraison").value = d.toISOString().split("T")[0];
  document.getElementById("commandeForm").reset();
  document.getElementById("dateLivraison").value = d.toISOString().split("T")[0];
  document.getElementById("commandeModal").classList.add("active");
}

async function submitCommande(e) {
  e.preventDefault();
  const date_livraison = document.getElementById("dateLivraison").value;
  const produit_id = document.getElementById("commandeProduit").value;
  const quantite = parseInt(document.getElementById("commandeQuantite").value, 10);
  const now = new Date();
  const result = await apiService.createCommande({
    agence_id: user.agence_id,
    type: "MANUELLE",
    date_commande: now.toISOString().split("T")[0],
    date_livraison,
    created_by: user.email,
    produit_id: produit_id || undefined,
    quantite: quantite || undefined
  });
  if (result.success) {
    closeModal("commandeModal");
    showCommandes();
  } else alert("Erreur: " + (result.message || ""));
}

function closeModal(id) {
  document.getElementById(id).classList.remove("active");
}

function handleLogout() {
  authService.logout();
  window.location.href = "index.html";
}

init();
