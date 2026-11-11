# Portail captif DAOUNA Wi-Fi (MikroTik)

Portail de connexion hotspot pour routeur MikroTik, aux couleurs DAOUNA Gontran (bleu nuit et or).
Design épuré : fond bleu nuit, logo Wi-Fi doré animé, un seul champ pour le code du ticket et un bouton. Rien d'autre sur la page d'accueil que les trois tarifs et le numéro pour acheter un ticket.

- **Aperçu en ligne** : `apercu.html` (simule le routeur, aucune connexion réelle).
- **Fichiers à envoyer au routeur** : dossier `hotspot/` (ou l'archive `portail-captif-daouna.zip`).

## Ce que fait le portail

| Page | Rôle |
|------|------|
| `login.html` | Connexion par **code de ticket** (identifiant = mot de passe), lien discret pour passer en **identifiant + mot de passe**, essai gratuit si activé, tarifs et téléphone |
| `alogin.html` | « Vous êtes connecté » avec le temps restant, puis redirection automatique |
| `status.html` | Temps restant en grand, durée, données utilisées, bouton de déconnexion |
| `logout.html` | Résumé de la session et bouton « Se reconnecter » |
| `error.html` | Message d'erreur clair et bouton « Réessayer » |
| `errors.txt` | Messages d'erreur du routeur traduits en français |
| `style.css` | Toutes les couleurs et la mise en forme (une seule feuille pour toutes les pages) |
| `md5.js` | Chiffrement CHAP du mot de passe (fonction `hexMD5`) |

Aucune police ni image externe : la page s'affiche instantanément, même sans Internet.

## Installation sur le routeur

1. Dans Winbox, ouvrez **Files** et faites une copie de sauvegarde de l'ancien dossier `hotspot`.
2. Glissez **tout le contenu** du dossier `hotspot/` dans le dossier `hotspot` du routeur (remplacez les fichiers).
3. **IP › Hotspot › Server Profiles** : vérifiez que *HTML Directory* vaut `hotspot`, et cochez *HTTP CHAP* (recommandé) et/ou *HTTP PAP*.
4. Créez les tickets dans **IP › Hotspot › Users** (ou avec l'appli MikroTik Manager) en mettant **le même code en identifiant et en mot de passe** pour le mode « Ticket ».
5. Pour le bouton « Essai gratuit » : **IP › Hotspot › Server Profiles › Login By › Trial**.

## Personnaliser

- **Nom du réseau** : remplacez `DAOUNA-WIFI` dans les fichiers `.html`.
- **Tarifs** : bloc `plans` de `login.html`.
- **Téléphone** : bas de `login.html` et de `error.html`.
- **Couleurs** : variables `--bg`, `--gold`, `--text` en haut de `style.css`.

Après une modification, réenvoyez le fichier sur le routeur puis rechargez la page (le téléphone garde parfois l'ancienne version en cache).
