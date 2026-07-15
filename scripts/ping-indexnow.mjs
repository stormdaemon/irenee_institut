// Notifie IndexNow (Bing, Seznam, Naver, Yandex...) des URLs du sitemap.
// Usage : node scripts/ping-indexnow.mjs [url ...]
// Sans argument, soumet toutes les URLs du sitemap public.

const HOST = "irenee-institut.org";
const KEY = "7242ad6fca3475228202e03fc917d30a";
const ENDPOINT = "https://api.indexnow.org/indexnow";

async function sitemapUrls() {
  const res = await fetch(`https://${HOST}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap.xml HTTP ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
}

const urlList = process.argv.length > 2 ? process.argv.slice(2) : await sitemapUrls();

const res = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/${KEY}.txt`,
    urlList
  })
});

console.log(`IndexNow: ${res.status} ${res.statusText} — ${urlList.length} URL(s) soumises`);
if (!res.ok) {
  console.error(await res.text());
  process.exit(1);
}
