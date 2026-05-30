# Institut Irénée rebuild

Reconstruction Next.js depuis le build `old_build`.

## Stack

- Bun `1.3.13`
- Next.js `16.2.6`
- React `19.2.6`
- Supabase JS `2.106.0`
- TypeScript `6.0.3`

## Commandes

```bash
bun install
bun run dev -- --hostname 127.0.0.1 --port 3001
bun run build
```

## Reconstruit

- Pages publiques : accueil, formations, formateurs, à propos, contact/FAQ.
- Auth : connexion et inscription Supabase côté client avec fallback local.
- LMS : espace étudiant, détail cours, détail module, quiz/progression.
- Admin : dashboard, cours, utilisateurs, devoirs, paiements, paramètres, stats, pages légales.
- API routes : courses, users, homework, payments, profile avatar, progress, settings, inscription.
- Assets récupérés : logos, formateurs, partenaires.
- Schéma Supabase inféré : `supabase/schema.sql`.

## À compléter ensuite

- Brancher les vraies politiques RLS Supabase selon les rôles.
- Paiement PayPal actif avec montant libre et attribution automatique des formations.
- Remplacer les contenus de secours par les vrais contenus DB si la base les contient.
- Recréer l'éditeur riche complet si TinyMCE/Cloudinary doit être conservé tel quel.
