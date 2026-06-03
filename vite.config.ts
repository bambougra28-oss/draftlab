import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [tailwindcss(), sveltekit()],
    server: {
        fs: {
            // Allow importing JSON from the repo-root `data/` directory
            // (championTags.json, sampleDrafts.json) into client bundles.
            allow: ['..', '.', './data']
        }
    }
});
