# Exploitation durcie

Les fichiers de ce dossier décrivent le service systemd, le frontal Nginx, le rôle PostgreSQL d’exécution, SSH et Fail2ban. Ils doivent être installés par `root` après sauvegarde des fichiers actifs et validés avant rechargement (`systemd-analyze verify`, `nginx -t`, `sshd -t`, `fail2ban-client -t`). Le fichier SSH garde volontairement le préfixe `00-` : OpenSSH retient la première valeur rencontrée dans les drop-ins, avant `50-cloud-init.conf`.

La production utilise des releases immuables dans `/srv/irenee-releases/<commit>` et le lien atomique `/srv/irenee-current`. Les secrets résident dans `/etc/irenee/production.env` (`root:irenee`, mode `0640`), jamais dans une release.

Ordre de mise en production :

1. construire et tester la release sur `irenee_security_test` ;
2. sauvegarder la base et la configuration ;
3. initialiser une seule fois le registre avec la dernière migration déjà
   présente, puis appliquer uniquement les migrations en attente :
   `MIGRATION_DATABASE=irenee_staging bun run db:migrate --apply --baseline-through=20260709010000_access_provenance.sql` ;
4. créer/faire tourner le rôle `irenee_runtime` ;
5. installer les secrets indépendants et le stockage `/var/lib/irenee/avatars` ;
6. durcir les salles Daily existantes ;
7. basculer le lien atomique, redémarrer et exécuter les sondes ;
8. chiffrer les anciens paramètres secrets ;
9. conserver au moins la release précédente pour un rollback immédiat.

Ne jamais rejouer directement tous les fichiers SQL. Le registre
`irenee_ops.schema_migrations` verrouille l'ordre, l'application unique et
l'empreinte SHA-256 de chaque fichier dans une transaction globale. Une
migration déjà enregistrée mais modifiée fait échouer le déploiement.

Le timer `irenee-security-maintenance.timer` applique chaque jour la rétention
des sessions et jetons expirés, des buckets de limitation, ainsi qu'une
rétention de deux ans pour les événements de paiement et d'audit. Le service
refuse toute base dont le nom ne correspond pas exactement à sa garde explicite.

Les abonnements webhook des fournisseurs doivent couvrir les transitions qui retirent un droit :

- Stripe : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.funds_withdrawn` et `charge.dispute.closed` ;
- PayPal : `CHECKOUT.ORDER.APPROVED`, `CHECKOUT.PAYMENT-APPROVAL.REVERSED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED` et `CUSTOMER.DISPUTE.CREATED`.

Après toute modification de ces abonnements, déclencher un événement de test signé depuis chaque fournisseur et vérifier uniquement les métadonnées/status dans `payment_events` et `security_audit_events`. Les corps bruts ne doivent jamais être journalisés.
