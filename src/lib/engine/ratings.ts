/**
 * Elo rating ↔ winrate conversions.
 *
 * Standard Elo curve (Arpad Elo, 1960, public domain), in the exact form
 * DraftGap uses so DraftLab produces matching numbers from the shared dataset.
 * See ATTRIBUTION.md.
 */

/** Win probability for a rating *difference* `d` (Elo expected score). */
export function ratingToWinrate(d: number): number {
    return 1 / (1 + Math.pow(10, -d / 400));
}

/** Inverse: the rating difference implied by a winrate `w` (0 < w < 1). */
export function winrateToRating(w: number): number {
    return -400 * Math.log10(1 / w - 1);
}

/** Winrate of a champion with base winrate `w1` into one with base winrate `w2`. */
export function getMatchupWinrate(w1: number, w2: number): number {
    return ratingToWinrate(winrateToRating(w1) - winrateToRating(w2));
}

/** Combined winrate of a duo whose members have base winrates `w1` and `w2`. */
export function getDuoWinrate(w1: number, w2: number): number {
    return ratingToWinrate(winrateToRating(w1) + winrateToRating(w2));
}
