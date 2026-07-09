# QA visuel des cours

Le harnais Playwright couvre la lecture d'un cours, la lecture d'un module et
l'éditeur de cours en `320x568`, `390x844`, `768x1024` et `1440x900`.

```bash
bunx playwright install chromium # une fois sur une nouvelle machine
bun run test:e2e
```

Le lanceur refuse toute URL d'application non locale et toute base dont le nom
ne contient pas `security_test`. Sans `TEST_DATABASE_URL`, il dérive
`irenee_security_test` depuis la connexion PostgreSQL locale. Il compile puis
démarre un serveur Next de production local, crée un directeur éphémère dans
la base isolée et le supprime à la fin. Toutes les données de cours sont
interceptées dans le navigateur : aucun cours persistant n'est modifié.

Les contrôles incluent Axe WCAG A/AA, l'absence de débordement horizontal, la
taille minimale des cibles tactiles, la stabilité de hauteur de l'iframe du
lecteur, un parcours clavier/enregistrement simulé et douze références de
régression plein écran. Les traces, vidéos et rapports d'échec sont écrits dans
`.playwright-artifacts/`.

Après une modification visuelle volontaire, régénérer les références puis
inspecter chaque PNG avant de les conserver :

```bash
bun run test:e2e:update
```
