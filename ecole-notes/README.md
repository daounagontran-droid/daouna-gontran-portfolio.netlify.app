# Gestion des notes et bulletins

Application web **hors-ligne** pour saisir les notes des élèves et imprimer les bulletins scolaires.
Aucun serveur, aucune installation : il suffit d'ouvrir `index.html` dans un navigateur (Chrome, Edge ou Firefox).

## Fonctionnalités

- **Classes, matières (avec coefficients et professeurs) et élèves**, avec import d'une liste copiée depuis Excel.
- **Saisie rapide des notes** sur 20 : plusieurs notes de classe (devoirs et interrogations) plus la composition, par trimestre.
  La touche Entrée passe à l'élève suivant, les notes invalides sont signalées et les moyennes et rangs se recalculent en direct.
- **Absences, retards et appréciation du conseil de classe** pour chaque élève.
- **Calculs automatiques** : moyenne par matière, moyenne trimestrielle pondérée par les coefficients,
  rangs (avec ex-aequo), moyenne de la classe, plus forte et plus faible moyenne, appréciations et distinctions
  (tableau d'honneur, encouragements, félicitations).
- **Bulletins A4 imprimables** ou enregistrables en PDF, pour un élève ou pour toute la classe.
  Le bulletin du 3e trimestre ajoute le bilan annuel et la décision (admis / redouble).
- **Résultats de la classe** : classement, statistiques, taux de réussite et export CSV pour Excel.
- **Paramètres** : nom, logo et coordonnées de l'école, nombre de notes de classe, poids de la composition et seuil d'admission.

## Règles de calcul (modifiables dans Paramètres)

- Moyenne de la matière = moyenne des notes de classe × 50 % + composition × 50 %
- Moyenne trimestrielle = Σ (moyenne × coefficient) ÷ Σ coefficients des matières notées
- Moyenne annuelle = moyenne des trois moyennes trimestrielles. L'élève est admis si elle atteint au moins 10/20.

## Données

Les données sont enregistrées automatiquement dans le navigateur (`localStorage`) de l'ordinateur utilisé.
Utilisez **Exporter une sauvegarde** régulièrement (sur une clé USB, par exemple) : le fichier JSON obtenu permet de
restaurer les données ou de les transférer sur un autre poste.

## Déploiement

Le site est statique (`index.html`, `style.css`, `app.js`). Il peut être publié tel quel sur Netlify ou GitHub Pages,
ou simplement copié sur une clé USB.
