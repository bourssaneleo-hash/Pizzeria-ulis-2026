# 🍕 La Pizzeria des apprentis — application éducative

Cette première version est un **MVP gratuit** prévu pour une activité scolaire :
- 3 rôles : Client, Serveur/Serveuse, Pizzaiolo
- commande avec ingrédients imagés et quantités
- transmission en temps réel de la commande
- prise de commande par le serveur
- préparation par le pizzaiolo avec cases à cocher
- statut de commande : en attente → prise → préparation → prête → terminée
- aucun compte enfant nominatif : connexion par code de classe + prénom/pseudo

## Ce qui est prévu pour la suite

La structure est volontairement prévue pour ajouter :
1. prix et travail sur les euros/monnaie ;
2. création libre de pizzas ;
3. partage d'une pizza en fractions (1/2, 1/4, etc.) ;
4. découpage visuel et validation par le pizzaiolo ;
5. activités pédagogiques / niveaux de difficulté.

## Mise en ligne gratuite

La solution proposée utilise :
- **Firebase** pour la synchronisation en temps réel ;
- **GitHub Pages** pour héberger gratuitement les fichiers de l'application.

### Étape 1 — créer Firebase

1. Va sur https://console.firebase.google.com/
2. Crée un projet, par exemple `pizzeria-ulis`.
3. Dans le projet, ajoute une **application Web** (icône `</>`).
4. Copie la configuration Firebase donnée par Google.
5. Dans Firebase → Authentication → Sign-in method → active **Anonymous**.
6. Dans Firebase → Realtime Database → crée une base.
7. Choisis une région européenne si proposée.
8. Pour le premier test, utilise les règles ci-dessous.

### Règles Realtime Database

Dans Realtime Database → Rules, mets :

{
  "rules": {
    "classes": {
      "$classCode": {
        "orders": {
          ".read": "auth != null",
          ".write": "auth != null"
        }
      }
    }
  }
}

Cette première version utilise un code de classe comme espace de travail. Pour un usage réel, je recommande ensuite de renforcer les règles et d'ajouter un code enseignant séparé.

### Étape 2 — connecter l'application

Ouvre `app.js`.

Remplace uniquement le bloc :

const firebaseConfig = {
  ...
};

par la configuration donnée par Firebase.

### Étape 3 — publier gratuitement

1. Crée un compte GitHub.
2. Crée un nouveau dépôt, par exemple `pizzeria-ulis`.
3. Ajoute `index.html`, `styles.css` et `app.js`.
4. Dans Settings → Pages, active GitHub Pages sur la branche `main` et le dossier `/root`.
5. GitHub donnera une adresse du type :
   https://TON-COMPTE.github.io/pizzeria-ulis/

## Important pour une école

- Ne demande pas de nom de famille, adresse, photo ou autre donnée personnelle.
- Utilise un code de classe que tu changes si nécessaire.
- Cette application est conçue comme outil pédagogique, pas comme système de compte élève.
- Les données des commandes restent dans Firebase tant qu'elles ne sont pas supprimées.

## Utilisation en classe

Exemple :
- 1 tablette/ordinateur = Client
- 1 tablette/ordinateur = Serveur
- 1 tablette/ordinateur = Pizzaiolo

Tous utilisent le même code de classe.

Le client commande → le serveur voit la commande → le serveur la transmet → le pizzaiolo coche les ingrédients → la pizza passe à « prête » → le serveur la donne au client.

