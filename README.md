# Orchidée Nature Management System

Système de gestion multi-agences (opérations, stocks, commandes, caisse). Données stockées dans Google Sheets via Apps Script. Devise : CFA.

## Configuration de la base de données Google Sheet

### 1. Créer le classeur

1. Allez sur [Google Drive](https://drive.google.com) et créez un nouveau **Google Sheets** (Tableur).
2. Donnez-lui un nom (ex. : `Orchidée Nature - Données`).

### 2. Créer les feuilles (onglets)

Créez les feuilles suivantes en bas du classeur (clic sur « + » ou « Ajouter une feuille »). Conservez exactement ces noms.

| Nom de la feuille   | Colonne A   | Colonne B   | Colonne C   | Colonne D   | Colonne E   | Colonne F   | Colonne G   | Colonne H   | Colonne I   | Colonne J   | Colonne K   | Colonne L   | Colonne M   |
|---------------------|------------|------------|------------|------------|------------|------------|------------|------------|------------|------------|------------|------------|------------|
| **Comptes**         | email      | password   | role       | nom        | agence_id  | statut     | last_login |             |             |             |             |             |             |
| **Agences**         | id         | nom        | code       |            |            |            |            |             |             |             |             |             |             |
| **Produits**        | id         | code       | nom        |            |            | prix_ht    | prix_ttc   |             | actif       |             |             |             |             |
| **Stocks**          | id         | agence_id  | produit_id | quantite_actuelle |      | date_maj   |             |             |             |             |             |             |             |
| **Operations**      | id         | numero     | agence_id  | type       | produit_id | quantite   | prix_unitaire | montant_total | date | heure | created_by | timestamp | notes |
| **Commandes**       | id         | numero     | agence_id  | type       | date_commande | date_livraison | statut   | priorite    | created_by |             |             |             |             |
| **LignesCommandes** | id_commande| produit_id | quantite   |            |            |            |            |             |             |             |             |             |             |
| **SessionsCaisse**  | id         | caissier_email | date_ouverture | date_fermeture | fond_caisse | montant_attendu | montant_reel | ecart | statut |   |             |             |             |
| **MouvementsCaisse**| id         | session_id | type       | montant    | description| timestamp  | caissier_email |             |             |             |             |             |             |
| **NotificationsLog**| id         | type       | id_reference | canal    | destinataire | statut    | date       | valide      |             |             |             |             |             |
| **AuthLogs**        | id         | email      | action     | date       | ip         | success    |             |             |             |             |             |             |             |
| **ContactsNotifications** | id   | nom        | prenom     | fonction   | whatsapp   | email      | types      | actif       |             |             |             |             |             |
| **ParametresAdmin** | key        | value      |            |            |            |            |            |             |             |             |             |             |             |

### 3. Remplir la première ligne (en-têtes)

Sur chaque feuille, la **première ligne** doit contenir les en-têtes (les noms de colonnes indiqués ci-dessus). La ligne 2 et suivantes contiendront les données.

### 4. Données minimales pour tester

**Feuille Comptes** (ligne 2) — au moins un compte par rôle :

- `admin@orchidenature.com` | `admin123` | `admin` | Admin | AG-001 | ACTIF
- `agence@orchidenature.com` | `agence123` | `agency` | Agence Paris | AG-001 | ACTIF
- `caissier@orchidenature.com` | `caisse123` | `caissier` | Caissier 1 | AG-001 | ACTIF

**Feuille Agences** (ligne 2) :

- AG-001 | Agence Paris Centre | PAR01

**Feuille Produits** (ligne 2) :

- PROD-001 | SAV001 | Savon Lavande 100g | | | 500 | 600 | | TRUE

**Feuille Stocks** (ligne 2) :

- STK-001 | AG-001 | PROD-001 | 50 | (vide)

Les mots de passe sont stockés en clair dans la feuille (pour la démo). En production, utilisez un mécanisme sécurisé (hash, authentification externe).

### 5. Apps Script (code backend)

1. **Option A – Script lié au tableur (recommandé)**  
   Ouvrez votre Google Sheet (celui qui contient les données) > **Extensions** > **Apps Script**. Le script sera lié à ce tableur.

2. **Option B – Projet autonome**  
   Si vous avez créé le script depuis [script.google.com](https://script.google.com), en haut de `Code.gs` vérifiez que la variable **`SPREADSHEET_ID`** contient l’ID de votre tableur (dans l’URL : `docs.google.com/spreadsheets/d/**ID_ICI**/edit`). Exemple :  
   `var SPREADSHEET_ID = '1ZCUtA3Sg4fLBahjkQO5CkuthtFiZzJdq7bpChy6fOTA';`

3. Supprimez tout le code par défaut, puis copiez-collez le contenu du fichier `google-sheets/Code.gs` du projet.
4. Enregistrez (Ctrl+S) et donnez un nom au projet (ex. : `Orchidée Nature API`).

### 6. Déployer le script en tant qu’application web

1. Dans Apps Script : **Déployer** > **Gérer les déploiements**.
2. **Créer un déploiement** > type **Application Web**.
3. Paramètres :
   - **Exécuter en tant que** : Moi
   - **Qui a accès** : **Tout le monde** (obligatoire pour éviter les erreurs CORS / 302)
4. Cliquez sur **Déployer** et copiez l’**URL du déploiement** (elle se termine par `/exec`).

### 7. Configurer l’application

1. Ouvrez le fichier **`config.js`** à la racine du projet.
2. Remplacez `apiUrl` si besoin :
   - En **local** avec le serveur proxy : laissez `apiUrl: "/api"`.
   - Pour le proxy local, l’URL réelle du script Google doit être dans **`server.js`** : remplacez la constante `GOOGLE_SCRIPT_URL` par l’URL de déploiement copiée à l’étape 6.

## Installation

1. Cloner ou extraire le projet.
2. À la racine du projet, lancer :
   ```bash
   npm install
   npm start
   ```
3. Le serveur démarre sur `http://localhost:8000`. Ouvrez cette URL dans le navigateur.

**Déploiement Vercel :** Le projet inclut une route `/api` qui relaie vers Google Apps Script. Dans le tableau de bord Vercel, définissez la variable d’environnement `GOOGLE_SCRIPT_URL` avec l’URL de déploiement de votre Apps Script (celle qui se termine par `/exec`). Gardez `apiUrl: "/api"` dans `config.js`.

## Test

IUGIUKJ

## Dépannage

### Résoudre l'erreur 405 (Méthode non autorisée)

Cette erreur vient **de Google**, pas du code : le déploiement de la Web App n’accepte pas les appels sans connexion Google. À faire **dans le projet Apps Script** :

1. Allez sur [script.google.com](https://script.google.com) et ouvrez le projet qui contient `Code.gs`.
2. Cliquez sur **Déployer** > **Gérer les déploiements**.
3. À droite du déploiement utilisé (celui dont vous avez copié l’URL `/exec`), cliquez sur le **crayon** (Modifier).
4. Dans **« Qui peut y accéder »**, choisissez **« Tout le monde »** (et non « Utilisateurs Google » ni « Utilisateurs de l’organisation »).
5. Cliquez sur **Enregistrer**.
6. Si une **nouvelle version** est proposée, créez-la et assurez-vous que l’URL dans `server.js` (`GOOGLE_SCRIPT_URL`) est bien celle de ce déploiement.

Après cela, relancez le serveur et réessayez la connexion.

- **CORS / 302** : même cause que le 405 ; le déploiement doit être **Tout le monde**.
- **Erreur de connexion** : vérifier que l’URL dans `server.js` (constante `GOOGLE_SCRIPT_URL`) correspond bien au déploiement et que le script est sauvegardé et déployé.
- **Données vides** : vérifier les noms des feuilles (exactement comme dans le tableau ci-dessus) et que la ligne 1 contient les en-têtes.
