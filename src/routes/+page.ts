// Client-only route (DV4): the engine reads localStorage/IndexedDB and fetches
// the ~50 MB dataset in the browser. The root +layout.ts already disables
// SSR/prerender app-wide; restated here so the route survives a layout
// refactor (parity with the lost V1 files, cf. docs/M4_PROTOTYPE.md).
export const ssr = false;
export const prerender = false;
