# Institut Saint Irénée

Application de production Next.js, hébergée sur VPS avec PostgreSQL local,
authentification par cookie HttpOnly et sessions révocables, paiements Stripe
et salles Daily privées. La couche `lib/supabase.ts` est une façade historique
du backend PostgreSQL, pas une connexion au service Supabase.

## Stack

- Bun `1.3.13`
- Next.js `16.2.11`
- React `19.2.6`
- PostgreSQL (`pg`) et migrations SQL dans `supabase/migrations`
- TypeScript `6.0.3`

## Commandes

```bash
bun install
bun run dev -- --hostname 127.0.0.1 --port 3001
bun run build
```

## Reconstruit

- Pages publiques : accueil, formations, formateurs, à propos, contact/FAQ.
- Auth : inscription et connexion PostgreSQL, cookie HttpOnly, révocation des sessions.
- LMS : espace étudiant, détail cours, détail module, quiz/progression.
- Cursus annuel : pass de 365 jours, accès aux cours publiés, examen final et certificat nominatif.
- Documents pédagogiques : parchemins de module et de cours enregistrés dans PostgreSQL.
- Admin : dashboard, cours, utilisateurs, devoirs, paiements, paramètres, stats, pages légales.
- API routes : courses, users, homework, payments, profile avatar, progress, settings, inscription.
- Assets récupérés : logos, formateurs, partenaires.
- Schéma historique : `supabase/schema.sql`, complété par les migrations de `supabase/migrations`.

## Emails pédagogiques

Les parchemins et certificats sont placés dans `learning_documents` avec le statut `queued`.
Le worker Google Apps Script prêt à configurer se trouve dans `scripts/google-apps-script-learning-documents.gs`.
Il récupère la file via `/api/automation/learning-documents`, envoie les pièces jointes avec Gmail, puis confirme la délivrance.

## Vérification et exploitation

`bun run lint` vérifie TypeScript. `bun run test:unit` exige une base isolée
dont le nom contient `security_test` ; ne jamais utiliser les données de production.
`bun audit` contrôle les dépendances verrouillées. Le build utilise le moteur
Turbopack par défaut (`bun run build`).

La production est `/srv/irenee-current`, un lien vers une release immuable.
Les secrets restent dans `/etc/irenee/production.env`. Voir `ops/README.md`
pour les sauvegardes, permissions du cache, vérifications et retour arrière.
