export default async function handler(req, res) {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ ok: false, error: 'Missing url parameter' });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ResearchFieldLogBot/1.0)' },
      redirect: 'follow'
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return res.status(200).json({ ok: false, error: 'not an HTML page (likely a direct file link)' });
    }

    const html = await response.text();

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

    return res.status(200).json({ ok: true, title, authors, year, description, siteName });
  } catch (err) {
    return res.status(200).json({ ok: false, error: err.message });
  }
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}