import { createHash, createHmac, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { Pool } from "pg";

export const E2E_DIRECTOR_EMAIL = "qa-director@irenee.test";

function isolatedDatabaseUrl() {
  const databaseUrl = new URL(process.env.DATABASE_URL || "");
  if (!/security_test/i.test(databaseUrl.pathname) || !["127.0.0.1", "localhost", "::1"].includes(databaseUrl.hostname)) {
    throw new Error("E2E setup refused: expected a local security_test database.");
  }
  return databaseUrl.toString();
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function createSessionToken(userId: string, email: string) {
  const secret = process.env.LOCAL_AUTH_JWT_SECRET || "";
  if (secret.length < 32) throw new Error("E2E setup requires a 32+ character LOCAL_AUTH_JWT_SECRET.");
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 60 * 60;
  const sessionId = randomUUID();
  const protectedHeader = base64UrlJson({ alg: "HS256", typ: "JWT" });
  const payload = base64UrlJson({
    aud: "irenee-web",
    email,
    exp: expiresAt,
    iat: now,
    iss: "https://irenee-institut.org",
    jti: sessionId,
    nbf: now - 5,
    role: "authenticated",
    sub: userId
  });
  const unsigned = `${protectedHeader}.${payload}`;
  const signature = createHmac("sha256", secret).update(unsigned).digest("base64url");
  return { expiresAt, sessionId, token: `${unsigned}.${signature}` };
}

export default async function globalSetup() {
  const pool = new Pool({ connectionString: isolatedDatabaseUrl(), max: 1 });
  const client = await pool.connect();
  const userId = randomUUID();
  const identityId = randomUUID();
  const session = createSessionToken(userId, E2E_DIRECTOR_EMAIL);

  try {
    await client.query("begin");
    await client.query("delete from auth.users where lower(email) = lower($1)", [E2E_DIRECTOR_EMAIL]);
    await client.query(
      `insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
      ) values (
        '00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, '', now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"nom":"Visuel","prenom":"QA"}'::jsonb, now(), now(), false, false
      )`,
      [userId, E2E_DIRECTOR_EMAIL]
    );
    await client.query(
      `insert into auth.identities (
        provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id
      ) values ($1, $2, $3::jsonb, 'email', now(), now(), now(), $4)`,
      [userId, userId, JSON.stringify({ sub: userId, email: E2E_DIRECTOR_EMAIL, email_verified: true }), identityId]
    );
    await client.query(
      `insert into public.profiles (id,email,nom,prenom,role,updated_at)
       values ($1,$2,'Visuel','QA','directeur',now())`,
      [userId, E2E_DIRECTOR_EMAIL]
    );
    await client.query(
      `insert into public.app_sessions (id,user_id,token_hash,expires_at,ip_hash,user_agent_hash)
       values ($1,$2,$3,to_timestamp($4),null,null)`,
      [session.sessionId, userId, createHash("sha256").update(session.token).digest("hex"), session.expiresAt]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  await mkdir("e2e/.auth", { recursive: true });
  await writeFile("e2e/.auth/director.json", JSON.stringify({
    cookies: [{
      name: "irenee_session",
      value: session.token,
      domain: "127.0.0.1",
      path: "/",
      expires: session.expiresAt,
      httpOnly: true,
      secure: false,
      sameSite: "Lax"
    }],
    origins: []
  }, null, 2));
}
