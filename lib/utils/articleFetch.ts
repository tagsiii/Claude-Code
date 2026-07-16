// Fetch and plain-text a news article so the LLM can read the BODY, not just
// the headline. This is what turns "Insane Gigascale 5.2GW Solar Project Moves
// Forward" from a title-only guess into a record with named sponsors, values,
// and countries.

const FETCH_TIMEOUT_MS = 8000;
const MIN_USEFUL_CHARS = 300; // shorter than this = paywall stub / consent page

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|br|section|article)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function fetchArticleText(url: string, maxChars = 6000): Promise<string | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // A browser-like UA avoids trivial bot walls; hard paywalls still win.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('html') && !contentType.includes('text')) return null;

    const text = stripHtml(await res.text());
    if (text.length < MIN_USEFUL_CHARS) return null;
    return text.slice(0, maxChars);
  } catch {
    return null; // timeouts / TLS / bot-walls — enrichment is best-effort
  }
}
