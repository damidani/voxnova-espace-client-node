# Espace client pour revendeurs VoxNova (Node.js)

Un espace client **clé en main**, à vos couleurs, que vous installez sur votre propre domaine (par exemple `espace.mon-operateur.fr`). Vos clients s’y connectent avec leurs identifiants habituels et gèrent leur téléphonie sans jamais voir la plateforme qui est derrière.

Il se branche sur l’API de la plateforme par le **SDK officiel** [`@voxnova/sdk`](https://www.npmjs.com/package/@voxnova/sdk), avec **votre clé revendeur** : aucune base de données à installer, rien à synchroniser. Tout ce que l’API sait faire est disponible.

> Une version PHP identique existe : [voxnova-espace-client-php](https://github.com/damidani/voxnova-espace-client-php).

## Ce que vos clients peuvent faire

| Page | Fonctions |
|---|---|
| **Tableau de bord** | Graphique des appels sur 30 jours, appels en cours en direct, derniers appels, numéros non routés, abonnement |
| **Utilisateurs** | Liste (rôle, poste, état, dernière connexion), ajout avec invitation par e-mail, suppression |
| **Numéros** | Où sonne chaque numéro (poste, groupe, file d’attente, standard vocal, horaires, messagerie…), achat d’un nouveau numéro par zone |
| **Scénarios d’appel** | Éditeur visuel : horaires, menu à touches, annonce (bibliothèque ou fichier personnalisé par adresse, renvoyée par exemple par une requête), requête HTTP vers votre CRM (réponse → variables, fiche crm_url), file d’attente, transfert, messagerie, SMS à l’appelant, rappel ; modèles prêts à l’emploi, test par simulation (aucun appel passé), brouillon ou actif |
| **Gestion** | Postes (paramètres SIP, état, nouveau mot de passe), groupes d’appel, standards vocaux, horaires, conférences, contacts (export CSV), appareils, demandes de rappel, webhooks (test, journal des envois), clés d’API, statistiques |
| **Toutes les fonctions** | Chaque fonction de l’API (plus de 400), rangée par thème avec recherche : le formulaire est généré depuis la description de l’API, la réponse s’affiche en tableau. Téléchargements (CSV, PDF, audio) et envois de fichiers compris. Les administrateurs voient tout, les utilisateurs leurs propres fonctions. |
| **Files d’attente** | Création, agents, répartition des appels, attente maximale, suppression |
| **Appels** | Journal paginé, filtres entrants / sortants / manqués |
| **Messagerie** | Messages vocaux de chaque poste, transcription, écoute, suppression |
| **SMS** | Envoi, forfait, solde et SMS au comptage, historique mois par mois |
| **Factures** | Abonnement en cours, factures et avoirs en PDF |
| **Panneau complet** | Bouton qui ouvre le panneau avancé de la plateforme (standard vocal, statistiques, blocs avancés des scénarios…) sans redemander le mot de passe, sur votre domaine en marque blanche |

Et aussi : **mot de passe oublié** (e-mail à vos couleurs), **double authentification**, **inscription en ligne** avec période d’essai (facultative).

Les utilisateurs non administrateurs voient un accueil simple qui ouvre leur espace téléphone ; la gestion de l’entreprise est réservée aux administrateurs.

## Installation

Prérequis : Node.js 20 ou plus récent, et une clé d’API revendeur (panneau revendeur › **API et documentation** › **Clés d’API**).

```bash
git clone https://github.com/damidani/voxnova-espace-client-node.git
cd voxnova-espace-client-node
npm ci --omit=dev
cp .env.example .env      # puis complétez .env
npm start
```

L’espace client répond sur `http://localhost:3000`.

### Avec Docker

```bash
docker build -t espace-client .
docker run -d --name espace-client --env-file .env -p 3000:3000 --restart unless-stopped espace-client
```

### Derrière un proxy (Nginx, Caddy, Traefik)

Servez l’espace client en **HTTPS** et ajoutez `TRUST_PROXY=true` dans `.env` pour que l’adresse réelle des visiteurs soit prise en compte (limitation des tentatives de connexion).

Exemple Caddy :

```
espace.mon-operateur.fr {
  reverse_proxy 127.0.0.1:3000
}
```

## Configuration (`.env`)

| Variable | Rôle |
|---|---|
| `API_URL` | Adresse de l’API de la plateforme (`https://api.hcloud.fr`) |
| `API_KEY` | Votre clé revendeur `vxr_…`. Elle reste sur le serveur, elle n’est jamais envoyée au navigateur. |
| `BRAND_NAME` | Nom affiché (en-tête, titres, e-mails) |
| `BRAND_COLOR` | Couleur principale, ex. `#4f46e5` |
| `BRAND_LOGO_URL` | Adresse https de votre logo (facultatif) |
| `SUPPORT_EMAIL`, `SUPPORT_PHONE` | Affichés en pied de page et sur la page de connexion |
| `PUBLIC_URL` | Adresse publique de l’espace client (lien des e-mails de réinitialisation) |
| `SESSION_SECRET` | 32 caractères aléatoires au moins : `openssl rand -hex 32` |
| `PORT` | Port d’écoute (3000 par défaut) |
| `TRUST_PROXY` | `true` derrière un proxy |
| `ALLOW_SIGNUP` | `true` pour permettre l’inscription en ligne (essai gratuit) |
| `SIGNUP_TRIAL_DAYS` | Durée de l’essai à l’inscription (14 jours par défaut) |

## Tester sans risque

Créez un **compte d’essai** (sandbox) depuis votre panneau revendeur : vous obtenez une clé `vxr_test_…` et deux clients fictifs déjà équipés. Mettez cette clé dans `API_KEY` : tout fonctionne comme en production, mais rien ne sort de la plateforme (pas d’appel, pas de SMS, pas de paiement).

Pour vous connecter comme un client fictif : sur la page de connexion, cliquez sur **Mot de passe oublié** avec l’e-mail d’un de ses utilisateurs (visible dans le panneau revendeur d’essai, fiche du client). L’e-mail n’est pas envoyé : il s’affiche dans la **console d’essai**, avec le lien pour choisir le mot de passe. Vous pouvez aussi créer un client avec **Créer un compte** si `ALLOW_SIGNUP=true`.

## Personnaliser

- **Textes et pages** : `views/*.ejs` (gabarits EJS, en français).
- **Apparence** : `public/style.css` (une seule feuille, mode sombre automatique, menu latéral repliable sur mobile). Interactions et éditeur de scénarios : `public/app.js`. La couleur de la marque vient de `BRAND_COLOR`.
- **Nouvelles pages** : toute l’API est utilisable ; voir la [documentation revendeur](https://hcloud.fr/docs/revendeur) et la [documentation clients](https://hcloud.fr/docs/clients). Dans `src/server.js`, `vx(as(req)).api.org.users.list()` (SDK `@voxnova/sdk`) appelle n’importe quelle route de l’API au nom du client connecté, ou `vx(as(req)).call('org.users.get', { params: { id } })`. Pages de gestion : liste `RES` dans `public/console.js`.

## Comment ça marche

1. Le client saisit son e-mail et son mot de passe. Le serveur les vérifie auprès de la plateforme (`POST /api/reseller/portal/login`, avec votre clé). Seuls **vos** clients peuvent se connecter.
2. La session est un cookie signé (`HttpOnly`, `SameSite=Lax`, `Secure` en HTTPS), valable 8 heures. Elle ne contient ni mot de passe ni clé.
3. Chaque page appelle l’API avec votre clé et les en-têtes `X-Organization` (le client) et `X-User` (l’utilisateur connecté) : chacun ne voit que son entreprise, avec ses propres droits. Les actions sont inscrites au journal d’audit du client.

### Sécurité

- Clé d’API uniquement côté serveur.
- Jeton anti-falsification sur chaque formulaire.
- Tentatives de connexion limitées (10 par minute et par adresse, en plus des limites et du verrouillage de la plateforme).
- En-têtes de sécurité stricts : seuls les scripts du site (`public/app.js`, sans dépendance) sont autorisés, aucun style en ligne, pas d’intégration dans un autre site.
- Le navigateur ne parle jamais à l’API : l’éditeur de scénarios passe par l’espace client (jeton anti-falsification dans l’en-tête `X-CSRF-Token`).

## Tests

```bash
npm test
```

## Licence

MIT © Damien B.
