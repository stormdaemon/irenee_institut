# Institut Apostolos Saint Irénée

Plateforme de formation catholique : cours et modules, espace étudiant, administration, paiements **Stripe uniquement** et visioconférence Daily. L’application utilise directement PostgreSQL avec `pg`, des requêtes paramétrées, une authentification locale par cookie HttpOnly et des sessions révocables. Aucun client Supabase ne participe aux requêtes de production.

## Développement

Bun 1.3.14, Next.js 16.2.11, React 19.2.6, TypeScript 6.0.3.

```sh
bun install --frozen-lockfile
# Copier .env.example vers .env.local et renseigner une base de développement.
bun run dev
bun run lint
bun run build
```

`database/schema.sql` initialise une base PostgreSQL vide. `database/migrations` contient les migrations natives ; `database/schema-columns.json` est la photographie des colonnes réellement interrogées. Le dossier `supabase` reste une archive historique, pas le chemin de migration actif. Ne jamais réinitialiser une base contenant des données.

## Tests

```sh
# Base isolée obligatoire, dont le nom contient security_test.
TEST_DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/apostolos_security_test bun run test:api
```

La suite exécute les tests des services et les tests happy/sad path des routes dans des processus isolés. Chaque fichier `app/**/route.ts` est instrumenté par Istanbul. Le contrôle échoue si une route manque ou si une ligne, branche, fonction ou instruction n’est pas couverte à 100 %. Les rapports sont produits dans `coverage/api-summary.json` et `coverage/api-coverage.json`. La couverture des handlers n’est pas une garantie d’absence de défaut dans toutes les intégrations externes ; des tests PostgreSQL réels et des vérifications HTTPS/browser la complètent.

Les tests de navigation existants se trouvent dans `e2e`. Ils utilisent uniquement une base locale isolée. Les références visuelles doivent être revues lors d’une modification graphique.

## Contenus et données

La restauration autorisée comporte 10 cours et 50 modules récupérables de la source historique. Les anciens élèves, inscriptions et paiements n’ont pas été importés. Ces contenus ne sont pas présentés comme un export de la dernière base inaccessible.

`bun run content:import CHEMIN_DU_DOSSIER` lit les fichiers `legacy-courses.json` et `legacy-course_modules.json` de ce dossier (chacun avec une propriété `rows`) et importe seulement les données pédagogiques validées, en transaction et sans écraser les identifiants déjà présents. `scripts/bootstrap-administrator.ts` crée le premier directeur depuis un fichier privé et refuse une seconde initialisation.

## Production OVH

Voir `ops/apostolos/README.md`. Docker sépare l’application et PostgreSQL. Le serveur web termine HTTPS ; le port applicatif reste lié à `127.0.0.1`. Les secrets ne sont jamais inclus dans Git ni dans les images.

Les paramètres Stripe/Daily sont chiffrés en AES-256-GCM en base avec une clé indépendante. L’administration masque ces valeurs lors de la lecture. Le secret webhook Stripe doit correspondre au nouveau domaine ; les anciens endpoints d’autres déploiements sont conservés.

## Messagerie

Les emails de contact, récupération de mot de passe et automatisations nécessitent le déploiement Google Apps Script configuré par `GOOGLE_APPS_SCRIPT_URL` et `GOOGLE_APPS_SCRIPT_MAIL_SECRET`. Une configuration absente ne doit pas être présentée comme un envoi réussi. Aucun secret ne doit être copié dans le dépôt ou dans des logs.
