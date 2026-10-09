import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { getPool, withTransaction } from "../lib/db";
import { validatePassword } from "../lib/local-auth";

// A private JSON file avoids putting credentials in arguments or console logs.
const filename = process.argv[2];
if (!filename) throw new Error("A private administrator JSON file is required.");
const input = JSON.parse(readFileSync(filename, "utf8"));
const email = String(input.email || "").trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid administrator email.");
const password = validatePassword(String(input.password || ""));
const encrypted = await bcrypt.hash(password, 12);
try {
  await withTransaction(async client => {
    await client.query("select pg_advisory_xact_lock(hashtextextended('apostolos:first-administrator',0))");
    const existing = await client.query("select id from public.profiles where role='directeur' limit 1");
    if (existing.rowCount) throw new Error("An administrator already exists. Bootstrap refuses to change existing access.");
    const id = randomUUID();
    const metadata = { prenom: "Administration", nom: "Apostolos" };
    await client.query(`insert into auth.users
      (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
      values ($1,'authenticated','authenticated',$2,$3,now(),'{"provider":"email","providers":["email"]}', $4::jsonb,now(),now())`,
    [id,email,encrypted,JSON.stringify(metadata)]);
    await client.query(`insert into auth.identities (provider_id,user_id,identity_data,provider,created_at,updated_at)
      values ($1::text,$1::uuid,$2::jsonb,'email',now(),now())`,[id,JSON.stringify({sub:id,email,email_verified:true,...metadata})]);
    await client.query(`insert into public.profiles (id,email,prenom,nom,role,statut_inscription)
      values ($1,$2,'Administration','Apostolos','directeur','valide')`,[id,email]);
  });
  console.log("First administrator created; credentials were not written to logs.");
} finally { await getPool().end(); }
