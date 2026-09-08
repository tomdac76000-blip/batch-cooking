# Batch — cadrage de la vraie V1

## Objectif

Une application française de batch cooking qui aide une personne à choisir des repas qu'elle aime, tenir un budget et progresser vers un objectif nutritionnel sans cuisiner chaque jour.

## Décisions de départ

- France uniquement ; Intermarché, E.Leclerc, Lidl et Carrefour.
- Web app installable sur téléphone et ordinateur.
- Version gratuite pour commencer.
- Une personne par foyer dans la V1 ; partage de foyer plus tard.
- Une session de préparation le dimanche par défaut, avec option de deuxième session.

## Parcours V1

1. Création de profil : taille, poids, activité, objectif, budget, repas couverts.
2. Préférences visuelles par catégories : adore, accepte, exclut.
3. Découverte de recettes : plusieurs choix par repas, jamais un menu imposé.
4. Sélection des recettes puis calcul du batch, portions, calories, protéines et coût.
5. Panier de courses : priorités, rayons, total, alternatives moins chères et produits optionnels.
6. Suivi : poids, budget prévu/réel, recettes aimées et commandes évitées.

## Données

- Catalogue interne de recettes normalisées : ingrédients en grammes, portions, conservation, tags, durée, coûts et macros.
- Référence nutritionnelle française Ciqual pour les aliments.
- Prix par enseigne et magasin quand une source est disponible ; estimation explicitement indiquée sinon.
- Aucun calcul de santé présenté comme médical ; le but est un cadre alimentaire et un suivi personnel.

## Écrans

- Accueil : « Cette semaine, qu’est-ce qu’on prépare ? »
- Profil et préférences alimentaires.
- Choix de recettes en cartes illustrées.
- Session batch du dimanche, dans l’ordre réel de cuisine.
- Liste de courses mobile.
- Suivi.

## Direction graphique

Couleurs franches, pictogrammes généreux, photos ou illustrations gourmandes, navigation très simple. Pas de tableau de bord froid ni de formes génériques de logiciel de gestion.
