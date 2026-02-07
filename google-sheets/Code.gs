// v1 : deploiement public, pas de validation d'origine (origin non verifie).
var SPREADSHEET_ID = '1EFkz_Y5MDNfJHdkXEVQLsE_aAatTRof6RjyGeQj7rwY';

var CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function getSpreadsheet() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents || String(e.postData.contents).trim() === '') {
      return createResponse(false, 'Corps de requête manquant. Envoyez un JSON avec { "action": "...", ... }.');
    }
    var raw = String(e.postData.contents).trim();
    var data = JSON.parse(raw);
    var action = data && (data.action || (e.parameter && e.parameter.action));
    if (!action) {
      return createResponse(false, 'Champ "action" manquant dans le JSON. Ex: { "action": "login", "email": "...", "password": "..." }');
    }
    Logger.log('doPost action=' + action);
    switch (action) {
      case 'login': return handleLogin(data);
      case 'getOperations': return getOperations(data);
      case 'createOperation': return createOperation(data);
      case 'updateOperation': return updateOperation(data);
      case 'getProducts': return getProducts(data);
      case 'getStocks': return getStocks(data);
      case 'updateStock': return updateStock(data);
      case 'getAgences': return getAgences(data);
      case 'createCommande': return createCommande(data);
      case 'getCommandes': return getCommandes(data);
      case 'openCaisseSession': return openCaisseSession(data);
      case 'closeCaisseSession': return closeCaisseSession(data);
      case 'addMouvementCaisse': return addMouvementCaisse(data);
      case 'getSessions': return getSessions(data);
      case 'getMouvementsCaisse': return getMouvementsCaisse(data);
      case 'getNotificationsLog': return getNotificationsLog(data);
      case 'validateNotification': return validateNotification(data);
      case 'getContactsNotifications': return getContactsNotifications(data);
      case 'getParametresAdmin': return getParametresAdmin(data);
      case 'setParametresAdmin': return setParametresAdmin(data);
      case 'sendNotification': return sendNotification(data);
      case 'logAuth': return logAuth(data);
      default: return createResponse(false, 'Action inconnue');
    }
  } catch (error) {
    return createResponse(false, 'Erreur: ' + error.message);
  }
}

function doGet(e) {
  return createResponse(true, 'API fonctionnelle');
}

function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders(CORS_HEADERS);
}

function createResponse(success, message, data) {
  if (data === undefined) data = null;
  var response = { success: success, message: message };
  if (data) response.data = data;
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders(CORS_HEADERS);
}

function getSheet(name) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function handleLogin(data) {
  Logger.log('handleLogin email=' + (data.email ? 'ok' : 'vide'));
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('Comptes');
  if (!sheet) sheet = ss.getSheets()[0];
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(data.email).trim() && String(rows[i][1]).trim() === String(data.password).trim()) {
      const user = { email: rows[i][0], role: rows[i][2], nom: rows[i][3], agence_id: rows[i][4], statut: rows[i][5] };
      if (user.statut !== 'ACTIF') {
        Logger.log('handleLogin compte non ACTIF');
        return createResponse(false, 'Compte désactivé');
      }
      const lastLoginCol = sheet.getLastColumn() >= 8 ? 8 : 7;
      sheet.getRange(i + 1, lastLoginCol).setValue(new Date());
      Logger.log('handleLogin succes');
      return createResponse(true, 'Connexion réussie', { user: user });
    }
  }
  Logger.log('handleLogin identifiants incorrects');
  return createResponse(false, 'Identifiants incorrects');
}

function getAgences(data) {
  const sheet = getSheet('Agences');
  const rows = sheet.getDataRange().getValues();
  const agences = [];
  for (let i = 1; i < rows.length; i++) {
    agences.push({ id: rows[i][0], nom: rows[i][1], code: rows[i][2] || '' });
  }
  return createResponse(true, 'OK', { agences: agences });
}

function getOperations(data) {
  const sheet = getSheet('Operations');
  const rows = sheet.getDataRange().getValues();
  const operations = [];
  for (let i = 1; i < rows.length; i++) {
    if (!data.agence_id || rows[i][2] === data.agence_id) {
      if (data.date_debut && rows[i][8] < data.date_debut) continue;
      if (data.date_fin && rows[i][8] > data.date_fin) continue;
      operations.push({
        id: rows[i][0], numero: rows[i][1], agence_id: rows[i][2], type: rows[i][3],
        produit_id: rows[i][4], quantite: rows[i][5], prix_unitaire: rows[i][6], montant_total: rows[i][7],
        date: rows[i][8], heure: rows[i][9], created_by: rows[i][10], timestamp: rows[i][11], notes: rows[i][12] || ''
      });
    }
  }
  return createResponse(true, 'OK', { operations: operations });
}

function createOperation(data) {
  const sheet = getSheet('Operations');
  const id = 'OP-' + Utilities.getUuid().substring(0, 8);
  const numero = 'OP-' + data.agence_id + '-' + Utilities.formatDate(new Date(), 'GMT', 'yyyyMMddHHmmss');
  sheet.appendRow([id, numero, data.agence_id, data.type, data.produit_id, data.quantite,
    data.prix_unitaire, data.montant_total, data.date, data.heure, data.created_by, new Date(), data.notes || '']);
  if (data.type === 'VENTE' || data.type === 'RETOUR') {
    updateStock({ agence_id: data.agence_id, produit_id: data.produit_id, quantite: data.type === 'VENTE' ? -data.quantite : data.quantite });
  }
  if (data.type === 'RECEPTION') {
    updateStock({ agence_id: data.agence_id, produit_id: data.produit_id, quantite: data.quantite });
  }
  return createResponse(true, 'Opération créée', { id: id, numero: numero });
}

function updateOperation(data) {
  const sheet = getSheet('Operations');
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.operation_id) {
      if (data.quantite !== undefined) sheet.getRange(i + 1, 6).setValue(data.quantite);
      if (data.prix_unitaire !== undefined) sheet.getRange(i + 1, 7).setValue(data.prix_unitaire);
      if (data.montant_total !== undefined) sheet.getRange(i + 1, 8).setValue(data.montant_total);
      if (data.notes !== undefined) sheet.getRange(i + 1, 13).setValue(data.notes);
      return createResponse(true, 'Opération mise à jour');
    }
  }
  return createResponse(false, 'Opération non trouvée');
}

function getProducts(data) {
  const sheet = getSheet('Produits');
  const rows = sheet.getDataRange().getValues();
  const products = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][8] === true || rows[i][8] === 'TRUE') {
      products.push({ id: rows[i][0], code: rows[i][1], nom: rows[i][2], prix_ht: rows[i][5], prix_ttc: rows[i][6] });
    }
  }
  return createResponse(true, 'OK', { products: products });
}

function getStocks(data) {
  const sheet = getSheet('Stocks');
  const rows = sheet.getDataRange().getValues();
  const stocks = [];
  for (let i = 1; i < rows.length; i++) {
    if (!data.agence_id || rows[i][1] === data.agence_id) {
      stocks.push({ id: rows[i][0], agence_id: rows[i][1], produit_id: rows[i][2], quantite_actuelle: rows[i][3] });
    }
  }
  return createResponse(true, 'OK', { stocks: stocks });
}

function updateStock(data) {
  const sheet = getSheet('Stocks');
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === data.agence_id && rows[i][2] === data.produit_id) {
      const newQuantite = rows[i][3] + data.quantite;
      sheet.getRange(i + 1, 4).setValue(newQuantite);
      sheet.getRange(i + 1, 6).setValue(new Date());
      return createResponse(true, 'Stock mis à jour');
    }
  }
  if (data.quantite < 0) {
    return createResponse(false, 'Stock introuvable pour cette agence/produit (vente impossible)');
  }
  const id = 'STK-' + Utilities.getUuid().substring(0, 8);
  sheet.appendRow([id, data.agence_id, data.produit_id, data.quantite, 0, new Date()]);
  return createResponse(true, 'Stock créé');
}

function createCommande(data) {
  const sheet = getSheet('Commandes');
  const id = 'CMD-' + Utilities.getUuid().substring(0, 8);
  const numero = 'CMD-' + data.agence_id + '-' + Utilities.formatDate(new Date(), 'GMT', 'yyyyMMdd');
  sheet.appendRow([id, numero, data.agence_id, data.type || 'MANUELLE', data.date_commande,
    data.date_livraison, data.statut || 'EN_ATTENTE', data.priorite || 'NORMAL', data.created_by]);
  if (data.produit_id && data.quantite) {
    const sheetL = getSheet('LignesCommandes');
    sheetL.appendRow([id, data.produit_id, data.quantite]);
  }
  return createResponse(true, 'Commande créée', { id: id, numero: numero });
}

function getCommandes(data) {
  const sheet = getSheet('Commandes');
  const rows = sheet.getDataRange().getValues();
  const commandes = [];
  for (let i = 1; i < rows.length; i++) {
    if (!data.agence_id || rows[i][2] === data.agence_id) {
      commandes.push({ id: rows[i][0], numero: rows[i][1], agence_id: rows[i][2], type: rows[i][3],
        date_commande: rows[i][4], date_livraison: rows[i][5], statut: rows[i][6] });
    }
  }
  return createResponse(true, 'OK', { commandes: commandes });
}

function openCaisseSession(data) {
  const sheet = getSheet('SessionsCaisse');
  const id = 'SES-' + Utilities.getUuid().substring(0, 8);
  sheet.appendRow([id, data.caissier_email, new Date(), null, data.fond_caisse, 0, 0, 0, 'OUVERTE']);
  return createResponse(true, 'Session ouverte', { session_id: id });
}

function closeCaisseSession(data) {
  const sheet = getSheet('SessionsCaisse');
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.session_id) {
      sheet.getRange(i + 1, 4).setValue(new Date());
      sheet.getRange(i + 1, 6).setValue(data.montant_attendu);
      sheet.getRange(i + 1, 7).setValue(data.montant_reel);
      sheet.getRange(i + 1, 8).setValue(data.ecart);
      sheet.getRange(i + 1, 9).setValue('FERMEE');
      return createResponse(true, 'Session fermée');
    }
  }
  return createResponse(false, 'Session non trouvée');
}

function addMouvementCaisse(data) {
  const sheet = getSheet('MouvementsCaisse');
  const id = 'MVT-' + Utilities.getUuid().substring(0, 8);
  sheet.appendRow([id, data.session_id, data.type, data.montant, data.description || '', new Date(), data.caissier_email]);
  return createResponse(true, 'Mouvement ajouté', { id: id });
}

function getSessions(data) {
  const sheet = getSheet('SessionsCaisse');
  const rows = sheet.getDataRange().getValues();
  const sessions = [];
  for (let i = 1; i < rows.length; i++) {
    if (!data.caissier_email || rows[i][1] === data.caissier_email) {
      sessions.push({
        id: rows[i][0], caissier_email: rows[i][1], date_ouverture: rows[i][2],
        date_fermeture: rows[i][3], fond_caisse: rows[i][4], montant_attendu: rows[i][5],
        montant_reel: rows[i][6], ecart: rows[i][7], statut: rows[i][8]
      });
    }
  }
  return createResponse(true, 'OK', { sessions: sessions });
}

function getMouvementsCaisse(data) {
  const sheet = getSheet('MouvementsCaisse');
  const rows = sheet.getDataRange().getValues();
  const mouvements = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === data.session_id) {
      mouvements.push({ id: rows[i][0], session_id: rows[i][1], type: rows[i][2], montant: rows[i][3], description: rows[i][4], timestamp: rows[i][5], caissier_email: rows[i][6] });
    }
  }
  return createResponse(true, 'OK', { mouvements: mouvements });
}

function getNotificationsLog(data) {
  const sheet = getSheet('NotificationsLog');
  const rows = sheet.getDataRange().getValues();
  const logs = [];
  for (let i = 1; i < rows.length; i++) {
    logs.push({ id: rows[i][0], type: rows[i][1], id_reference: rows[i][2], canal: rows[i][3], destinataire: rows[i][4], statut: rows[i][5], date: rows[i][6], valide: rows[i][7] === true || rows[i][7] === 'TRUE' });
  }
  return createResponse(true, 'OK', { logs: logs });
}

function validateNotification(data) {
  const sheet = getSheet('NotificationsLog');
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.log_id) {
      sheet.getRange(i + 1, 8).setValue(true);
      return createResponse(true, 'Notification validée');
    }
  }
  return createResponse(false, 'Log non trouvé');
}

function getContactsNotifications(data) {
  const sheet = getSheet('ContactsNotifications');
  const rows = sheet.getDataRange().getValues();
  const contacts = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][7] === true || rows[i][7] === 'TRUE') {
      contacts.push({ id: rows[i][0], nom: rows[i][1], prenom: rows[i][2], fonction: rows[i][3], whatsapp: rows[i][4], email: rows[i][5], types: rows[i][6] || 'TOUS' });
    }
  }
  return createResponse(true, 'OK', { contacts: contacts });
}

function getParametresAdmin(data) {
  const sheet = getSheet('ParametresAdmin');
  const rows = sheet.getDataRange().getValues();
  const params = {};
  for (let i = 1; i < rows.length; i++) {
    params[rows[i][0]] = rows[i][1];
  }
  return createResponse(true, 'OK', { params: params });
}

function setParametresAdmin(data) {
  const sheet = getSheet('ParametresAdmin');
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.key) {
      sheet.getRange(i + 1, 2).setValue(data.value);
      return createResponse(true, 'Paramètre mis à jour');
    }
  }
  sheet.appendRow([data.key, data.value]);
  return createResponse(true, 'Paramètre créé');
}

function sendNotification(data) {
  const sheet = getSheet('NotificationsLog');
  const id = 'NOT-' + Utilities.getUuid().substring(0, 8);
  sheet.appendRow([id, data.type, data.id_reference || '', data.canal, data.destinataire || '', 'ENVOYE', new Date(), false]);
  return createResponse(true, 'Notification envoyée', { id: id });
}

function logAuth(data) {
  const sheet = getSheet('AuthLogs');
  const id = 'LOG-' + Utilities.getUuid().substring(0, 8);
  sheet.appendRow([id, data.email, data.logAction || data.action, new Date(), data.ip || 'N/A', true]);
  return createResponse(true, 'Log enregistré');
}

function testLogin() {
  const out = handleLogin({ email: 'admin@orchidenature.com', password: 'admin123' });
  const json = JSON.parse(out.getContent());
  Logger.log('[TEST] login: ' + (json.success ? 'OK' : 'FAIL - ' + json.message));
  return json.success;
}

function testLoginWrongPassword() {
  const out = handleLogin({ email: 'admin@orchidenature.com', password: 'wrong' });
  const json = JSON.parse(out.getContent());
  const ok = !json.success && json.message && json.message.indexOf('Identifiants') >= 0;
  Logger.log('[TEST] login wrong password: ' + (ok ? 'OK' : 'FAIL - ' + (json.message || '')));
  return ok;
}

function testGetAgences() {
  const out = getAgences({});
  const json = JSON.parse(out.getContent());
  Logger.log('[TEST] getAgences: ' + (json.success ? 'OK (count: ' + (json.data.agences ? json.data.agences.length : 0) + ')' : 'FAIL - ' + json.message));
  return json.success;
}

function testGetProducts() {
  const out = getProducts({});
  const json = JSON.parse(out.getContent());
  Logger.log('[TEST] getProducts: ' + (json.success ? 'OK (count: ' + (json.data.products ? json.data.products.length : 0) + ')' : 'FAIL - ' + json.message));
  return json.success;
}

function testGetOperations() {
  const out = getOperations({ agence_id: null });
  const json = JSON.parse(out.getContent());
  Logger.log('[TEST] getOperations: ' + (json.success ? 'OK (count: ' + (json.data.operations ? json.data.operations.length : 0) + ')' : 'FAIL - ' + json.message));
  return json.success;
}

function testGetStocks() {
  const out = getStocks({ agence_id: null });
  const json = JSON.parse(out.getContent());
  Logger.log('[TEST] getStocks: ' + (json.success ? 'OK (count: ' + (json.data.stocks ? json.data.stocks.length : 0) + ')' : 'FAIL - ' + json.message));
  return json.success;
}

function testGetCommandes() {
  const out = getCommandes({ agence_id: null });
  const json = JSON.parse(out.getContent());
  Logger.log('[TEST] getCommandes: ' + (json.success ? 'OK (count: ' + (json.data.commandes ? json.data.commandes.length : 0) + ')' : 'FAIL - ' + json.message));
  return json.success;
}

function testGetParametresAdmin() {
  const out = getParametresAdmin({});
  const json = JSON.parse(out.getContent());
  Logger.log('[TEST] getParametresAdmin: ' + (json.success ? 'OK' : 'FAIL - ' + json.message));
  return json.success;
}

function testGetNotificationsLog() {
  const out = getNotificationsLog({});
  const json = JSON.parse(out.getContent());
  Logger.log('[TEST] getNotificationsLog: ' + (json.success ? 'OK (count: ' + (json.data.logs ? json.data.logs.length : 0) + ')' : 'FAIL - ' + json.message));
  return json.success;
}

function runAllTests() {
  Logger.log('=== Debut des tests ===');
  var ok = 0;
  var fail = 0;
  try { testLogin() ? ok++ : fail++; } catch (e) { Logger.log('[TEST] login EXCEPTION: ' + e.message); fail++; }
  try { testLoginWrongPassword() ? ok++ : fail++; } catch (e) { Logger.log('[TEST] loginWrongPassword EXCEPTION: ' + e.message); fail++; }
  try { testGetAgences() ? ok++ : fail++; } catch (e) { Logger.log('[TEST] getAgences EXCEPTION: ' + e.message); fail++; }
  try { testGetProducts() ? ok++ : fail++; } catch (e) { Logger.log('[TEST] getProducts EXCEPTION: ' + e.message); fail++; }
  try { testGetOperations() ? ok++ : fail++; } catch (e) { Logger.log('[TEST] getOperations EXCEPTION: ' + e.message); fail++; }
  try { testGetStocks() ? ok++ : fail++; } catch (e) { Logger.log('[TEST] getStocks EXCEPTION: ' + e.message); fail++; }
  try { testGetCommandes() ? ok++ : fail++; } catch (e) { Logger.log('[TEST] getCommandes EXCEPTION: ' + e.message); fail++; }
  try { testGetParametresAdmin() ? ok++ : fail++; } catch (e) { Logger.log('[TEST] getParametresAdmin EXCEPTION: ' + e.message); fail++; }
  try { testGetNotificationsLog() ? ok++ : fail++; } catch (e) { Logger.log('[TEST] getNotificationsLog EXCEPTION: ' + e.message); fail++; }
  Logger.log('=== Fin des tests: ' + ok + ' OK, ' + fail + ' FAIL ===');
  return fail === 0;
}
