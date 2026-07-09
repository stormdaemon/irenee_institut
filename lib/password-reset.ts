import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { query, withTransaction } from "@/lib/db";
import { validatePassword, type LocalUser } from "@/lib/local-auth";

type PasswordResetUserRow = {
  banned_until?: Date | string | null;
  email: string | null;
  email_confirmed_at?: Date | string | null;
  encrypted_password?: string | null;
  id: string;
  raw_user_meta_data?: Record<string, unknown> | null;
};

export const PASSWORD_RESET_TTL_SECONDS = 30 * 60;
const invalidResetLinkMessage = "Lien de réinitialisation invalide ou expiré.";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function userFromRow(row: PasswordResetUserRow): LocalUser {
  return {
    email: row.email || "",
    id: row.id,
    user_metadata: row.raw_user_meta_data || {}
  };
}

/**
 * Creates a short-lived credential only for a confirmed, active local account.
 * The caller must always return the same public response, including when this
 * function returns null, to avoid disclosing whether an address is registered.
 */
export async function issuePasswordResetToken(email: string) {
  const normalized = normalizeEmail(email);
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { resetToken: null, user: null };
  }

  const resetToken = randomBytes(32).toString("base64url");
  return withTransaction(async client => {
    const result = await client.query<PasswordResetUserRow>(
      `select id,email,encrypted_password,raw_user_meta_data,email_confirmed_at,banned_until
       from auth.users
       where lower(email) = lower($1) and deleted_at is null
       limit 1
       for update`,
      [normalized]
    );
    const row = result.rows[0];
    if (
      !row?.encrypted_password ||
      !row.email_confirmed_at ||
      (row.banned_until && new Date(row.banned_until).getTime() > Date.now())
    ) {
      return { resetToken: null, user: null };
    }

    // A newly requested link supersedes every older link. This keeps exactly
    // one credential capable of changing the account at any point in time.
    await client.query(
      `update public.password_reset_tokens
       set consumed_at = coalesce(consumed_at, now())
       where user_id = $1 and consumed_at is null`,
      [row.id]
    );
    await client.query(
      `insert into public.password_reset_tokens (user_id,token_hash,expires_at)
       values ($1,$2,now() + ($3 * interval '1 second'))`,
      [row.id, hashToken(resetToken), PASSWORD_RESET_TTL_SECONDS]
    );

    return { resetToken, user: userFromRow(row) };
  });
}

/**
 * Consumes a reset credential and changes all related security state in one
 * transaction. It intentionally does not create a session: the user must log
 * in with the new password after the reset.
 */
export async function resetPasswordWithToken(token: string, nextPassword: string) {
  try {
    validatePassword(nextPassword);
  } catch (error) {
    return { error: error as Error, userId: null };
  }

  // Do the expensive password work before looking up the credential so an
  // invalid link does not become a cheap online guessing oracle.
  const encryptedPassword = await bcrypt.hash(nextPassword, 12);
  if (!token || token.length > 256) {
    return { error: new Error(invalidResetLinkMessage), userId: null };
  }

  try {
    const userId = await withTransaction(async client => {
      // Read the owner first, then lock the user before the token. Issuance uses
      // the same lock order, preventing deadlocks with concurrent reset emails.
      const candidate = await client.query<{ user_id: string }>(
        `select user_id
         from public.password_reset_tokens
         where token_hash = $1 and consumed_at is null and expires_at > now()
         limit 1`,
        [hashToken(token)]
      );
      if (!candidate.rows[0]) return null;

      await client.query("select id from auth.users where id = $1 for update", [candidate.rows[0].user_id]);
      const eligible = await client.query<{ user_id: string }>(
        `select t.user_id
         from public.password_reset_tokens t
         join auth.users u on u.id = t.user_id
         where t.token_hash = $1
           and t.consumed_at is null
           and t.expires_at > now()
           and u.deleted_at is null
           and u.email_confirmed_at is not null
           and (u.banned_until is null or u.banned_until <= now())
         for update of t`,
        [hashToken(token)]
      );
      const row = eligible.rows[0];
      if (!row) return null;

      const updated = await client.query(
        `update auth.users
         set encrypted_password = $1, updated_at = now()
         where id = $2 and deleted_at is null
         returning id`,
        [encryptedPassword, row.user_id]
      );
      if (updated.rowCount !== 1) return null;

      await client.query(
        `update public.password_reset_tokens
         set consumed_at = coalesce(consumed_at, now())
         where user_id = $1 and consumed_at is null`,
        [row.user_id]
      );
      await client.query(
        `update public.email_verification_tokens
         set consumed_at = coalesce(consumed_at, now())
         where user_id = $1 and consumed_at is null`,
        [row.user_id]
      );
      await client.query(
        `update public.app_sessions
         set revoked_at = coalesce(revoked_at, now())
         where user_id = $1 and revoked_at is null`,
        [row.user_id]
      );
      return row.user_id;
    });

    return userId
      ? { error: null, userId }
      : { error: new Error(invalidResetLinkMessage), userId: null };
  } catch {
    return { error: new Error("La réinitialisation est momentanément indisponible."), userId: null };
  }
}
