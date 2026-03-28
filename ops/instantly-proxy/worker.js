/**
 * Cloudflare Worker: Instantly API proxy
 *
 * Proxies VPS → api.instantly.ai requests through Cloudflare's edge network,
 * bypassing the ASN-level block that Cloudflare applies to Hetzner datacenter IPs.
 *
 * Deploy: Cloudflare dashboard → Workers & Pages → Create → paste this code
 * Worker name: instantly-proxy
 * Environment variable: PROXY_SECRET = (set in Worker Settings → Variables)
 *
 * VPS calls Worker URL instead of api.instantly.ai, e.g.:
 *   https://instantly-proxy.<subdomain>.workers.dev/api/v2/emails?limit=100
 */

const INSTANTLY_BASE = 'https://api.instantly.ai';

export default {
  async fetch(request, env) {
    // Shared-secret guard — prevents the Worker being used as an open relay
    const proxySecret = env.PROXY_SECRET;
    if (proxySecret) {
      const clientSecret = request.headers.get('X-Proxy-Secret') || '';
      if (clientSecret !== proxySecret) {
        return new Response('Forbidden', { status: 403 });
      }
    }

    const url = new URL(request.url);
    const targetURL = INSTANTLY_BASE + url.pathname + url.search;

    // Forward original headers (including Authorization) to Instantly
    const forwardHeaders = new Headers(request.headers);
    forwardHeaders.delete('X-Proxy-Secret'); // don't leak the secret upstream
    forwardHeaders.set('Host', 'api.instantly.ai');

    try {
      const upstream = await fetch(new Request(targetURL, {
        method: request.method,
        headers: forwardHeaders,
        body: request.method !== 'GET' && request.method !== 'HEAD'
          ? request.body
          : undefined,
      }));

      const responseHeaders = new Headers(upstream.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
