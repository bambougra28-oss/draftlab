import staticAdapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// The app is a pure client SPA (ssr=false, prerender=false everywhere), so it
// ships as plain static files deployable to ANY host — GitHub Pages, Cloudflare
// Pages, Netlify, S3… No server is needed: /api/golgg was only a dev-time
// scouting proxy and is blocked from datacenter IPs in production anyway.
//
// BASE_PATH lets a project-subpath host work: GitHub Pages project sites serve
// at /<repo> (e.g. /draftlab). Empty (the default) serves at the domain root
// (Cloudflare Pages, a custom domain, local preview). `strict: false` tolerates
// the non-prerenderable /api/golgg endpoint (simply absent from the static
// output — the gol.gg transport then surfaces an honest "unavailable" message).
const base = process.env.BASE_PATH ?? '';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    preprocess: vitePreprocess(),
    kit: {
        adapter: staticAdapter({ fallback: '404.html', strict: false }),
        paths: { base }
    }
};

export default config;
