import { expect, test } from "bun:test";
import {
  buildGoogleAppsScriptPayload,
  getGoogleAppsScriptError
} from "../supabase/functions/notify-registration/google-apps-script";

test("buildGoogleAppsScriptPayload sends only the registration fields expected by Google Apps Script", () => {
  expect(buildGoogleAppsScriptPayload({
    user_id: "private-user-id",
    email: "student@example.com",
    prenom: "Jean",
    nom: "Dupont",
    created_at: "2026-05-31T18:00:00.000Z"
  }, "private-secret")).toEqual({
    secret: "private-secret",
    registration: {
      email: "student@example.com",
      prenom: "Jean",
      nom: "Dupont",
      created_at: "2026-05-31T18:00:00.000Z"
    }
  });
});

test("getGoogleAppsScriptError accepts successful Apps Script responses", () => {
  expect(getGoogleAppsScriptError(true, { ok: true })).toBeNull();
});

test("getGoogleAppsScriptError preserves Apps Script errors returned with HTTP 200", () => {
  expect(getGoogleAppsScriptError(true, { ok: false, error: "Unauthorized" })).toBe("Unauthorized");
});
