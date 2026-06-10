/**
 * R1 — hardened same-origin proxy for gol.gg (M2_PING1 spec, verbatim):
 *
 *  - HTTPS-only targets;
 *  - host allowlist: `gol.gg` EXACT match (no subdomains, no lookalikes);
 *  - URLs carrying credentials (user:pass@) are refused;
 *  - upstream 3xx are refused manually (redirect: 'manual') — no silent
 *    off-allowlist hops;
 *  - per-IP rate limit of 1 req/s with 429 + Retry-After (in-memory in this
 *    isolate — best-effort on Cloudflare, exact in `vite dev`; fine for a
 *    local-first single-user tool);
 *  - GET only, explicit 405 + Allow on POST/PUT/DELETE/PATCH;
 *  - custom UA, no caller header/cookie forwarding in either direction;
 *  - raw HTML passthrough as `text/html`, never cached (no-store).
 *
 * NOTE: gol.gg blocks datacenter IP ranges, so this proxy mostly serves the
 * local `vite dev`/`preview` case; deployed instances may see upstream 403s.
 */
import type { RequestHandler } from '@sveltejs/kit';

const ALLOWED_HOST = 'gol.gg';
const RATE_LIMIT_MS = 1000;
const USER_AGENT = 'DraftLab/0.1 (local-first draft-prep tool; polite scraper, 1 req/s)';

/** ip → last accepted request (ms). Pruned opportunistically. */
const lastAcceptedAt = new Map<string, number>();

function textResponse(status: number, body: string, headers: Record<string, string> = {}): Response {
    return new Response(body, {
        status,
        headers: { 'content-type': 'text/plain; charset=utf-8', ...headers }
    });
}

/** True when this IP already got a request through less than 1 s ago. */
function rateLimited(ip: string, now: number): boolean {
    if (lastAcceptedAt.size > 256) {
        for (const [key, at] of lastAcceptedAt) {
            if (now - at > 10 * RATE_LIMIT_MS) lastAcceptedAt.delete(key);
        }
    }
    const last = lastAcceptedAt.get(ip);
    if (last !== undefined && now - last < RATE_LIMIT_MS) return true;
    lastAcceptedAt.set(ip, now);
    return false;
}

export const GET: RequestHandler = async (event) => {
    const raw = event.url.searchParams.get('url');
    if (raw === null || raw === '') {
        return textResponse(400, 'Paramètre "url" manquant');
    }

    let target: URL;
    try {
        target = new URL(raw);
    } catch {
        return textResponse(400, 'URL cible invalide');
    }
    if (target.protocol !== 'https:') {
        return textResponse(403, 'HTTPS uniquement');
    }
    if (target.hostname !== ALLOWED_HOST) {
        return textResponse(403, 'Hôte refusé (gol.gg uniquement)');
    }
    if (target.username !== '' || target.password !== '') {
        return textResponse(403, 'Identifiants dans l\'URL refusés');
    }

    let ip = 'unknown';
    try {
        ip = event.getClientAddress();
    } catch {
        // Some dev/test environments cannot resolve a client address.
    }
    if (rateLimited(ip, Date.now())) {
        return textResponse(429, 'Limite de débit atteinte (1 requête/s)', { 'retry-after': '1' });
    }

    let upstream: Response;
    try {
        // Fresh header set: the caller's cookies/headers are never forwarded.
        upstream = await event.fetch(target.href, {
            redirect: 'manual',
            headers: { 'user-agent': USER_AGENT, accept: 'text/html' }
        });
    } catch {
        return textResponse(502, 'Échec de la requête vers gol.gg');
    }
    if (upstream.status >= 300 && upstream.status < 400) {
        return textResponse(502, 'Redirection amont refusée');
    }

    return new Response(await upstream.text(), {
        status: upstream.status,
        headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store'
        }
    });
};

const methodNotAllowed: RequestHandler = () =>
    textResponse(405, 'GET uniquement', { allow: 'GET' });

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
