const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL || "";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  if (!GOOGLE_SCRIPT_URL) return res.status(500).json({ success: false, message: "GOOGLE_SCRIPT_URL non configurée" });
  try {
    const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
    const r = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });
    const text = await r.text();
    res.status(r.status).setHeader("Content-Type", r.headers.get("content-type") || "application/json").send(text);
  } catch (e) {
    res.status(502).json({ success: false, message: "Erreur de connexion" });
  }
};
