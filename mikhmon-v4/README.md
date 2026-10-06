# Mikhmon V4 — MikroTik Hotspot Monitor

Application web PHP pour gérer un hotspot MikroTik : vouchers, profils, ventes, sessions et trafic.
Réécriture complète inspirée de Mikhmon V3 (laksa19), qui n'est plus maintenu.

Aucune dépendance : PHP 8.1+ suffit (extensions `openssl` et `session`, présentes par défaut).

## Fonctionnalités

| Domaine | Ce que fait Mikhmon V4 |
|---|---|
| **Multi-routeurs** | Plusieurs MikroTik, mots de passe API chiffrés (AES-256-GCM), test de connexion, API ou API-SSL |
| **Tableau de bord** | Horloge, CPU/mémoire en direct, sessions actives, revenus du jour/mois, graphique de trafic, journal hotspot |
| **Utilisateurs** | Liste, recherche, filtres par profil/lot, ajout/modification, activation, remise à zéro, suppression groupée |
| **Générateur** | Lots de 1 à 1000 vouchers : code unique ou utilisateur+mot de passe, préfixe, longueur, jeu de caractères, limites temps/données |
| **Profils** | Débit, utilisateurs partagés, pool, **validité**, **prix**, **expiration** (suppression ou blocage), verrouillage MAC, enregistrement des ventes |
| **Impression** | 3 modèles (carte, petit format, ticket thermique 58 mm), QR code de connexion, impression des seuls vouchers non utilisés |
| **Rapports** | Ventes par période (raccourcis jour/semaine/mois/année), par profil, graphique journalier, export CSV (Excel), suppression |
| **Hotspot** | Sessions actives (déconnexion), hôtes (bypass/blocage), IP bindings, cookies |
| **Réseau** | Trafic en direct par interface, baux DHCP, PPP (secrets + connexions actives) |
| **Système** | Journal filtrable, planificateur, infos routeur, nettoyage des expirés, redémarrage/arrêt |
| **Mode démo** | Un faux routeur pour tout essayer sans MikroTik |

Interface en français, thème sombre/clair, adaptée au téléphone.

## Installation

### Windows (Laragon ou XAMPP)
1. Copiez le dossier `mikhmon-v4` dans `C:\laragon\www\` (ou `C:\xampp\htdocs\`).
2. Ouvrez `http://localhost/mikhmon-v4/`.

### Linux (Apache / Nginx + PHP-FPM)
```bash
sudo cp -r mikhmon-v4 /var/www/html/
sudo chown -R www-data:www-data /var/www/html/mikhmon-v4/data
```
Avec Nginx, bloquez l'accès aux dossiers internes :
```nginx
location ~ ^/mikhmon-v4/(data|inc|pages)/ { deny all; }
```

### Android (KSWEB, Termux) ou test rapide
```bash
cd mikhmon-v4
php -S 0.0.0.0:8080
```
puis ouvrez `http://<ip-du-téléphone>:8080`.

> Netlify, GitHub Pages et les hébergeurs « statiques » n'exécutent pas PHP : Mikhmon doit tourner sur un
> serveur PHP qui peut joindre le routeur (PC du réseau local, téléphone, VPS avec accès VPN au MikroTik…).

Au premier lancement, Mikhmon vous demande de créer le compte administrateur. La configuration est stockée
dans `data/config.php` (ce dossier doit être accessible en écriture par PHP et ne jamais être publié).

## Préparer le MikroTik

```routeros
/ip service enable api
/ip service set api address=192.168.88.0/24   # facultatif : limiter aux machines du LAN
/user add name=mikhmon group=full password=MotDePasseSolide
```
Pour API-SSL (port 8729) : `/ip service enable api-ssl` avec un certificat.

Ensuite : **Routeurs → Ajouter un routeur**, renseignez l'IP, l'utilisateur, le mot de passe, le nom DNS du
hotspot (ex. `wifi.local`, utilisé pour le QR code) et la devise (`FCFA` par défaut).

## Fonctionnement des profils (validité, prix, ventes)

Quand vous enregistrez un profil dans Mikhmon, il écrit un script **on-login** dans le profil RouterOS.
À la **première connexion** d'un utilisateur, ce script :

1. crée une tâche planifiée `exp-<utilisateur>` dont l'intervalle est la validité. À l'échéance elle
   **supprime** l'utilisateur, ou le **bloque** (`limit-uptime=1s`, commentaire `| EXPIRE`) selon le mode choisi ;
2. ajoute au commentaire de l'utilisateur la date de première connexion et la date d'expiration ;
3. verrouille éventuellement le compte sur l'adresse MAC de l'appareil ;
4. enregistre la vente dans `/system script` (commentaire `mikhmon`), au **même format que Mikhmon V3** :
   vos anciens rapports de ventes restent lisibles.

Les profils créés par Mikhmon V3 sont reconnus et convertis au format V4 lorsque vous les enregistrez.
Le script fonctionne avec RouterOS v6.43+ et v7 (formats de date des deux versions pris en charge).

## Structure

```
mikhmon-v4/
├── index.php            contrôleur frontal (index.php?p=page)
├── inc/
│   ├── RouterOSAPI.php  client API RouterOS (protocole binaire, login v6.43+/v7 et ancien login MD5)
│   ├── DemoAPI.php      routeur simulé (mode démo)
│   ├── hotspot.php      script on-login, vouchers, ventes, formatage
│   ├── bootstrap.php    configuration, chiffrement, authentification, CSRF
│   └── layout.php       gabarit et composants HTML
├── pages/               une page par fichier
├── assets/              CSS et JavaScript (sans framework)
└── data/                configuration générée (protégée)
```

## Sécurité

- mot de passe administrateur haché (`password_hash`), limitation des tentatives de connexion ;
- jeton CSRF sur toutes les actions, échappement systématique des sorties ;
- mots de passe des routeurs chiffrés en AES-256-GCM ;
- `data/`, `inc/` et `pages/` interdits d'accès direct (`.htaccess`, règle Nginx ci-dessus).

N'exposez pas Mikhmon sur Internet sans HTTPS.

## Limites connues

- Le QR code des vouchers est généré par une bibliothèque chargée depuis cdnjs : sans Internet,
  les vouchers s'impriment normalement, sans QR code.
- Le script on-login a été écrit pour RouterOS v6.43+ et v7, mais n'a pas encore été testé sur un vrai routeur.
  Validez-le d'abord sur un profil de test : connectez-vous avec un voucher, puis vérifiez la tâche `exp-…`
  dans **Planificateur** et la vente dans **Rapport des ventes**.
