import { defineConfig } from 'vitest/config';

// Vitest runs without the SvelteKit plugin to avoid the dev-server watcher
// keeping the process alive after tests complete. Tests target pure TS modules
// in src/lib/, so no Svelte compilation is needed.
export default defineConfig({
    test: {
        include: ['tests/**/*.{test,spec}.{js,ts}'],
        environment: 'node'
    }
});
