/**
 * Orchidé Nature - Utilitaires rapports (logo, styles, export PDF)
 */
const ReportUtils = {
  get logoUrl() {
    if (typeof window === "undefined" || !window.location) return "images/logo.png";
    const base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, "/");
    return base + "images/logo.png";
  },

  buildHeader(meta) {
    const period = meta.period || "";
    const agence = meta.agence || "Toutes les agences";
    const date = meta.date || new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    return `
      <div class="report-header">
        <img src="${this.logoUrl}" alt="Orchidé Nature" class="logo" crossorigin="anonymous">
        <div class="brand">
          <h1>Orchidé Nature</h1>
          <p>Système de Gestion Multi-Agences</p>
        </div>
      </div>
      <div class="report-meta">
        ${period ? `<strong>Période :</strong> ${period} &nbsp;|&nbsp; ` : ""}
        <strong>Agence :</strong> ${agence} &nbsp;|&nbsp;
        <strong>Généré le :</strong> ${date}
      </div>
    `;
  },

  buildFooter() {
    return `
      <div class="report-footer">
        © ${new Date().getFullYear()} Orchidé Nature — Document généré automatiquement
      </div>
    `;
  },

  wrapDocument(meta, bodyHtml, title) {
    return `
      <div class="report-document">
        ${this.buildHeader(meta)}
        <div class="report-body">
          ${title ? `<h2 class="report-title">${title}</h2>` : ""}
          ${bodyHtml}
        </div>
        ${this.buildFooter()}
      </div>
    `;
  },

  async exportToPdf(element, filename) {
    if (typeof html2pdf === "undefined") {
      alert("Bibliothèque PDF non chargée. Vérifiez votre connexion.");
      return;
    }
    const opt = {
      margin: 10,
      filename: (filename || "rapport_orchidee_nature") + ".pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    };
    try {
      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error("Erreur export PDF:", err);
      alert("Erreur lors de la génération du PDF.");
    }
  }
};
