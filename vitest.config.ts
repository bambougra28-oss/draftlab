import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Vitest runs without the SvelteKit plugin to avoid the dev-server watcher
// keeping the process alive after tests complete. Tests target pure TS modules
// in src/lib/, so no Svelte compilation is needed. We still resolve the `$lib`
// alias manually so source files can use SvelteKit-style imports under Vitest.
export default defineConfig({
    resolve: {
        alias: {
            $lib: fileURLToPath(new URL('./src/lib', import.meta.url))
        }
    },
    test: {
        include: ['tests/**/*.{test,spec}.{js,ts}'],
        environment: 'node'
    }
});
