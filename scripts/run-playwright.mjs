import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function loadLocalEnv() {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadLocalEnv();

const explicitTestUrl = process.env.TEST_DATABASE_URL || "";
const configuredUrl = explicitTestUrl || process.env.DATABASE_URL || "";

if (!configuredUrl) {
  throw new Error("TEST_DATABASE_URL is required to run browser tests safely.");
}

const databaseUrl = new URL(configuredUrl);
const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);

if (!explicitTestUrl) {
  if (!localHosts.has(databaseUrl.hostname)) {
    throw new Error("Refusing to derive a browser-test database from a non-local DATABASE_URL.");
  }
  databaseUrl.pathname = "/irenee_security_test";
}

if (!localHosts.has(databaseUrl.hostname) || !/security_test/i.test(databaseUrl.pathname)) {
  throw new Error("Refusing browser tests: DATABASE_URL must be a local security_test database.");
}

const port = Number(process.env.E2E_PORT || 3101);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("E2E_PORT must be an unprivileged TCP port.");
}

const baseUrl = new URL(process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`);
if (!localHosts.has(baseUrl.hostname) || !["http:", "https:"].includes(baseUrl.protocol)) {
  throw new Error("Refusing browser tests against a non-local application URL.");
}

const childEnv = {
  ...process.env,
  AUTH_COOKIE_SECURE: "false",
  DATABASE_URL: databaseUrl.toString(),
  E2E_BASE_URL: baseUrl.toString().replace(/\/$/, ""),
  E2E_PORT: String(port),
  LOCAL_AUTH_JWT_SECRET: process.env.E2E_JWT_SECRET || "irenee-e2e-browser-tests-only-2026-change-me-never-production",
  TEST_DATABASE_URL: databaseUrl.toString()
};

if (process.env.E2E_SKIP_BUILD !== "true") {
  const build = Bun.spawn(["bunx", "next", "build"], {
    env: childEnv,
    stderr: "inherit",
    stdout: "inherit"
  });
  const buildExitCode = await build.exited;
  if (buildExitCode !== 0) process.exit(buildExitCode);
}

const child = Bun.spawn(["bunx", "playwright", "test", ...process.argv.slice(2)], {
  env: childEnv,
  stderr: "inherit",
  stdout: "inherit"
});

process.exit(await child.exited);
