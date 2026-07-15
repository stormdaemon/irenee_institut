# Point SEO du 15 juillet 2026 — concurrence institutsaintirenee.fr

## Fait nouveau majeur

`institutsaintirenee.fr` ne sert plus de site : il répond par une **redirection 301
vers `https://apostolosinstitut.fr`**. Le concurrent s'est rebaptisé « Apostolos —
Institut d'Apologétique Saint-Irénée » (visible aussi sur son Instagram et sa page
CredoFunding). Son certificat HTTPS expiré n'a aucun effet sur son classement tant
que la redirection 301 fonctionne : Google suit la redirection et conserve les
signaux accumulés pendant la transition.

Conséquence : Google va progressivement re-titrer et re-marquer leur résultat vers
la nouvelle entité « Apostolos ». L'espace de nom « Saint Irénée » dans les
résultats devrait se libérer dans les semaines qui viennent — à condition d'occuper
le terrain avec des signaux frais, ce qui est l'objet des actions ci-dessous.

## Pourquoi ils restent premiers sur la requête de marque

`INSTITUT D'APOLOGETIQUE SAINT-IRENEE` est le **nom officiel de leur association
déclarée** (SIREN 105 419 394, créée le 20 mai 2026). Sur cette requête exacte,
Google favorise l'entité qui porte ce nom, appuyée par ses citations externes déjà
indexées : annuaire-entreprises.data.gouv.fr, HelloAsso, Kompass, CredoFunding,
presse (Le Salon Beige). Aucun réglage technique de notre côté ne peut contrer des
signaux d'entité de ce type — c'est un sujet de citations, de notoriété et le cas
échéant de droit des marques.

Sur les requêtes non-marque (« institut apologétique catholique formation en
ligne »), `irenee-institut.org` ressort déjà **premier**.

## Ce qui a été fait ce jour (déployé en production, release `36e3b8d`)

- Sitemap : `lastmod` mis à jour au 8 juillet 2026 (date du dernier changement
  réel du contenu public : vidéo de présentation, refonte images) pour inciter au
  recrawl. L'ancienne date figée au 1er juin laissait croire à un site inactif.
- IndexNow mis en place : clé publiée sur
  `https://irenee-institut.org/7242ad6fca3475228202e03fc917d30a.txt`, script
  `scripts/ping-indexnow.mjs`, et **les 65 URLs du sitemap déjà soumises**
  (réponse 202). Couvre Bing, DuckDuckGo, Yandex, Seznam, Naver.
- Contrôle complet : les 65 URLs publiques répondent 200 avec titres/canonicals
  uniques, données structurées (EducationalOrganization + SIREN Parole et
  Partage, WebSite, VideoObject) bien servies, redirections http/www correctes,
  sitemap et robots.txt sains. Les correctifs de l'audit du 31 mai sont bien en
  production.

Rollback si besoin : `ln -sfn /srv/irenee-releases/81ee89d /srv/irenee-current
&& systemctl restart irenee-production`.

## Actions qui nécessitent vos comptes (à faire, par impact décroissant)

1. **Google Search Console** (le site y est déjà vérifié via DNS) :
   - re-soumettre `https://irenee-institut.org/sitemap.xml` ;
   - « Inspection d'URL » → « Demander une indexation » pour `/`,
     `/institut-apologetique`, `/formations`, `/presse/liberation-institut-saint-irenee-2026` ;
   - vérifier dans Performances les requêtes où vous êtes en position 2-5.
2. **Citations de l'entité** : la fiche annuaire-entreprises de Parole et Partage
   (SIREN 841 890 692), une page HelloAsso, et des profils sociaux au nom exact
   « Institut d'Apologétique Saint Irénée » pointant vers `irenee-institut.org`,
   avec nom/adresse/téléphone identiques partout. C'est précisément ce qui a fait
   monter le concurrent en quelques jours.
3. **Liens partenaires** : demander aux partenaires réels affichés sur le site un
   lien éditorial vers l'accueil (l'article de Libération est un atout — vérifier
   qu'il contient un lien).
4. **Marque** : le concurrent migre vers « Apostolos ». C'est le moment de déposer
   « Institut d'Apologétique Saint Irénée » à l'INPI pour sécuriser le nom.
5. **Volet juridique** : l'audit du 31 mai documente des ressemblances de contenu
   avec preuve d'antériorité (empreintes SHA-256). Attention : il s'agit d'une
   association réellement déclarée, pas d'un site de phishing — la qualification
   « copie frauduleuse » doit être validée par un professionnel avant toute mise
   en demeure ou signalement (voir la section « Préservation de preuve et
   recours » de `SEO-AUDIT-INSTITUT-SAINT-IRENEE.md`). Leur rebranding rend ce
   volet moins urgent : le conflit de nom est en train de se résoudre de lui-même.

## Suivi

Recontrôler la SERP « institut d'apologétique saint irénée » chaque semaine.
Attendu : leur résultat bascule sur apostolosinstitut.fr/« Apostolos » et la
position 1 sur « Saint Irénée » se libère. Si dans 4-6 semaines l'ancien domaine
occupe toujours la position 1 sans contenu propre, un signalement Google
« résultat obsolète » (outil Remove Outdated Content) devient pertinent.
