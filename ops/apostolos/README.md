# Exploitation OVH — Apostolos

- Domaine : https://apostolos-saint-irenee.duckdns.org
- Répertoire : `/opt/apostolos`
- Releases immuables : `/opt/apostolos/releases/<release>`
- Application : conteneur `apostolos-app`, `127.0.0.1:3031` vers le port 3000.
- PostgreSQL : conteneur `apostolos-database`, réseau Docker privé `apostolos`, aucun port publié.
- Volumes : `apostolos-postgres` et `apostolos-avatars`.
- Secrets root uniquement : `/opt/apostolos/secrets/application.env` et `database.env`.
- Nginx : `/etc/nginx/sites-available/apostolos.conf`.

## Publication

Construire l’image identifiée, vérifier le build, sauvegarder les données, puis lancer Compose avec une version explicite. Aucun script de build ne supprime ou ne désinstalle des services du serveur.

```sh
sudo /opt/apostolos/backup.sh
sudo env APOSTOLOS_RELEASE=VERSION docker compose -p apostolos \
  -f /opt/apostolos/releases/VERSION/ops/apostolos/compose.yaml up -d app
sudo nginx -t
```

Conserver l’image précédente jusqu’à validation HTTPS, connexion et lecture/écriture. Pour revenir à cette version, relancer la commande avec son identifiant, sans changer les volumes. Toute migration doit rester compatible avec cette stratégie ou disposer de son plan de restauration explicite.

## Sauvegardes

`apostolos-backup.timer` lance chaque jour une sauvegarde PostgreSQL au format custom et une archive des avatars. Les fichiers et empreintes SHA-256 sont dans `/opt/apostolos/backups`, accessibles à root uniquement. Le premier dump a été restauré dans une base de contrôle séparée et les 10 cours/50 modules/1 administrateur y ont été vérifiés.

Ces sauvegardes locales ne protègent pas d’une perte complète du VPS. Conserver une copie hors serveur et sauvegarder séparément les secrets de chiffrement. Ne jamais restaurer par-dessus la production pour effectuer un simple contrôle.

```sh
sudo systemctl status apostolos-backup.timer
sudo docker ps --filter name=apostolos
sudo docker logs --tail 50 apostolos-app
```

Certbot renouvelle le certificat ; son hook vérifie Nginx puis recharge le service. Préserver les configurations des autres applications du VPS.

## Confidentialité

Ne jamais afficher `docker inspect ... Config.Env`, les fichiers `.env`, les clés Stripe/Daily ou les secrets de webhook dans les logs partagés. Les fichiers privés locaux de cette installation sont hors dépôt. L’identifiant administrateur provisoire est un identifiant de connexion, pas une boîte email.
