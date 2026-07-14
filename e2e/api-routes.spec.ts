import { expect, test, type APIRequestContext } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

type HttpMethod = "DELETE" | "GET" | "PATCH" | "POST";

type ApiRouteCase = {
  data?: unknown;
  expectedStatus: number;
  method: HttpMethod;
  path: string;
  source: string;
  crossSite?: boolean;
};

const missingUuid = "00000000-0000-0000-0000-000000000000";

// Keep this list explicit. The inventory test below fails whenever a route
// file or exported HTTP handler is added without a corresponding safe probe.
const apiRoutes: ApiRouteCase[] = [
  { source: "app/api/admin/access/route.ts", method: "GET", path: "/api/admin/access", expectedStatus: 401 },
  { source: "app/api/admin/live/route.ts", method: "GET", path: "/api/admin/live", expectedStatus: 401 },
  { source: "app/api/admin/live/route.ts", method: "POST", path: "/api/admin/live", expectedStatus: 401 },
  { source: "app/api/admin/live/[id]/route.ts", method: "PATCH", path: `/api/admin/live/${missingUuid}`, expectedStatus: 401 },

  { source: "app/api/auth/login/route.ts", method: "POST", path: "/api/auth/login", expectedStatus: 403, crossSite: true },
  { source: "app/api/auth/logout/route.ts", method: "POST", path: "/api/auth/logout", expectedStatus: 200 },
  { source: "app/api/auth/password/reset/complete/route.ts", method: "POST", path: "/api/auth/password/reset/complete", expectedStatus: 403, crossSite: true },
  { source: "app/api/auth/password/reset/request/route.ts", method: "POST", path: "/api/auth/password/reset/request", expectedStatus: 403, crossSite: true },
  { source: "app/api/auth/password/route.ts", method: "POST", path: "/api/auth/password", expectedStatus: 401 },
  { source: "app/api/auth/profile/route.ts", method: "GET", path: "/api/auth/profile", expectedStatus: 401 },
  { source: "app/api/auth/session/route.ts", method: "POST", path: "/api/auth/session", expectedStatus: 401 },
  { source: "app/api/auth/signup/route.ts", method: "POST", path: "/api/auth/signup", expectedStatus: 403, crossSite: true },
  { source: "app/api/auth/user/route.ts", method: "GET", path: "/api/auth/user", expectedStatus: 401 },
  { source: "app/api/auth/verification/resend/route.ts", method: "POST", path: "/api/auth/verification/resend", expectedStatus: 403, crossSite: true },
  { source: "app/api/auth/verify/route.ts", method: "POST", path: "/api/auth/verify", expectedStatus: 403, crossSite: true },

  { source: "app/api/automation/annual-pass-emails/route.ts", method: "GET", path: "/api/automation/annual-pass-emails", expectedStatus: 401 },
  { source: "app/api/automation/annual-pass-emails/route.ts", method: "POST", path: "/api/automation/annual-pass-emails", expectedStatus: 401 },
  { source: "app/api/automation/annual-pass-reminders/route.ts", method: "GET", path: "/api/automation/annual-pass-reminders", expectedStatus: 401 },
  { source: "app/api/automation/annual-pass-reminders/route.ts", method: "POST", path: "/api/automation/annual-pass-reminders", expectedStatus: 401 },
  { source: "app/api/automation/learning-documents/route.ts", method: "GET", path: "/api/automation/learning-documents", expectedStatus: 401 },
  { source: "app/api/automation/learning-documents/route.ts", method: "POST", path: "/api/automation/learning-documents", expectedStatus: 401 },

  { source: "app/api/avatars/[id]/route.ts", method: "GET", path: `/api/avatars/${missingUuid}`, expectedStatus: 404 },
  { source: "app/api/book-requests/[id]/route.ts", method: "PATCH", path: `/api/book-requests/${missingUuid}`, expectedStatus: 401 },
  { source: "app/api/contact/route.ts", method: "POST", path: "/api/contact", expectedStatus: 403, crossSite: true },
  { source: "app/api/courses/[id]/route.ts", method: "PATCH", path: `/api/courses/${missingUuid}`, expectedStatus: 401 },
  { source: "app/api/courses/route.ts", method: "GET", path: "/api/courses", expectedStatus: 401 },
  { source: "app/api/courses/route.ts", method: "POST", path: "/api/courses", expectedStatus: 401 },
  { source: "app/api/documents/[id]/route.ts", method: "GET", path: `/api/documents/${missingUuid}`, expectedStatus: 401 },
  { source: "app/api/documents/verify/route.ts", method: "POST", path: "/api/documents/verify", expectedStatus: 403, crossSite: true },
  { source: "app/api/download/google-apps-script/route.ts", method: "POST", path: "/api/download/google-apps-script", expectedStatus: 401 },
  { source: "app/api/final-exam/route.ts", method: "GET", path: "/api/final-exam", expectedStatus: 401 },
  { source: "app/api/final-exam/route.ts", method: "POST", path: "/api/final-exam", expectedStatus: 401 },
  { source: "app/api/homework/[id]/route.ts", method: "PATCH", path: `/api/homework/${missingUuid}`, expectedStatus: 401 },
  { source: "app/api/homework/route.ts", method: "GET", path: "/api/homework", expectedStatus: 401 },
  { source: "app/api/homework/route.ts", method: "POST", path: "/api/homework", expectedStatus: 401 },
  { source: "app/api/inscription/route.ts", method: "POST", path: "/api/inscription", expectedStatus: 401 },
  {
    source: "app/api/learning/courses/[slug]/modules/[moduleId]/route.ts",
    method: "GET",
    path: `/api/learning/courses/missing-api-contract-course/modules/${missingUuid}`,
    expectedStatus: 401
  },
  { source: "app/api/learning/courses/[slug]/route.ts", method: "GET", path: "/api/learning/courses/missing-api-contract-course", expectedStatus: 401 },
  { source: "app/api/library/book-requests/route.ts", method: "POST", path: "/api/library/book-requests", expectedStatus: 401 },
  { source: "app/api/live/[id]/route.ts", method: "POST", path: `/api/live/${missingUuid}`, expectedStatus: 401 },
  { source: "app/api/live/route.ts", method: "GET", path: "/api/live", expectedStatus: 401 },
  { source: "app/api/me/route.ts", method: "GET", path: "/api/me", expectedStatus: 401 },
  { source: "app/api/onboarding/complete/route.ts", method: "POST", path: "/api/onboarding/complete", expectedStatus: 401 },
  { source: "app/api/onboarding/status/route.ts", method: "GET", path: "/api/onboarding/status", expectedStatus: 401 },
  { source: "app/api/payments/[id]/route.ts", method: "PATCH", path: `/api/payments/${missingUuid}`, expectedStatus: 401 },
  { source: "app/api/payments/checkout/route.ts", method: "POST", path: "/api/payments/checkout", expectedStatus: 401 },
  { source: "app/api/payments/library/checkout/route.ts", method: "POST", path: "/api/payments/library/checkout", expectedStatus: 401 },
  { source: "app/api/payments/paypal/test/route.ts", method: "GET", path: "/api/payments/paypal/test", expectedStatus: 401 },
  { source: "app/api/payments/stripe/reconcile/route.ts", method: "POST", path: "/api/payments/stripe/reconcile", expectedStatus: 403, crossSite: true },
  { source: "app/api/payments/stripe/test/route.ts", method: "GET", path: "/api/payments/stripe/test", expectedStatus: 401 },
  { source: "app/api/profile/avatar/route.ts", method: "POST", path: "/api/profile/avatar", expectedStatus: 401 },
  { source: "app/api/progress/update/route.ts", method: "POST", path: "/api/progress/update", expectedStatus: 401 },
  { source: "app/api/settings/route.ts", method: "GET", path: "/api/settings", expectedStatus: 401 },
  { source: "app/api/settings/route.ts", method: "POST", path: "/api/settings", expectedStatus: 401 },
  { source: "app/api/users/[id]/route.ts", method: "DELETE", path: `/api/users/${missingUuid}`, expectedStatus: 401 },
  { source: "app/api/users/route.ts", method: "GET", path: "/api/users", expectedStatus: 401 },
  { source: "app/api/users/route.ts", method: "PATCH", path: "/api/users", expectedStatus: 401 },

  { source: "app/paypal_checkout_valid/route.ts", method: "GET", path: "/paypal_checkout_valid", expectedStatus: 200 },
  { source: "app/paypal_checkout_valid/route.ts", method: "POST", path: "/paypal_checkout_valid", data: {}, expectedStatus: 401 },
  { source: "app/stripe_webhook/route.ts", method: "GET", path: "/stripe_webhook", expectedStatus: 200 },
  { source: "app/stripe_webhook/route.ts", method: "POST", path: "/stripe_webhook", data: {}, expectedStatus: 401 },
  { source: "app/stripe_webhook_lite/route.ts", method: "GET", path: "/stripe_webhook_lite", expectedStatus: 200 },
  { source: "app/stripe_webhook_lite/route.ts", method: "POST", path: "/stripe_webhook_lite", data: {}, expectedStatus: 401 }
];

function routeFilesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return routeFilesUnder(path);
    if (!entry.isFile() || entry.name !== "route.ts") return [];
    return [relative(process.cwd(), path).split(sep).join("/")];
  });
}

function exportedHandlers(sourceFile: string) {
  const source = readFileSync(resolve(process.cwd(), sourceFile), "utf8");
  const methods = new Set<string>();
  const patterns = [
    /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(/g,
    /export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*=/g
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) methods.add(match[1]);
  }
  return [...methods].map(method => `${sourceFile}#${method}`);
}

async function probe(request: APIRequestContext, route: ApiRouteCase) {
  const headers = route.crossSite
    ? { Origin: "https://cross-site.invalid", "Sec-Fetch-Site": "cross-site" }
    : undefined;
  return request.fetch(route.path, {
    data: route.data,
    failOnStatusCode: false,
    headers,
    method: route.method
  });
}

test.describe("API route inventory and anonymous safety contracts", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the explicit matrix covers all 51 route files and all 63 exported handlers", () => {
    const expectedFiles = [...new Set(apiRoutes.map(route => route.source))].sort();
    const actualFiles = routeFilesUnder(resolve(process.cwd(), "app")).sort();
    const expectedHandlers = apiRoutes.map(route => `${route.source}#${route.method}`).sort();
    const actualHandlers = actualFiles.flatMap(exportedHandlers).sort();

    expect(expectedFiles).toHaveLength(51);
    expect(apiRoutes).toHaveLength(63);
    expect(actualFiles).toEqual(expectedFiles);
    expect(actualHandlers).toEqual(expectedHandlers);
  });

  for (const route of apiRoutes) {
    test(`${route.method} ${route.path} rejects the safe anonymous/invalid probe as expected`, async ({ request }) => {
      const response = await probe(request, route);
      const contentType = response.headers()["content-type"] || "";

      expect(response.status()).toBe(route.expectedStatus);
      expect(contentType).toContain("application/json");
    });
  }
});
