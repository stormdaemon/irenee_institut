import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { query } from "@/lib/db";

export type LocalUser = {
  id: string;
  email: string;
  user_metadata: Record<string, unknown>;
};

export type LocalSession = {
  access_token: string;
  expires_at: number;
  expires_in: number;
  token_type: "bearer";
  user: LocalUser;
};

export const SESSION_COOKIE_NAME = "irenee_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export function encodeJwtSecret(secret: string) {
  if (secret.length < 32) throw new Error("LOCAL_AUTH_JWT_SECRET must be at least 32 characters.");
  return new TextEncoder().encode(secret);
}

function jwtSecret() {
  return encodeJwtSecret(process.env.LOCAL_AUTH_JWT_SECRET || "");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function userFromRow(row: { id: string; email: string | null; raw_user_meta_data?: Record<string, unknown> | null }): LocalUser {
  return {
    id: row.id,
    email: row.email || "",
    user_metadata: row.raw_user_meta_data || {}
  };
}

export async function findUserByEmail(email: string) {
  const result = await query<{
    id: string;
    email: string | null;
    encrypted_password: string | null;
    raw_user_meta_data: Record<string, unknown> | null;
  }>(
    `select id, email, encrypted_password, raw_user_meta_data
     from auth.users
     where lower(email) = lower($1) and deleted_at is null
     limit 1`,
    [normalizeEmail(email)]
  );
  return result.rows[0] || null;
}

export async function findUserById(id: string) {
  const result = await query<{
    id: string;
    email: string | null;
    raw_user_meta_data: Record<string, unknown> | null;
  }>(
    `select id, email, raw_user_meta_data
     from auth.users
     where id = $1 and deleted_at is null
     limit 1`,
    [id]
  );
  return result.rows[0] ? userFromRow(result.rows[0]) : null;
}

export async function createSession(user: LocalUser): Promise<LocalSession> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_TTL_SECONDS;
  const token = await new SignJWT({
    aud: "authenticated",
    email: user.email,
    role: "authenticated"
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(jwtSecret());

  return {
    access_token: token,
    expires_at: expiresAt,
    expires_in: SESSION_TTL_SECONDS,
    token_type: "bearer",
    user
  };
}

export async function verifyAccessToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, jwtSecret(), { algorithms: ["HS256"] });
    if (!payload.sub) return { user: null, error: new Error("Session invalide.") };
    const user = await findUserById(payload.sub);
    if (!user) return { user: null, error: new Error("Utilisateur introuvable.") };
    return { user, error: null };
  } catch {
    return { user: null, error: new Error("Session invalide ou expiree.") };
  }
}

export async function signInWithPassword(email: string, password: string) {
  const row = await findUserByEmail(email);
  if (!row?.encrypted_password) {
    return { session: null, user: null, error: new Error("Identifiants invalides.") };
  }

  const ok = await bcrypt.compare(password, row.encrypted_password);
  if (!ok) return { session: null, user: null, error: new Error("Identifiants invalides.") };

  const user = userFromRow(row);
  await query(`update auth.users set last_sign_in_at = now(), updated_at = now() where id = $1`, [user.id]);
  return { session: await createSession(user), user, error: null };
}

export async function signUpWithPassword(input: { email: string; password: string; metadata?: Record<string, unknown> }) {
  const email = normalizeEmail(input.email);
  const existing = await findUserByEmail(email);
  if (existing) {
    return { session: null, user: userFromRow(existing), identities: [], error: null };
  }

  const userId = randomUUID();
  const identityId = randomUUID();
  const encryptedPassword = await bcrypt.hash(input.password, 12);
  const metadata = input.metadata || {};

  await query(
    `insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, $3, now(),
      '{"provider":"email","providers":["email"]}'::jsonb, $4::jsonb, now(), now(), false, false
    )`,
    [userId, email, encryptedPassword, JSON.stringify(metadata)]
  );

  await query(
    `insert into auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id
    ) values ($1, $2, $3::jsonb, 'email', now(), now(), now(), $4)`,
    [userId, userId, JSON.stringify({ sub: userId, email, email_verified: true, ...metadata }), identityId]
  );

  const user: LocalUser = { id: userId, email, user_metadata: metadata };
  return { session: await createSession(user), user, identities: [{ id: identityId, user_id: userId, provider: "email" }], error: null };
}

export async function deleteLocalUser(id: string) {
  await query(`delete from auth.users where id = $1`, [id]);
  return { data: { user: null }, error: null };
}
