import { expect, test } from "@playwright/test";

const flows = [
  { product: "annual-pass", page: "/formations", endpoint: "/api/payments/checkout", open: /Obtenir le pass annuel/i },
  { product: "library", page: "/bibliotheque-apologetique", endpoint: "/api/payments/library/checkout", open: /Adh[eé]rer pour 15/i }
];
for (const width of [1440, 390]) {
  test.describe(`Stripe custom Checkout at ${width}px`, () => {
    test.use({ storageState: { cookies: [], origins: [] }, viewport: { width, height: 900 } });
    for (const flow of flows) {
      for (const outcome of ["confirmed", "declined", "unavailable"] as const) {
        test(`${flow.product}: ${outcome} preserves a usable payment flow`, async ({ page }) => {
          let calls = 0;
          const user = { email: "student.checkout@example.test", id: "browser-checkout-student" };
          await page.route("**/api/auth/user", route => route.fulfill({ json: { user, session: { user, expires_at: 2000000000, token_type: "cookie" } } }));
          await page.route(`**${flow.endpoint}`, async route => {
            calls++;
            expect(route.request().method()).toBe("POST");
            expect(route.request().postDataJSON()).toEqual(flow.product === "annual-pass" ? { amount: "99", bookRequested: false, bookTitle: "" } : {});
            await route.fulfill({ status: outcome === "unavailable" ? 503 : 200, json: outcome === "unavailable"
              ? { ok: false, error: "Le paiement est momentanément indisponible." }
              : { ok: true, provider: "stripe", clientSecret: "cs_test_browser123_secret_simulated123", publishableKey: "pk_test_simulated123" } });
          });
          // Simulates the public SDK boundary; no provider account or real card is contacted.
          await page.route("https://js.stripe.com/basil/stripe.js", route => route.fulfill({ contentType: "application/javascript", body: `
            window.Stripe = function(key) {
              if (key !== 'pk_test_simulated123') throw new Error('Unexpected publishable key');
              return { initCheckout: async function(options) {
                if (await options.fetchClientSecret() !== 'cs_test_browser123_secret_simulated123') throw new Error('Unexpected session');
                return { createPaymentElement: function() { return {
                  mount: function(target) { target.innerHTML = '<div role="group" aria-label="Champs Stripe simulés">Formulaire sécurisé simulé</div>'; },
                  destroy: function() {}
                }; }, confirm: async function() {
                  ${outcome === "declined" ? "return { type: 'error', error: { message: 'Carte refusée pour ce test.' } };" : "window.location.assign('/checkout-confirmed-test'); return {};"}
                } };
              } };
            };
          ` }));
          await page.route("**/checkout-confirmed-test", route => route.fulfill({ contentType: "text/html", body: '<html lang="fr"><title>Confirmation simulée</title><h1>Paiement simulé confirmé</h1></html>' }));
          await page.goto(flow.page);
          await page.getByRole("button", { name: flow.open }).click();
          const dialog = page.getByRole("dialog");
          await expect(dialog).toBeInViewport();
          expect(calls).toBe(0);
          await dialog.getByRole("button", { name: "Continuer vers le paiement" }).click();
          if (outcome === "unavailable") {
            await expect(dialog.getByRole("alert")).toHaveText("Le paiement est momentanément indisponible.");
            await expect(dialog.getByRole("button", { name: "Continuer vers le paiement" })).toBeEnabled();
          } else {
            await expect(dialog.getByRole("group", { name: "Champs Stripe simulés" })).toBeVisible();
            const pay = dialog.getByRole("button", { name: /^Payer/ });
            await expect(pay).toBeEnabled();
            await pay.click();
            if (outcome === "declined") {
              await expect(dialog.getByRole("alert")).toHaveText("Carte refusée pour ce test.");
              await expect(pay).toBeEnabled();
            } else {
              await expect(page).toHaveTitle("Confirmation simulée");
            }
          }
          expect(calls).toBe(1);
        });
      }
    }
  });
}
