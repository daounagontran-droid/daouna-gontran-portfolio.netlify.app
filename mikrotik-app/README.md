# MikroTik Manager

Application mobile (Android et iPhone) pour gérer à distance un routeur MikroTik configuré en Wi-Fi zone.

L'application communique directement avec le routeur par l'**API REST de RouterOS 7**. Elle ne passe par aucun serveur intermédiaire.

## Fonctions

| Onglet | Ce que vous pouvez faire |
| --- | --- |
| **Accueil** | Modèle, version, temps de fonctionnement, processeur, mémoire, température, trafic en direct par interface, nombre de clients, adresse DDNS (IP › Cloud) |
| **Wi-Fi** | Activer ou couper chaque réseau, changer le nom (SSID), le mot de passe ou passer en réseau ouvert (hotspot), masquer le réseau, débloquer des appareils |
| **Tickets** | Générer des lots de tickets hotspot (durée, volume, profil de débit, prix), les imprimer, les partager en PDF ou par WhatsApp/SMS, suivre la recette et le stock, rechercher un code, le remettre à zéro ou le supprimer, nettoyer les tickets épuisés |
| **Clients** | Appareils connectés au Wi-Fi (nom, IP, signal), sessions hotspot (temps restant, données consommées), déconnecter ou bloquer un appareil |
| **Plus** | Interfaces (activer / désactiver), baux DHCP (IP fixe, blocage), forfaits hotspot (débit, appareils par ticket), journal filtrable, système (nom, mises à jour, sauvegarde, redémarrage), terminal RouterOS |

Plusieurs routeurs peuvent être enregistrés. Les mots de passe sont rangés dans le trousseau chiffré du téléphone (Keychain sur iPhone, Keystore sur Android).

Les deux pilotes Wi-Fi de RouterOS sont gérés :
- l'ancien pilote `wireless` (hAP lite, hAP ac², cAP ac, SXT, etc.) ;
- le nouveau pilote `wifi` / `wifiwave2` (hAP ax², hAP ax³, cAP ax, etc.).

## 1. Préparer le routeur

Il faut **RouterOS 7.1 ou plus récent**, car l'API REST n'existe pas en v6. Pour connaître la version, ouvrez Winbox puis System › Packages. Les commandes ci-dessous se tapent dans le terminal de Winbox ou de WebFig.

### Créer un utilisateur dédié à l'application

```routeros
/user group add name=app-mobile policy=read,write,test,reboot,sensitive,api,rest-api,web,ftp
/user add name=appmobile group=app-mobile password="UnMotDePasseLongEtSolide"
```

### Accès depuis le réseau local (HTTP)

Le service web est actif par défaut :

```routeros
/ip service set www disabled=no port=80
```

Dans l'application, saisissez l'adresse `192.168.88.1` (ou l'IP du routeur) et laissez HTTPS désactivé.

### Accès depuis internet (HTTPS) : cas d'une IP publique

1. Activez le DDNS gratuit de MikroTik et notez le nom obtenu :

   ```routeros
   /ip cloud set ddns-enabled=yes
   /ip cloud print
   # dns-name: abcd1234.sn.mynetname.net
   ```

2. Obtenez un certificat Let's Encrypt gratuit. Le port 80 doit être joignable depuis internet pendant cette opération :

   ```routeros
   /ip firewall filter add chain=input protocol=tcp dst-port=80 action=accept comment="Let's Encrypt (temporaire)" place-before=0
   /certificate enable-ssl-certificate dns-name=[/ip cloud get dns-name]
   ```

   Le certificat est installé sur le service `www-ssl` et se renouvelle tout seul.

3. Ouvrez HTTPS, puis refermez HTTP côté internet :

   ```routeros
   /ip service set www-ssl disabled=no port=443
   /ip firewall filter add chain=input protocol=tcp dst-port=443 action=accept comment="App MikroTik (HTTPS)" place-before=0
   /ip firewall filter remove [find comment="Let's Encrypt (temporaire)"]
   /ip service set www address=192.168.0.0/16,10.0.0.0/8
   ```

4. Dans l'application, saisissez l'adresse `abcd1234.sn.mynetname.net` et activez HTTPS.

> Un certificat auto-signé ne fonctionne pas : Android et iOS le refusent. Utilisez Let's Encrypt comme ci-dessus.

### Accès depuis internet : cas d'une connexion 4G sans IP publique (CGNAT)

C'est fréquent avec les box 4G. Le routeur n'est alors pas joignable directement depuis internet. Deux solutions :

- **Back To Home** (RouterOS 7.12 et plus, gratuit) : le routeur crée un VPN WireGuard via le relais de MikroTik.

  ```routeros
  /ip cloud set ddns-enabled=yes back-to-home-vpn=enabled
  /ip cloud back-to-home-users add name=telephone allow-lan=yes
  /ip cloud back-to-home-users show-client-config telephone
  ```

  Selon la version de RouterOS, ces menus peuvent changer légèrement. Vous pouvez aussi passer par Winbox › IP › Cloud › Back To Home. Importez la configuration affichée (QR code) dans l'application **WireGuard** du téléphone. Une fois le VPN activé, connectez-vous dans MikroTik Manager avec l'IP locale (`192.168.88.1`, en HTTP).
- **Un autre VPN** (WireGuard, ZeroTier, etc.) : même principe, on utilise ensuite l'IP locale du routeur.

## 2. Installer l'application

### Tester tout de suite avec Expo Go

```bash
cd mikrotik-app
npm install
npx expo start
```

Installez **Expo Go** (Play Store ou App Store) et scannez le QR code affiché.

### Générer l'APK Android à installer sur le téléphone

```bash
npm install -g eas-cli
eas login            # compte Expo gratuit
eas build -p android --profile preview
```

À la fin, EAS donne un lien pour télécharger l'APK : ouvrez-le sur le téléphone et installez-le. Pour le Play Store, utilisez `--profile production`. Pour iPhone, utilisez `eas build -p ios` (compte Apple Developer requis).

## 3. Utilisation des tickets

1. Créez d'abord vos **forfaits** (Plus › Forfaits hotspot), par exemple `2Mbps` avec 2 Mbit/s en descendant et 1 appareil par ticket.
2. Dans **Tickets › Générer**, choisissez le forfait, la durée (1 h, 24 h, 1 semaine…), le prix et le nombre de tickets.
3. Imprimez la planche A4 (4 tickets par ligne), ou partagez le PDF ou la liste des codes sur WhatsApp.
4. La recette est calculée à partir des tickets entamés : un ticket compte comme vendu dès sa première connexion.

> La durée d'un ticket correspond au **temps de connexion** (`limit-uptime` de RouterOS). Le décompte s'arrête quand le client se déconnecte.

Chaque ticket porte un commentaire RouterOS de la forme `lot=261028-ABC prix=500 forfait=24_heures`. C'est ce commentaire qui permet de regrouper les lots, même pour des tickets consultés depuis Winbox.

## Développement

```bash
npm run typecheck     # vérification TypeScript
npx expo start --web  # aperçu dans le navigateur (le routeur doit autoriser CORS, sinon utilisez le téléphone)
```

Structure :

```
src/
  app/            écrans (Expo Router : chaque fichier est une page)
    (tabs)/       les 5 onglets principaux
  components/     interface (boutons, cartes, menu d'actions, couleurs)
  context/        routeur connecté et liste des routeurs enregistrés
  lib/
    mikrotik.ts   client de l'API REST RouterOS
    wifi.ts       gestion des pilotes wireless / wifi / wifiwave2
    vouchers.ts   génération des codes et des planches de tickets
```
