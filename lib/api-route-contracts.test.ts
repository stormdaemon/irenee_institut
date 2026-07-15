import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import test from "node:test";
import * as adminAccess from "@/app/api/admin/access/route";
import * as adminLiveById from "@/app/api/admin/live/[id]/route";
import * as adminLive from "@/app/api/admin/live/route";
import * as authLogin from "@/app/api/auth/login/route";
import * as authLogout from "@/app/api/auth/logout/route";
import * as authPasswordResetComplete from "@/app/api/auth/password/reset/complete/route";
import * as authPasswordResetRequest from "@/app/api/auth/password/reset/request/route";
import * as authPassword from "@/app/api/auth/password/route";
import * as authProfile from "@/app/api/auth/profile/route";
import * as authSession from "@/app/api/auth/session/route";
import * as authSignup from "@/app/api/auth/signup/route";
import * as authUser from "@/app/api/auth/user/route";
import * as authVerificationResend from "@/app/api/auth/verification/resend/route";
import * as authVerify from "@/app/api/auth/verify/route";
import * as annualPassEmails from "@/app/api/automation/annual-pass-emails/route";
import * as annualPassReminders from "@/app/api/automation/annual-pass-reminders/route";
import * as annualPassWeekly from "@/app/api/automation/annual-pass-weekly/route";
import * as automationLearningDocuments from "@/app/api/automation/learning-documents/route";
import * as avatarById from "@/app/api/avatars/[id]/route";
import * as bookRequestById from "@/app/api/book-requests/[id]/route";
import * as contact from "@/app/api/contact/route";
import * as courseById from "@/app/api/courses/[id]/route";
import * as courses from "@/app/api/courses/route";
import * as documentById from "@/app/api/documents/[id]/route";
import * as documentVerify from "@/app/api/documents/verify/route";
import * as appsScriptPartage from "@/app/api/download/apps-script-partage/route";
import * as googleAppsScriptDownload from "@/app/api/download/google-apps-script/route";
import * as emailsDesinscription from "@/app/api/emails/desinscription/route";
import * as finalExam from "@/app/api/final-exam/route";
import * as homeworkById from "@/app/api/homework/[id]/route";
import * as homework from "@/app/api/homework/route";
import * as inscription from "@/app/api/inscription/route";
import * as learningModule from "@/app/api/learning/courses/[slug]/modules/[moduleId]/route";
import * as learningCourse from "@/app/api/learning/courses/[slug]/route";
import * as libraryBookRequests from "@/app/api/library/book-requests/route";
import * as liveById from "@/app/api/live/[id]/route";
import * as live from "@/app/api/live/route";
import * as me from "@/app/api/me/route";
import * as onboardingComplete from "@/app/api/onboarding/complete/route";
import * as onboardingStatus from "@/app/api/onboarding/status/route";
import * as paymentById from "@/app/api/payments/[id]/route";
import * as paymentCheckout from "@/app/api/payments/checkout/route";
import * as paymentLibraryCheckout from "@/app/api/payments/library/checkout/route";
import * as paymentPayPalTest from "@/app/api/payments/paypal/test/route";
import * as paymentStripeReconcile from "@/app/api/payments/stripe/reconcile/route";
import * as paymentStripeTest from "@/app/api/payments/stripe/test/route";
import * as profileAvatar from "@/app/api/profile/avatar/route";
import * as progressUpdate from "@/app/api/progress/update/route";
import * as settings from "@/app/api/settings/route";
import * as userById from "@/app/api/users/[id]/route";
import * as users from "@/app/api/users/route";
import * as paypalWebhook from "@/app/paypal_checkout_valid/route";
import * as stripeWebhook from "@/app/stripe_webhook/route";
import * as stripeWebhookLite from "@/app/stripe_webhook_lite/route";
import { query } from "@/lib/db";

type HttpMethod = "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT";
type RouteHandler = (...args: any[]) => Promise<Response | undefined> | Response | undefined;
type ContractCase = {
  expectedStatus: number;
  handler: RouteHandler;
  method: HttpMethod;
  params?: Record<string, string>;
  pathname: string;
  routeFile: string;
};

const routeHandlerPattern = /\bexport\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\(|\bexport\s+const\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*=/g;

function contract(
  routeFile: string,
  method: HttpMethod,
  handler: RouteHandler,
  pathname: string,
  expectedStatus: number,
  params?: Record<string, string>
): ContractCase {
  return { expectedStatus, handler, method, params, pathname, routeFile };
}

const cases: ContractCase[] = [
  contract("app/api/admin/access/route.ts", "GET", adminAccess.GET, "/api/admin/access", 401),
  contract("app/api/admin/live/[id]/route.ts", "PATCH", adminLiveById.PATCH, "/api/admin/live/not-a-uuid", 401, { id: "not-a-uuid" }),
  contract("app/api/admin/live/route.ts", "GET", adminLive.GET, "/api/admin/live", 401),
  contract("app/api/admin/live/route.ts", "POST", adminLive.POST, "/api/admin/live", 401),
  contract("app/api/auth/login/route.ts", "POST", authLogin.POST, "/api/auth/login", 403),
  contract("app/api/auth/logout/route.ts", "POST", authLogout.POST, "/api/auth/logout", 200),
  contract("app/api/auth/password/reset/complete/route.ts", "POST", authPasswordResetComplete.POST, "/api/auth/password/reset/complete", 403),
  contract("app/api/auth/password/reset/request/route.ts", "POST", authPasswordResetRequest.POST, "/api/auth/password/reset/request", 403),
  contract("app/api/auth/password/route.ts", "POST", authPassword.POST, "/api/auth/password", 401),
  contract("app/api/auth/profile/route.ts", "GET", authProfile.GET, "/api/auth/profile", 401),
  contract("app/api/auth/session/route.ts", "POST", authSession.POST, "/api/auth/session", 401),
  contract("app/api/auth/signup/route.ts", "POST", authSignup.POST, "/api/auth/signup", 403),
  contract("app/api/auth/user/route.ts", "GET", authUser.GET, "/api/auth/user", 401),
  contract("app/api/auth/verification/resend/route.ts", "POST", authVerificationResend.POST, "/api/auth/verification/resend", 403),
  contract("app/api/auth/verify/route.ts", "POST", authVerify.POST, "/api/auth/verify", 403),
  contract("app/api/automation/annual-pass-emails/route.ts", "GET", annualPassEmails.GET, "/api/automation/annual-pass-emails", 401),
  contract("app/api/automation/annual-pass-emails/route.ts", "POST", annualPassEmails.POST, "/api/automation/annual-pass-emails", 401),
  contract("app/api/automation/annual-pass-reminders/route.ts", "GET", annualPassReminders.GET, "/api/automation/annual-pass-reminders", 401),
  contract("app/api/automation/annual-pass-reminders/route.ts", "POST", annualPassReminders.POST, "/api/automation/annual-pass-reminders", 401),
  contract("app/api/automation/annual-pass-weekly/route.ts", "GET", annualPassWeekly.GET, "/api/automation/annual-pass-weekly", 401),
  contract("app/api/automation/annual-pass-weekly/route.ts", "POST", annualPassWeekly.POST, "/api/automation/annual-pass-weekly", 401),
  contract("app/api/automation/learning-documents/route.ts", "GET", automationLearningDocuments.GET, "/api/automation/learning-documents", 401),
  contract("app/api/automation/learning-documents/route.ts", "POST", automationLearningDocuments.POST, "/api/automation/learning-documents", 401),
  contract("app/api/avatars/[id]/route.ts", "GET", avatarById.GET, "/api/avatars/not-a-uuid", 404, { id: "not-a-uuid" }),
  contract("app/api/book-requests/[id]/route.ts", "PATCH", bookRequestById.PATCH, "/api/book-requests/not-a-uuid", 401, { id: "not-a-uuid" }),
  contract("app/api/contact/route.ts", "POST", contact.POST, "/api/contact", 403),
  contract("app/api/courses/[id]/route.ts", "PATCH", courseById.PATCH, "/api/courses/not-a-uuid", 401, { id: "not-a-uuid" }),
  contract("app/api/courses/route.ts", "GET", courses.GET, "/api/courses", 401),
  contract("app/api/courses/route.ts", "POST", courses.POST, "/api/courses", 401),
  contract("app/api/documents/[id]/route.ts", "GET", documentById.GET, "/api/documents/not-a-uuid", 401, { id: "not-a-uuid" }),
  contract("app/api/documents/verify/route.ts", "POST", documentVerify.POST, "/api/documents/verify", 403),
  contract("app/api/download/apps-script-partage/route.ts", "GET", appsScriptPartage.GET, "/api/download/apps-script-partage", 401),
  contract("app/api/download/google-apps-script/route.ts", "POST", googleAppsScriptDownload.POST, "/api/download/google-apps-script", 401),
  contract("app/api/emails/desinscription/route.ts", "GET", emailsDesinscription.GET, "/api/emails/desinscription", 400),
  contract("app/api/final-exam/route.ts", "GET", finalExam.GET, "/api/final-exam", 401),
  contract("app/api/final-exam/route.ts", "POST", finalExam.POST, "/api/final-exam", 401),
  contract("app/api/homework/[id]/route.ts", "PATCH", homeworkById.PATCH, "/api/homework/not-a-uuid", 401, { id: "not-a-uuid" }),
  contract("app/api/homework/route.ts", "GET", homework.GET, "/api/homework", 401),
  contract("app/api/homework/route.ts", "POST", homework.POST, "/api/homework", 401),
  contract("app/api/inscription/route.ts", "POST", inscription.POST, "/api/inscription", 401),
  contract("app/api/learning/courses/[slug]/modules/[moduleId]/route.ts", "GET", learningModule.GET, "/api/learning/courses/missing/modules/not-a-uuid", 401, { moduleId: "not-a-uuid", slug: "missing" }),
  contract("app/api/learning/courses/[slug]/route.ts", "GET", learningCourse.GET, "/api/learning/courses/missing", 401, { slug: "missing" }),
  contract("app/api/library/book-requests/route.ts", "POST", libraryBookRequests.POST, "/api/library/book-requests", 401),
  contract("app/api/live/[id]/route.ts", "POST", liveById.POST, "/api/live/not-a-uuid", 401, { id: "not-a-uuid" }),
  contract("app/api/live/route.ts", "GET", live.GET, "/api/live", 401),
  contract("app/api/me/route.ts", "GET", me.GET, "/api/me", 401),
  contract("app/api/onboarding/complete/route.ts", "POST", onboardingComplete.POST, "/api/onboarding/complete", 401),
  contract("app/api/onboarding/status/route.ts", "GET", onboardingStatus.GET, "/api/onboarding/status", 401),
  contract("app/api/payments/[id]/route.ts", "PATCH", paymentById.PATCH, "/api/payments/not-a-uuid", 401, { id: "not-a-uuid" }),
  contract("app/api/payments/checkout/route.ts", "POST", paymentCheckout.POST, "/api/payments/checkout", 401),
  contract("app/api/payments/library/checkout/route.ts", "POST", paymentLibraryCheckout.POST, "/api/payments/library/checkout", 401),
  contract("app/api/payments/paypal/test/route.ts", "GET", paymentPayPalTest.GET, "/api/payments/paypal/test", 401),
  contract("app/api/payments/stripe/reconcile/route.ts", "POST", paymentStripeReconcile.POST, "/api/payments/stripe/reconcile", 403),
  contract("app/api/payments/stripe/test/route.ts", "GET", paymentStripeTest.GET, "/api/payments/stripe/test", 401),
  contract("app/api/profile/avatar/route.ts", "POST", profileAvatar.POST, "/api/profile/avatar", 401),
  contract("app/api/progress/update/route.ts", "POST", progressUpdate.POST, "/api/progress/update", 401),
  contract("app/api/settings/route.ts", "GET", settings.GET, "/api/settings", 401),
  contract("app/api/settings/route.ts", "POST", settings.POST, "/api/settings", 401),
  contract("app/api/users/[id]/route.ts", "DELETE", userById.DELETE, "/api/users/not-a-uuid", 401, { id: "not-a-uuid" }),
  contract("app/api/users/route.ts", "GET", users.GET, "/api/users", 401),
  contract("app/api/users/route.ts", "PATCH", users.PATCH, "/api/users", 401),
  contract("app/paypal_checkout_valid/route.ts", "GET", paypalWebhook.GET, "/paypal_checkout_valid", 200),
  contract("app/paypal_checkout_valid/route.ts", "POST", paypalWebhook.POST, "/paypal_checkout_valid", 401),
  contract("app/stripe_webhook/route.ts", "GET", stripeWebhook.GET, "/stripe_webhook", 200),
  contract("app/stripe_webhook/route.ts", "POST", stripeWebhook.POST, "/stripe_webhook", 401),
  contract("app/stripe_webhook_lite/route.ts", "GET", stripeWebhookLite.GET, "/stripe_webhook_lite", 200),
  contract("app/stripe_webhook_lite/route.ts", "POST", stripeWebhookLite.POST, "/stripe_webhook_lite", 401)
];

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return /^route\.(?:[cm]?[jt]sx?)$/.test(entry.name) ? [path] : [];
  });
}

function discoveredHandlerKeys() {
  return routeFiles(join(process.cwd(), "app")).flatMap(path => {
    const routeFile = relative(process.cwd(), path).split(sep).join("/");
    const source = readFileSync(path, "utf8");
    return [...source.matchAll(routeHandlerPattern)].map(match => `${routeFile}#${match[1] || match[2]}`);
  }).sort();
}

test("every HTTP route handler has a side-effect-free anonymous contract", async () => {
  const database = await query<{ name: string }>("select current_database() as name");
  assert.match(database.rows[0]?.name || "", /security_test/i, "route contracts require the isolated security_test database");

  const discovered = discoveredHandlerKeys();
  const manifest = cases.map(item => `${item.routeFile}#${item.method}`).sort();
  assert.equal(routeFiles(join(process.cwd(), "app")).length, 54, "the route-file inventory changed");
  assert.equal(discovered.length, 67, "the route-handler inventory changed");
  assert.equal(new Set(manifest).size, manifest.length, "the route contract manifest contains a duplicate");
  assert.deepEqual(manifest, discovered, "every exported route handler must have an explicit contract case");

  const originalFetch = globalThis.fetch;
  const failures: string[] = [];
  globalThis.fetch = (async input => {
    const target = typeof input === "string" || input instanceof URL ? String(input) : input.url;
    throw new Error(`Unexpected network request from route contract: ${target}`);
  }) as typeof fetch;

  try {
    for (const item of cases) {
      try {
        const request = new Request(new URL(item.pathname, "https://irenee.test"), { method: item.method });
        const response = await item.handler(request, { params: Promise.resolve(item.params || {}) });
        assert.ok(response instanceof Response, `${item.routeFile}#${item.method} did not return a Response`);
        assert.equal(response.status, item.expectedStatus, `${item.routeFile}#${item.method}`);
      } catch (error) {
        failures.push(`${item.routeFile}#${item.method}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(failures, [], failures.join("\n"));
});
