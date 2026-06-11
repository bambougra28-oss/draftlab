/**
 * Player enrichment — fill `DraftAction.playerId` on existing corpora from
 * Leaguepedia's ScoreboardPlayers (SP) table, WITHOUT re-pulling the drafts.
 *
 * For every distinct tournament of every given corpus file, pull the SP rows
 * (GameId, Link, Champion) and join locally: within one game a champion is
 * unique across both teams (no mirror picks), so `(gameId, championName)`
 * identifies the player. Files are rewritten in place; the sibling
 * `index.json` manifest (when present) gets a fresh `pulledAt` so the app's
 * idempotent import re-ingests the enriched league.
 *
 * Run: node --experimental-transform-types --no-warnings scripts/data/enrichPlayers.ts \
 *        static/corpus/lck-2026.json [...more corpus files]
 *
 * Data: Leaguepedia (lol.fandom.com), CC BY-SA 3.0.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const libRootHref = pathToFileURL(resolve(repoRoot, 'src', 'lib')).href;

registerHooks({
    resolve(specifier, context, nextResolve) {
        const isLib = specifier.startsWith('$lib/');
        const base = isLib ? `${libRootHref}/${specifier.slice('$lib/'.length)}` : specifier;
        const candidates = isLib
            ? [`${base}.ts`, `${base}/index.ts`]
            : base.startsWith('./') || base.startsWith('../')
              ? [base, `${base}.ts`, `${base}/index.ts`]
              : [base];
        let lastError: unknown;
        for (const candidate of candidates) {
            try {
                return nextResolve(candidate, context);
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError;
    },
    load(url, context, nextLoad) {
        if (url.endsWith('.json')) {
            return {
                format: 'json',
                source: readFileSync(fileURLToPath(url), 'utf8'),
                shortCircuit: true
            };
        }
        return nextLoad(url, context);
    }
});

type CargoModule = typeof import('../../src/lib/data/providers/leaguepediaCargo');
type DraftRecord = import('../../src/lib/data/types').DraftRecord;
const { MwSession, fetchCargoRows, LEAGUEPEDIA_ATTRIBUTION } = (await import(
    `${libRootHref}/data/providers/leaguepediaCargo.ts`
)) as CargoModule;

const inputs = process.argv.slice(2);
if (inputs.length === 0) {
    console.error('Usage: node scripts/data/enrichPlayers.ts <corpus.json> [...]');
    process.exit(1);
}

const user = process.env.DRAFTLAB_LP_USER;
const pass = process.env.DRAFTLAB_LP_PASS;
if (!user || !pass) {
    console.error('DRAFTLAB_LP_USER / DRAFTLAB_LP_PASS manquants (bot password Leaguepedia).');
    process.exit(1);
}

console.log(`Login bot: ${user.split('@')[0]}@…`);
const session = await MwSession.login({ username: user, password: pass });
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** GameIds per SP `IN (…)` chunk — bounded by URL length (long page names). */
const SP_GAMEID_CHUNK = 40;

/**
 * SP rows for a chunk of GameIds, with the pullCorpus ratelimit retry
 * discipline. Queries by GameId (the exact join key of the records) — the
 * record's `tournament` is a DISPLAY name, not the OverviewPage, so the
 * original per-tournament WHERE matched nothing.
 */
async function playersOfGameIds(gameIds: string[]): Promise<Map<string, Map<string, string>>> {
    const inList = gameIds.map((id) => `'${id.replace(/'/g, "\\'")}'`).join(',');
    for (let attempt = 1; ; attempt++) {
        try {
            const rows = await fetchCargoRows(
                {
                    tables: 'ScoreboardPlayers=SP',
                    fields: 'SP.GameId=gid,SP.Link=link,SP.Champion=champ',
                    where: `SP.GameId IN (${inList})`,
                    orderBy: 'SP.GameId ASC'
                },
                { transport: session.transport, pageDelayMs: 2500 }
            );
            const byGame = new Map<string, Map<string, string>>();
            for (const row of rows) {
                if (!row.gid || !row.link || !row.champ) continue;
                const game = byGame.get(row.gid) ?? new Map<string, string>();
                game.set(row.champ.toLowerCase(), row.link);
                byGame.set(row.gid, game);
            }
            return byGame;
        } catch (error) {
            if ((error as { code?: string }).code !== 'ratelimited' || attempt === 5) throw error;
            console.log(`  chunk de ${gameIds.length} gameIds → rate-limited (tentative ${attempt}/5), pause 75 s…`);
            await sleep(75_000);
        }
    }
}

for (const input of inputs) {
    const absPath = resolve(repoRoot, input);
    const records = JSON.parse(readFileSync(absPath, 'utf8')) as DraftRecord[];
    const gameIds = [...new Set(records.map((r) => r.gameId).filter((id) => id !== ''))];
    console.log(`\n${input} : ${records.length} records, ${gameIds.length} gameIds`);

    const players = new Map<string, Map<string, string>>();
    for (let i = 0; i < gameIds.length; i += SP_GAMEID_CHUNK) {
        const chunk = gameIds.slice(i, i + SP_GAMEID_CHUNK);
        const byGame = await playersOfGameIds(chunk);
        for (const [gameId, game] of byGame) players.set(gameId, game);
        console.log(`  gameIds ${i + 1}-${i + chunk.length} → ${byGame.size} games avec joueurs`);
        await sleep(2500);
    }

    let picks = 0;
    let enriched = 0;
    for (const record of records) {
        const game = players.get(record.gameId);
        for (const action of record.actions) {
            if (action.type !== 'pick' || action.championName === '') continue;
            picks++;
            const link = game?.get(action.championName.toLowerCase());
            if (link !== undefined) {
                action.playerId = link;
                enriched++;
            }
        }
    }
    writeFileSync(absPath, JSON.stringify(records, null, 1), 'utf8');
    console.log(`  → ${enriched}/${picks} picks attribués (${((100 * enriched) / Math.max(1, picks)).toFixed(1)} %)`);

    // Bump the manifest pulledAt so the app re-imports the enriched league.
    const manifestPath = resolve(dirname(absPath), 'index.json');
    if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
            files?: { file: string; pulledAt: string | null }[];
        };
        const fileName = absPath.split(/[\\/]/).pop()!;
        const entry = manifest.files?.find((f) => f.file === fileName);
        if (entry) {
            entry.pulledAt = new Date().toISOString();
            writeFileSync(manifestPath, JSON.stringify(manifest, null, 1), 'utf8');
        }
    }
}

console.log(`\n${LEAGUEPEDIA_ATTRIBUTION}`);
