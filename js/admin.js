const user = authService.requireAuth([CONFIG.roles.ADMIN]);
let agences = [];
let allOperations = [];
let allCommandes = [];
let allStocks = [];
let allProducts = [];
let caChartInstance = null;
let agencesChartInstance = null;

function formatCurrency(amount) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", minimumFractionDigits: 0 }).format(amount || 0);
}

function getDateRange(periode) {
  const now = new Date();
  let debut, fin;
  fin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  if (periode === "jour") {
    debut = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  } else if (periode === "semaine") {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    debut = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0);
  } else {
    debut = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
  }
  return { debut: debut.toISOString().split("T")[0], fin: fin.toISOString().split("T")[0] };
}

async function init() {
  if (!user) return;
  var brand = document.getElementById("appBrand"); if (brand && typeof CONFIG !== "undefined") brand.textContent = CONFIG.app.header;
  document.getElementById("userName").textContent = user.nom || user.email;
  const r = await apiService.getAgences();
  if (r.success && r.data.agences) {
    agences = r.data.agences;
    const sel = document.getElementById("agenceFilter");
    agences.forEach((a) => {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = a.nom || a.id;
      sel.appendChild(opt);
    });
  }
  document.querySelectorAll(".menu-item").forEach((el) => {
    el.addEventListener("click", () => {
      document.querySelectorAll(".menu-item").forEach((m) => m.classList.remove("active"));
      el.classList.add("active");
      document.querySelectorAll(".content-section").forEach((s) => s.classList.add("hidden"));
      const section = document.getElementById("section-" + el.dataset.section);
      if (section) section.classList.remove("hidden");
      if (el.dataset.section === "rapports") { loadDashboard(); return; }
      if (el.dataset.section === "stocks") loadStocks();
      if (el.dataset.section === "notifications") loadNotifications();
      if (el.dataset.section === "parametres") loadParametres();
      document.getElementById("adminContainer") && document.getElementById("adminContainer").classList.remove("menu-open");
    });
  });
  document.getElementById("btnApplyFilters").addEventListener("click", applyFilters);
  document.getElementById("btnExportRapport").addEventListener("click", buildAndShowRapport);
  document.getElementById("btnExportPdf").addEventListener("click", exportRapportPdf);
  document.getElementById("parametresForm").addEventListener("submit", saveParametres);
  await loadDashboard();
}

function applyFilters() {
  loadDashboard();
}

async function loadDashboard() {
  const agenceId = document.getElementById("agenceFilter").value || null;
  const periode = document.getElementById("periodeFilter").value;
  const range = getDateRange(periode);
  const opsRes = await apiService.getOperations(agenceId, range.debut, range.fin);
  const cmdRes = await apiService.getCommandes(agenceId);
  const prodRes = await apiService.getProducts();
  if (opsRes.success) allOperations = opsRes.data.operations || [];
  if (cmdRes.success) allCommandes = cmdRes.data.commandes || [];
  if (prodRes.success && prodRes.data?.products) allProducts = prodRes.data.products;
  const ventes = allOperations.filter((o) => o.type === "VENTE");
  const caTotal = ventes.reduce((s, v) => s + (parseFloat(v.montant_total) || 0), 0);
  document.getElementById("caTotal").textContent = formatCurrency(caTotal);
  document.getElementById("nbOperations").textContent = allOperations.length;
  document.getElementById("nbCommandes").textContent = allCommandes.length;
  document.getElementById("nbAlertes").textContent = "0";
  renderCharts();
}

function renderCharts() {
  const ventes = allOperations.filter((o) => o.type === "VENTE");
  const byDate = {};
  ventes.forEach((v) => {
    const d = (v.date || "").toString().substring(0, 10);
    if (!byDate[d]) byDate[d] = 0;
    byDate[d] += parseFloat(v.montant_total) || 0;
  });
  const sortedDates = Object.keys(byDate).sort();
  const labels = sortedDates.length ? sortedDates : ["Aucune donnée"];
  const dataCa = sortedDates.length ? sortedDates.map((d) => byDate[d]) : [0];
  const ctxCa = document.getElementById("caChart");
  if (caChartInstance) caChartInstance.destroy();
  caChartInstance = new Chart(ctxCa, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{ label: "CA (CFA)", data: dataCa, borderColor: "#c9a227", backgroundColor: "rgba(201,162,39,0.15)", tension: 0.4, borderWidth: 2 }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
  const byAgence = {};
  ventes.forEach((v) => {
    const id = v.agence_id || "Inconnu";
    if (!byAgence[id]) byAgence[id] = 0;
    byAgence[id] += parseFloat(v.montant_total) || 0;
  });
  const agLabels = Object.keys(byAgence).length ? Object.keys(byAgence) : ["Aucune"];
  const agData = Object.keys(byAgence).length ? Object.values(byAgence) : [0];
  const ctxAg = document.getElementById("agencesChart");
  if (agencesChartInstance) agencesChartInstance.destroy();
  agencesChartInstance = new Chart(ctxAg, {
    type: "bar",
    data: {
      labels: agLabels,
      datasets: [{ label: "CA par agence (CFA)", data: agData, backgroundColor: ["#c9a227", "#d4af37", "#a67c00", "#b8860b"] }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

async function loadStocks() {
  const r = await apiService.getStocks(null);
  allStocks = (r.success && r.data.stocks) ? r.data.stocks : [];
  const tbody = document.querySelector("#stocksTable tbody");
  tbody.innerHTML = "";
  allStocks.slice(0, 200).forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = "<td>" + (s.agence_id || "") + "</td><td>" + (s.produit_id || "") + "</td><td>" + (s.quantite_actuelle || 0) + "</td>";
    tbody.appendChild(tr);
  });
}

async function loadNotifications() {
  const r = await apiService.getNotificationsLog();
  const logs = (r.success && r.data.logs) ? r.data.logs : [];
  const tbody = document.querySelector("#notifTable tbody");
  tbody.innerHTML = "";
  logs.slice(0, 100).forEach((log) => {
    const tr = document.createElement("tr");
    const dateStr = log.date ? new Date(log.date).toLocaleString("fr-FR") : "";
    const valide = log.valide ? "Oui" : "Non";
    let btn = "";
    if (!log.valide) btn = '<button type="button" class="btn btn-sm btn-primary" data-id="' + log.id + '">Valider</button>';
    tr.innerHTML = "<td>" + dateStr + "</td><td>" + (log.type || "") + "</td><td>" + (log.canal || "") + "</td><td>" + (log.id_reference || "") + "</td><td>" + valide + "</td><td>" + btn + "</td>";
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll("button[data-id]").forEach((b) => {
    b.addEventListener("click", async () => {
      const id = b.getAttribute("data-id");
      const res = await apiService.validateNotification(id);
      if (res.success) loadNotifications();
    });
  });
}

async function loadParametres() {
  const r = await apiService.getParametresAdmin();
  const p = (r.success && r.data.params) ? r.data.params : {};
  document.getElementById("param_notif_chaque_op").checked = p.notif_chaque_op === "true" || p.notif_chaque_op === true;
  document.getElementById("param_synthese_jour").checked = p.synthese_jour === "true" || p.synthese_jour === true;
  document.getElementById("param_whatsapp").checked = p.whatsapp !== "false";
  document.getElementById("param_commande_admin").checked = p.commande_admin !== "false";
  document.getElementById("param_whatsapp_number").value = p.whatsapp_number || "";
}

async function saveParametres(e) {
  e.preventDefault();
  await apiService.setParametresAdmin("notif_chaque_op", document.getElementById("param_notif_chaque_op").checked ? "true" : "false");
  await apiService.setParametresAdmin("synthese_jour", document.getElementById("param_synthese_jour").checked ? "true" : "false");
  await apiService.setParametresAdmin("whatsapp", document.getElementById("param_whatsapp").checked ? "true" : "false");
  await apiService.setParametresAdmin("commande_admin", document.getElementById("param_commande_admin").checked ? "true" : "false");
  await apiService.setParametresAdmin("whatsapp_number", document.getElementById("param_whatsapp_number").value.trim());
  alert("Paramètres enregistrés.");
}

function getProduitNom(id) {
  const p = allProducts.find((x) => x.id === id);
  return p ? p.nom : id;
}

function buildAndShowRapport() {
  const agenceId = document.getElementById("agenceFilter").value || null;
  const periode = document.getElementById("periodeFilter").value;
  const range = getDateRange(periode);
  const ventes = allOperations.filter((o) => o.type === "VENTE");
  const caTotal = ventes.reduce((s, v) => s + (parseFloat(v.montant_total) || 0), 0);
  const periodeLabel = periode === "jour" ? "Aujourd'hui" : periode === "semaine" ? "Cette semaine" : "Ce mois";
  const agence = agenceId ? (agences.find((a) => a.id === agenceId)?.nom || agenceId) : "Toutes les agences";

  const statsHtml = `
    <div class="report-stats">
      <div class="report-stat"><div class="label">CA Total</div><div class="value">${formatCurrency(caTotal)}</div></div>
      <div class="report-stat"><div class="label">Opérations</div><div class="value">${allOperations.length}</div></div>
      <div class="report-stat"><div class="label">Ventes</div><div class="value">${ventes.length}</div></div>
    </div>
  `;
  const tableRows = allOperations.slice(0, 500).map((o) => {
    const nom = getProduitNom(o.produit_id);
    return `<tr><td>${o.date || ""}</td><td>${o.heure || ""}</td><td>${o.type}</td><td>${o.agence_id || ""}</td><td>${nom}</td><td>${o.quantite}</td><td>${formatCurrency(o.prix_unitaire)}</td><td>${formatCurrency(o.montant_total)}</td></tr>`;
  }).join("");
  const tableHtml = `
    <table class="report-table">
      <thead><tr><th>Date</th><th>Heure</th><th>Type</th><th>Agence</th><th>Produit</th><th>Qté</th><th>Prix unit.</th><th>Montant</th></tr></thead>
      <tbody>${tableRows || "<tr><td colspan='8'>Aucune opération</td></tr>"}</tbody>
    </table>
  `;

  const meta = {
    period: `${periodeLabel} (${range.debut} → ${range.fin})`,
    agence: agence,
    date: new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
  };
  const html = ReportUtils.wrapDocument(meta, statsHtml + tableHtml, "Rapport d'activité");
  const preview = document.getElementById("rapportPreview");
  preview.innerHTML = html;
  document.getElementById("btnExportPdf").style.display = "inline-flex";
}

async function exportRapportPdf() {
  const el = document.querySelector("#rapportPreview .report-document");
  if (!el) {
    alert("Générez d'abord le rapport.");
    return;
  }
  const agenceId = document.getElementById("agenceFilter").value || "global";
  const range = getDateRange(document.getElementById("periodeFilter").value);
  await ReportUtils.exportToPdf(el, "rapport_activite_" + agenceId + "_" + range.debut);
}

function handleLogout() {
  authService.logout();
  window.location.href = "index.html";
}

init();
