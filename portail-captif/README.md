# Portail captif DAOUNA Wi-Fi (MikroTik)

Portail de connexion hotspot pour routeur MikroTik, aux couleurs DAOUNA Gontran (bleu nuit et or).
Le design reprend l'idée d'un **ticket** : carte crème avec ligne de découpe, champ « code du ticket » en gros caractères.

- **Aperçu en ligne** : `apercu.html` (simule le routeur, aucune connexion réelle).
- **Fichiers à envoyer au routeur** : dossier `hotspot/` (ou l'archive `portail-captif-daouna.zip`).

## Ce que fait le portail

| Page | Rôle |
|------|------|
| `login.html` | Connexion par **code de ticket** (identifiant = mot de passe) ou par **compte** (identifiant + mot de passe), bouton d'essai gratuit si activé, forfaits, contacts |
| `alogin.html` | Confirmation « Vous êtes connecté », puis redirection automatique |
| `status.html` | Temps restant, durée, données reçues / envoyées, IP, MAC, bouton de déconnexion |
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

Le lien WhatsApp n'ouvre l'application que si `wa.me` et `whatsapp.com` sont dans **IP › Hotspot › Walled Garden** ; sinon, le numéro de téléphone reste utilisable.

## Personnaliser

- **Nom du réseau** : remplacez `DAOUNA-WIFI` dans les fichiers `.html`.
- **Forfaits et prix** : section « Nos forfaits » de `login.html`.
- **Contacts** : section « Besoin d'un ticket ? » de `login.html` et le numéro dans `error.html`.
- **Couleurs** : variables `--navy`, `--gold`, `--cream` en haut de `style.css`.

Après une modification, réenvoyez le fichier sur le routeur puis rechargez la page (le téléphone garde parfois l'ancienne version en cache).
