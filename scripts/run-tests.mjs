const explicitTestUrl = process.env.TEST_DATABASE_URL || "";
const configuredUrl = explicitTestUrl || process.env.DATABASE_URL || "";

if (!configuredUrl) {
  throw new Error("TEST_DATABASE_URL is required to run the test suite safely.");
}

const databaseUrl = new URL(configuredUrl);
if (!explicitTestUrl) {
  if (!["127.0.0.1", "localhost", "::1"].includes(databaseUrl.hostname)) {
    throw new Error("Refusing to derive a test database from a non-local DATABASE_URL. Set TEST_DATABASE_URL explicitly.");
  }
  databaseUrl.pathname = "/irenee_security_test";
}

if (!/security_test/i.test(databaseUrl.pathname)) {
  throw new Error("Refusing to run destructive tests: the database name must contain security_test.");
}

const requestedTests = process.argv.slice(2);
const child = Bun.spawn([
  process.execPath,
  "test",
  "--timeout",
  "20000",
  ...(requestedTests.length ? requestedTests : ["lib"])
], {
  env: { ...process.env, DATABASE_URL: databaseUrl.toString() },
  stderr: "inherit",
  stdout: "inherit"
});

process.exit(await child.exited);
