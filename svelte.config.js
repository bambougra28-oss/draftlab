import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const cloudflare = adapter();

// workerd.exe crashes at startup (0xc0000005 in ntdll) on this Windows 11
// Home machine — upstream cloudflare/workerd#4668 — which kills both
// `vite dev` and the post-build prerender step through `adapter.emulate()`.
// The app is fully client-only (ssr=false everywhere) and /api/golgg uses
// only standard Request/Response, never `platform.env`, so the emulation
// layer adds nothing here. Linux CI is unaffected; keep the guard
// Windows-scoped so other platforms keep the full adapter behavior.
if (process.platform === 'win32') {
    delete cloudflare.emulate;
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
    preprocess: vitePreprocess(),
    kit: {
        adapter: cloudflare
    }
};

export default config;
