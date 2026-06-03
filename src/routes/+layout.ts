// Client-only app (DV4): no SSR — the engine reads localStorage / IndexedDB and
// fetches the dataset in the browser. Prerendering is disabled because every
// route is dynamic and unauthenticated.
export const ssr = false;
export const prerender = false;
