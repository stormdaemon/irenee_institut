const targets = [
  {
    name: "irenee-institut",
    startUrl: "https://irenee-institut.org/",
    maxPages: 100
  },
  {
    name: "institutsaintirenee",
    startUrl: "https://www.institutsaintirenee.fr/",
    maxPages: 40
  }
];

function decodeHtml(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#(?:39|x27);/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(value = "") {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function pick(html, expression) {
  return stripHtml(html.match(expression)?.[1] || "");
}

function getDescription(html) {
  return (
    pick(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
    pick(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)
  );
}

function getCanonical(html) {
  return (
    pick(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i) ||
    pick(html, /<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["']/i)
  );
}

async function crawl({ name, startUrl, maxPages }) {
  const origin = new URL(startUrl).origin;
  const queue = [startUrl];
  const seen = new Set();
  const pages = [];

  while (queue.length && seen.size < maxPages) {
    const requestedUrl = queue.shift();
    if (seen.has(requestedUrl)) continue;
    seen.add(requestedUrl);

    try {
      const response = await fetch(requestedUrl, { redirect: "follow" });
      const contentType = response.headers.get("content-type") || "";
      const html = await response.text();

      if (!contentType.includes("text/html")) continue;

      const hrefs = [...html.matchAll(/href=["']([^"'#]+)["']/gi)].map(match => match[1]);
      for (const href of hrefs) {
        try {
          const url = new URL(href, response.url);
          url.hash = "";
          if (url.origin !== origin) continue;
          if (!seen.has(url.href) && !queue.includes(url.href)) queue.push(url.href);
        } catch {
          // Ignore invalid URLs found in page markup.
        }
      }

      pages.push({
        url: response.url,
        status: response.status,
        title: pick(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
        description: getDescription(html),
        canonical: getCanonical(html),
        h1: pick(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i),
        words: stripHtml(html).split(/\s+/).filter(Boolean).length
      });
    } catch (error) {
      pages.push({
        url: requestedUrl,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { name, startUrl, pages };
}

const results = [];
for (const target of targets) {
  results.push(await crawl(target));
}

console.log(JSON.stringify({ auditedAt: new Date().toISOString(), results }, null, 2));
