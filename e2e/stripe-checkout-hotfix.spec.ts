import { expect, test, type Page } from "@playwright/test";

type CheckoutFlow = {
  checkoutUrl: string;
  endpoint: string;
  openButton: RegExp;
  pagePath: string;
  product: "annual-pass" | "library-membership";
};

const flows: CheckoutFlow[] = [
  {
    checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_e2e_annual_pass",
    endpoint: "/api/payments/checkout",
    openButton: /Obtenir le pass annuel/i,
    pagePath: "/formations",
    product: "annual-pass"
  },
  {
    checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_e2e_library",
    endpoint: "/api/payments/library/checkout",
    openButton: /Adh[eé]rer pour 15/i,
    pagePath: "/bibliotheque-apologetique",
    product: "library-membership"
  }
];

async function exerciseHostedCheckout(page: Page, flow: CheckoutFlow) {
  const user = {
    email: "student.checkout@example.test",
    id: "browser-checkout-student"
  };
  let checkoutCalls = 0;

  await page.route("**/api/auth/user", async route => {
    await route.fulfill({
      body: JSON.stringify({
        session: {
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: "cookie",
          user
        },
        user
      }),
      contentType: "application/json",
      status: 200
    });
  });

  await page.route(`**${flow.endpoint}`, async route => {
    checkoutCalls += 1;
    expect(route.request().method()).toBe("POST");

    const rawBody = route.request().postData();
    const body = rawBody ? JSON.parse(rawBody) as Record<string, unknown> : {};
    if (flow.product === "annual-pass") {
      expect(body).toEqual({ amount: "99", bookRequested: false, bookTitle: "" });
    } else {
      expect(body).toEqual({});
    }

    await route.fulfill({
      body: JSON.stringify({
        checkoutUrl: flow.checkoutUrl,
        ok: true,
        provider: "stripe",
        sessionId: flow.product === "annual-pass" ? "cs_test_e2e_annual_pass" : "cs_test_e2e_library"
      }),
      contentType: "application/json",
      status: 200
    });
  });

  await page.route("https://checkout.stripe.com/**", async route => {
    await route.fulfill({
      body: "<!doctype html><html lang=\"fr\"><title>Stripe Checkout simulé</title><body>Checkout simulé</body></html>",
      contentType: "text/html; charset=utf-8",
      status: 200
    });
  });

  await page.goto(flow.pagePath);
  await page.getByRole("button", { name: flow.openButton }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeInViewport();
  await expect(dialog.getByRole("button", { name: /Continuer vers Stripe/i })).toBeVisible();
  expect(checkoutCalls).toBe(0);

  await dialog.getByRole("button", { name: /Continuer vers Stripe/i }).click();
  await page.waitForURL(flow.checkoutUrl);

  expect(checkoutCalls).toBe(1);
  expect(new URL(page.url()).protocol).toBe("https:");
  expect(new URL(page.url()).hostname).toBe("checkout.stripe.com");
  await expect(page).toHaveTitle("Stripe Checkout simulé");
}

test.describe("Stripe checkout hotfix on desktop", () => {
  test.use({
    storageState: { cookies: [], origins: [] },
    viewport: { height: 900, width: 1440 }
  });

  for (const flow of flows) {
    test(`${flow.product}: modal -> POST API -> hosted Stripe navigation`, async ({ page }) => {
      await exerciseHostedCheckout(page, flow);
    });
  }
});

test.describe("Stripe checkout hotfix on mobile", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    storageState: { cookies: [], origins: [] },
    viewport: { height: 844, width: 390 }
  });

  for (const flow of flows) {
    test(`${flow.product}: modal -> POST API -> hosted Stripe navigation`, async ({ page }) => {
      await exerciseHostedCheckout(page, flow);
    });
  }
});
