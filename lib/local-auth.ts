import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { query, withTransaction } from "@/lib/db";
import { getTrustedClientIp, parseRequestCookies } from "@/lib/request-security";

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

type SessionContext = {
  ip?: string;
  userAgent?: string;
};

type AuthUserRow = {
  id: string;
  email: string | null;
  encrypted_password?: string | null;
  raw_user_meta_data?: Record<string, unknown> | null;
  email_confirmed_at?: Date | string | null;
  banned_until?: Date | string | null;
};

export const SESSION_COOKIE_NAME = "irenee_session";
export const SECURE_SESSION_COOKIE_NAME = "__Host-irenee_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;
export const EMAIL_VERIFICATION_TTL_SECONDS = 60 * 60 * 24;
const TOKEN_ISSUER = "https://irenee-institut.org";
const TOKEN_AUDIENCE = "irenee-web";
const MAX_ACTIVE_SESSIONS = 5;
const DUMMY_PASSWORD_HASH = "$2b$12$NllQiFd5CDUC9iNKKjvfbOiT3u38gYunck/8gPzXz3xJ74pSBjd5.";
const commonPasswords = new Set([
  "123456789012", "azertyuiop12", "motdepasse12", "password1234", "qwertyuiop12"
]);

class SessionEligibilityError extends Error {}

export function encodeJwtSecret(secret: string) {
  if (secret.length < 32) throw new Error("LOCAL_AUTH_JWT_SECRET must be at least 32 characters.");
  return new TextEncoder().encode(secret);
}

function jwtSecretValue() {
  return process.env.LOCAL_AUTH_JWT_SECRET || "";
}

function jwtSecret() {
  return encodeJwtSecret(jwtSecretValue());
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hashContext(value?: string) {
  if (!value) return null;
  return createHmac("sha256", jwtSecretValue()).update(value).digest("hex");
}

function userFromRow(row: AuthUserRow): LocalUser {
  return {
    id: row.id,
    email: row.email || "",
    user_metadata: row.raw_user_meta_data || {}
  };
}

export function validatePassword(password: string) {
  if (password.length < 12) throw new Error("Le mot de passe doit contenir au moins 12 caractères.");
  if (password.length > 128) throw new Error("Le mot de passe ne peut pas dépasser 128 caractères.");
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("Le mot de passe ne peut pas dépasser 72 octets avec le hachage actuel.");
  }
  if (commonPasswords.has(password.trim().toLowerCase())) throw new Error("Ce mot de passe est trop courant.");
  return password;
}

function normalizeMetadata(metadata?: Record<string, unknown>) {
  const clean = (value: unknown) => String(value || "").replace(/\s+/g, " ").trim().slice(0, 120);
  return {
    nom: clean(metadata?.nom || metadata?.last_name),
    prenom: clean(metadata?.prenom || metadata?.first_name),
    telephone: String(metadata?.telephone || metadata?.phone || "").replace(/\s+/g, " ").trim().slice(0, 30)
  };
}

export async function findUserByEmail(email: string) {
  const result = await query<AuthUserRow>(
    `select id, email, encrypted_password, raw_user_meta_data, email_confirmed_at, banned_until
     from auth.users
     where lower(email) = lower($1) and deleted_at is null
     limit 1`,
    [normalizeEmail(email)]
  );
  return result.rows[0] || null;
}

export async function findUserById(id: string) {
  const result = await query<AuthUserRow>(
    `select id, email, raw_user_meta_data, email_confirmed_at, banned_until
     from auth.users
     where id = $1
       and deleted_at is null
       and email_confirmed_at is not null
       and (banned_until is null or banned_until <= now())
     limit 1`,
    [id]
  );
  return result.rows[0] ? userFromRow(result.rows[0]) : null;
}

export async function createSession(user: LocalUser, context: SessionContext = {}): Promise<LocalSession> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_TTL_SECONDS;
  const sessionId = randomUUID();
  const created = await withTransaction(async client => {
    // Lock the account eligibility while the session is registered. This closes
    // the race between a successful password check and an administrator ban.
    const eligible = await client.query<AuthUserRow>(
      `select id,email,raw_user_meta_data,email_confirmed_at,banned_until
       from auth.users
       where id = $1
         and deleted_at is null
         and email_confirmed_at is not null
         and (banned_until is null or banned_until <= now())
       for share`,
      [user.id]
    );
    if (!eligible.rows[0]) throw new SessionEligibilityError("Session invalide.");
    const databaseUser = userFromRow(eligible.rows[0]);
    const token = await new SignJWT({ email: databaseUser.email, role: "authenticated" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setAudience(TOKEN_AUDIENCE)
      .setIssuer(TOKEN_ISSUER)
      .setJti(sessionId)
      .setSubject(databaseUser.id)
      .setIssuedAt(now)
      .setNotBefore(now - 5)
      .setExpirationTime(expiresAt)
      .sign(jwtSecret());

    await client.query(
      `insert into public.app_sessions (id,user_id,token_hash,expires_at,ip_hash,user_agent_hash)
       values ($1,$2,$3,to_timestamp($4),$5,$6)`,
      [sessionId, databaseUser.id, hashToken(token), expiresAt, hashContext(context.ip), hashContext(context.userAgent)]
    );
    await client.query(
      `update public.app_sessions
       set revoked_at = coalesce(revoked_at, now())
       where user_id = $1 and revoked_at is null and id not in (
         select id from public.app_sessions
         where user_id = $1 and revoked_at is null and expires_at > now()
         order by created_at desc limit $2
       )`,
      [databaseUser.id, MAX_ACTIVE_SESSIONS]
    );
    return { token, user: databaseUser };
  });

  return {
    access_token: created.token,
    expires_at: expiresAt,
    expires_in: SESSION_TTL_SECONDS,
    token_type: "bearer",
    user: created.user
  };
}

async function verifiedClaims(token: string) {
  const result = await jwtVerify(token, jwtSecret(), {
    algorithms: ["HS256"],
    audience: TOKEN_AUDIENCE,
    clockTolerance: 5,
    issuer: TOKEN_ISSUER
  });
  if (!result.payload.sub || !result.payload.jti) throw new Error("Session invalide.");
  return result.payload;
}

export async function verifyAccessToken(token: string) {
  try {
    const payload = await verifiedClaims(token);
    const sessions = await query<AuthUserRow & { user_id: string; expires_at: Date | string }>(
      `select s.user_id,s.expires_at,u.id,u.email,u.raw_user_meta_data,u.email_confirmed_at,u.banned_until
       from public.app_sessions s
       join auth.users u on u.id = s.user_id
       where s.id = $1 and s.user_id = $2 and s.token_hash = $3
         and s.revoked_at is null and s.expires_at > now()
         and u.deleted_at is null
         and u.email_confirmed_at is not null
         and (u.banned_until is null or u.banned_until <= now())
       limit 1`,
      [payload.jti, payload.sub, hashToken(token)]
    );
    const session = sessions.rows[0];
    if (!session) throw new Error("Session invalide.");
    return {
      error: null,
      expiresAt: Math.floor(new Date(session.expires_at).getTime() / 1000),
      sessionId: String(payload.jti),
      user: userFromRow(session)
    };
  } catch {
    return { user: null, error: new Error("Session invalide ou expiree."), expiresAt: null, sessionId: null };
  }
}

export async function revokeAccessToken(token: string) {
  try {
    const payload = await verifiedClaims(token);
    await query(
      `update public.app_sessions set revoked_at = coalesce(revoked_at, now())
       where id = $1 and user_id = $2 and token_hash = $3`,
      [payload.jti, payload.sub, hashToken(token)]
    );
  } catch {
    // Logout remains idempotent for expired or malformed tokens.
  }
}

export async function revokeAllUserSessions(userId: string) {
  await query("update public.app_sessions set revoked_at = coalesce(revoked_at, now()) where user_id = $1", [userId]);
}

export async function signInWithPassword(email: string, password: string, context: SessionContext = {}) {
  const row = await findUserByEmail(email);
  const ok = await bcrypt.compare(password, row?.encrypted_password || DUMMY_PASSWORD_HASH);
  if (!row?.encrypted_password || !ok) {
    return { session: null, user: null, error: new Error("Identifiants invalides.") };
  }
  if (!row.email_confirmed_at) {
    return { session: null, user: null, error: new Error("Confirmez votre adresse email avant de vous connecter.") };
  }
  if (row.banned_until && new Date(row.banned_until).getTime() > Date.now()) {
    return { session: null, user: null, error: new Error("Identifiants invalides.") };
  }

  const user = userFromRow(row);
  await query("update auth.users set last_sign_in_at = now(), updated_at = now() where id = $1", [user.id]);
  try {
    return { session: await createSession(user, context), user, error: null };
  } catch (error) {
    if (error instanceof SessionEligibilityError) {
      return { session: null, user: null, error: new Error("Identifiants invalides.") };
    }
    throw error;
  }
}

export async function signUpWithPassword(
  input: { email: string; password: string; metadata?: Record<string, unknown> },
  context: SessionContext = {}
) {
  const email = normalizeEmail(input.email);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { session: null, user: null, identities: [], error: new Error("Email invalide.") };
  }
  try {
    validatePassword(input.password);
  } catch (error) {
    return { session: null, user: null, identities: [], error: error as Error };
  }

  // Pay the same password-hashing cost before the unique-email decision so an
  // existing address is not exposed through a cheap timing difference.
  const encryptedPassword = await bcrypt.hash(input.password, 12);
  try {
    const existing = await findUserByEmail(email);
    if (existing) {
      return {
        session: null,
        user: userFromRow(existing),
        identities: [],
        error: null
      };
    }
  } catch {
    return {
      session: null,
      user: null,
      identities: [],
      error: new Error("Le compte n'a pas pu être créé.")
    };
  }
  const metadata = normalizeMetadata(input.metadata);
  const userId = randomUUID();
  const identityId = randomUUID();

  try {
    await withTransaction(async client => {
      await client.query(
        `insert into auth.users (
           instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
           raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
         ) values (
           '00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, $3, now(),
           '{"provider":"email","providers":["email"]}'::jsonb, $4::jsonb, now(), now(), false, false
         )`,
        [userId, email, encryptedPassword, JSON.stringify(metadata)]
      );
      await client.query(
        `insert into auth.identities (
           provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id
         ) values ($1, $2, $3::jsonb, 'email', now(), now(), now(), $4)`,
        [userId, userId, JSON.stringify({ sub: userId, email, email_verified: true, ...metadata }), identityId]
      );
      await client.query(
        `insert into public.profiles (id,email,nom,prenom,telephone,role,updated_at)
         values ($1,$2,$3,$4,$5,'etudiant',now())`,
        [userId, email, metadata.nom, metadata.prenom, metadata.telephone]
      );
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      const existing = await findUserByEmail(email);
      return {
        session: null,
        user: existing ? userFromRow(existing) : null,
        identities: [],
        error: null
      };
    }
    return {
      session: null,
      user: null,
      identities: [],
      error: new Error("Le compte n'a pas pu être créé.")
    };
  }

  const user: LocalUser = { id: userId, email, user_metadata: metadata };
  try {
    const session = await createSession(user, context);
    return {
      session,
      user: session.user,
      identities: [{ id: identityId, user_id: userId, provider: "email" }],
      error: null
    };
  } catch {
    // Do not strand an unusable account if hardened session creation fails.
    await query("delete from auth.users where id = $1", [userId]).catch(() => undefined);
    return {
      session: null,
      user: null,
      identities: [],
      error: new Error("Le compte n'a pas pu être finalisé.")
    };
  }
}

export async function changePassword(userId: string, currentPassword: string, nextPassword: string) {
  if (!currentPassword || currentPassword.length > 128) {
    return { error: new Error("Le mot de passe actuel est incorrect.") };
  }
  try {
    validatePassword(nextPassword);
  } catch (error) {
    return { error: error as Error };
  }

  const result = await query<AuthUserRow>(
    `select id,email,encrypted_password,raw_user_meta_data,email_confirmed_at,banned_until
     from auth.users
     where id = $1 and deleted_at is null
     limit 1`,
    [userId]
  );
  const row = result.rows[0];
  const currentPasswordIsValid = await bcrypt.compare(currentPassword, row?.encrypted_password || DUMMY_PASSWORD_HASH);
  if (!row?.encrypted_password || !currentPasswordIsValid) {
    return { error: new Error("Le mot de passe actuel est incorrect.") };
  }
  if (await bcrypt.compare(nextPassword, row.encrypted_password)) {
    return { error: new Error("Le nouveau mot de passe doit être différent du mot de passe actuel.") };
  }

  const nextPasswordHash = await bcrypt.hash(nextPassword, 12);
  try {
    const changed = await withTransaction(async client => {
      const updated = await client.query(
        `update auth.users
         set encrypted_password = $1, updated_at = now()
         where id = $2 and encrypted_password = $3 and deleted_at is null
         returning id`,
        [nextPasswordHash, userId, row.encrypted_password]
      );
      if (updated.rowCount !== 1) return false;
      await client.query(
        "update public.app_sessions set revoked_at = coalesce(revoked_at, now()) where user_id = $1",
        [userId]
      );
      return true;
    });
    if (!changed) return { error: new Error("Le mot de passe a été modifié ailleurs. Reconnectez-vous et réessayez.") };
    return { error: null };
  } catch {
    return { error: new Error("Le mot de passe n'a pas pu être modifié.") };
  }
}

export async function issueEmailVerificationToken(email: string) {
  const normalized = normalizeEmail(email);
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { user: null, verificationToken: null };
  }

  const verificationToken = randomBytes(32).toString("base64url");
  return withTransaction(async client => {
    const result = await client.query<AuthUserRow>(
      `select id,email,raw_user_meta_data,email_confirmed_at,banned_until
       from auth.users
       where lower(email) = lower($1) and deleted_at is null
       limit 1
       for update`,
      [normalized]
    );
    const row = result.rows[0];
    if (!row || row.email_confirmed_at || (row.banned_until && new Date(row.banned_until).getTime() > Date.now())) {
      return { user: null, verificationToken: null };
    }
    await client.query(
      `update public.email_verification_tokens
       set consumed_at = coalesce(consumed_at, now())
       where user_id = $1 and consumed_at is null and expires_at <= now()`,
      [row.id]
    );
    await client.query(
      `update public.email_verification_tokens
       set consumed_at = coalesce(consumed_at, now())
       where id in (
         select id from public.email_verification_tokens
         where user_id = $1 and consumed_at is null and expires_at > now()
         order by created_at desc
         offset 2
       )`,
      [row.id]
    );
    await client.query(
      `insert into public.email_verification_tokens (user_id,token_hash,expires_at)
       values ($1,$2,now() + ($3 * interval '1 second'))`,
      [row.id, hashToken(verificationToken), EMAIL_VERIFICATION_TTL_SECONDS]
    );
    return { user: userFromRow(row), verificationToken };
  });
}

export async function beginEmailSignUp(input: { email: string; metadata?: Record<string, unknown> }) {
  const email = normalizeEmail(input.email);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { session: null, user: null, identities: [], verificationToken: null, error: new Error("Email invalide.") };
  }

  // No user-selected password is accepted before mailbox ownership has been
  // proven. The random, unrecoverable placeholder also keeps the expensive
  // password work on both branches so account existence is not trivially
  // exposed by timing.
  const encryptedPassword = await bcrypt.hash(randomBytes(32).toString("base64url"), 12);
  await query(
    `delete from auth.users
     where lower(email) = lower($1)
       and email_confirmed_at is null
       and created_at < now() - interval '7 days'`,
    [email]
  );
  const existing = await findUserByEmail(email);
  if (existing) {
    const verification = await issueEmailVerificationToken(email);
    return {
      session: null,
      user: userFromRow(existing),
      identities: [],
      verificationToken: verification.verificationToken,
      error: null
    };
  }

  const userId = randomUUID();
  const identityId = randomUUID();
  const metadata = normalizeMetadata(input.metadata);
  const verificationToken = randomBytes(32).toString("base64url");

  try {
    await withTransaction(async client => {
      await client.query(
        `insert into auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
        ) values (
          '00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, $3,
          '{"provider":"email","providers":["email"]}'::jsonb, $4::jsonb, now(), now(), false, false
        )`,
        [userId, email, encryptedPassword, JSON.stringify(metadata)]
      );
      await client.query(
        `insert into auth.identities (
          provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id
        ) values ($1, $2, $3::jsonb, 'email', now(), now(), now(), $4)`,
        [userId, userId, JSON.stringify({ sub: userId, email, email_verified: false, ...metadata }), identityId]
      );
      await client.query(
        `insert into public.profiles (id,email,nom,prenom,telephone,role,updated_at)
         values ($1,$2,$3,$4,$5,'etudiant',now())`,
        [userId, email, metadata.nom, metadata.prenom, metadata.telephone]
      );
      await client.query(
        `insert into public.email_verification_tokens (user_id,token_hash,expires_at)
         values ($1,$2,now() + ($3 * interval '1 second'))`,
        [userId, hashToken(verificationToken), EMAIL_VERIFICATION_TTL_SECONDS]
      );
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      const duplicate = await findUserByEmail(email);
      const verification = duplicate ? await issueEmailVerificationToken(email) : { verificationToken: null };
      return {
        session: null,
        user: duplicate ? userFromRow(duplicate) : null,
        identities: [],
        verificationToken: verification.verificationToken,
        error: null
      };
    }
    return { session: null, user: null, identities: [], verificationToken: null, error: new Error("Le compte n'a pas pu être créé.") };
  }

  const user: LocalUser = { id: userId, email, user_metadata: metadata };
  return {
    session: null,
    user,
    identities: [{ id: identityId, user_id: userId, provider: "email" }],
    verificationToken,
    error: null
  };
}

export async function verifyEmailToken(token: string, password: string, context: SessionContext = {}) {
  if (!token || token.length > 256) return { session: null, user: null, error: new Error("Lien de confirmation invalide ou expiré.") };
  try {
    validatePassword(password);
  } catch (error) {
    return { session: null, user: null, error: error as Error };
  }
  // Hash before reading the token so valid and invalid links both pay the same
  // dominant CPU cost and the plaintext password never enters a transaction.
  const encryptedPassword = await bcrypt.hash(password, 12);
  const user = await withTransaction(async client => {
    const candidate = await client.query<{ user_id: string }>(
      `select user_id
       from public.email_verification_tokens
       where token_hash = $1 and consumed_at is null and expires_at > now()
       limit 1`,
      [hashToken(token)]
    );
    if (!candidate.rows[0]) return null;
    await client.query("select id from auth.users where id = $1 for update", [candidate.rows[0].user_id]);
    const result = await client.query<AuthUserRow>(
      `select u.id,u.email,u.raw_user_meta_data,u.banned_until
       from public.email_verification_tokens t
       join auth.users u on u.id = t.user_id
       where t.token_hash = $1 and t.consumed_at is null and t.expires_at > now()
         and u.deleted_at is null and u.email_confirmed_at is null
         and (u.banned_until is null or u.banned_until <= now())
       for update of t`,
      [hashToken(token)]
    );
    const row = result.rows[0];
    if (!row) return null;
    await client.query(
      "update public.email_verification_tokens set consumed_at = coalesce(consumed_at, now()) where user_id = $1 and consumed_at is null",
      [row.id]
    );
    await client.query(
      `update auth.users
       set encrypted_password=$2,
           email_confirmed_at=coalesce(email_confirmed_at,now()),
           updated_at=now()
       where id=$1 and email_confirmed_at is null
         and (banned_until is null or banned_until <= now())`,
      [row.id, encryptedPassword]
    );
    await client.query(
      `update auth.identities
       set identity_data = jsonb_set(identity_data,'{email_verified}','true'::jsonb,true), updated_at=now()
       where user_id=$1 and provider='email'`,
      [row.id]
    );
    return userFromRow(row);
  });
  if (!user) return { session: null, user: null, error: new Error("Lien de confirmation invalide ou expiré.") };
  try {
    return { session: await createSession(user, context), user, error: null };
  } catch (error) {
    if (error instanceof SessionEligibilityError) {
      return { session: null, user: null, error: new Error("Lien de confirmation invalide ou expiré.") };
    }
    throw error;
  }
}

export function getRequestSessionToken(request: Request) {
  const authorization = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (authorization) return { token: authorization, viaCookie: false };
  const cookies = parseRequestCookies(request);
  const token = cookies.get(SECURE_SESSION_COOKIE_NAME) || cookies.get(SESSION_COOKIE_NAME) || "";
  return { token, viaCookie: Boolean(token) };
}

export function sessionContextFromRequest(request: Request): SessionContext {
  return {
    ip: getTrustedClientIp(request),
    userAgent: request.headers.get("user-agent") || undefined
  };
}

export async function deleteLocalUser(id: string) {
  await query("delete from auth.users where id = $1", [id]);
  return { data: { user: null }, error: null };
}
