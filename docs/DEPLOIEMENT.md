# Déploiement pas à pas (environ 20 minutes)

## 1. Google Sheet
1. Créez une Google Sheet vide « Démarchage de dons ».
2. Partagez-la **uniquement** avec les administrateurs (Éditeur). Ne la publiez pas : le public lit via l API, ce qui protège l onglet `Editeurs` (codes d accès).

## 2. Apps Script
1. Dans la Sheet : **Extensions > Apps Script**. Remplacez le contenu de `Code.gs` par `api/Code.gs`.
2. Sélectionnez la fonction `setup` puis **Exécuter** et acceptez les autorisations (une seule fois). Les onglets `Démarchage`, `Listes`, `Editeurs`, `Historique` sont créés.
3. Onglet `Editeurs` : une ligne par éditeur : Nom, Code (12 caractères minimum, unique, difficile à deviner), `OUI`.
4. Onglet `Listes` : modifiez librement les valeurs des menus déroulants.

## 3. Publier l API
1. **Déployer > Nouveau déploiement > type « Application Web »**.
2. Exécuter en tant que : **Moi**. Qui a accès : **Tout le monde**.
3. Copiez l URL terminant par `/exec`.
4. Après toute modification de `Code.gs` : **Déployer > Gérer les déploiements > Modifier > Nouvelle version**.

## 4. GitHub
1. Créez un dépôt et poussez ce dossier sur la branche `main`.
2. Éditez `frontend/config.js` : collez l URL `/exec` dans `API_URL`.
3. **Settings > Pages > Source : GitHub Actions**. Le workflow publie `frontend/` à chaque push.
4. Le site est disponible sur `https://<compte>.github.io/<depot>/`.

## 5. Vérifications de sécurité
- Navigation privée : la liste s affiche, aucun bouton de modification.
- Mauvais code : « Code invalide » ; après 15 échecs, blocage 10 minutes.
- Révocation d un éditeur : `NON` dans la colonne Actif (effet immédiat).
- Historique des modifications faites via le site : onglet `Historique`.
