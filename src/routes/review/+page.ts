// Client-only route (DV4): the review reads IndexedDB (saved series), fetches
// the ~50 MB dataset pair in the browser and runs the navigator oracle
// client-side. The root +layout.ts already disables SSR/prerender app-wide;
// restated here so the route survives a layout refactor (same convention as
// the other routes).
export const ssr = false;
export const prerender = false;
