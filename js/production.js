/**
 * Gestion Production & Stock Alimentaire - Orchidé Nature
 */

const ALLOWED_ROLES = [CONFIG.roles.CUISINE, CONFIG.roles.GESTIONNAIRE_STOCK, CONFIG.roles.ADMIN, CONFIG.roles.AGENCY];
const user = authService.requireAuth(ALLOWED_ROLES);

let products = [];
let matieresPremieres = [];
let recettes = [];
let agenceId = null;

function getAgenceId() {
  return user.agence_id || "AG1";
}

function closeModal(id) {
  document.getElementById(id).classList.remove("active");
}

function openModal(id) {
  document.getElementById(id).classList.add("active");
  if (id === "modalProduction") fillProductionModal();
  if (id === "modalFdj") fillFdjModal();
  if (id === "modalMouvement") fillMouvementModal();
  if (id === "modalLotMp") fillLotMpModal();
}

function handleLogout() {
  authService.logout();
  window.location.href = "index.html";
}

async function init() {
  if (!user) return;
  agenceId = getAgenceId();
  document.getElementById("userName").textContent = user.nom || user.email;
  document.getElementById("agenceLabel").textContent = user.agence_id || user.nom || "—";

  await Promise.all([
    loadProducts(),
    loadMatieresPremieres(),
    loadRecettes()
  ]);

  document.querySelectorAll(".menu-item").forEach((el) => {
    el.addEventListener("click", () => {
      document.querySelectorAll(".menu-item").forEach((m) => m.classList.remove("active"));
      el.classList.add("active");
      const view = el.dataset.view;
      showView(view);
      document.getElementById("prodContainer")?.classList.remove("menu-open");
    });
  });

  document.getElementById("formProduction")?.addEventListener("submit", submitProduction);
  document.getElementById("formFdj")?.addEventListener("submit", submitFdj);
  document.getElementById("formMouvement")?.addEventListener("submit", submitMouvement);
  document.getElementById("formRecette")?.addEventListener("submit", submitRecette);
  document.getElementById("formLotMp")?.addEventListener("submit", submitLotMp);
  document.getElementById("btnAddLigneProd")?.addEventListener("click", addLigneProduction);
  document.getElementById("btnAddIngredient")?.addEventListener("click", addIngredientRow);
  document.getElementById("prodProduit")?.addEventListener("change", onProduitChangeRecette);
  document.getElementById("recetteProduit")?.addEventListener("change", loadRecetteForEdit);

  showView("accueil");
}

async function loadProducts() {
  const r = await apiService.getProducts();
  if (r.success && r.data?.products) products = r.data.products;
  return r;
}

async function loadMatieresPremieres() {
  const r = await apiService.getMatieresPremieres();
  if (r.success && r.data?.matieres_premieres) matieresPremieres = r.data.matieres_premieres;
  return r;
}

async function loadRecettes() {
  const r = await apiService.getRecettes();
  if (r.success && r.data?.recettes) recettes = r.data.recettes;
  return r;
}

function showView(viewName) {
  const titles = {
    accueil: "Gestion Production & Stock",
    production: "Déclaration de production",
    fdj: "Fin de journée",
    mouvements: "Mouvements produits finis",
    stocks: "État des stocks",
    recettes: "Recettes",
    alertes: "Alertes péremption",
    "rapport-ecarts": "Rapport des écarts"
  };
  document.getElementById("pageTitle").textContent = titles[viewName] || "Production";
  const content = document.getElementById("viewContent");

  switch (viewName) {
    case "accueil":
      renderAccueil(content);
      break;
    case "production":
      renderProduction(content);
      break;
    case "fdj":
      renderFdj(content);
      break;
    case "mouvements":
      renderMouvements(content);
      break;
    case "stocks":
      renderStocks(content);
      break;
    case "recettes":
      renderRecettes(content);
      break;
    case "alertes":
      renderAlertes(content);
      break;
    case "rapport-ecarts":
      renderRapportEcarts(content);
      break;
    default:
      content.innerHTML = "";
  }
}

function renderAccueil(container) {
  container.innerHTML = `
    <div class="accueil-grid">
      <button type="button" class="action-card" onclick="showView('production'); openModal('modalProduction')">
        <div class="icon-wrap"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg></div>
        <h3>Déclarer une production</h3>
        <p>Enregistrer les quantités produites. Les matières premières sont déduites automatiquement selon les recettes (FIFO).</p>
      </button>
      <button type="button" class="action-card" onclick="showView('fdj'); openModal('modalFdj')">
        <div class="icon-wrap"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg></div>
        <h3>Fin de journée</h3>
        <p>Saisir les quantités réelles utilisées et consulter le rapport des écarts théorique / réel.</p>
      </button>
      <button type="button" class="action-card" onclick="showView('mouvements'); openModal('modalMouvement')">
        <div class="icon-wrap"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg></div>
        <h3>Mouvement PF</h3>
        <p>Remise pour vente, invendus, retours — enregistrer les mouvements des produits finis.</p>
      </button>
      <button type="button" class="action-card" onclick="showView('stocks')">
        <div class="icon-wrap"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg></div>
        <h3>État des stocks</h3>
        <p>Consulter les stocks matières premières et produits finis en temps réel.</p>
      </button>
      <button type="button" class="action-card" onclick="showView('recettes')">
        <div class="icon-wrap"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg></div>
        <h3>Recettes</h3>
        <p>Configurer les fiches recettes (ingrédients par produit).</p>
      </button>
      <button type="button" class="action-card" onclick="showView('alertes')">
        <div class="icon-wrap"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-6-6 6 6 0 00-6 6v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg></div>
        <h3>Alertes péremption</h3>
        <p>Lots proches de la date de péremption (FIFO).</p>
      </button>
    </div>
  `;

  (async () => {
    const [rStocks, rAlertes] = await Promise.all([
      apiService.getStocksMpResume({ agence_id: agenceId }),
      apiService.getAlertesPeremption({ agence_id: agenceId, jours: 7 })
    ]);
    const stocksMp = (rStocks.success && rStocks.data?.stocks_mp) ? rStocks.data.stocks_mp : [];
    const alertesPf = (rAlertes.success && rAlertes.data?.alertes_pf) ? rAlertes.data.alertes_pf : [];
    const alertesMp = (rAlertes.success && rAlertes.data?.alertes_mp) ? rAlertes.data.alertes_mp : [];
    const nbAlertes = alertesPf.length + alertesMp.length;

    const statsHtml = `
      <div class="stats-row">
        <div class="stat-mini"><div class="label">Matières 1ères</div><div class="value">${stocksMp.length}</div></div>
        <div class="stat-mini"><div class="label">Alertes 7 jours</div><div class="value">${nbAlertes}</div></div>
      </div>
      ${nbAlertes > 0 ? `
      <div class="alertes-box">
        <h3><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg> Péremption proche</h3>
        <ul>
          ${[...alertesPf, ...alertesMp].slice(0, 5).map((a) => `
            <li>${a.produit_nom || a.mp_nom || a.matiere_premiere_id} — Lot ${a.numero_lot} — Péremption ${a.date_peremption} (${a.quantite_restante} restant)</li>
          `).join("")}
        </ul>
      </div>
      ` : ""}
    `;
    container.insertAdjacentHTML("afterbegin", statsHtml);
  })();
}

function renderProduction(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>Déclarations de production</h2>
        <button type="button" class="btn btn-primary" onclick="openModal('modalProduction')">+ Nouvelle production</button>
      </div>
      <p class="muted">Lors de la déclaration, les matières premières sont déduites automatiquement selon la recette (FIFO). Les produits finis sont créés en lots.</p>
      <div id="listeDeclarations"></div>
    </div>
  `;
  loadDeclarationsProduction();
}

async function loadDeclarationsProduction() {
  const r = await apiService.getDeclarationsProduction({ agence_id: agenceId, date_debut: getDateOffset(-7), date_fin: getDateOffset(0) });
  const declarations = (r.success && r.data?.declarations) ? r.data.declarations : [];
  const el = document.getElementById("listeDeclarations");
  if (!el) return;
  if (declarations.length === 0) {
    el.innerHTML = '<div class="empty-state">Aucune déclaration récente.</div>';
    return;
  }
  el.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Date</th><th>Heure</th><th>Produits</th><th>Créé par</th></tr></thead>
        <tbody>
          ${declarations.map((d) => `
            <tr>
              <td>${d.date}</td>
              <td>${d.heure || "—"}</td>
              <td>${(d.lignes || []).map((l) => {
                const p = products.find((x) => x.id === l.produit_id);
                return (p ? p.nom : l.produit_id) + " × " + l.quantite;
              }).join(", ") || "—"}</td>
              <td>${d.created_by || "—"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function getDateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function fillProductionModal() {
  const sel = document.getElementById("prodProduit");
  sel.innerHTML = "<option value=''>Sélectionner un produit...</option>";
  products.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.nom;
    sel.appendChild(opt);
  });
  document.getElementById("lignesProduction").innerHTML = "";
  document.getElementById("recettePreview").innerHTML = "";
  addLigneProduction();
}

function addLigneProduction() {
  const container = document.getElementById("lignesProduction");
  const sel = document.createElement("div");
  sel.className = "ligne-dyn";
  sel.innerHTML = `
    <div class="form-group">
      <label>Produit</label>
      <select class="ligne-prod-select">
        <option value="">—</option>
        ${products.map((p) => `<option value="${p.id}">${p.nom}</option>`).join("")}
      </select>
    </div>
    <div class="form-group">
      <label>Quantité</label>
      <input type="number" class="ligne-qte" min="1" value="1">
    </div>
    <button type="button" class="btn btn-sm btn-secondary" onclick="this.closest('.ligne-dyn').remove()">×</button>
  `;
  container.appendChild(sel);
}

function onProduitChangeRecette() {
  const pid = document.getElementById("prodProduit").value;
  const preview = document.getElementById("recettePreview");
  if (!pid) { preview.innerHTML = ""; return; }
  apiService.getRecetteByProduit(pid).then((r) => {
    const rec = r.success && r.data?.recette;
    if (!rec || !rec.ingredients || rec.ingredients.length === 0) {
      preview.innerHTML = "<em>Aucune recette configurée pour ce produit.</em>";
      return;
    }
    preview.innerHTML = `
      <strong>Recette (par unité) :</strong>
      <ul>${rec.ingredients.map((i) => `<li>${i.mp_nom} : ${i.quantite} ${i.unite}</li>`).join("")}</ul>
    `;
  });
}

async function submitProduction(e) {
  e.preventDefault();
  const lignes = [];
  const pidTop = document.getElementById("prodProduit")?.value;
  const qtyTop = parseFloat(document.getElementById("prodQuantite")?.value) || 0;
  if (pidTop && qtyTop > 0) lignes.push({ produit_id: pidTop, quantite: qtyTop });
  document.querySelectorAll("#lignesProduction .ligne-dyn").forEach((row) => {
    const prod = row.querySelector(".ligne-prod-select")?.value;
    const qte = parseFloat(row.querySelector(".ligne-qte")?.value) || 0;
    if (prod && qte > 0) lignes.push({ produit_id: prod, quantite: qte });
  });
  if (lignes.length === 0) {
    alert("Ajoutez au moins un produit avec une quantité.");
    return;
  }
  const result = await apiService.declareProduction({
    agence_id: agenceId,
    lignes,
    created_by: user.email
  });
  if (result.success) {
    closeModal("modalProduction");
    showView("production");
    alert("Production enregistrée avec succès.");
  } else {
    alert("Erreur : " + (result.message || "stock insuffisant"));
  }
}

function renderFdj(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>Déclarations Fin de Journée</h2>
        <button type="button" class="btn btn-primary" onclick="openModal('modalFdj')">+ Nouvelle FDJ</button>
      </div>
      <p class="muted">Saisissez les quantités réellement utilisées par matière première. Comparez avec les quantités théoriques.</p>
      <div class="form-group" style="max-width:200px">
        <label>Date</label>
        <input type="date" id="fdjFilterDate" value="${new Date().toISOString().split("T")[0]}">
      </div>
      <div id="listeFdj"></div>
    </div>
  `;
  document.getElementById("fdjFilterDate")?.addEventListener("change", loadDeclarationsFdj);
  loadDeclarationsFdj();
}

async function loadDeclarationsFdj() {
  const dateEl = document.getElementById("fdjFilterDate");
  const date = dateEl ? dateEl.value : new Date().toISOString().split("T")[0];
  const r = await apiService.getDeclarationsFdj({ agence_id: agenceId, date });
  const declarations = (r.success && r.data?.declarations) ? r.data.declarations : [];
  const el = document.getElementById("listeFdj");
  if (!el) return;
  if (declarations.length === 0) {
    el.innerHTML = '<div class="empty-state">Aucune déclaration FDJ pour cette date.</div>';
    return;
  }
  el.innerHTML = declarations.map((d) => `
    <div class="card" style="margin-top:12px">
      <h3 style="font-size:14px; margin-bottom:10px">${d.date} ${d.heure || ""} — ${d.created_by || "—"}</h3>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Matière</th><th>Théorique</th><th>Réel</th><th>Écart</th></tr></thead>
          <tbody>
            ${(d.lignes || []).map((l) => {
              const ec = (l.ecart ?? (l.quantite_reelle - l.quantite_theorique));
              const ecClass = ec > 0 ? "ecart-pos" : ec < 0 ? "ecart-neg" : "ecart-nul";
              return `<tr><td>${l.mp_nom}</td><td>${l.quantite_theorique} ${l.unite || ""}</td><td>${l.quantite_reelle}</td><td class="${ecClass}">${ec} ${l.unite || ""}</td></tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `).join("");
}

function fillFdjModal() {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("fdjDate").value = today;
  const tbody = document.getElementById("fdjLignes");
  tbody.innerHTML = "";
  matieresPremieres.forEach((mp) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${mp.nom} (${mp.unite})</td>
      <td><input type="number" step="0.01" readonly class="fdj-theo" data-mp="${mp.id}" value="0" style="width:80px; background:#f5f5f5"></td>
      <td><input type="number" step="0.01" class="fdj-reel" data-mp="${mp.id}" value="0" required style="width:80px"></td>
      <td class="fdj-ecart" data-mp="${mp.id}">—</td>
    `;
    tr.querySelector(".fdj-reel").addEventListener("input", () => updateFdjEcarts());
    tbody.appendChild(tr);
  });
  loadTheoriqueFdj(today);
}

function updateFdjEcarts() {
  document.querySelectorAll("#fdjLignes tr").forEach((tr) => {
    const mp = tr.querySelector(".fdj-reel")?.dataset?.mp;
    const theo = parseFloat(tr.querySelector(".fdj-theo")?.value) || 0;
    const reel = parseFloat(tr.querySelector(".fdj-reel")?.value) || 0;
    const ecart = reel - theo;
    const ecEl = tr.querySelector(".fdj-ecart");
    if (ecEl) {
      ecEl.textContent = ecart;
      ecEl.className = "fdj-ecart " + (ecart > 0 ? "ecart-pos" : ecart < 0 ? "ecart-neg" : "ecart-nul");
    }
  });
}

async function loadTheoriqueFdj(date) {
  const r = await apiService.getDeclarationsProduction({ agence_id: agenceId, date });
  const declarations = (r.success && r.data?.declarations) ? r.data.declarations : [];
  const theoByMp = {};
  for (const d of declarations) {
    for (const ligne of d.lignes || []) {
      const rec = recettes.find((r) => r.produit_id === ligne.produit_id);
      if (rec && rec.ingredients) {
        for (const ing of rec.ingredients) {
          const mpId = ing.matiere_premiere_id;
          theoByMp[mpId] = (theoByMp[mpId] || 0) + (ing.quantite || 0) * (ligne.quantite || 0);
        }
      }
    }
  }
  document.querySelectorAll(".fdj-theo").forEach((inp) => {
    const mp = inp.dataset.mp;
    inp.value = theoByMp[mp] || 0;
  });
  updateFdjEcarts();
}

async function submitFdj(e) {
  e.preventDefault();
  const date = document.getElementById("fdjDate").value;
  const lignes = [];
  document.querySelectorAll("#fdjLignes tr").forEach((tr) => {
    const mp = tr.querySelector(".fdj-reel")?.dataset?.mp;
    const theo = parseFloat(tr.querySelector(".fdj-theo")?.value) || 0;
    const reel = parseFloat(tr.querySelector(".fdj-reel")?.value) || 0;
    if (mp) lignes.push({ matiere_premiere_id: mp, quantite_theorique: theo, quantite_reelle: reel });
  });
  const result = await apiService.declareFdj({
    agence_id: agenceId,
    date,
    lignes,
    created_by: user.email
  });
  if (result.success) {
    closeModal("modalFdj");
    showView("fdj");
    alert("Fin de journée enregistrée.");
  } else {
    alert("Erreur : " + (result.message || ""));
  }
}

function renderMouvements(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>Mouvements produits finis</h2>
        <button type="button" class="btn btn-primary" onclick="openModal('modalMouvement')">+ Nouveau mouvement</button>
      </div>
      <div id="listeMouvements"></div>
    </div>
  `;
  loadMouvements();
}

async function loadMouvements() {
  const r = await apiService.getMouvementsPf({ agence_id: agenceId, date_debut: getDateOffset(-14), date_fin: getDateOffset(0) });
  const mouvements = (r.success && r.data?.mouvements) ? r.data.mouvements : [];
  const el = document.getElementById("listeMouvements");
  if (!el) return;
  const labels = { REMISE_VENTE: "Remise vente", INVENDU: "Invendu", RETOUR: "Retour" };
  if (mouvements.length === 0) {
    el.innerHTML = '<div class="empty-state">Aucun mouvement récent.</div>';
    return;
  }
  el.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Date</th><th>Type</th><th>Produit</th><th>Quantité</th><th>Notes</th></tr></thead>
        <tbody>
          ${mouvements.map((m) => `<tr><td>${m.date} ${m.heure || ""}</td><td>${labels[m.type] || m.type}</td><td>${m.produit_nom || m.produit_id}</td><td>${m.quantite}</td><td>${m.notes || "—"}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function fillMouvementModal() {
  const sel = document.getElementById("mvtProduit");
  sel.innerHTML = "<option value=''>Sélectionner...</option>";
  products.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.nom;
    sel.appendChild(opt);
  });
}

async function submitMouvement(e) {
  e.preventDefault();
  const result = await apiService.addMouvementPf({
    agence_id: agenceId,
    type: document.getElementById("mvtType").value,
    produit_id: document.getElementById("mvtProduit").value,
    quantite: parseFloat(document.getElementById("mvtQuantite").value),
    notes: document.getElementById("mvtNotes").value.trim() || null,
    created_by: user.email
  });
  if (result.success) {
    closeModal("modalMouvement");
    showView("mouvements");
    document.getElementById("formMouvement").reset();
  } else {
    alert("Erreur : " + (result.message || ""));
  }
}

function renderStocks(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>Matières premières (résumé)</h2>
        <button type="button" class="btn btn-secondary" onclick="openModal('modalLotMp')">+ Nouveau lot</button>
      </div>
      <div id="stocksMp"></div>
    </div>
    <div class="card">
      <h2>Produits finis (stocks)</h2>
      <div id="stocksPf"></div>
    </div>
  `;
  loadStocks();
}

async function loadStocks() {
  const [rMp, rPf, rStocks] = await Promise.all([
    apiService.getStocksMpResume({ agence_id: agenceId }),
    apiService.getLotsPf({ agence_id: agenceId }),
    apiService.getStocks({ agence_id: agenceId })
  ]);
  const stocksMp = (rMp.success && rMp.data?.stocks_mp) ? rMp.data.stocks_mp : [];
  const lotsPf = (rPf.success && rPf.data?.lots) ? rPf.data.lots : [];
  const stocksPf = (rStocks.success && rStocks.data?.stocks) ? rStocks.data.stocks : [];

  const elMp = document.getElementById("stocksMp");
  const elPf = document.getElementById("stocksPf");
  if (elMp) {
    if (stocksMp.length === 0) elMp.innerHTML = '<div class="empty-state">Aucun stock MP.</div>';
    else elMp.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Matière première</th><th>Unite</th><th>Total</th></tr></thead>
          <tbody>${stocksMp.map((s) => `<tr><td>${s.mp_nom}</td><td>${s.unite}</td><td>${s.total}</td></tr>`).join("")}</tbody>
        </table>
      </div>
    `;
  }
  if (elPf) {
    if (stocksPf.length === 0) elPf.innerHTML = '<div class="empty-state">Aucun stock produit fini.</div>';
    else elPf.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Produit</th><th>Quantité</th></tr></thead>
          <tbody>${stocksPf.map((s) => {
            const p = products.find((x) => x.id === s.produit_id);
            return `<tr><td>${p ? p.nom : s.produit_id}</td><td>${s.quantite_actuelle}</td></tr>`;
          }).join("")}</tbody>
        </table>
      </div>
    `;
  }
}

function renderRecettes(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>Recettes</h2>
        <button type="button" class="btn btn-primary" onclick="fillRecetteModal(); openModal('modalRecette')">+ Configurer recette</button>
      </div>
      <p class="muted">Chaque produit peut avoir une fiche recette listant les matières premières nécessaires par unité.</p>
      <div id="listeRecettes"></div>
    </div>
  `;
  const el = document.getElementById("listeRecettes");
  if (recettes.length === 0) el.innerHTML = '<div class="empty-state">Aucune recette configurée.</div>';
  else el.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Produit</th><th>Ingrédients</th><th>Action</th></tr></thead>
        <tbody>
          ${recettes.map((r) => `
            <tr>
              <td>${r.produit_nom || r.produit_id}</td>
              <td>${(r.ingredients || []).map((i) => `${i.mp_nom}: ${i.quantite} ${i.unite}`).join(", ") || "—"}</td>
              <td><button type="button" class="btn btn-sm btn-secondary" onclick="editRecette('${r.produit_id}')">Modifier</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function fillRecetteModal(produitId) {
  const sel = document.getElementById("recetteProduit");
  sel.innerHTML = "<option value=''>Sélectionner un produit...</option>";
  products.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.nom;
    sel.appendChild(opt);
  });
  if (produitId) sel.value = produitId;
  document.getElementById("recetteIngredients").innerHTML = "";
  if (produitId) loadRecetteForEdit();
}

function loadRecetteForEdit() {
  const pid = document.getElementById("recetteProduit").value;
  if (!pid) return;
  apiService.getRecetteByProduit(pid).then((r) => {
    const rec = r.success && r.data?.recette;
    const container = document.getElementById("recetteIngredients");
    container.innerHTML = "";
    (rec?.ingredients || []).forEach((i) => addIngredientRow(i));
    if ((rec?.ingredients || []).length === 0) addIngredientRow();
  });
}

function addIngredientRow(ing) {
  const container = document.getElementById("recetteIngredients");
  const row = document.createElement("div");
  row.className = "ingredient-row";
  row.innerHTML = `
    <div class="form-group">
      <label>Matière première</label>
      <select class="ing-mp">
        <option value="">—</option>
        ${matieresPremieres.map((mp) => `<option value="${mp.id}" ${ing?.matiere_premiere_id === mp.id ? "selected" : ""}>${mp.nom} (${mp.unite})</option>`).join("")}
      </select>
    </div>
    <div class="form-group">
      <label>Quantité</label>
      <input type="number" class="ing-qte" step="0.001" min="0" value="${ing?.quantite || ""}" placeholder="0">
    </div>
    <div class="form-group">
      <label>Unité</label>
      <input type="text" class="ing-unite" value="${ing?.unite || "kg"}" placeholder="kg">
    </div>
    <button type="button" class="btn btn-sm btn-secondary" onclick="this.closest('.ingredient-row').remove()">×</button>
  `;
  container.appendChild(row);
}

async function submitRecette(e) {
  e.preventDefault();
  const produit_id = document.getElementById("recetteProduit").value;
  const ingredients = [];
  document.querySelectorAll("#recetteIngredients .ingredient-row").forEach((row) => {
    const mp = row.querySelector(".ing-mp")?.value;
    const qte = parseFloat(row.querySelector(".ing-qte")?.value);
    const unite = row.querySelector(".ing-unite")?.value?.trim() || "kg";
    if (mp && qte > 0) ingredients.push({ matiere_premiere_id: mp, quantite: qte, unite });
  });
  const result = await apiService.saveRecette({ produit_id, ingredients });
  if (result.success) {
    closeModal("modalRecette");
    await loadRecettes();
    showView("recettes");
  }
}

function editRecette(produitId) {
  fillRecetteModal(produitId);
  openModal("modalRecette");
}

function renderAlertes(container) {
  container.innerHTML = `
    <div class="card">
      <h2>Lots proches de la péremption (7 jours)</h2>
      <div id="alertesContent"></div>
    </div>
  `;
  loadAlertes();
}

async function loadAlertes() {
  const r = await apiService.getAlertesPeremption({ agence_id: agenceId, jours: 7 });
  const alertesPf = (r.success && r.data?.alertes_pf) ? r.data.alertes_pf : [];
  const alertesMp = (r.success && r.data?.alertes_mp) ? r.data.alertes_mp : [];
  const el = document.getElementById("alertesContent");
  if (!el) return;
  if (alertesPf.length === 0 && alertesMp.length === 0) {
    el.innerHTML = '<div class="empty-state">Aucune alerte péremption.</div>';
    return;
  }
  el.innerHTML = `
    <h3 style="font-size:14px; margin-bottom:10px">Produits finis</h3>
    <div class="table-wrap" style="margin-bottom:20px">
      <table class="data-table">
        <thead><tr><th>Produit</th><th>Lot</th><th>Péremption</th><th>Restant</th></tr></thead>
        <tbody>${alertesPf.map((a) => `<tr><td>${a.produit_nom}</td><td>${a.numero_lot}</td><td>${a.date_peremption}</td><td>${a.quantite_restante}</td></tr>`).join("")}</tbody>
      </table>
    </div>
    <h3 style="font-size:14px; margin-bottom:10px">Matières premières</h3>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Matière</th><th>Lot</th><th>Péremption</th><th>Restant</th></tr></thead>
        <tbody>${alertesMp.map((a) => `<tr><td>${a.mp_nom}</td><td>${a.numero_lot}</td><td>${a.date_peremption}</td><td>${a.quantite_restante}</td></tr>`).join("")}</tbody>
      </table>
    </div>
  `;
}

function renderRapportEcarts(container) {
  container.innerHTML = `
    <div class="card">
      <h2>Rapport des écarts (FDJ)</h2>
      <p class="muted">Comparaison quantités théoriques vs réelles par matière première.</p>
      <div class="report-actions">
        <div class="form-group" style="max-width:200px; margin:0">
          <label>Date</label>
          <input type="date" id="rapportDate" value="${new Date().toISOString().split("T")[0]}">
        </div>
        <button type="button" class="btn btn-primary" onclick="loadRapportEcarts()">Afficher le rapport</button>
        <button type="button" class="btn btn-primary" id="btnExportPdfEcarts" style="display:none">Exporter en PDF</button>
      </div>
      <div class="report-preview-wrap" id="rapportContent" style="margin-top:16px"></div>
    </div>
  `;
  document.getElementById("rapportDate")?.addEventListener("change", loadRapportEcarts);
  document.getElementById("btnExportPdfEcarts")?.addEventListener("click", exportRapportEcartsPdf);
  loadRapportEcarts();
}

async function loadRapportEcarts() {
  const date = document.getElementById("rapportDate")?.value || new Date().toISOString().split("T")[0];
  const r = await apiService.getRapportEcarts({ agence_id: agenceId, date });
  const rapport = r.success && r.data?.rapport;
  const el = document.getElementById("rapportContent");
  const btnPdf = document.getElementById("btnExportPdfEcarts");
  if (!el) return;
  if (!rapport) {
    el.innerHTML = '<div class="empty-state">Aucune déclaration FDJ pour cette date.</div>';
    if (btnPdf) btnPdf.style.display = "none";
    return;
  }
  const tableRows = (rapport.lignes || []).map((l) => {
    const ec = l.ecart ?? (l.quantite_reelle - l.quantite_theorique);
    const ecClass = ec > 0 ? "ecart-pos" : ec < 0 ? "ecart-neg" : "ecart-nul";
    return `<tr><td>${l.mp_nom}</td><td>${l.quantite_theorique} ${l.unite || ""}</td><td>${l.quantite_reelle}</td><td class="${ecClass}">${ec} ${l.unite || ""}</td></tr>`;
  }).join("");

  const meta = {
    period: `Fin de journée - ${date}`,
    agence: user.nom || user.agence_id || "—",
    date: new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
  };
  const tableHtml = `
    <table class="report-table">
      <thead><tr><th>Matière première</th><th>Théorique</th><th>Réel</th><th>Écart</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;
  const html = ReportUtils.wrapDocument(meta, tableHtml, "Rapport des écarts — " + rapport.date + " — " + (rapport.created_by || "—"));
  el.innerHTML = html;
  if (btnPdf) btnPdf.style.display = "inline-flex";
}

async function exportRapportEcartsPdf() {
  const el = document.querySelector("#rapportContent .report-document");
  if (!el) {
    alert("Affichez d'abord le rapport.");
    return;
  }
  const date = document.getElementById("rapportDate")?.value || new Date().toISOString().split("T")[0];
  await ReportUtils.exportToPdf(el, "rapport_ecarts_fdj_" + date);
}

function fillLotMpModal() {
  const sel = document.getElementById("lotMpMatiere");
  sel.innerHTML = "<option value=''>Sélectionner...</option>";
  matieresPremieres.forEach((mp) => {
    const opt = document.createElement("option");
    opt.value = mp.id;
    opt.setAttribute("data-unite", mp.unite);
    opt.textContent = `${mp.nom} (${mp.unite})`;
    sel.appendChild(opt);
  });
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("lotMpDateReception").value = today;
  const peremp = new Date();
  peremp.setMonth(peremp.getMonth() + 3);
  document.getElementById("lotMpDatePeremption").value = peremp.toISOString().split("T")[0];
  sel.addEventListener("change", () => {
    const opt = sel.options[sel.selectedIndex];
    const unite = opt?.getAttribute("data-unite") || "kg";
    document.getElementById("lotMpQuantite").step = unite === "kg" ? "0.01" : "1";
  });
}

async function submitLotMp(e) {
  e.preventDefault();
  const opt = document.getElementById("lotMpMatiere").options[document.getElementById("lotMpMatiere").selectedIndex];
  const unite = opt?.getAttribute("data-unite") || "kg";
  const result = await apiService.addLotMp({
    matiere_premiere_id: document.getElementById("lotMpMatiere").value,
    agence_id: agenceId,
    numero_lot: document.getElementById("lotMpNumero").value.trim() || undefined,
    quantite: parseFloat(document.getElementById("lotMpQuantite").value),
    unite,
    date_reception: document.getElementById("lotMpDateReception").value,
    date_peremption: document.getElementById("lotMpDatePeremption").value
  });
  if (result.success) {
    closeModal("modalLotMp");
    showView("stocks");
    document.getElementById("formLotMp").reset();
  }
}

document.getElementById("modalProduction")?.addEventListener("click", (e) => { if (e.target.id === "modalProduction") closeModal("modalProduction"); });
document.getElementById("modalFdj")?.addEventListener("click", (e) => { if (e.target.id === "modalFdj") closeModal("modalFdj"); });
document.getElementById("modalMouvement")?.addEventListener("click", (e) => { if (e.target.id === "modalMouvement") closeModal("modalMouvement"); });
document.getElementById("modalRecette")?.addEventListener("click", (e) => { if (e.target.id === "modalRecette") closeModal("modalRecette"); });
document.getElementById("modalLotMp")?.addEventListener("click", (e) => { if (e.target.id === "modalLotMp") closeModal("modalLotMp"); });

init();
