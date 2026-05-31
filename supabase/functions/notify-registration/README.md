# Registration notifications

The database migration queues new Supabase Auth registrations and invokes this
Edge Function asynchronously.

The Edge Function forwards each registration to a Google Apps Script Web App.
The Web App sends the email through its authorized Gmail account.

Required Supabase Edge Function secrets:

```bash
supabase secrets set GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
supabase secrets set GOOGLE_APPS_SCRIPT_WEBHOOK_SECRET=...
```

The Apps Script Web App must use the same webhook secret and reject requests
with a different value.
