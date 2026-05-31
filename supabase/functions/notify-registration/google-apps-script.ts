export type RegistrationRecord = {
  user_id?: string;
  email?: string;
  prenom?: string;
  nom?: string;
  created_at?: string;
};

type GoogleAppsScriptResponse = {
  ok?: boolean;
  error?: unknown;
};

export function buildGoogleAppsScriptPayload(record: RegistrationRecord, secret: string) {
  return {
    secret,
    registration: {
      email: record.email,
      prenom: record.prenom,
      nom: record.nom,
      created_at: record.created_at
    }
  };
}

export function getGoogleAppsScriptError(responseOk: boolean, result: GoogleAppsScriptResponse) {
  if (responseOk && result.ok === true) return null;
  return String(result.error || "Google Apps Script rejected the notification");
}
