// Fetches a URL server-side (no CORS restriction here, unlike in the browser)
// and pulls out whatever title/author/year/description metadata the page exposes.
// Prioritizes citation_* meta tags (the same ones Zotero/Mendeley rely on —
// most journal, IEEE Xplore, and repository pages include these specifically
// for reference managers), then falls back to Open Graph, then plain <title>.

exports.handler = async function (event) {
  const targetUrl = event.queryStringParameters && event.queryStringParameters.url;

  if (!targetUrl) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing url parameter' }) };
  }

  try {
    const res = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ResearchFieldLogBot/1.0)' },
      redirect: 'follow'
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: false, error: 'not an HTML page (likely a direct file link)' })
      };
    }

    const html = await res.text();

    const grab = (pattern) => {
      const m = html.match(pattern);
      return m ? decodeHtmlEntities(m[1].trim()) : null;
    };
    const grabAll = (pattern) => {
      const out = [];
      const re = new RegExp(pattern, 'gi');
      let m;
      while ((m = re.exec(html)) !== null) out.push(decodeHtmlEntities(m[1].trim()));
      return out;
    };

    const title =
      grab(/<meta[^>]+name=["']citation_title["'][^>]+content=["']([^"']+)["']/i) ||
      grab(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
      grab(/<title[^>]*>([^<]+)<\/title>/i);

    const authors = grabAll(/<meta[^>]+name=["']citation_author["'][^>]+content=["']([^"']+)["']/i);

    const year = grab(/<meta[^>]+name=["']citation_(?:publication_date|date|online_date)["'][^>]+content=["']([^"']+)["']/i);

    const description =
      grab(/<meta[^>]+name=["']citation_abstract["'][^>]+content=["']([^"']+)["']/i) ||
      grab(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
      grab(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);

    const siteName = grab(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, title, authors, year, description, siteName })
    };
  } catch (err) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
