# Registration notifications

The database migration queues new Supabase Auth registrations and invokes this
Edge Function asynchronously.

Required Supabase Edge Function secrets:

```bash
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set REGISTRATION_NOTIFICATION_FROM="Institut Irenee <notifications@example.org>"
```

The sender domain must be verified in Resend. The webhook secret and recipient
list are configured separately during deployment.
