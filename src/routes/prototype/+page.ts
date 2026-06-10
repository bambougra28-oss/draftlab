// Client-only route (DV4) — per docs/M4_PROTOTYPE.md the prototype declared
// `ssr = false, prerender = false` route-side; the root +layout.ts now does it
// app-wide and this restatement keeps the route self-sufficient.
export const ssr = false;
export const prerender = false;
