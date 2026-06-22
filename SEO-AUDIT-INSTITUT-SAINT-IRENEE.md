# Audit SEO concurrentiel - Institut Saint Irénée

Date de l'audit : 31 mai 2026

Site analysé : <https://irenee-institut.org/>
Concurrent analysé : <https://www.institutsaintirenee.fr/>

## Résumé exécutif

Le concurrent est actuellement le premier résultat visible dans Google sur la requête `Institut d'apologétique` lors d'un contrôle standard réalisé le 31 mai 2026. Cette progression rapide ne vient pas d'une supériorité technique globale :

- son domaine a été enregistré le 28 mai 2026 ;
- son site ne publie pas de sitemap XML à l'URL standard ;
- seule sa page d'accueil ressortait dans les recherches `site:` effectuées pendant l'audit ;
- sa page d'accueil cible en revanche très directement la requête : nom de domaine proche, balise `title`, nom d'organisation, texte d'introduction et citations externes récentes.

Le site `irenee-institut.org` possède une base plus forte à moyen terme : domaine enregistré le 25 octobre 2025, sitemap XML, blog thématique et 59 URL exposées avant cet audit. Son défaut principal était plus simple : la page d'accueil s'intitulait seulement `Institut Saint Irénée`, plusieurs pages publiques héritaient du même titre générique et des écrans applicatifs pouvaient être proposés à l'indexation.

## Chronologie vérifiable

| Élément | Date UTC | Source |
| --- | --- | --- |
| Enregistrement de `irenee-institut.org` | 25 octobre 2025 | [RDAP Public Interest Registry](https://rdap.publicinterestregistry.org/rdap/domain/irenee-institut.org) |
| Création déclarée de l'association concurrente | 20 mai 2026 | [Societe.com](https://www.societe.com/societe/institut-d-apologetique-saint-irenee-105419394.html) |
| Enregistrement de `institutsaintirenee.fr` | 28 mai 2026 | [RDAP AFNIC](https://rdap.nic.fr/domain/institutsaintirenee.fr) |
| Audit et contrôle Google | 31 mai 2026 | Contrôle manuel daté et script de capture local |

La chronologie est un signal utile, mais elle ne suffit pas seule à établir juridiquement une atteinte au droit d'auteur.

## Pourquoi le concurrent passe devant

### 1. Une page d'accueil parfaitement alignée sur la requête

Le concurrent utilise `Institut d'Apologétique Saint-Irénée` comme titre de page et comme nom d'entité. Google reprend ce titre dans le résultat. Avant correction, notre accueil affichait seulement `Institut Saint Irénée`.

Google explique que les titres de résultats peuvent être construits à partir de la balise `title`, du titre visible principal et d'autres textes proéminents de la page : [Title links](https://developers.google.com/search/docs/appearance/title-link).

### 2. Un avantage lexical de domaine

`institutsaintirenee.fr` reprend presque directement le nom affiché de l'entité concurrente. Ce n'est pas un avantage suffisant à lui seul, mais il simplifie la compréhension de l'entité et renforce la cohérence du résultat.

### 3. Des citations externes déjà indexées

Google affiche notamment une fiche [HelloAsso](https://www.helloasso.com/associations/institut-d-apologetique-saint-irenee) et une fiche [Societe.com](https://www.societe.com/societe/institut-d-apologetique-saint-irenee-105419394.html) sous le résultat principal. Ces citations récentes donnent rapidement des signaux d'existence publique.

### 4. Une proposition éditoriale lisible

Le concurrent présente un format en présentiel à Paris, un programme, des intervenants et des partenaires. Ce contenu n'est pas techniquement sophistiqué, mais il rend l'offre immédiatement compréhensible. Notre avantage distinctif doit être exposé avec la même netteté : formation catholique accessible en ligne, modules structurés, progression et ressources éditoriales.

### 5. Une base technique concurrente encore faible

Le fichier `robots.txt` concurrent existe, mais `https://www.institutsaintirenee.fr/sitemap.xml` renvoie `404`. Les pages secondaires n'avaient pas de canonical ni de description dédiée lors du crawl. La fenêtre pour reprendre la première place est donc réelle.

## Ressemblances de contenu à documenter

Le dossier local `old_build` contient une version historique antérieure à l'enregistrement du domaine concurrent. La page concurrente actuelle reprend ou adapte plusieurs éléments observables :

- le positionnement autour de la crédibilité de la foi catholique ;
- la mission auprès des jeunes générations ;
- la structure accueil, mission, formation, partenaires et appel à candidature ;
- des formulations de CTA et de pied de page très proches ;
- une progression éditoriale comparable autour des sources, de la philosophie, de l'histoire de l'Église et du dialogue science-foi.

Une ressemblance éditoriale ne doit pas être présentée publiquement comme un jugement juridique acquis. Pour une action formelle, il faut préserver les pages, isoler les passages originaux datés et faire qualifier les éléments par un professionnel.

Empreinte SHA-256 du chunk historique local :

`ec2b8104d4adb689d55a525bc6aa7ba1e020fb063391bb1bd95e207511ca2210`

## Corrections implémentées dans le dépôt

- Accueil renommé et recadré sur `Institut d'Apologétique Irénée`.
- Nouvelle page pilier : `/institut-apologetique`.
- Pages complémentaires : `/ecole-apologetique-en-ligne`, `/programme-apologetique` et `/ressources-apologetique`.
- Canonicals et métadonnées dédiées ajoutés sur l'accueil, les formations, les formateurs, l'à-propos et le contact.
- Données structurées `EducationalOrganization`, `WebSite`, `BreadcrumbList` et `FAQPage`.
- Nouvelle page pilier ajoutée au sitemap et liée depuis l'accueil et le pied de page.
- Balises `noindex` ajoutées aux écrans privés ou applicatifs : auth, administration, cours réservés, devoirs, espace étudiant, paiement et paramètres.
- Retrait de quatre paragraphes génériques injectés dans quarante articles de blog pour réduire la répétition à grande échelle.
- Sitemap stabilisé avec des dates de modification exactes au lieu d'une date recalculée à chaque requête.
- `robots.txt` ajusté afin que les robots puissent lire les balises `noindex` des écrans applicatifs.

Google recommande de publier du contenu utile pour les personnes et sanctionne les productions à grande échelle conçues surtout pour manipuler les classements : [Helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) et [Spam policies](https://developers.google.com/search/docs/essentials/spam-policies).

## Plan d'action sous 48 heures

1. Déployer les modifications du dépôt.
2. Dans Google Search Console, soumettre le sitemap `https://irenee-institut.org/sitemap.xml`.
3. Demander une nouvelle exploration pour `/`, `/institut-apologetique`, `/formations`, `/blog` et `/a-propos`.
4. Vérifier que les pages privées commencent à sortir de l'index après recrawl.
5. Créer ou compléter les citations publiques légitimes de l'association Parole et Partage avec un nom, une adresse, un téléphone et une URL cohérents.
6. Demander aux partenaires réels déjà affichés sur le site un lien éditorial vers l'accueil ou la page pilier, avec une ancre naturelle.
7. Publier sur les réseaux propres à l'Institut la page pilier et deux articles de fond existants.

Google documente la demande de recrawl et la soumission de sitemap : [Ask Google to recrawl](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl).

## Plan de contenu sur 30 jours

Le relevé détaillé des positions et des pages cibles est disponible dans [`SEO-KEYWORD-MATRIX.md`](./SEO-KEYWORD-MATRIX.md).

Prioriser la qualité et la preuve d'expertise. Les pages suivantes doivent être enrichies éditorialement avant d'ajouter de nouveaux volumes :

| Intention | URL principale | Action |
| --- | --- | --- |
| `institut d'apologétique` | `/` et `/institut-apologetique` | Consolider les liens internes et les citations externes |
| `formation apologétique catholique` | `/formations` | Ajouter déroulé, modalités, durée et résultats attendus |
| `qu'est-ce que l'apologétique catholique` | `/blog/qu-est-ce-que-l-apologetique-catholique` | Ajouter exemples, sources et auteur identifiable |
| `école d'apologétique` | série de blog existante | Relire, fusionner ou approfondir les pages les plus proches |
| `science et foi` | article existant | Ajouter une bibliographie et un angle pédagogique propre |
| `fiabilité des Évangiles` | futur contenu expert | Publier seulement avec auteur, sources et vraie valeur ajoutée |

Chaque article important doit afficher un auteur ou une responsabilité éditoriale identifiable, des sources vérifiables, une date de mise à jour et des liens vers la formation adaptée.

## Stratégie de crédibilité

La bonne réponse publique est positive et vérifiable :

- rendre plus visible l'association porteuse, son SIREN, ses coordonnées et son histoire ;
- distinguer clairement l'offre en ligne de l'offre présentielle concurrente ;
- publier les profils réels des formateurs et leurs domaines d'expertise ;
- obtenir des liens depuis les partenaires réellement engagés ;
- éviter les pages d'attaque nominatives, les faux avis, les signalements infondés et le bourrage de mots-clés.

## Préservation de preuve et recours

Exécuter régulièrement :

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\capture-seo-evidence.ps1
```

Le script archive les HTML publics, les réponses RDAP et leurs empreintes SHA-256 dans `seo-evidence/captures/`.

Pour une démarche formelle :

1. Faire réaliser un constat par un commissaire de justice si l'enjeu le justifie.
2. Dresser une liste courte des passages protégés réellement repris, avec URL source, URL cible et preuve de date.
3. Faire relire la qualification juridique avant envoi d'une mise en demeure.
4. Utiliser le [formulaire d'abus Infomaniak](https://www.infomaniak.com/fr/form/abuse) si le dossier est suffisamment étayé.
5. Utiliser les [outils légaux Google](https://support.google.com/legal/troubleshooter/1114905) uniquement pour une demande exacte, documentée et portée par le titulaire des droits.
6. Réserver le [signalement de spam Google](https://developers.google.com/search/docs/monitor-debug/report-search-spam) aux cas qui correspondent réellement aux règles de spam.

Ce document est un audit SEO et un dossier de travail factuel, pas un avis juridique.

## Sources principales

- [Google Search Central - Title links](https://developers.google.com/search/docs/appearance/title-link)
- [Google Search Central - Ask Google to recrawl](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)
- [Google Search Central - Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Google Search Central - Spam policies](https://developers.google.com/search/docs/essentials/spam-policies)
- [Google Search Central - Report spam](https://developers.google.com/search/docs/monitor-debug/report-search-spam)
- [RDAP AFNIC - institutsaintirenee.fr](https://rdap.nic.fr/domain/institutsaintirenee.fr)
- [RDAP Public Interest Registry - irenee-institut.org](https://rdap.publicinterestregistry.org/rdap/domain/irenee-institut.org)
- [Infomaniak - Signaler un abus](https://www.infomaniak.com/fr/form/abuse)
- [Google Legal Help](https://support.google.com/legal/troubleshooter/1114905)
