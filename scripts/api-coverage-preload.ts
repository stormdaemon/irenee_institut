import { plugin } from "bun";
import { afterAll } from "bun:test";
import { createInstrumenter } from "istanbul-lib-instrument";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

plugin({
  name: "apostolos-http-route-coverage",
  setup(build) {
    build.onLoad({ filter: /[\\/]app[\\/].*[\\/]route\.ts$/ }, args => {
      const instrumenter = createInstrumenter({
        esModules: true,
        compact: false,
        preserveComments: true,
        parserPlugins: ["typescript"],
      });
      return { contents: instrumenter.instrumentSync(readFileSync(args.path, "utf8"), resolve(args.path)), loader: "ts" };
    });
  },
});

afterAll(() => {
  mkdirSync("coverage", { recursive: true });
  writeFileSync(process.env.API_COVERAGE_FILE || "coverage/api-coverage.json", JSON.stringify(
    (globalThis as typeof globalThis & { __coverage__?: unknown }).__coverage__ || {}
  ));
});
