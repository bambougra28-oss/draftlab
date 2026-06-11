# Gate F2 — la surprise casse la lecture des rôles (chantier F, run #2)

> Généré : 2026-06-11T12:09:42.972Z · seed 42 · règle pré-enregistrée VERBATIM en tête de `scripts/backtest/roleSurprise.ts`
> (design gelé docs/run2/F-pocket-picks.md §3.2). Restriction du harnais roleInference — scoring importé, rien recodé.
> Corpus : lck-2026.json, lec-2026.json, lfl-2026.json, lpl-2026.json, lec-2025.json, lfl-2025.json, lpl-2025.json.

## Préconditions publiées

| Fichier | sha256 |
|---|---|
| lck-2026.json | E7808B40A86498C8F600F6EE41F18320D27AA21F90CAF56A6E9C9AA19800467F |
| lec-2026.json | B5755B288A538617FF5444FAED7DCEFD99EB6AA8BA4CF631F5060FEDD81A53C3 |
| lfl-2026.json | 27E9F731D939CC2AFDBA38724828EE56E76AD12D45D3A371A55311B28EBADDB5 |
| lpl-2026.json | 971FB3C0481A67F00B0593230D6D155F2B437D2C27C16E1A0863F168DE066601 |
| lec-2025.json | F24B15EB2271A598D00BCC146A238A3762F6C360AE577850FEF1DE3E58AD0E4B |
| lfl-2025.json | B17F4FF66DD9C79669F2A4AA81F697FEEA8C3F640BDBAE4956692B4CF24E2608 |
| lpl-2025.json | 62DD32418B01C5E929BD85CCB4647F1FAD4AD67AC8443FAD453D48286C823439 |

## Événements structurels (fold only)

| Corpus | Évts A | Évts B | Sides A | Sides B | Sides A∧B (déclaré) | Sides double-A | Sides sains | Scores voisins A |
|---|---|---|---|---|---|---|---|---|
| lck-2026.json | 16 | 45 | 16 | 42 | 2 | 0 | 516 | 64 |
| lec-2026.json | 17 | 117 | 17 | 95 | 3 | 0 | 347 | 68 |
| lfl-2026.json | 10 | 63 | 10 | 56 | 2 | 0 | 294 | 40 |
| lpl-2026.json | 34 | 71 | 31 | 66 | 2 | 3 | 641 | 130 |
| lec-2025.json | 25 | 154 | 25 | 122 | 2 | 0 | 441 | 100 |
| lfl-2025.json | 13 | 232 | 13 | 133 | 3 | 0 | 469 | 52 |
| lpl-2025.json | 31 | 136 | 31 | 128 | 3 | 0 | 1392 | 124 |

Recompte voisins classe A : 146 × 4 = 584 paires naïves − 6 scores mutuels tautologiques (sides doubles, exclus MÉCANIQUEMENT) = 578.

## S2 — le théorème classe A (pédagogie, n’entre dans AUCUN critère)

- Accuracy sur le champion surprise classe A lui-même : 0.0 % sur 146 événements — attendu 0 % PAR CONSTRUCTION : le vrai rôle a un prior fold nul, roleAssignmentHypotheses (weight > 0) exclut la vérité de H.
- Toute valeur ≠ 0 % serait un bug de définition, pas une découverte.

## Primaire — Δ_contamination (k = 5)

| Tranche | Scores | Accuracy |
|---|---|---|
| Voisins des sides classe A (contaminés) | 578 | 14.4 % |
| Sides sans AUCUN événement (sains) | 20500 | 96.8 % |

- **Δ_contamination = -82.49 pp**, IC bootstrap 95 % cluster par série [-87.74 pp ; -77.74 pp] (1000/1000 resamples définis).
- Prédiction pré-enregistrée : Δ < 0, ampleur ≥ 5 pp.

**Verdict : F2 VERTE** — hi < 0 : la surprise contamine significativement la lecture des voisins par injectivité.

**Garde de branchement F-c (conséquence exclusive)** : F-c ne se branche QUE si F2 est VERTE — puis RE-RUN obligatoire de scripts/backtest/roleInference.ts, non-régression accuracy pooled k=3 ≥ 94,5 % exigée, sinon F-c débranché et le rouge documenté (le système VERT pré-enregistré prime).

## S1 — classe B : le champion surprise lui-même (par élimination)

- Accuracy top-hypothèse k=5 sur le champion classe B : 70.5 % [67.3 % ; 73.6 %] sur 818 événements (uniforme + injectivité — exemple attendu : Nasus G5, 4 voisins lisibles ⇒ jungle en reste).

## S3 — Δ_contamination en classe B (descriptif)

- Voisins des sides classe B : 93.7 % (2754 scores) vs sains 96.8 % — Δ = -3.17 pp, IC [-4.85 pp ; -1.30 pp] (1000/1000).

## S4 — contamination à k = 3 (événements dans les 3 premiers picks du side)

- Voisins k=3 contaminés : 69.2 % (156 scores) vs sains k=3 97.6 % (12300) — Δ = -28.32 pp, IC [-37.10 pp ; -20.01 pp] (1000/1000).

## Baselines de contexte (RE-MESURE du harnais sur ces corpora, déclarée)

| Tranche | n champions | Accuracy | Wilson 95 % |
|---|---|---|---|
| TOUS — top-hypothèse k=3 | 14604 | 95.0 % | [94.7 % ; 95.4 %] |
| TOUS — top-hypothèse k=5 | 24340 | 93.4 % | [93.0 % ; 93.7 %] |

## S5 — table des événements (champion, rôle réel, rôle prédit pour lui et ses voisins, équipe, gameId)

| Corpus | Classe | Champion | Rôle réel | Rôle prédit | Voisins (réel → prédit) | Équipe | gameId |
|---|---|---|---|---|---|---|---|
| lck-2026.json | B | Zeri | Bot | Bot | Wukong (Jungle → Jungle) · Ahri (Mid → Mid) · Zaahen (Top → Top) · Alistar (Support → Support) | DRX | LCK/2026 Season/Cup_Week 3_1_3 |
| lck-2026.json | B | Yorick | Top | Top | Akali (Mid → Mid) · Sejuani (Jungle → Jungle) · Kalista (Bot → Bot) · Renata Glasc (Support → Support) | BRION | LCK/2026 Season/Cup_Week 3_1_4 |
| lck-2026.json | B | Tristana | Bot | Bot | Zoe (Mid → Mid) · Rell (Support → Support) · Nocturne (Jungle → Jungle) · Sion (Top → Top) | BRION | LCK/2026 Season/Cup_Week 3_1_5 |
| lck-2026.json | B | Lillia | Jungle | Mid | Jayce (Mid → Jungle) · Jhin (Bot → Bot) · Leona (Support → Support) · Jax (Top → Top) | BNK FEARX | LCK/2026 Season/Cup_Week 3_2_4 |
| lck-2026.json | B | Jinx | Bot | Bot | Malphite (Jungle → Jungle) · Lulu (Support → Support) · Yone (Mid → Mid) · K'Sante (Top → Top) | Nongshim RedForce | LCK/2026 Season/Cup_Week 3_3_3 |
| lck-2026.json | B | Blitzcrank | Support | Support | Aphelios (Bot → Bot) · Dr. Mundo (Jungle → Jungle) · Zaahen (Top → Top) · Ahri (Mid → Mid) | KT Rolster | LCK/2026 Season/Cup_Week 3_3_3 |
| lck-2026.json | B | Tahm Kench | Support | Support | Jarvan IV (Jungle → Jungle) · Caitlyn (Bot → Bot) · Galio (Mid → Mid) · Gragas (Top → Top) | Nongshim RedForce | LCK/2026 Season/Cup_Week 3_3_4 |
| lck-2026.json | B | Shen | Support | Support | Aurora (Mid → Mid) · Kai'Sa (Bot → Bot) · Trundle (Jungle → Jungle) | Nongshim RedForce | LCK/2026 Season/Cup_Week 3_3_5 |
| lck-2026.json | B | Olaf | Top | Top | Aurora (Mid → Mid) · Kai'Sa (Bot → Bot) · Trundle (Jungle → Jungle) | Nongshim RedForce | LCK/2026 Season/Cup_Week 3_3_5 |
| lck-2026.json | B | Yorick | Top | Top | Pantheon (Jungle → Jungle) · Lucian (Bot → Bot) · Nami (Support → Support) · Ahri (Mid → Mid) | Dplus Kia | LCK/2026 Season/Cup_Week 3_4_3 |
| lck-2026.json | B | Ornn | Top | Top | Pantheon (Jungle → Jungle) · Cassiopeia (Mid → Mid) · Aphelios (Bot → Bot) · Thresh (Support → Support) | Gen.G | LCK/2026 Season/Cup_Week 3_5_3 |
| lck-2026.json | A | Zaahen | Jungle | ∅ | Lucian (Bot → ∅) · Galio (Mid → ∅) · K'Sante (Top → ∅) · Sona (Support → ∅) | DRX | LCK/2026 Season/Cup_Play-In Round 1_1_3 |
| lck-2026.json | B | Sona | Support | ∅ | Zaahen (Jungle → ∅) · Lucian (Bot → ∅) · Galio (Mid → ∅) · K'Sante (Top → ∅) | DRX | LCK/2026 Season/Cup_Play-In Round 1_1_3 |
| lck-2026.json | B | Ornn | Top | Top | Jarvan IV (Jungle → Jungle) · Yunara (Bot → Bot) · Lulu (Support → Support) · Ahri (Mid → Mid) | Dplus Kia | LCK/2026 Season/Cup_Play-In Round 2_1_1 |
| lck-2026.json | B | Rammus | Jungle | Jungle | Rell (Support → Support) · Miss Fortune (Bot → Bot) · Jax (Top → Top) | DN SOOPers | LCK/2026 Season/Cup_Playoffs Round 1_1_5 |
| lck-2026.json | B | Smolder | Mid | Mid | Rell (Support → Support) · Miss Fortune (Bot → Bot) · Jax (Top → Top) | DN SOOPers | LCK/2026 Season/Cup_Playoffs Round 1_1_5 |
| lck-2026.json | B | Zac | Jungle | Jungle | Sion (Top → Top) · Aphelios (Bot → Bot) · Thresh (Support → Support) · Galio (Mid → Mid) | BNK FEARX | LCK/2026 Season/Cup_Playoffs Round 1_1_5 |
| lck-2026.json | B | Naafiri | Jungle | Jungle | Galio (Mid → Mid) · Sion (Top → Top) · Kalista (Bot → Bot) · Renata Glasc (Support → Support) | DRX | LCK/2026 Season/Cup_Playoffs Round 1_2_4 |
| lck-2026.json | B | Yuumi | Support | Support | Azir (Mid → Mid) · Jarvan IV (Jungle → Jungle) · Ornn (Top → Top) · Ezreal (Bot → Bot) | Dplus Kia | LCK/2026 Season/Cup_Playoffs Round 2_1_1 |
| lck-2026.json | B | Malzahar | Mid | Mid | Ashe (Bot → Bot) · Dr. Mundo (Jungle → Jungle) · Seraphine (Support → Support) · Jax (Top → Top) | Dplus Kia | LCK/2026 Season/Cup_Playoffs Round 2_1_3 |
| lck-2026.json | A | Ryze | Top | ∅ | Ashe (Bot → ∅) · Seraphine (Support → ∅) · Yone (Mid → ∅) · Maokai (Jungle → ∅) | BNK FEARX | LCK/2026 Season/Cup_Playoffs Round 2_2_3 |
| lck-2026.json | B | Maokai | Jungle | ∅ | Ryze (Top → ∅) · Ashe (Bot → ∅) · Seraphine (Support → ∅) · Yone (Mid → ∅) | BNK FEARX | LCK/2026 Season/Cup_Playoffs Round 2_2_3 |
| lck-2026.json | B | Naafiri | Jungle | Jungle | Renekton (Top → Top) · Corki (Bot → Bot) · Rell (Support → Support) · Viktor (Mid → Mid) | DN SOOPers | LCK/2026 Season/Cup_Playoffs Round 1_3_4 |
| lck-2026.json | B | Naafiri | Jungle | Jungle | Yunara (Bot → Bot) · Neeko (Support → Support) · Kennen (Top → Top) · Viktor (Mid → Mid) | DN SOOPers | LCK/2026 Season/Cup_Playoffs Round 2_3_4 |
| lck-2026.json | B | Mel | Mid | Mid | Yunara (Bot → Bot) · Lulu (Support → Support) · Aatrox (Jungle → Jungle) · Gnar (Top → Top) | Gen.G | LCK/2026 Season/Cup_Playoffs Round 4_1_3 |
| lck-2026.json | B | Nidalee | Jungle | Jungle | Renekton (Top → Top) · Zoe (Mid → Mid) · Nautilus (Support → Support) · Jinx (Bot → Bot) | Gen.G | LCK/2026 Season/Cup_Playoffs Round 4_1_4 |
| lck-2026.json | B | Yuumi | Support | Support | Rumble (Top → Top) · Azir (Mid → Mid) · Xin Zhao (Jungle → Jungle) · Zeri (Bot → Bot) | T1 | LCK/2026 Season/Cup_Playoffs Round 3_1_1 |
| lck-2026.json | B | Kha'Zix | Jungle | Jungle | Aphelios (Bot → Bot) · Lulu (Support → Support) · Renekton (Top → Top) · Twisted Fate (Mid → Mid) | T1 | LCK/2026 Season/Cup_Playoffs Round 3_1_3 |
| lck-2026.json | A | Sylas | Top | Jungle | Varus (Bot → Bot) · Zaahen (Jungle → Top) · Galio (Mid → Mid) · Rakan (Support → Support) | T1 | LCK/2026 Season/Cup_Playoffs Round 3_1_4 |
| lck-2026.json | B | Maokai | Jungle | ∅ | Gwen (Top → ∅) · Neeko (Support → ∅) · Miss Fortune (Bot → ∅) · Tristana (Mid → ∅) | Dplus Kia | LCK/2026 Season/Cup_Playoffs Round 3_1_5 |
| lck-2026.json | B | Yuumi | Support | Support | Azir (Mid → Mid) · Xin Zhao (Jungle → Jungle) · Ezreal (Bot → Bot) · Sion (Top → Top) | Dplus Kia | LCK/2026 Season/Cup_Playoffs Round 4_2_1 |
| lck-2026.json | B | Annie | Mid | Mid | Neeko (Support → Support) · Wukong (Jungle → Jungle) · Yunara (Bot → Bot) · Aatrox (Top → Top) | Gen.G | LCK/2026 Season/Cup_Finals_1_3 |
| lck-2026.json | B | Pyke | Support | ∅ | Azir (Mid → ∅) · Trundle (Jungle → ∅) · Renekton (Top → ∅) · Mel (Bot → ∅) | HANJIN BRION | LCK/2026 Season/Rounds 1-2_Week 1_1_2 |
| lck-2026.json | A | Anivia | Support | ∅ | Orianna (Mid → ∅) · Jarvan IV (Jungle → ∅) · Ezreal (Bot → ∅) · Ambessa (Top → ∅) | T1 | LCK/2026 Season/Rounds 1-2_Week 1_2_1 |
| lck-2026.json | B | Vayne | Top | Top | Yunara (Bot → Bot) · Nocturne (Jungle → Jungle) · Lulu (Support → Support) · Annie (Mid → Mid) | KT Rolster | LCK/2026 Season/Rounds 1-2_Week 1_2_2 |
| lck-2026.json | A | Anivia | Support | ∅ | Vi (Jungle → ∅) · Varus (Bot → ∅) · Gnar (Top → ∅) · LeBlanc (Mid → ∅) | Nongshim RedForce | LCK/2026 Season/Rounds 1-2_Week 1_3_1 |
| lck-2026.json | A | Anivia | Support | ∅ | Ryze (Mid → ∅) · Ambessa (Jungle → ∅) · Varus (Bot → ∅) · Gnar (Top → ∅) | Kiwoom DRX | LCK/2026 Season/Rounds 1-2_Week 1_4_2 |
| lck-2026.json | A | Varus | Top | ∅ | Pantheon (Jungle → ∅) · Azir (Mid → ∅) · Neeko (Support → ∅) · Jhin (Bot → ∅) | Gen.G | LCK/2026 Season/Rounds 1-2_Week 1_5_2 |
| lck-2026.json | A | Anivia | Top | Mid | Pantheon (Jungle → Jungle) · Aurora (Mid → Top) · Jhin (Bot → Bot) · Nautilus (Support → Support) | Hanwha Life Esports | LCK/2026 Season/Rounds 1-2_Week 1_7_1 |
| lck-2026.json | B | Vayne | Top | Top | Jarvan IV (Jungle → Jungle) · Yunara (Bot → Bot) · Lulu (Support → Support) · Taliyah (Mid → Mid) | Hanwha Life Esports | LCK/2026 Season/Rounds 1-2_Week 1_7_2 |
| lck-2026.json | A | Anivia | Support | ∅ | Jarvan IV (Jungle → ∅) · Annie (Mid → ∅) · Renekton (Top → ∅) · Corki (Bot → ∅) | Dplus Kia | LCK/2026 Season/Rounds 1-2_Week 1_8_2 |
| lck-2026.json | A | Anivia | Support | ∅ | Ryze (Mid → ∅) · Lee Sin (Jungle → ∅) · Gnar (Top → ∅) · Sivir (Bot → ∅) | Nongshim RedForce | LCK/2026 Season/Rounds 1-2_Week 1_9_2 |
| lck-2026.json | B | Senna | Bot | Bot | Ryze (Mid → Mid) · Jarvan IV (Jungle → Jungle) · Nautilus (Support → Support) · Jayce (Top → Top) | BNK FEARX | LCK/2026 Season/Rounds 1-2_Week 1_10_1 |
| lck-2026.json | B | Skarner | Jungle | Jungle | Rumble (Top → Top) · Caitlyn (Bot → Bot) · Bard (Support → Support) · Azir (Mid → Mid) | Gen.G | LCK/2026 Season/Rounds 1-2_Week 1_10_2 |
| lck-2026.json | B | Hwei | Mid | Mid | Ezreal (Bot → Bot) · Neeko (Support → Support) · Renekton (Top → Top) · Maokai (Jungle → Jungle) | BNK FEARX | LCK/2026 Season/Rounds 1-2_Week 2_6_2 |
| lck-2026.json | B | Hwei | Mid | Mid | Ashe (Bot → Bot) · Xin Zhao (Jungle → Jungle) · Seraphine (Support → Support) · Yorick (Top → Top) | KT Rolster | LCK/2026 Season/Rounds 1-2_Week 3_2_2 |
| lck-2026.json | A | Annie | Top | ∅ | Pantheon (Jungle → ∅) · Ashe (Bot → ∅) · Seraphine (Support → ∅) · Yone (Mid → ∅) | Hanwha Life Esports | LCK/2026 Season/Rounds 1-2_Week 3_4_2 |
| lck-2026.json | B | Lux | Support | Support | Azir (Mid → Mid) · Nocturne (Jungle → Jungle) · Jayce (Top → Top) · Caitlyn (Bot → Bot) | T1 | LCK/2026 Season/Rounds 1-2_Week 3_6_2 |
| lck-2026.json | B | Camille | Support | Support | Rumble (Top → Top) · Xin Zhao (Jungle → Jungle) · Twisted Fate (Mid → Mid) · Jhin (Bot → Bot) | T1 | LCK/2026 Season/Rounds 1-2_Week 3_10_1 |
| lck-2026.json | B | Morgana | Support | Support | Anivia (Mid → Mid) · Jarvan IV (Jungle → Jungle) · Sion (Top → Top) · Caitlyn (Bot → Bot) | T1 | LCK/2026 Season/Rounds 1-2_Week 4_7_2 |
| lck-2026.json | B | Illaoi | Top | Top | Karma (Support → Support) · Pantheon (Jungle → Jungle) · Sivir (Bot → Bot) · Twisted Fate (Mid → Mid) | Dplus Kia | LCK/2026 Season/Rounds 1-2_Week 4_8_1 |
| lck-2026.json | B | Aurelion Sol | Mid | Mid | Ezreal (Bot → Bot) · Nocturne (Jungle → Jungle) · Neeko (Support → Support) · Yorick (Top → Top) | BNK FEARX | LCK/2026 Season/Rounds 1-2_Week 4_9_1 |
| lck-2026.json | A | Twisted Fate | Top | ∅ | Karma (Support → ∅) · Trundle (Jungle → ∅) · Caitlyn (Bot → ∅) · Mel (Mid → ∅) | Gen.G | LCK/2026 Season/Rounds 1-2_Week 4_10_2 |
| lck-2026.json | B | Kog'Maw | Bot | Bot | Ambessa (Top → Top) · Nocturne (Jungle → Jungle) · Twisted Fate (Mid → Mid) · Lulu (Support → Support) | T1 | LCK/2026 Season/Rounds 1-2_Week 5_1_2 |
| lck-2026.json | B | Zyra | Mid | Top | Jarvan IV (Jungle → Jungle) · Ashe (Bot → Bot) · Seraphine (Support → Support) | Dplus Kia | LCK/2026 Season/Rounds 1-2_Week 7_5_1 |
| lck-2026.json | B | Irelia | Top | Mid | Jarvan IV (Jungle → Jungle) · Ashe (Bot → Bot) · Seraphine (Support → Support) | Dplus Kia | LCK/2026 Season/Rounds 1-2_Week 7_5_1 |
| lck-2026.json | A | Rumble | Mid | ∅ | Ezreal (Bot → ∅) · Seraphine (Support → ∅) · Skarner (Jungle → ∅) · Renekton (Top → ∅) | Gen.G | LCK/2026 Season/Rounds 1-2_Week 7_7_1 |
| lck-2026.json | B | Draven | Bot | Bot | Milio (Support → Support) · Aurora (Mid → Mid) · Nocturne (Jungle → Jungle) · Olaf (Top → Top) | Hanwha Life Esports | LCK/2026 Season/Rounds 1-2_Week 7_9_3 |
| lck-2026.json | A | Galio | Top | Mid | Karma (Support → Support) · Xin Zhao (Jungle → Jungle) · Sivir (Bot → Bot) · Ryze (Mid → Top) | BNK FEARX | LCK/2026 Season/Rounds 1-2_Week 8_3_1 |
| lck-2026.json | A | Galio | Top | Mid | Ryze (Mid → Top) · Yunara (Bot → Bot) · Lulu (Support → Support) · Xin Zhao (Jungle → Jungle) | Nongshim RedForce | LCK/2026 Season/Rounds 1-2_Week 9_3_2 |
| lck-2026.json | A | Galio | Top | Mid | Jarvan IV (Jungle → Jungle) · Miss Fortune (Bot → Bot) · Bard (Support → Support) · Aurora (Mid → Top) | Dplus Kia | LCK/2026 Season/Rounds 1-2_Week 9_5_3 |
| lec-2026.json | B | Yone | Mid | Mid | Kai'Sa (Bot → Bot) · Rakan (Support → Support) · Gnar (Top → Top) | GIANTX | LEC/2026 Season/Versus Season_Week 2_1_1 |
| lec-2026.json | B | Sejuani | Jungle | Jungle | Kai'Sa (Bot → Bot) · Rakan (Support → Support) · Gnar (Top → Top) | GIANTX | LEC/2026 Season/Versus Season_Week 2_1_1 |
| lec-2026.json | B | Thresh | Support | Support | K'Sante (Top → Top) · Ryze (Mid → Mid) · Dr. Mundo (Jungle → Jungle) · Aphelios (Bot → Bot) | Team Heretics | LEC/2026 Season/Versus Season_Week 2_3_1 |
| lec-2026.json | B | Kalista | Bot | Bot | Rumble (Top → Top) · Wukong (Jungle → Jungle) · Taliyah (Mid → Mid) | Team Vitality | LEC/2026 Season/Versus Season_Week 2_3_1 |
| lec-2026.json | B | Renata Glasc | Support | Support | Rumble (Top → Top) · Wukong (Jungle → Jungle) · Taliyah (Mid → Mid) | Team Vitality | LEC/2026 Season/Versus Season_Week 2_3_1 |
| lec-2026.json | B | Jinx | Bot | Mid | Pantheon (Jungle → Jungle) · Nautilus (Support → Support) · Kled (Top → Top) | SK Gaming | LEC/2026 Season/Versus Season_Week 2_5_1 |
| lec-2026.json | B | Ekko | Mid | Bot | Pantheon (Jungle → Jungle) · Nautilus (Support → Support) · Kled (Top → Top) | SK Gaming | LEC/2026 Season/Versus Season_Week 2_5_1 |
| lec-2026.json | B | Leona | Support | Support | Yunara (Bot → Bot) · Jarvan IV (Jungle → Jungle) · Azir (Mid → Mid) · Sion (Top → Top) | Karmine Corp | LEC/2026 Season/Versus Season_Week 2_5_1 |
| lec-2026.json | B | Thresh | Support | Support | Azir (Mid → Mid) · K'Sante (Top → Top) · Jarvan IV (Jungle → Jungle) · Aphelios (Bot → Bot) | Fnatic | LEC/2026 Season/Versus Season_Week 2_6_1 |
| lec-2026.json | B | Zoe | Mid | Mid | Kai'Sa (Bot → Bot) · Jarvan IV (Jungle → Jungle) · K'Sante (Top → Top) · Neeko (Support → Support) | Team Vitality | LEC/2026 Season/Versus Season_Week 2_7_1 |
| lec-2026.json | B | Swain | Mid | Mid | Corki (Bot → Bot) · Rumble (Top → Top) · Vi (Jungle → Jungle) · Nami (Support → Support) | Shifters | LEC/2026 Season/Versus Season_Week 2_7_1 |
| lec-2026.json | B | Cho'Gath | Top | Top | Ryze (Mid → Mid) · Yunara (Bot → Bot) · Wukong (Jungle → Jungle) · Rell (Support → Support) | SK Gaming | LEC/2026 Season/Versus Season_Week 2_8_1 |
| lec-2026.json | B | Nocturne | Jungle | Jungle | Orianna (Mid → Mid) · K'Sante (Top → Top) · Aphelios (Bot → Bot) · Lulu (Support → Support) | GIANTX | LEC/2026 Season/Versus Season_Week 2_11_1 |
| lec-2026.json | B | Galio | Mid | Top | Corki (Bot → Bot) · Xin Zhao (Jungle → Jungle) · Rakan (Support → Support) | G2 Esports | LEC/2026 Season/Versus Season_Week 2_12_1 |
| lec-2026.json | B | Lee Sin | Top | Mid | Corki (Bot → Bot) · Xin Zhao (Jungle → Jungle) · Rakan (Support → Support) | G2 Esports | LEC/2026 Season/Versus Season_Week 2_12_1 |
| lec-2026.json | B | Yone | Mid | Mid | Varus (Bot → Bot) · Rumble (Top → Top) · Pantheon (Jungle → Jungle) · Alistar (Support → Support) | SK Gaming | LEC/2026 Season/Versus Season_Week 2_13_1 |
| lec-2026.json | B | Lucian | Bot | Top | Taliyah (Mid → Mid) · Vi (Jungle → Jungle) · Neeko (Support → Support) | Shifters | LEC/2026 Season/Versus Season_Week 2_14_1 |
| lec-2026.json | B | Nidalee | Top | Bot | Taliyah (Mid → Mid) · Vi (Jungle → Jungle) · Neeko (Support → Support) | Shifters | LEC/2026 Season/Versus Season_Week 2_14_1 |
| lec-2026.json | B | Gragas | Top | Top | Ryze (Mid → Mid) · Pantheon (Jungle → Jungle) · Caitlyn (Bot → Bot) · Nami (Support → Support) | Los Ratones | LEC/2026 Season/Versus Season_Week 2_14_1 |
| lec-2026.json | B | Gwen | Top | Top | Yunara (Bot → Bot) · Jarvan IV (Jungle → Jungle) · Ryze (Mid → Mid) · Alistar (Support → Support) | Team Vitality | LEC/2026 Season/Versus Season_Week 2_15_1 |
| lec-2026.json | B | Gwen | Top | Top | Azir (Mid → Mid) · Dr. Mundo (Jungle → Jungle) · Jhin (Bot → Bot) · Alistar (Support → Support) | Team Heretics | LEC/2026 Season/Versus Season_Week 2_16_1 |
| lec-2026.json | B | Poppy | Top | Jungle | Aphelios (Bot → Bot) · Aatrox (Jungle → Top) · Taliyah (Mid → Mid) · Nautilus (Support → Support) | Natus Vincere | LEC/2026 Season/Versus Season_Week 2_17_1 |
| lec-2026.json | B | Leona | Support | Support | Yunara (Bot → Bot) · Ambessa (Top → Top) · Azir (Mid → Mid) · Pantheon (Jungle → Jungle) | Karmine Corp | LEC/2026 Season/Versus Season_Week 2_17_1 |
| lec-2026.json | B | Trundle | Jungle | Jungle | Yunara (Bot → Bot) · Azir (Mid → Mid) · Renekton (Top → Top) · Lulu (Support → Support) | Movistar KOI | LEC/2026 Season/Versus Season_Week 2_18_1 |
| lec-2026.json | B | Elise | Support | Support | Vi (Jungle → Jungle) · Caitlyn (Bot → Bot) · Taliyah (Mid → Mid) · K'Sante (Top → Top) | GIANTX | LEC/2026 Season/Versus Season_Week 2_18_1 |
| lec-2026.json | B | Pyke | Support | Support | Rumble (Top → Top) · Wukong (Jungle → Jungle) · Ryze (Mid → Mid) · Corki (Bot → Bot) | Natus Vincere | LEC/2026 Season/Versus Season_Week 3_2_1 |
| lec-2026.json | B | Skarner | Jungle | Jungle | Jhin (Bot → Bot) · Azir (Mid → Mid) · Rell (Support → Support) | Shifters | LEC/2026 Season/Versus Season_Week 3_3_1 |
| lec-2026.json | B | Rek'Sai | Top | Top | Jhin (Bot → Bot) · Azir (Mid → Mid) · Rell (Support → Support) | Shifters | LEC/2026 Season/Versus Season_Week 3_3_1 |
| lec-2026.json | B | Poppy | Top | Top | Orianna (Mid → Mid) · Caitlyn (Bot → Bot) · Dr. Mundo (Jungle → Jungle) · Nami (Support → Support) | Los Ratones | LEC/2026 Season/Versus Season_Week 3_6_1 |
| lec-2026.json | B | Elise | Support | Support | Pantheon (Jungle → Jungle) · Sion (Top → Top) · Ryze (Mid → Mid) · Caitlyn (Bot → Bot) | SK Gaming | LEC/2026 Season/Versus Season_Week 3_10_1 |
| lec-2026.json | B | Galio | Mid | Mid | Pantheon (Jungle → Jungle) · K'Sante (Top → Top) · Kai'Sa (Bot → Bot) · Nautilus (Support → Support) | Karmine Corp Blue | LEC/2026 Season/Versus Season_Week 3_13_1 |
| lec-2026.json | B | Poppy | Jungle | Jungle | Orianna (Mid → Mid) · Yunara (Bot → Bot) · Rumble (Top → Top) · Alistar (Support → Support) | Fnatic | LEC/2026 Season/Versus Season_Week 3_13_1 |
| lec-2026.json | A | Ryze | Top | Mid | Vi (Jungle → Jungle) · Yone (Mid → Support) · Yunara (Bot → Bot) · Taric (Support → Top) | SK Gaming | LEC/2026 Season/Versus Season_Week 3_14_1 |
| lec-2026.json | B | Yone | Mid | Support | Ryze (Top → Mid) · Vi (Jungle → Jungle) · Yunara (Bot → Bot) | SK Gaming | LEC/2026 Season/Versus Season_Week 3_14_1 |
| lec-2026.json | B | Taric | Support | Top | Ryze (Top → Mid) · Vi (Jungle → Jungle) · Yunara (Bot → Bot) | SK Gaming | LEC/2026 Season/Versus Season_Week 3_14_1 |
| lec-2026.json | B | Yone | Mid | Mid | Rumble (Top → Top) · Vi (Jungle → Jungle) · Corki (Bot → Bot) · Bard (Support → Support) | Team Vitality | LEC/2026 Season/Versus Season_Week 3_16_1 |
| lec-2026.json | B | Galio | Mid | Mid | Varus (Bot → Bot) · Jayce (Jungle → Jungle) · Alistar (Support → Support) · Rumble (Top → Top) | Karmine Corp | LEC/2026 Season/Versus Season_Week 3_18_1 |
| lec-2026.json | B | Nocturne | Jungle | Jungle | Orianna (Mid → Mid) · Sivir (Bot → Bot) · Rakan (Support → Support) · K'Sante (Top → Top) | Shifters | LEC/2026 Season/Versus Season_Week 3_18_1 |
| lec-2026.json | B | Jax | Top | Top | Xin Zhao (Jungle → Jungle) · Corki (Bot → Bot) · Azir (Mid → Mid) · Nautilus (Support → Support) | Fnatic | LEC/2026 Season/Versus Season_Week 4_1_1 |
| lec-2026.json | B | Ornn | Top | Top | Yunara (Bot → Bot) · Xin Zhao (Jungle → Jungle) · Neeko (Support → Support) · Yone (Mid → Mid) | SK Gaming | LEC/2026 Season/Versus Season_Week 4_3_1 |
| lec-2026.json | B | Sylas | Jungle | Jungle | Sion (Top → Top) · Corki (Bot → Bot) · Yone (Mid → Mid) · Bard (Support → Support) | Los Ratones | LEC/2026 Season/Versus Season_Week 4_7_1 |
| lec-2026.json | A | Dr. Mundo | Top | ∅ | Azir (Mid → ∅) · Varus (Bot → ∅) · Alistar (Support → ∅) · Pantheon (Jungle → ∅) | Team Vitality | LEC/2026 Season/Versus Season_Week 4_7_1 |
| lec-2026.json | A | Rumble | Jungle | ∅ | Jhin (Bot → ∅) · Nautilus (Support → ∅) · Aurora (Mid → ∅) · Ambessa (Top → ∅) | Team Heretics | LEC/2026 Season/Versus Season_Week 4_11_1 |
| lec-2026.json | B | LeBlanc | Mid | Mid | Varus (Bot → Bot) · Jayce (Jungle → Jungle) · Neeko (Support → Support) · K'Sante (Top → Top) | Karmine Corp | LEC/2026 Season/Versus Season_Week 4_11_1 |
| lec-2026.json | B | Jax | Top | Top | Pantheon (Jungle → Jungle) · Taliyah (Mid → Mid) · Yunara (Bot → Bot) · Alistar (Support → Support) | Fnatic | LEC/2026 Season/Versus Playoffs_Round 1_1_2 |
| lec-2026.json | B | Ahri | Mid | Mid | Aatrox (Jungle → Jungle) · Ezreal (Bot → Bot) · Bard (Support → Support) · Sion (Top → Top) | Natus Vincere | LEC/2026 Season/Versus Playoffs_Round 1_1_2 |
| lec-2026.json | A | Jayce | Top | ∅ | Dr. Mundo (Jungle → ∅) · Azir (Mid → ∅) · Corki (Bot → ∅) · Bard (Support → ∅) | Team Vitality | LEC/2026 Season/Versus Playoffs_Round 1_2_1 |
| lec-2026.json | B | Ornn | Top | Top | Pantheon (Jungle → Jungle) · Neeko (Support → Support) · Cassiopeia (Mid → Mid) · Caitlyn (Bot → Bot) | Movistar KOI | LEC/2026 Season/Versus Playoffs_Round 1_2_2 |
| lec-2026.json | B | Ahri | Mid | Mid | Rumble (Top → Top) · Jarvan IV (Jungle → Jungle) · Nautilus (Support → Support) · Jinx (Bot → Bot) | Team Vitality | LEC/2026 Season/Versus Playoffs_Round 1_2_2 |
| lec-2026.json | B | Miss Fortune | Bot | Bot | Azir (Mid → Mid) · Pantheon (Jungle → Jungle) · Nautilus (Support → Support) · Gnar (Top → Top) | Team Heretics | LEC/2026 Season/Versus Playoffs_Round 1_3_2 |
| lec-2026.json | B | Ornn | Top | Top | Orianna (Mid → Mid) · Jarvan IV (Jungle → Jungle) · Ezreal (Bot → Bot) · Bard (Support → Support) | GIANTX | LEC/2026 Season/Versus Playoffs_Round 1_4_1 |
| lec-2026.json | B | Ornn | Top | Jungle | Zaahen (Jungle → Top) · Ezreal (Bot → Bot) · Azir (Mid → Mid) · Rell (Support → Support) | Movistar KOI | LEC/2026 Season/Versus Playoffs_Round 2_1_1 |
| lec-2026.json | B | Miss Fortune | Bot | Bot | Dr. Mundo (Jungle → Jungle) · Ryze (Mid → Mid) · Bard (Support → Support) · Gnar (Top → Top) | Natus Vincere | LEC/2026 Season/Versus Playoffs_Round 2_1_2 |
| lec-2026.json | B | Ashe | Bot | ∅ | Ambessa (Jungle → ∅) · Anivia (Mid → ∅) · Galio (Top → ∅) | Karmine Corp | LEC/2026 Season/Versus Playoffs_Round 2_2_2 |
| lec-2026.json | B | Seraphine | Support | ∅ | Ambessa (Jungle → ∅) · Anivia (Mid → ∅) · Galio (Top → ∅) | Karmine Corp | LEC/2026 Season/Versus Playoffs_Round 2_2_2 |
| lec-2026.json | B | Naafiri | Jungle | Mid | Ambessa (Top → Top) · Jinx (Bot → Bot) · Thresh (Support → Support) | Team Heretics | LEC/2026 Season/Versus Playoffs_Round 1_5_3 |
| lec-2026.json | B | Ahri | Mid | Jungle | Ambessa (Top → Top) · Jinx (Bot → Bot) · Thresh (Support → Support) | Team Heretics | LEC/2026 Season/Versus Playoffs_Round 1_5_3 |
| lec-2026.json | B | Ashe | Bot | Support | Ryze (Mid → Mid) · Xin Zhao (Jungle → Jungle) · K'Sante (Top → Top) | GIANTX | LEC/2026 Season/Versus Playoffs_Round 2_3_2 |
| lec-2026.json | B | Seraphine | Support | Bot | Ryze (Mid → Mid) · Xin Zhao (Jungle → Jungle) · K'Sante (Top → Top) | GIANTX | LEC/2026 Season/Versus Playoffs_Round 2_3_2 |
| lec-2026.json | B | Ornn | Top | Top | Yunara (Bot → Bot) · Nautilus (Support → Support) · Aatrox (Jungle → Jungle) · Taliyah (Mid → Mid) | GIANTX | LEC/2026 Season/Versus Playoffs_Round 2_3_3 |
| lec-2026.json | B | Ahri | Mid | Mid | Rumble (Top → Top) · Aphelios (Bot → Bot) · Lulu (Support → Support) · Wukong (Jungle → Jungle) | Natus Vincere | LEC/2026 Season/Versus Playoffs_Round 2_3_3 |
| lec-2026.json | B | Yasuo | Top | Top | Corki (Bot → Bot) · Orianna (Mid → Mid) · Nocturne (Jungle → Jungle) · Rell (Support → Support) | Team Vitality | LEC/2026 Season/Versus Playoffs_Round 2_4_2 |
| lec-2026.json | B | Seraphine | Bot | Mid | K'Sante (Top → Top) · Xin Zhao (Jungle → Jungle) · Braum (Support → Support) | Team Vitality | LEC/2026 Season/Versus Playoffs_Round 2_4_3 |
| lec-2026.json | B | Twisted Fate | Mid | Bot | K'Sante (Top → Top) · Xin Zhao (Jungle → Jungle) · Braum (Support → Support) | Team Vitality | LEC/2026 Season/Versus Playoffs_Round 2_4_3 |
| lec-2026.json | B | Ahri | Mid | Mid | Rumble (Top → Top) · Wukong (Jungle → Jungle) · Alistar (Support → Support) | Karmine Corp | LEC/2026 Season/Versus Playoffs_Round 2_4_3 |
| lec-2026.json | B | Zeri | Bot | Bot | Rumble (Top → Top) · Wukong (Jungle → Jungle) · Alistar (Support → Support) | Karmine Corp | LEC/2026 Season/Versus Playoffs_Round 2_4_3 |
| lec-2026.json | B | Ashe | Bot | Bot | Rumble (Top → Top) · Jarvan IV (Jungle → Jungle) · Taliyah (Mid → Mid) · Nautilus (Support → Support) | G2 Esports | LEC/2026 Season/Versus Playoffs_Round 4_1_2 |
| lec-2026.json | B | Ornn | Top | Support | Ryze (Mid → Mid) · Caitlyn (Bot → Bot) · Xin Zhao (Jungle → Jungle) | Movistar KOI | LEC/2026 Season/Versus Playoffs_Round 4_1_2 |
| lec-2026.json | B | Seraphine | Support | Top | Ryze (Mid → Mid) · Caitlyn (Bot → Bot) · Xin Zhao (Jungle → Jungle) | Movistar KOI | LEC/2026 Season/Versus Playoffs_Round 4_1_2 |
| lec-2026.json | B | Ahri | Mid | Mid | Yunara (Bot → Bot) · K'Sante (Top → Top) · Lulu (Support → Support) · Wukong (Jungle → Jungle) | G2 Esports | LEC/2026 Season/Versus Playoffs_Round 4_1_3 |
| lec-2026.json | B | Ornn | Top | Support | Orianna (Mid → Mid) · Jarvan IV (Jungle → Jungle) | GIANTX | LEC/2026 Season/Versus Playoffs_Round 3_1_1 |
| lec-2026.json | B | Ashe | Bot | Bot | Orianna (Mid → Mid) · Jarvan IV (Jungle → Jungle) | GIANTX | LEC/2026 Season/Versus Playoffs_Round 3_1_1 |
| lec-2026.json | B | Seraphine | Support | Top | Orianna (Mid → Mid) · Jarvan IV (Jungle → Jungle) | GIANTX | LEC/2026 Season/Versus Playoffs_Round 3_1_1 |
| lec-2026.json | A | Karma | Mid | ∅ | Vi (Jungle → ∅) · Aphelios (Bot → ∅) · Thresh (Support → ∅) · Gnar (Top → ∅) | GIANTX | LEC/2026 Season/Versus Playoffs_Round 3_1_3 |
| lec-2026.json | B | Ahri | Mid | Jungle | Xayah (Bot → Bot) · Rakan (Support → Support) · Kennen (Top → Top) | Karmine Corp | LEC/2026 Season/Versus Playoffs_Round 3_1_3 |
| lec-2026.json | B | Naafiri | Jungle | Mid | Xayah (Bot → Bot) · Rakan (Support → Support) · Kennen (Top → Top) | Karmine Corp | LEC/2026 Season/Versus Playoffs_Round 3_1_3 |
| lec-2026.json | A | Varus | Top | ∅ | Pantheon (Jungle → ∅) · Orianna (Mid → ∅) · Ezreal (Bot → ∅) · Alistar (Support → ∅) | Karmine Corp | LEC/2026 Season/Versus Playoffs_Round 4_2_1 |
| lec-2026.json | B | Ashe | Bot | Support | Ryze (Mid → Mid) · Sion (Top → Top) · Wukong (Jungle → Jungle) | Karmine Corp | LEC/2026 Season/Versus Playoffs_Round 4_2_2 |
| lec-2026.json | B | Seraphine | Support | Bot | Ryze (Mid → Mid) · Sion (Top → Top) · Wukong (Jungle → Jungle) | Karmine Corp | LEC/2026 Season/Versus Playoffs_Round 4_2_2 |
| lec-2026.json | A | Jayce | Top | ∅ | Jhin (Bot → ∅) · Syndra (Mid → ∅) · Rell (Support → ∅) · Sejuani (Jungle → ∅) | Karmine Corp | LEC/2026 Season/Versus Playoffs_Round 4_2_3 |
| lec-2026.json | B | Syndra | Mid | ∅ | Jhin (Bot → ∅) · Rell (Support → ∅) · Jayce (Top → ∅) · Sejuani (Jungle → ∅) | Karmine Corp | LEC/2026 Season/Versus Playoffs_Round 4_2_3 |
| lec-2026.json | B | Ahri | Mid | Mid | Neeko (Support → Support) · Aphelios (Bot → Bot) · Poppy (Top → Top) · Malphite (Jungle → Jungle) | Movistar KOI | LEC/2026 Season/Versus Playoffs_Round 4_2_4 |
| lec-2026.json | B | Milio | Support | ∅ | Lucian (Bot → ∅) · Gwen (Jungle → ∅) · Yone (Mid → ∅) · K'Sante (Top → ∅) | Movistar KOI | LEC/2026 Season/Versus Playoffs_Round 4_2_5 |
| lec-2026.json | B | Kha'Zix | Jungle | ∅ | Kalista (Bot → ∅) · Renata Glasc (Support → ∅) · Akali (Top → ∅) · Galio (Mid → ∅) | Karmine Corp | LEC/2026 Season/Versus Playoffs_Round 4_2_5 |
| lec-2026.json | B | Shen | Top | Top | Orianna (Mid → Mid) · Aatrox (Jungle → Jungle) · Bard (Support → Support) · Caitlyn (Bot → Bot) | G2 Esports | LEC/2026 Season/Versus Playoffs_Finals_1_1 |
| lec-2026.json | B | Ashe | Bot | Support | Dr. Mundo (Jungle → Jungle) · Taliyah (Mid → Mid) | G2 Esports | LEC/2026 Season/Versus Playoffs_Finals_1_2 |
| lec-2026.json | B | Seraphine | Support | Top | Dr. Mundo (Jungle → Jungle) · Taliyah (Mid → Mid) | G2 Esports | LEC/2026 Season/Versus Playoffs_Finals_1_2 |
| lec-2026.json | B | Yasuo | Top | Bot | Dr. Mundo (Jungle → Jungle) · Taliyah (Mid → Mid) | G2 Esports | LEC/2026 Season/Versus Playoffs_Finals_1_2 |
| lec-2026.json | B | Naafiri | Jungle | Jungle | Ryze (Mid → Mid) · Gwen (Top → Top) · Ezreal (Bot → Bot) · Karma (Support → Support) | Karmine Corp | LEC/2026 Season/Versus Playoffs_Finals_1_2 |
| lec-2026.json | B | Ornn | Top | Top | Pantheon (Jungle → Jungle) · Corki (Bot → Bot) · Rell (Support → Support) | G2 Esports | LEC/2026 Season/Versus Playoffs_Finals_1_3 |
| lec-2026.json | B | Sylas | Mid | Mid | Pantheon (Jungle → Jungle) · Corki (Bot → Bot) · Rell (Support → Support) | G2 Esports | LEC/2026 Season/Versus Playoffs_Finals_1_3 |
| lec-2026.json | B | Ahri | Mid | Mid | Rumble (Top → Top) · Wukong (Jungle → Jungle) · Jhin (Bot → Bot) · Nautilus (Support → Support) | Karmine Corp | LEC/2026 Season/Versus Playoffs_Finals_1_3 |
| lec-2026.json | B | Syndra | Mid | Mid | Yunara (Bot → Bot) · Xin Zhao (Jungle → Jungle) · Renata Glasc (Support → Support) · Renekton (Top → Top) | G2 Esports | LEC/2026 Season/Versus Playoffs_Finals_1_4 |
| lec-2026.json | B | Maokai | Jungle | ∅ | Sion (Top → ∅) · Aurora (Mid → ∅) · Alistar (Support → ∅) · Sivir (Bot → ∅) | Karmine Corp | LEC/2026 Season/Versus Playoffs_Finals_1_5 |
| lec-2026.json | B | Annie | Mid | Mid | K'Sante (Top → Top) · Yunara (Bot → Bot) · Lulu (Support → Support) · Dr. Mundo (Jungle → Jungle) | GIANTX | LEC/2026 Season/Spring Season_Week 1_1_2 |
| lec-2026.json | B | Annie | Mid | Mid | Karma (Support → Support) · K'Sante (Top → Top) · Jhin (Bot → Bot) · Naafiri (Jungle → Jungle) | Team Vitality | LEC/2026 Season/Spring Season_Week 1_2_3 |
| lec-2026.json | B | Zed | Mid | Mid | Yunara (Bot → Bot) · Milio (Support → Support) · Skarner (Jungle → Jungle) · Kennen (Top → Top) | SK Gaming | LEC/2026 Season/Spring Season_Week 1_4_3 |
| lec-2026.json | B | Mel | Mid | Mid | Ashe (Bot → Bot) · Seraphine (Support → Support) · Sejuani (Jungle → Jungle) · Gnar (Top → Top) | Team Heretics | LEC/2026 Season/Spring Season_Week 1_4_3 |
| lec-2026.json | B | Lissandra | Mid | Mid | Rumble (Top → Top) · Nocturne (Jungle → Jungle) · Neeko (Support → Support) · Aphelios (Bot → Bot) | Movistar KOI | LEC/2026 Season/Spring Season_Week 1_5_2 |
| lec-2026.json | A | Anivia | Top | ∅ | Yunara (Bot → ∅) · Janna (Support → ∅) · Zaahen (Jungle → ∅) · Yone (Mid → ∅) | SK Gaming | LEC/2026 Season/Spring Season_Week 1_6_3 |
| lec-2026.json | B | Janna | Support | ∅ | Yunara (Bot → ∅) · Zaahen (Jungle → ∅) · Anivia (Top → ∅) · Yone (Mid → ∅) | SK Gaming | LEC/2026 Season/Spring Season_Week 1_6_3 |
| lec-2026.json | B | Hwei | Mid | Mid | Lulu (Support → Support) · Xin Zhao (Jungle → Jungle) · Sion (Top → Top) · Jinx (Bot → Bot) | Team Heretics | LEC/2026 Season/Spring Season_Week 1_7_2 |
| lec-2026.json | B | Olaf | Jungle | Jungle | Sivir (Bot → Bot) · Bard (Support → Support) · Akali (Mid → Mid) · Poppy (Top → Top) | G2 Esports | LEC/2026 Season/Spring Season_Week 2_2_2 |
| lec-2026.json | B | Tristana | Mid | Mid | Bard (Support → Support) · Kai'Sa (Bot → Bot) · Sejuani (Jungle → Jungle) · Jax (Top → Top) | GIANTX | LEC/2026 Season/Spring Season_Week 2_6_3 |
| lec-2026.json | B | Ziggs | Bot | Bot | Azir (Mid → Mid) · Pantheon (Jungle → Jungle) · Gnar (Top → Top) · Rell (Support → Support) | Team Vitality | LEC/2026 Season/Spring Season_Week 3_2_2 |
| lec-2026.json | B | Olaf | Jungle | Jungle | Lucian (Bot → Bot) · Milio (Support → Support) · Sion (Top → Top) · Zoe (Mid → Mid) | G2 Esports | LEC/2026 Season/Spring Season_Week 3_2_3 |
| lec-2026.json | B | Irelia | Mid | Top | Seraphine (Bot → Bot) · Pantheon (Jungle → Jungle) · Nautilus (Support → Support) · Anivia (Top → Mid) | SK Gaming | LEC/2026 Season/Spring Season_Week 3_3_1 |
| lec-2026.json | B | Camille | Top | Top | Varus (Bot → Bot) · Nautilus (Support → Support) · Aatrox (Jungle → Jungle) · Galio (Mid → Mid) | Team Vitality | LEC/2026 Season/Spring Season_Week 3_4_3 |
| lec-2026.json | B | Ziggs | Bot | Bot | Vi (Jungle → Jungle) · Bard (Support → Support) · Ambessa (Top → Top) · Galio (Mid → Mid) | Team Heretics | LEC/2026 Season/Spring Season_Week 3_5_1 |
| lec-2026.json | B | Vayne | Top | Top | Varus (Bot → Bot) · Azir (Mid → Mid) · Karma (Support → Support) · Dr. Mundo (Jungle → Jungle) | Shifters | LEC/2026 Season/Spring Season_Week 3_7_2 |
| lec-2026.json | B | Quinn | Top | Top | Caitlyn (Bot → Bot) · Jarvan IV (Jungle → Jungle) · Elise (Support → Support) · Cassiopeia (Mid → Mid) | Team Vitality | LEC/2026 Season/Spring Season_Week 4_3_1 |
| lec-2026.json | A | Anivia | Support | ∅ | Yunara (Bot → ∅) · Xin Zhao (Jungle → ∅) · Akali (Mid → ∅) · Jax (Top → ∅) | Team Heretics | LEC/2026 Season/Spring Season_Week 4_4_2 |
| lec-2026.json | B | Amumu | Support | Support | Corki (Bot → Bot) · Nocturne (Jungle → Jungle) · Gnar (Top → Top) | SK Gaming | LEC/2026 Season/Spring Season_Week 4_6_2 |
| lec-2026.json | B | Diana | Mid | Mid | Corki (Bot → Bot) · Nocturne (Jungle → Jungle) · Gnar (Top → Top) | SK Gaming | LEC/2026 Season/Spring Season_Week 4_6_2 |
| lec-2026.json | B | Viego | Jungle | Jungle | Lucian (Bot → Bot) · Milio (Support → Support) · Anivia (Mid → Top) · Irelia (Top → Mid) | Shifters | LEC/2026 Season/Spring Season_Week 5_4_2 |
| lec-2026.json | B | Darius | Jungle | Jungle | Ezreal (Bot → Bot) · Karma (Support → Support) · Ryze (Mid → Mid) · Aurora (Top → Top) | Shifters | LEC/2026 Season/Spring Season_Week 5_5_1 |
| lec-2026.json | B | Soraka | Support | Support | Jarvan IV (Jungle → Jungle) · Ornn (Top → Top) · Ezreal (Bot → Bot) · Ryze (Mid → Mid) | Fnatic | LEC/2026 Season/Spring Season_Week 5_6_1 |
| lec-2026.json | B | Shyvana | Top | Top | Pantheon (Jungle → Jungle) · Jhin (Bot → Bot) · Rell (Support → Support) · Ekko (Mid → Mid) | SK Gaming | LEC/2026 Season/Spring Season_Week 6_2_1 |
| lec-2026.json | B | Kog'Maw | Bot | Bot | Ryze (Top → Mid) · Lulu (Support → Support) · Zaahen (Jungle → Jungle) · Irelia (Mid → Top) | SK Gaming | LEC/2026 Season/Spring Season_Week 6_2_3 |
| lec-2026.json | B | Yuumi | Support | Support | Aurora (Mid → Mid) · Nocturne (Jungle → Jungle) · Jayce (Top → Top) · Zeri (Bot → Bot) | Team Heretics | LEC/2026 Season/Spring Season_Week 6_3_1 |
| lec-2026.json | B | Shyvana | Top | Top | Ashe (Bot → Bot) · Xin Zhao (Jungle → Jungle) · Seraphine (Support → Support) · Sylas (Mid → Mid) | Movistar KOI | LEC/2026 Season/Spring Season_Week 6_6_2 |
| lec-2026.json | B | Shyvana | Top | Top | Azir (Mid → Mid) · Bard (Support → Support) · Caitlyn (Bot → Bot) · Skarner (Jungle → Jungle) | Movistar KOI | LEC/2026 Season/Spring Season_Week 7_4_1 |
| lec-2026.json | A | Cassiopeia | Top | ∅ | Bard (Support → ∅) · Vi (Jungle → ∅) · Caitlyn (Bot → ∅) · Viktor (Mid → ∅) | Karmine Corp | LEC/2026 Season/Spring Season_Week 7_5_2 |
| lec-2026.json | B | Brand | Top | Top | Corki (Bot → Bot) · Naafiri (Jungle → Jungle) · Nautilus (Support → Support) · Sylas (Mid → Mid) | Karmine Corp | LEC/2026 Season/Spring Season_Week 7_5_3 |
| lec-2026.json | A | Yone | Top | ∅ | Ashe (Bot → ∅) · Vi (Jungle → ∅) · Seraphine (Support → ∅) · Taliyah (Mid → ∅) | Karmine Corp | LEC/2026 Season/Spring Playoffs_Round 1_1_1 |
| lec-2026.json | A | Yone | Top | Mid | Jarvan IV (Jungle → Jungle) · Ezreal (Bot → Bot) · Cassiopeia (Mid → Top) · Leona (Support → Support) | G2 Esports | LEC/2026 Season/Spring Playoffs_Round 3_1_1 |
| lec-2026.json | B | Senna | Bot | Bot | Alistar (Support → Support) · Azir (Mid → Mid) · Gnar (Top → Top) · Zaahen (Jungle → Jungle) | Movistar KOI | LEC/2026 Season/Spring Playoffs_Round 3_1_5 |
| lec-2026.json | A | Yone | Top | Mid | Anivia (Mid → Top) · Vi (Jungle → Jungle) · Caitlyn (Bot → Bot) · Neeko (Support → Support) | Karmine Corp | LEC/2026 Season/Spring Playoffs_Round 1_3_2 |
| lec-2026.json | A | Rek'Sai | Jungle | ∅ | Varus (Top → ∅) · Nautilus (Support → ∅) · Aurora (Mid → ∅) · Corki (Bot → ∅) | Karmine Corp | LEC/2026 Season/Spring Playoffs_Round 1_3_3 |
| lec-2026.json | A | Shen | Support | ∅ | Jarvan IV (Jungle → ∅) · Mel (Bot → ∅) · Olaf (Top → ∅) · Azir (Mid → ∅) | GIANTX | LEC/2026 Season/Spring Playoffs_Round 2_1_1 |
| lec-2026.json | A | Annie | Top | Mid | Corki (Bot → Bot) · Nami (Support → Support) · Yasuo (Mid → Top) · Wukong (Jungle → Jungle) | Movistar KOI | LEC/2026 Season/Spring Playoffs_Round 3_2_3 |
| lec-2026.json | B | Senna | Bot | Jungle | Anivia (Mid → Mid) · Alistar (Support → Support) · Kled (Top → Top) | G2 Esports | LEC/2026 Season/Spring Playoffs_Finals_1_5 |
| lec-2026.json | B | Nasus | Jungle | Bot | Anivia (Mid → Mid) · Alistar (Support → Support) · Kled (Top → Top) | G2 Esports | LEC/2026 Season/Spring Playoffs_Finals_1_5 |
| lec-2026.json | A | Poppy | Support | ∅ | Varus (Bot → ∅) · Akali (Mid → ∅) · Aatrox (Jungle → ∅) · Nidalee (Top → ∅) | Karmine Corp | LEC/2026 Season/Spring Playoffs_Finals_1_5 |
| lfl-2026.json | B | Cho'Gath | Top | Top | Orianna (Mid → Mid) · Neeko (Support → Support) · Wukong (Jungle → Jungle) · Smolder (Bot → Bot) | Zephyr Esport | LFL/2026 Season/Invitational_Day 1_1_1 |
| lfl-2026.json | B | Rek'Sai | Jungle | Jungle | Azir (Mid → Mid) · Yunara (Bot → Bot) · Neeko (Support → Support) · Sion (Top → Top) | Solary | LFL/2026 Season/Invitational_Day 1_2_1 |
| lfl-2026.json | B | Lux | Bot | Bot | Ambessa (Top → Top) · Akali (Mid → Mid) · Karma (Support → Support) · Nocturne (Jungle → Jungle) | Yumeea | LFL/2026 Season/Invitational_Day 1_2_1 |
| lfl-2026.json | B | Darius | Top | Jungle | Kai'Sa (Bot → Bot) · Gwen (Jungle → Top) · Syndra (Mid → Mid) · Rell (Support → Support) | Lausanne-Sport Esports | LFL/2026 Season/Invitational_Day 1_3_1 |
| lfl-2026.json | B | Dr. Mundo | Jungle | Top | Corki (Bot → Bot) · Syndra (Mid → Mid) · Alistar (Support → Support) | Joblife | LFL/2026 Season/Invitational_Day 1_4_1 |
| lfl-2026.json | B | Yorick | Top | Jungle | Corki (Bot → Bot) · Syndra (Mid → Mid) · Alistar (Support → Support) | Joblife | LFL/2026 Season/Invitational_Day 1_4_1 |
| lfl-2026.json | B | Zaahen | Top | Top | Yunara (Bot → Bot) · Nocturne (Jungle → Jungle) · Akali (Mid → Mid) · Neeko (Support → Support) | Galions | LFL/2026 Season/Invitational_Day 1_5_1 |
| lfl-2026.json | B | Malphite | Jungle | Jungle | Varus (Bot → Bot) · Renekton (Top → Top) · Taliyah (Mid → Mid) · Alistar (Support → Support) | Vitality.Bee | LFL/2026 Season/Invitational_Day 2_1_1 |
| lfl-2026.json | B | Tristana | Bot | Bot | Rumble (Top → Top) · Orianna (Mid → Mid) · Rell (Support → Support) · Naafiri (Jungle → Jungle) | Lille Esport | LFL/2026 Season/Invitational_Day 2_2_1 |
| lfl-2026.json | B | Caitlyn | Bot | Jungle | Ryze (Mid → Mid) · Jayce (Jungle → Top) · Neeko (Support → Support) | ZYB Esport | LFL/2026 Season/Invitational_Day 2_4_1 |
| lfl-2026.json | B | Mordekaiser | Top | Bot | Ryze (Mid → Mid) · Jayce (Jungle → Top) · Neeko (Support → Support) | ZYB Esport | LFL/2026 Season/Invitational_Day 2_4_1 |
| lfl-2026.json | B | Thresh | Support | Support | Yunara (Bot → Bot) · Vi (Jungle → Jungle) · Taliyah (Mid → Mid) · Aurora (Top → Top) | BK ROG Esports | LFL/2026 Season/Invitational_Day 3_5_1 |
| lfl-2026.json | B | Gragas | Top | Top | Yunara (Bot → Bot) · Syndra (Mid → Mid) · Jarvan IV (Jungle → Jungle) · Alistar (Support → Support) | Caldya Esport | LFL/2026 Season/Invitational_Day 4_2_1 |
| lfl-2026.json | B | Lulu | Support | Support | Yunara (Bot → Bot) · Jarvan IV (Jungle → Jungle) · Syndra (Mid → Mid) · K'Sante (Top → Top) | Ici Japon Corp. Esport | LFL/2026 Season/Invitational_Day 4_3_1 |
| lfl-2026.json | B | Ahri | Mid | Mid | Varus (Bot → Bot) · Neeko (Support → Support) · Rek'Sai (Jungle → Jungle) · Zaahen (Top → Top) | Lausanne-Sport Esports | LFL/2026 Season/Invitational_Day 4_5_1 |
| lfl-2026.json | B | Vayne | Top | Top | Corki (Bot → Bot) · Ryze (Mid → Mid) · Xin Zhao (Jungle → Jungle) · Rakan (Support → Support) | BK ROG Esports | LFL/2026 Season/Invitational_Day 5_1_1 |
| lfl-2026.json | B | Ahri | Mid | Mid | Yunara (Bot → Bot) · Jarvan IV (Jungle → Jungle) · Rell (Support → Support) · K'Sante (Top → Top) | Lille Esport | LFL/2026 Season/Invitational_Day 5_3_1 |
| lfl-2026.json | B | Sylas | Mid | Mid | Wukong (Jungle → Jungle) · Varus (Bot → Bot) · Ambessa (Top → Top) · Renata Glasc (Support → Support) | Esprit Shōnen | LFL/2026 Season/Invitational_Day 5_3_1 |
| lfl-2026.json | B | Anivia | Mid | Jungle | Renekton (Top → Top) · Taliyah (Jungle → Mid) · Alistar (Support → Support) · Corki (Bot → Bot) | Vitality.Bee | LFL/2026 Season/Invitational_Day 5_5_1 |
| lfl-2026.json | A | Ambessa | Jungle | ∅ | Ryze (Mid → ∅) · Gnar (Top → ∅) · Ezreal (Bot → ∅) · Leona (Support → ∅) | Karmine Corp Blue Stars | LFL/2026 Season/Invitational_Day 5_5_1 |
| lfl-2026.json | B | Milio | Support | Support | Ambessa (Top → Top) · Azir (Mid → Mid) · Pantheon (Jungle → Jungle) · Lucian (Bot → Bot) | Galions | LFL/2026 Season/Invitational_Week 1_1_1 |
| lfl-2026.json | B | Cassiopeia | Mid | Mid | Varus (Bot → Bot) · Xin Zhao (Jungle → Jungle) · Rumble (Top → Top) · Rell (Support → Support) | Solary | LFL/2026 Season/Invitational_Week 1_2_1 |
| lfl-2026.json | B | Xayah | Bot | Bot | Jayce (Top → Top) · Rakan (Support → Support) · Orianna (Mid → Mid) · Xin Zhao (Jungle → Jungle) | French Flair | LFL/2026 Season/Invitational_Week 1_3_1 |
| lfl-2026.json | B | Ahri | Mid | Mid | Rumble (Top → Top) · Vi (Jungle → Jungle) · Caitlyn (Bot → Bot) · Nautilus (Support → Support) | Lille Esport | LFL/2026 Season/Invitational_Week 1_3_1 |
| lfl-2026.json | B | Yone | Mid | Top | Caitlyn (Bot → Bot) · Sejuani (Jungle → Jungle) · Rell (Support → Support) · Annie (Top → Mid) | ZYB Esport | LFL/2026 Season/Invitational_Week 1_5_1 |
| lfl-2026.json | B | Camille | Top | Top | Orianna (Mid → Mid) · Caitlyn (Bot → Bot) · Malphite (Jungle → Jungle) · Karma (Support → Support) | Joblife | LFL/2026 Season/Invitational_Week 1_10_1 |
| lfl-2026.json | B | Yone | Mid | Mid | Varus (Bot → Bot) · Jarvan IV (Jungle → Jungle) · Nautilus (Support → Support) | BK ROG Esports | LFL/2026 Season/Invitational_Week 1_11_1 |
| lfl-2026.json | B | Sylas | Top | Top | Varus (Bot → Bot) · Jarvan IV (Jungle → Jungle) · Nautilus (Support → Support) | BK ROG Esports | LFL/2026 Season/Invitational_Week 1_11_1 |
| lfl-2026.json | A | Ambessa | Jungle | ∅ | Rumble (Top → ∅) · Ryze (Mid → ∅) · Corki (Bot → ∅) · Neeko (Support → ∅) | Vitality.Bee | LFL/2026 Season/Invitational_Week 1_12_1 |
| lfl-2026.json | B | Zoe | Mid | Mid | K'Sante (Top → Top) · Wukong (Jungle → Jungle) · Rell (Support → Support) · Sivir (Bot → Bot) | Lille Esport | LFL/2026 Season/Invitational_Week 1_12_1 |
| lfl-2026.json | A | Ambessa | Jungle | Mid | Yunara (Bot → Bot) · Nautilus (Support → Support) · Aurora (Top → Top) · Ahri (Mid → Jungle) | Galions | LFL/2026 Season/Invitational_Week 1_13_1 |
| lfl-2026.json | B | Ahri | Mid | Jungle | Ambessa (Jungle → Mid) · Yunara (Bot → Bot) · Nautilus (Support → Support) · Aurora (Top → Top) | Galions | LFL/2026 Season/Invitational_Week 1_13_1 |
| lfl-2026.json | A | Pantheon | Support | ∅ | Yunara (Bot → ∅) · Taliyah (Mid → ∅) · Jax (Top → ∅) · Malphite (Jungle → ∅) | Joblife | LFL/2026 Season/Invitational_Week 2_2_1 |
| lfl-2026.json | B | Ivern | Jungle | ∅ | Ezreal (Bot → ∅) · Taliyah (Mid → ∅) · Leona (Support → ∅) · Smolder (Top → ∅) | ZYB Esport | LFL/2026 Season/Invitational_Week 2_4_1 |
| lfl-2026.json | B | Nami | Support | Support | Rumble (Top → Top) · Corki (Bot → Bot) · Taliyah (Mid → Mid) · Wukong (Jungle → Jungle) | TLN Pirates | LFL/2026 Season/Invitational_Week 2_7_1 |
| lfl-2026.json | B | Nami | Support | Support | Taliyah (Mid → Mid) · Jarvan IV (Jungle → Jungle) · Corki (Bot → Bot) · Jax (Top → Top) | Skillcamp | LFL/2026 Season/Invitational_Week 2_14_1 |
| lfl-2026.json | B | Kindred | Jungle | Bot | Ryze (Mid → Mid) · Bard (Support → Support) · Vayne (Bot → Top) · Ambessa (Top → Jungle) | ZYB Esport | LFL/2026 Season/Invitational_Week 2_16_1 |
| lfl-2026.json | B | Aphelios | Bot | Bot | Rumble (Top → Top) · Ryze (Mid → Mid) · Pantheon (Jungle → Jungle) · Thresh (Support → Support) | Joblife | LFL/2026 Season/Invitational_Week 2_19_1 |
| lfl-2026.json | A | Varus | Top | ∅ | Syndra (Mid → ∅) · Jayce (Jungle → ∅) · Alistar (Support → ∅) · Corki (Bot → ∅) | BK ROG Esports | LFL/2026 Season/Invitational_Week 2_20_1 |
| lfl-2026.json | B | Riven | Top | Bot | Orianna (Mid → Mid) · Jayce (Jungle → Jungle) · Vayne (Bot → Top) · Bard (Support → Support) | ZYB Esport | LFL/2026 Season/Invitational_Week 3_5_1 |
| lfl-2026.json | B | Nami | Support | Support | Ryze (Mid → Mid) · Corki (Bot → Bot) · Xin Zhao (Jungle → Jungle) · Zaahen (Top → Top) | BK ROG Esports | LFL/2026 Season/Invitational_Week 3_6_1 |
| lfl-2026.json | B | Lee Sin | Jungle | Jungle | Orianna (Mid → Mid) · Ornn (Top → Top) · Jinx (Bot → Bot) · Nautilus (Support → Support) | Lille Esport | LFL/2026 Season/Invitational_Week 3_8_1 |
| lfl-2026.json | B | Nami | Support | Support | Ornn (Top → Top) · Corki (Bot → Bot) · Taliyah (Mid → Mid) · Aatrox (Jungle → Jungle) | Galions | LFL/2026 Season/Invitational_Tiebreakers_3_1 |
| lfl-2026.json | B | Rengar | Jungle | Jungle | Orianna (Mid → Mid) · Nami (Support → Support) · Corki (Bot → Bot) · K'Sante (Top → Top) | French Flair | LFL/2026 Season/Invitational_Round 1_1_3 |
| lfl-2026.json | B | Fiora | Top | Top | Ryze (Mid → Mid) · Aphelios (Bot → Bot) · Nautilus (Support → Support) · Jayce (Jungle → Jungle) | Joblife | LFL/2026 Season/Invitational_Round 1_2_3 |
| lfl-2026.json | B | Karthus | Bot | Bot | Orianna (Mid → Mid) · Rell (Support → Support) · Nocturne (Jungle → Jungle) · Zaahen (Top → Top) | TLN Pirates | LFL/2026 Season/Invitational_Round 1_2_4 |
| lfl-2026.json | B | Singed | Top | Top | Azir (Mid → Mid) · Pantheon (Jungle → Jungle) · Kai'Sa (Bot → Bot) · Pyke (Support → Support) | Joblife | LFL/2026 Season/Invitational_Round 1_2_4 |
| lfl-2026.json | A | Poppy | Top | ∅ | Maokai (Jungle → ∅) · Ezreal (Bot → ∅) · Mel (Mid → ∅) · Renata Glasc (Support → ∅) | TLN Pirates | LFL/2026 Season/Invitational_Round 1_2_5 |
| lfl-2026.json | B | Mel | Mid | ∅ | Maokai (Jungle → ∅) · Ezreal (Bot → ∅) · Renata Glasc (Support → ∅) · Poppy (Top → ∅) | TLN Pirates | LFL/2026 Season/Invitational_Round 1_2_5 |
| lfl-2026.json | B | Mel | Mid | Mid | Aatrox (Jungle → Top) · Jayce (Top → Jungle) · Rakan (Support → Support) · Xayah (Bot → Bot) | Galions | LFL/2026 Season/Invitational_Round 2_1_4 |
| lfl-2026.json | B | Ashe | Bot | Support | Jarvan IV (Jungle → Jungle) · Ahri (Mid → Mid) · Zaahen (Top → Top) | Galions | LFL/2026 Season/Invitational_Round 3_1_2 |
| lfl-2026.json | B | Seraphine | Support | Bot | Jarvan IV (Jungle → Jungle) · Ahri (Mid → Mid) · Zaahen (Top → Top) | Galions | LFL/2026 Season/Invitational_Round 3_1_2 |
| lfl-2026.json | B | LeBlanc | Mid | Mid | Aatrox (Jungle → Jungle) · Ambessa (Top → Top) · Zeri (Bot → Bot) · Lulu (Support → Support) | French Flair | LFL/2026 Season/Invitational_Round 3_1_2 |
| lfl-2026.json | B | Aurelion Sol | Mid | Mid | Maokai (Jungle → Jungle) · Renata Glasc (Support → Support) · Aphelios (Bot → Bot) · Renekton (Top → Top) | Galions | LFL/2026 Season/Invitational_Round 3_1_5 |
| lfl-2026.json | B | Mel | Mid | Mid | Kalista (Bot → Bot) · Nocturne (Jungle → Jungle) · Karma (Support → Support) | French Flair | LFL/2026 Season/Invitational_Round 3_1_5 |
| lfl-2026.json | B | Olaf | Top | Top | Kalista (Bot → Bot) · Nocturne (Jungle → Jungle) · Karma (Support → Support) | French Flair | LFL/2026 Season/Invitational_Round 3_1_5 |
| lfl-2026.json | B | Ashe | Bot | Bot | Jarvan IV (Jungle → Jungle) · K'Sante (Top → Top) | Galions | LFL/2026 Season/Invitational_Finals_1_1 |
| lfl-2026.json | B | Seraphine | Support | Mid | Jarvan IV (Jungle → Jungle) · K'Sante (Top → Top) | Galions | LFL/2026 Season/Invitational_Finals_1_1 |
| lfl-2026.json | B | Mel | Mid | Support | Jarvan IV (Jungle → Jungle) · K'Sante (Top → Top) | Galions | LFL/2026 Season/Invitational_Finals_1_1 |
| lfl-2026.json | A | Renekton | Mid | Top | Aurora (Top → Mid) · Aatrox (Jungle → Jungle) · Caitlyn (Bot → Bot) · Karma (Support → Support) | Galions | LFL/2026 Season/Invitational_Finals_1_3 |
| lfl-2026.json | B | Twisted Fate | Mid | Mid | Yunara (Bot → Bot) · Pantheon (Jungle → Jungle) · Lulu (Support → Support) · Sion (Top → Top) | Ici Japon Corp. Esport | LFL/2026 Season/Spring Split_Week 1_10_1 |
| lfl-2026.json | B | Malzahar | Mid | Mid | Ezreal (Bot → Bot) · Aatrox (Jungle → Jungle) · Gnar (Top → Top) · Rakan (Support → Support) | Galions | LFL/2026 Season/Spring Split_Week 1_15_1 |
| lfl-2026.json | B | Elise | Support | Support | Rumble (Top → Top) · Tristana (Bot → Bot) · Zaahen (Jungle → Jungle) · Ahri (Mid → Mid) | ZYB Esport | LFL/2026 Season/Spring Split_Week 2_8_1 |
| lfl-2026.json | B | Lissandra | Mid | Mid | Ezreal (Bot → Bot) · Bard (Support → Support) · Jayce (Jungle → Jungle) · Gnar (Top → Top) | Galions | LFL/2026 Season/Spring Split_Week 2_12_1 |
| lfl-2026.json | B | Taric | Support | Support | Ashe (Bot → Bot) · Xin Zhao (Jungle → Jungle) · Renekton (Top → Top) · Ahri (Mid → Mid) | TLN Pirates | LFL/2026 Season/Spring Split_Week 3_1_1 |
| lfl-2026.json | A | Anivia | Top | Mid | Ezreal (Bot → Bot) · Karma (Support → Support) · Olaf (Jungle → Top) · Sylas (Mid → Jungle) | Solary | LFL/2026 Season/Spring Split_Week 3_3_1 |
| lfl-2026.json | B | Zilean | Top | Top | Caitlyn (Bot → Bot) · Xin Zhao (Jungle → Jungle) · Karma (Support → Support) · Ryze (Mid → Mid) | Solary | LFL/2026 Season/Spring Split_Week 4_5_1 |
| lfl-2026.json | A | Anivia | Support | ∅ | Caitlyn (Bot → ∅) · Ahri (Mid → ∅) · Naafiri (Jungle → ∅) · Fiora (Top → ∅) | Vitality.Bee | LFL/2026 Season/Spring Playoffs_Round 1_3_2 |
| lfl-2026.json | B | Samira | Bot | Bot | Rell (Support → Support) · Jax (Top → Top) · Sejuani (Jungle → Jungle) · Azir (Mid → Mid) | ZYB Esport | LFL/2026 Season/Spring Playoffs_Round 1_6_2 |
| lfl-2026.json | B | Volibear | Top | Top | Nocturne (Jungle → Jungle) · Syndra (Mid → Mid) · Alistar (Support → Support) · Sivir (Bot → Bot) | TLN Pirates | LFL/2026 Season/Spring Playoffs_Round 3_1_3 |
| lfl-2026.json | B | Nilah | Bot | Bot | Wukong (Jungle → Jungle) · Ornn (Top → Top) · Viktor (Mid → Mid) · Renata Glasc (Support → Support) | Galions | LFL/2026 Season/Spring Playoffs_Round 4_2_3 |
| lfl-2026.json | A | Naafiri | Top | ∅ | Lucian (Bot → ∅) · Annie (Mid → ∅) · Braum (Support → ∅) · Wukong (Jungle → ∅) | Solary | LFL/2026 Season/Spring Playoffs_Finals_1_1 |
| lfl-2026.json | B | Irelia | Top | Top | Caitlyn (Bot → Bot) · Jarvan IV (Jungle → Jungle) · Akali (Mid → Mid) · Pyke (Support → Support) | Galions | LFL/2026 Season/Spring Playoffs_Finals_1_3 |
| lpl-2026.json | B | Ekko | Mid | Mid | K'Sante (Top → Top) · Ashe (Bot → Bot) · Seraphine (Support → Support) · Vi (Jungle → Jungle) | Ultra Prime | LPL/2026 Season/Split 1_Week 3_3_1 |
| lpl-2026.json | B | Aatrox | Top | Top | Yunara (Bot → Bot) · Xin Zhao (Jungle → Jungle) · Lulu (Support → Support) · Syndra (Mid → Mid) | Top Esports | LPL/2026 Season/Split 1_Week 3_4_2 |
| lpl-2026.json | B | Swain | Mid | Mid | Ambessa (Jungle → Jungle) · Sivir (Bot → Bot) · Nautilus (Support → Support) · K'Sante (Top → Top) | Invictus Gaming | LPL/2026 Season/Split 1_Week 3_5_3 |
| lpl-2026.json | A | Varus | Top | ∅ | Vi (Jungle → ∅) · Ahri (Mid → ∅) · Yunara (Bot → ∅) · Rakan (Support → ∅) | Ninjas in Pyjamas.CN | LPL/2026 Season/Split 1_Week 3_8_1 |
| lpl-2026.json | B | Tristana | Bot | Bot | Rumble (Top → Top) · Pantheon (Jungle → Jungle) · Akali (Mid → Mid) · Leona (Support → Support) | Ninjas in Pyjamas.CN | LPL/2026 Season/Split 1_Week 3_8_2 |
| lpl-2026.json | B | Yasuo | Top | Top | Azir (Mid → Mid) · Xin Zhao (Jungle → Jungle) · Miss Fortune (Bot → Bot) · Rakan (Support → Support) | ThunderTalk Gaming | LPL/2026 Season/Split 1_Week 3_9_1 |
| lpl-2026.json | A | Varus | Top | ∅ | Sejuani (Jungle → ∅) · Yone (Mid → ∅) · Jhin (Bot → ∅) · Bard (Support → ∅) | Ninjas in Pyjamas.CN | LPL/2026 Season/Split 1_Week 3_9_1 |
| lpl-2026.json | B | Sejuani | Jungle | ∅ | Varus (Top → ∅) · Yone (Mid → ∅) · Jhin (Bot → ∅) · Bard (Support → ∅) | Ninjas in Pyjamas.CN | LPL/2026 Season/Split 1_Week 3_9_1 |
| lpl-2026.json | B | Elise | Support | Jungle | Rumble (Top → Top) · Poppy (Jungle → Support) · Cassiopeia (Mid → Mid) · Caitlyn (Bot → Bot) | Weibo Gaming | LPL/2026 Season/Split 1_Week 3_10_3 |
| lpl-2026.json | A | Pantheon | Support | ∅ | Sivir (Bot → ∅) · Akali (Mid → ∅) · Wukong (Jungle → ∅) · Aatrox (Top → ∅) | Top Esports | LPL/2026 Season/Split 1_Week 3_12_3 |
| lpl-2026.json | B | Aatrox | Top | ∅ | Sivir (Bot → ∅) · Pantheon (Support → ∅) · Akali (Mid → ∅) · Wukong (Jungle → ∅) | Top Esports | LPL/2026 Season/Split 1_Week 3_12_3 |
| lpl-2026.json | B | Swain | Mid | Mid | Xin Zhao (Jungle → Jungle) · Lulu (Support → Support) · Jax (Top → Top) · Kai'Sa (Bot → Bot) | JD Gaming | LPL/2026 Season/Split 1_Week 3_13_3 |
| lpl-2026.json | B | Naafiri | Jungle | Jungle | Neeko (Support → Support) · Ambessa (Top → Top) · Sivir (Bot → Bot) · Galio (Mid → Mid) | Anyone's Legend | LPL/2026 Season/Split 1_Week 3_13_3 |
| lpl-2026.json | B | Hwei | Mid | Mid | Yunara (Bot → Bot) · Vi (Jungle → Jungle) · Braum (Support → Support) · Rek'Sai (Top → Top) | LNG Esports | LPL/2026 Season/Split 1_Week 3_15_3 |
| lpl-2026.json | B | Aatrox | Top | Top | Aphelios (Bot → Bot) · Vi (Jungle → Jungle) · Thresh (Support → Support) · Ryze (Mid → Mid) | Top Esports | LPL/2026 Season/Split 1_Week 3_16_2 |
| lpl-2026.json | B | Pyke | Support | Support | Jarvan IV (Jungle → Jungle) · Jhin (Bot → Bot) · Zaahen (Top → Top) · Syndra (Mid → Mid) | Oh My God | LPL/2026 Season/Split 1_Week 4_1_3 |
| lpl-2026.json | B | Aatrox | Jungle | Jungle | Neeko (Support → Support) · Kai'Sa (Bot → Bot) · Sion (Top → Top) · Syndra (Mid → Mid) | Weibo Gaming | LPL/2026 Season/Split 1_Week 4_2_2 |
| lpl-2026.json | B | Naafiri | Jungle | Jungle | Ambessa (Top → Top) · Ezreal (Bot → Bot) · Karma (Support → Support) · Zoe (Mid → Mid) | LNG Esports | LPL/2026 Season/Split 1_Week 4_3_2 |
| lpl-2026.json | B | Twisted Fate | Mid | Mid | Neeko (Support → Support) · Corki (Bot → Bot) · Wukong (Jungle → Jungle) · Renekton (Top → Top) | JD Gaming | LPL/2026 Season/Split 1_Week 4_4_3 |
| lpl-2026.json | B | Naafiri | Top | Jungle | Azir (Mid → Mid) · Miss Fortune (Bot → Bot) · Rakan (Support → Support) | Anyone's Legend | LPL/2026 Season/Split 1_Week 4_6_3 |
| lpl-2026.json | B | Sejuani | Jungle | Top | Azir (Mid → Mid) · Miss Fortune (Bot → Bot) · Rakan (Support → Support) | Anyone's Legend | LPL/2026 Season/Split 1_Week 4_6_3 |
| lpl-2026.json | A | Varus | Top | ∅ | Nocturne (Jungle → ∅) · Akali (Mid → ∅) · Jhin (Bot → ∅) · Leona (Support → ∅) | Weibo Gaming | LPL/2026 Season/Split 1_Week 4_6_3 |
| lpl-2026.json | B | Aatrox | Jungle | Jungle | Azir (Mid → Mid) · Yunara (Bot → Bot) · K'Sante (Top → Top) · Renata Glasc (Support → Support) | Bilibili Gaming | LPL/2026 Season/Split 1_Week 4_10_2 |
| lpl-2026.json | B | Sejuani | Jungle | Jungle | Viktor (Mid → Mid) · Corki (Bot → Bot) · Nautilus (Support → Support) · Renekton (Top → Top) | Anyone's Legend | LPL/2026 Season/Split 1_Week 4_10_3 |
| lpl-2026.json | B | Kindred | Jungle | Jungle | Aurora (Top → Mid) · Bard (Support → Support) · Ezreal (Bot → Bot) · Galio (Mid → Top) | Bilibili Gaming | LPL/2026 Season/Split 1_Week 4_10_3 |
| lpl-2026.json | B | Skarner | Jungle | Jungle | Azir (Mid → Mid) · Rumble (Top → Top) · Aphelios (Bot → Bot) · Lulu (Support → Support) | Team WE | LPL/2026 Season/Split 1 Playoffs_Play-In Round 1_1_1 |
| lpl-2026.json | B | Twisted Fate | Mid | Mid | Poppy (Jungle → Jungle) · Corki (Bot → Bot) · Nami (Support → Support) · Zaahen (Top → Top) | Team WE | LPL/2026 Season/Split 1 Playoffs_Play-In Round 1_1_4 |
| lpl-2026.json | B | Elise | Support | Support | Wukong (Jungle → Jungle) · Syndra (Mid → Mid) · K'Sante (Top → Top) · Caitlyn (Bot → Bot) | Top Esports | LPL/2026 Season/Split 1 Playoffs_Play-In Round 1_1_4 |
| lpl-2026.json | B | Yuumi | Support | Support | Kennen (Top → Top) · Sivir (Bot → Bot) · Dr. Mundo (Jungle → Jungle) · Sylas (Mid → Mid) | Team WE | LPL/2026 Season/Split 1 Playoffs_Play-In Round 1_1_5 |
| lpl-2026.json | B | Vladimir | Top | Top | Nocturne (Jungle → Jungle) · Zeri (Bot → Bot) · Rakan (Support → Support) | Top Esports | LPL/2026 Season/Split 1 Playoffs_Play-In Round 1_1_5 |
| lpl-2026.json | B | Smolder | Mid | Mid | Nocturne (Jungle → Jungle) · Zeri (Bot → Bot) · Rakan (Support → Support) | Top Esports | LPL/2026 Season/Split 1 Playoffs_Play-In Round 1_1_5 |
| lpl-2026.json | A | Varus | Top | ∅ | Ryze (Mid → ∅) · Qiyana (Jungle → ∅) · Jhin (Bot → ∅) · Bard (Support → ∅) | Ninjas in Pyjamas.CN | LPL/2026 Season/Split 1 Playoffs_Play-In Round 1_2_1 |
| lpl-2026.json | A | Malphite | Top | ∅ | Ashe (Bot → ∅) · Seraphine (Support → ∅) · Jayce (Jungle → ∅) · Syndra (Mid → ∅) | Invictus Gaming | LPL/2026 Season/Split 1 Playoffs_Play-In Round 1_2_4 |
| lpl-2026.json | B | Diana | Mid | Mid | Yunara (Bot → Bot) · Lulu (Support → Support) · Trundle (Jungle → Jungle) · Ornn (Top → Top) | Ninjas in Pyjamas.CN | LPL/2026 Season/Split 1 Playoffs_Play-In Round 1_2_4 |
| lpl-2026.json | B | Naafiri | Jungle | Jungle | Varus (Bot → Bot) · Taliyah (Mid → Mid) · Nautilus (Support → Support) · Gwen (Top → Top) | ThunderTalk Gaming | LPL/2026 Season/Split 1 Playoffs_Play-In Round 2_1_3 |
| lpl-2026.json | B | Nidalee | Top | Top | Lulu (Support → Support) · Trundle (Jungle → Jungle) · Yunara (Bot → Bot) · Viktor (Mid → Mid) | EDward Gaming | LPL/2026 Season/Split 1 Playoffs_Play-In Round 2_2_4 |
| lpl-2026.json | B | Zac | Jungle | Jungle | Aphelios (Bot → Bot) · Thresh (Support → Support) · Gnar (Top → Top) · Yone (Mid → Mid) | Oh My God | LPL/2026 Season/Split 1 Playoffs_Play-In Round 2_2_4 |
| lpl-2026.json | B | Lee Sin | Jungle | Support | Miss Fortune (Bot → Bot) · Akali (Mid → Mid) · Gnar (Top → Top) | Oh My God | LPL/2026 Season/Split 1 Playoffs_Play-In Round 3_1_3 |
| lpl-2026.json | B | Rammus | Support | Jungle | Miss Fortune (Bot → Bot) · Akali (Mid → Mid) · Gnar (Top → Top) | Oh My God | LPL/2026 Season/Split 1 Playoffs_Play-In Round 3_1_3 |
| lpl-2026.json | A | Jax | Jungle | ∅ | Rumble (Top → ∅) · Orianna (Mid → ∅) · Lucian (Bot → ∅) · Nami (Support → ∅) | LNG Esports | LPL/2026 Season/Split 1 Playoffs_Play-In Round 3_2_2 |
| lpl-2026.json | B | Kha'Zix | Jungle | Jungle | Sion (Top → Top) · Miss Fortune (Bot → Bot) · Rell (Support → Support) · Syndra (Mid → Mid) | LNG Esports | LPL/2026 Season/Split 1 Playoffs_Play-In Round 3_2_4 |
| lpl-2026.json | B | Aatrox | Top | Top | Jayce (Jungle → Jungle) · Jhin (Bot → Bot) · Leona (Support → Support) · Akali (Mid → Mid) | Team WE | LPL/2026 Season/Split 1 Playoffs_Play-In Round 3_2_4 |
| lpl-2026.json | B | Gangplank | Top | Top | Aurora (Mid → Mid) · Wukong (Jungle → Jungle) · Corki (Bot → Bot) · Bard (Support → Support) | Top Esports | LPL/2026 Season/Split 1 Playoffs_Round 1_1_2 |
| lpl-2026.json | B | Maokai | Jungle | Jungle | Rumble (Top → Top) · Sivir (Bot → Bot) · Nautilus (Support → Support) · Yone (Mid → Mid) | Top Esports | LPL/2026 Season/Split 1 Playoffs_Round 1_1_3 |
| lpl-2026.json | A | Jayce | Top | ∅ | Ezreal (Bot → ∅) · Karma (Support → ∅) · Viktor (Mid → ∅) · Lee Sin (Jungle → ∅) | Top Esports | LPL/2026 Season/Split 1 Playoffs_Round 1_1_4 |
| lpl-2026.json | B | Xayah | Bot | Bot | Rakan (Support → Support) · Jax (Top → Top) · Ahri (Mid → Mid) · Qiyana (Jungle → Jungle) | JD Gaming | LPL/2026 Season/Split 1 Playoffs_Round 1_1_5 |
| lpl-2026.json | A | Jayce | Top | Jungle | Ezreal (Bot → Bot) · Sylas (Mid → Mid) · Blitzcrank (Support → Support) | Team WE | LPL/2026 Season/Split 1 Playoffs_Round 1_2_3 |
| lpl-2026.json | A | Zaahen | Jungle | Top | Ezreal (Bot → Bot) · Sylas (Mid → Mid) · Blitzcrank (Support → Support) | Team WE | LPL/2026 Season/Split 1 Playoffs_Round 1_2_3 |
| lpl-2026.json | A | Jayce | Top | ∅ | Aurora (Mid → ∅) · Corki (Bot → ∅) · Nami (Support → ∅) · Dr. Mundo (Jungle → ∅) | Ninjas in Pyjamas.CN | LPL/2026 Season/Split 1 Playoffs_Round 1_4_2 |
| lpl-2026.json | A | Sylas | Top | ∅ | Yunara (Bot → ∅) · Qiyana (Jungle → ∅) · Karma (Support → ∅) · Twisted Fate (Mid → ∅) | Ninjas in Pyjamas.CN | LPL/2026 Season/Split 1 Playoffs_Round 1_4_3 |
| lpl-2026.json | B | Maokai | Jungle | Jungle | Aurora (Top → Top) · Ashe (Bot → Bot) · Seraphine (Support → Support) · Yone (Mid → Mid) | JD Gaming | LPL/2026 Season/Split 1 Playoffs_Round 2_1_2 |
| lpl-2026.json | B | Xayah | Bot | Bot | Aurora (Mid → Mid) · Viego (Jungle → Jungle) · Gnar (Top → Top) · Rell (Support → Support) | Team WE | LPL/2026 Season/Split 1 Playoffs_Round 1_5_2 |
| lpl-2026.json | A | Zaahen | Jungle | ∅ | Yunara (Bot → ∅) · Renekton (Top → ∅) · Nautilus (Support → ∅) · Taliyah (Mid → ∅) | Ninjas in Pyjamas.CN | LPL/2026 Season/Split 1 Playoffs_Round 1_6_2 |
| lpl-2026.json | B | Lissandra | Mid | Mid | Ambessa (Top → Top) · Kai'Sa (Bot → Bot) · Alistar (Support → Support) · Lee Sin (Jungle → Jungle) | Invictus Gaming | LPL/2026 Season/Split 1 Playoffs_Round 1_6_3 |
| lpl-2026.json | B | Gangplank | Top | Top | Yunara (Bot → Bot) · Pantheon (Jungle → Jungle) · Ahri (Mid → Mid) · Rakan (Support → Support) | Top Esports | LPL/2026 Season/Split 1 Playoffs_Round 2_3_3 |
| lpl-2026.json | A | Jayce | Top | ∅ | Vi (Jungle → ∅) · Corki (Bot → ∅) · Taliyah (Mid → ∅) · Nautilus (Support → ∅) | Anyone's Legend | LPL/2026 Season/Split 1 Playoffs_Round 2_4_2 |
| lpl-2026.json | B | Annie | Mid | Mid | Kai'Sa (Bot → Bot) · Wukong (Jungle → Jungle) · Alistar (Support → Support) · Yorick (Top → Top) | Anyone's Legend | LPL/2026 Season/Split 1 Playoffs_Round 2_4_4 |
| lpl-2026.json | B | Xayah | Bot | Jungle | Gnar (Top → Top) · Rakan (Support → Support) · Yone (Mid → Mid) | Invictus Gaming | LPL/2026 Season/Split 1 Playoffs_Round 2_4_4 |
| lpl-2026.json | B | Maokai | Jungle | Bot | Gnar (Top → Top) · Rakan (Support → Support) · Yone (Mid → Mid) | Invictus Gaming | LPL/2026 Season/Split 1 Playoffs_Round 2_4_4 |
| lpl-2026.json | B | Olaf | Jungle | Jungle | Ashe (Bot → Bot) · Lulu (Support → Support) · Twisted Fate (Mid → Mid) · Jax (Top → Top) | JD Gaming | LPL/2026 Season/Split 1 Playoffs_Round 4_1_3 |
| lpl-2026.json | A | Anivia | Support | Mid | Pantheon (Jungle → Support) · Kalista (Bot → Bot) · Yorick (Top → Top) · Sylas (Mid → Jungle) | Bilibili Gaming | LPL/2026 Season/Split 1 Playoffs_Round 4_1_5 |
| lpl-2026.json | B | Camille | Top | Top | Ryze (Mid → Mid) · Nocturne (Jungle → Jungle) · Sivir (Bot → Bot) · Rakan (Support → Support) | Weibo Gaming | LPL/2026 Season/Split 1 Playoffs_Round 3_1_3 |
| lpl-2026.json | B | Warwick | Jungle | Jungle | Aurora (Top → Top) · Corki (Bot → Bot) · Nami (Support → Support) · LeBlanc (Mid → Mid) | Weibo Gaming | LPL/2026 Season/Split 1 Playoffs_Round 3_1_4 |
| lpl-2026.json | B | Maokai | Jungle | Jungle | Varus (Bot → Bot) · Nautilus (Support → Support) · Renekton (Top → Top) · Yone (Mid → Mid) | JD Gaming | LPL/2026 Season/Split 1 Playoffs_Round 4_2_2 |
| lpl-2026.json | A | Jayce | Top | ∅ | Jarvan IV (Jungle → ∅) · Corki (Bot → ∅) · Nami (Support → ∅) · Mel (Mid → ∅) | JD Gaming | LPL/2026 Season/Split 1 Playoffs_Finals_1_2 |
| lpl-2026.json | B | Kog'Maw | Bot | Bot | Lulu (Support → Support) · Xin Zhao (Jungle → Jungle) · Sion (Top → Top) · Taliyah (Mid → Mid) | JD Gaming | LPL/2026 Season/Split 1 Playoffs_Finals_1_3 |
| lpl-2026.json | B | Xayah | Bot | Bot | Ryze (Mid → Mid) · Rakan (Support → Support) · Gwen (Top → Top) · Qiyana (Jungle → Jungle) | Bilibili Gaming | LPL/2026 Season/Split 1 Playoffs_Finals_1_4 |
| lpl-2026.json | B | Milio | Support | Support | Azir (Mid → Mid) · Pantheon (Jungle → Jungle) · Renekton (Top → Top) · Lucian (Bot → Bot) | Ninjas in Pyjamas.CN | LPL/2026 Season/Split 2_Week 2_1_2 |
| lpl-2026.json | A | Anivia | Top | ∅ | Nocturne (Jungle → ∅) · Jhin (Bot → ∅) · Shen (Support → ∅) · Yone (Mid → ∅) | Ninjas in Pyjamas.CN | LPL/2026 Season/Split 2_Week 2_1_3 |
| lpl-2026.json | B | Milio | Support | Support | Rumble (Top → Top) · Vi (Jungle → Jungle) · Ahri (Mid → Mid) · Lucian (Bot → Bot) | Ninjas in Pyjamas.CN | LPL/2026 Season/Split 2_Week 2_3_1 |
| lpl-2026.json | A | Anivia | Top | ∅ | Pantheon (Jungle → ∅) · Lulu (Support → ∅) · Yunara (Bot → ∅) · Azir (Mid → ∅) | EDward Gaming | LPL/2026 Season/Split 2_Week 2_5_1 |
| lpl-2026.json | B | Milio | Support | Support | Vi (Jungle → Jungle) · Aurora (Mid → Mid) · Jayce (Top → Top) · Lucian (Bot → Bot) | EDward Gaming | LPL/2026 Season/Split 2_Week 2_5_2 |
| lpl-2026.json | B | Vayne | Top | Top | Ezreal (Bot → Bot) · Pantheon (Jungle → Jungle) · Bard (Support → Support) · Twisted Fate (Mid → Mid) | JD Gaming | LPL/2026 Season/Split 2_Week 2_8_2 |
| lpl-2026.json | B | Milio | Support | Support | Jarvan IV (Jungle → Jungle) · Lucian (Bot → Bot) · Azir (Mid → Mid) · Sion (Top → Top) | Oh My God | LPL/2026 Season/Split 2_Week 2_9_3 |
| lpl-2026.json | B | Vayne | Top | Top | Seraphine (Support → Support) · Jarvan IV (Jungle → Jungle) · Ezreal (Bot → Bot) · Azir (Mid → Mid) | Top Esports | LPL/2026 Season/Split 2_Week 3_4_1 |
| lpl-2026.json | B | Milio | Support | Support | Jarvan IV (Jungle → Jungle) · Rumble (Top → Top) · Azir (Mid → Mid) · Lucian (Bot → Bot) | ThunderTalk Gaming | LPL/2026 Season/Split 2_Week 3_5_1 |
| lpl-2026.json | B | Milio | Support | Support | Lucian (Bot → Bot) · Gnar (Top → Top) · Ryze (Mid → Mid) · Lee Sin (Jungle → Jungle) | Ninjas in Pyjamas.CN | LPL/2026 Season/Split 2_Week 3_6_2 |
| lpl-2026.json | B | Milio | Support | Support | Ryze (Mid → Mid) · Pantheon (Jungle → Jungle) · Ambessa (Top → Top) · Lucian (Bot → Bot) | Weibo Gaming | LPL/2026 Season/Split 2_Week 3_8_1 |
| lpl-2026.json | B | Xerath | Mid | Mid | Rumble (Top → Top) · Ezreal (Bot → Bot) · Pantheon (Jungle → Jungle) · Nami (Support → Support) | Invictus Gaming | LPL/2026 Season/Split 2_Week 3_9_1 |
| lpl-2026.json | B | Milio | Support | Support | Lucian (Bot → Bot) · Nocturne (Jungle → Jungle) · Galio (Mid → Mid) | Anyone's Legend | LPL/2026 Season/Split 2_Week 3_10_2 |
| lpl-2026.json | B | Vayne | Top | Top | Lucian (Bot → Bot) · Nocturne (Jungle → Jungle) · Galio (Mid → Mid) | Anyone's Legend | LPL/2026 Season/Split 2_Week 3_10_2 |
| lpl-2026.json | B | Tryndamere | Top | Top | Varus (Bot → Bot) · Maokai (Jungle → Jungle) · Alistar (Support → Support) · Yone (Mid → Mid) | JD Gaming | LPL/2026 Season/Split 2_Week 4_6_2 |
| lpl-2026.json | A | Lee Sin | Top | ∅ | Yunara (Bot → ∅) · Lulu (Support → ∅) · Xin Zhao (Jungle → ∅) · Ryze (Mid → ∅) | Top Esports | LPL/2026 Season/Split 2_Week 4_7_2 |
| lpl-2026.json | A | Wukong | Top | ∅ | Orianna (Mid → ∅) · Corki (Bot → ∅) · Nami (Support → ∅) · Pantheon (Jungle → ∅) | Ultra Prime | LPL/2026 Season/Split 2_Week 4_10_1 |
| lpl-2026.json | A | Shen | Top | ∅ | Jarvan IV (Jungle → ∅) · Ezreal (Bot → ∅) · Bard (Support → ∅) · Azir (Mid → ∅) | Anyone's Legend | LPL/2026 Season/Split 2_Week 5_1_1 |
| lpl-2026.json | B | Lux | Support | Support | Annie (Mid → Mid) · Caitlyn (Bot → Bot) · Xin Zhao (Jungle → Jungle) · Gnar (Top → Top) | Invictus Gaming | LPL/2026 Season/Split 2_Week 5_8_2 |
| lpl-2026.json | B | Shyvana | Jungle | Jungle | Seraphine (Support → Support) · Annie (Mid → Mid) · Senna (Bot → Bot) · Gnar (Top → Top) | Ninjas in Pyjamas.CN | LPL/2026 Season/Split 2_Week 6_7_2 |
| lpl-2026.json | B | Shyvana | Jungle | Jungle | Lulu (Support → Support) · Azir (Mid → Mid) · Yunara (Bot → Bot) · Renekton (Top → Top) | Ninjas in Pyjamas.CN | LPL/2026 Season/Split 2_Week 7_1_2 |
| lpl-2026.json | A | Twisted Fate | Top | ∅ | Nautilus (Support → ∅) · Skarner (Jungle → ∅) · Miss Fortune (Bot → ∅) · Ryze (Mid → ∅) | LGD Gaming | LPL/2026 Season/Split 2_Week 7_5_1 |
| lpl-2026.json | A | Twisted Fate | Top | ∅ | Ryze (Mid → ∅) · Corki (Bot → ∅) · Nami (Support → ∅) · Naafiri (Jungle → ∅) | EDward Gaming | LPL/2026 Season/Split 2_Week 7_9_2 |
| lpl-2026.json | A | Rumble | Mid | ∅ | Pantheon (Jungle → ∅) · Ziggs (Bot → ∅) · Leona (Support → ∅) · Vayne (Top → ∅) | EDward Gaming | LPL/2026 Season/Split 2 Playoffs_Play-In_3_4 |
| lpl-2026.json | A | Rek'Sai | Jungle | Top | Twisted Fate (Mid → Mid) · Jax (Top → Jungle) · Ziggs (Bot → Bot) · Camille (Support → Support) | Weibo Gaming | LPL/2026 Season/Split 2 Playoffs_Play-In_4_4 |
| lpl-2026.json | A | Malphite | Mid | Jungle | Kalista (Bot → Bot) · Renata Glasc (Support → Support) · Ambessa (Top → Top) · Sylas (Jungle → Mid) | Weibo Gaming | LPL/2026 Season/Split 2 Playoffs_Play-In_4_5 |
| lpl-2026.json | A | Vayne | Mid | ∅ | Draven (Bot → ∅) · Maokai (Jungle → ∅) · Thresh (Support → ∅) · Zaahen (Top → ∅) | LGD Gaming | LPL/2026 Season/Split 2 Playoffs_Play-In_4_5 |
| lpl-2026.json | B | Fiora | Top | Jungle | Annie (Mid → Mid) · Jayce (Jungle → Top) · Jhin (Bot → Bot) · Rell (Support → Support) | ThunderTalk Gaming | LPL/2026 Season/Split 2 Playoffs_Round 1_1_4 |
| lpl-2026.json | A | Sion | Mid | ∅ | Caitlyn (Bot → ∅) · Elise (Support → ∅) · Naafiri (Jungle → ∅) · Vayne (Top → ∅) | LGD Gaming | LPL/2026 Season/Split 2 Playoffs_Round 1_2_2 |
| lpl-2026.json | A | Skarner | Support | ∅ | Jayce (Jungle → ∅) · Ziggs (Bot → ∅) · Yorick (Top → ∅) · Akali (Mid → ∅) | LGD Gaming | LPL/2026 Season/Split 2 Playoffs_Round 1_2_3 |
| lpl-2026.json | B | Fizz | Mid | Mid | Seraphine (Support → Support) · Xin Zhao (Jungle → Jungle) · Ezreal (Bot → Bot) · Ambessa (Top → Top) | EDward Gaming | LPL/2026 Season/Split 2 Playoffs_Round 1_3_2 |
| lpl-2026.json | B | Morgana | Support | Support | Cassiopeia (Mid → Mid) · Maokai (Jungle → Jungle) · Caitlyn (Bot → Bot) · Renekton (Top → Top) | JD Gaming | LPL/2026 Season/Split 2 Playoffs_Round 2_1_4 |
| lpl-2026.json | A | Rumble | Support | ∅ | Twisted Fate (Top → ∅) · Lee Sin (Jungle → ∅) · Kai'Sa (Bot → ∅) · Galio (Mid → ∅) | Anyone's Legend | LPL/2026 Season/Split 2 Playoffs_Round 2_2_3 |
| lpl-2026.json | A | Renekton | Mid | Top | Yunara (Bot → Bot) · Lulu (Support → Support) · Maokai (Jungle → Jungle) | LGD Gaming | LPL/2026 Season/Split 2 Playoffs_Round 1_5_4 |
| lpl-2026.json | A | Akali | Top | Mid | Yunara (Bot → Bot) · Lulu (Support → Support) · Maokai (Jungle → Jungle) | LGD Gaming | LPL/2026 Season/Split 2 Playoffs_Round 1_5_4 |
| lpl-2026.json | B | Zyra | Mid | Mid | Lucian (Bot → Bot) · Milio (Support → Support) · Trundle (Jungle → Jungle) · Jayce (Top → Top) | EDward Gaming | LPL/2026 Season/Split 2 Playoffs_Round 1_6_2 |
| lpl-2026.json | A | Skarner | Support | ∅ | Ashe (Bot → ∅) · Nidalee (Jungle → ∅) · Zaahen (Top → ∅) | Bilibili Gaming | LPL/2026 Season/Split 2 Playoffs_Round 2_4_4 |
| lpl-2026.json | A | Jayce | Mid | ∅ | Ashe (Bot → ∅) · Nidalee (Jungle → ∅) · Zaahen (Top → ∅) | Bilibili Gaming | LPL/2026 Season/Split 2 Playoffs_Round 2_4_4 |
| lec-2025.json | B | Smolder | Mid | Mid | K'Sante (Top → Top) · Varus (Bot → Bot) · Rell (Support → Support) · Zyra (Jungle → Jungle) | Team Heretics | LEC/2025 Season/Winter Season_Week 2_2_1 |
| lec-2025.json | B | Jhin | Bot | Mid | Maokai (Jungle → Jungle) · Corki (Mid → Bot) · Rell (Support → Support) · Rumble (Top → Top) | Team Vitality | LEC/2025 Season/Winter Season_Week 2_4_1 |
| lec-2025.json | B | Brand | Jungle | Jungle | Varus (Bot → Bot) · K'Sante (Top → Top) · Alistar (Support → Support) | G2 Esports | LEC/2025 Season/Winter Season_Week 2_4_1 |
| lec-2025.json | B | Smolder | Mid | Mid | Varus (Bot → Bot) · K'Sante (Top → Top) · Alistar (Support → Support) | G2 Esports | LEC/2025 Season/Winter Season_Week 2_4_1 |
| lec-2025.json | B | Elise | Support | Support | Viktor (Mid → Mid) · Ezreal (Bot → Bot) · Sejuani (Jungle → Jungle) · Jayce (Top → Top) | SK Gaming | LEC/2025 Season/Winter Season_Week 2_7_1 |
| lec-2025.json | B | Nilah | Bot | Bot | Viktor (Mid → Mid) · K'Sante (Top → Top) · Wukong (Jungle → Jungle) · Rell (Support → Support) | Team Vitality | LEC/2025 Season/Winter Season_Week 2_11_1 |
| lec-2025.json | B | Smolder | Mid | Mid | Vi (Jungle → Jungle) · Kalista (Bot → Bot) · Rell (Support → Support) · Rumble (Top → Top) | Fnatic | LEC/2025 Season/Winter Season_Week 2_12_1 |
| lec-2025.json | B | Nautilus | Support | Support | K'Sante (Top → Top) · Zyra (Jungle → Jungle) · Corki (Mid → Mid) · Miss Fortune (Bot → Bot) | G2 Esports | LEC/2025 Season/Winter Season_Week 2_13_1 |
| lec-2025.json | B | Smolder | Mid | Mid | Varus (Bot → Bot) · Jayce (Top → Top) · Nidalee (Jungle → Jungle) · Leona (Support → Support) | GIANTX | LEC/2025 Season/Winter Season_Week 2_13_1 |
| lec-2025.json | B | Gnar | Top | Top | Viktor (Mid → Mid) · Xin Zhao (Jungle → Jungle) · Ezreal (Bot → Bot) · Leona (Support → Support) | Karmine Corp | LEC/2025 Season/Winter Season_Week 2_14_1 |
| lec-2025.json | B | Nautilus | Support | Support | Corki (Bot → Bot) · Vi (Jungle → Jungle) · Ambessa (Top → Top) · Hwei (Mid → Mid) | Movistar KOI | LEC/2025 Season/Winter Season_Week 2_15_1 |
| lec-2025.json | B | Ashe | Bot | Bot | K'Sante (Top → Top) · Viktor (Mid → Mid) · Xin Zhao (Jungle → Jungle) · Braum (Support → Support) | SK Gaming | LEC/2025 Season/Winter Season_Week 3_1_1 |
| lec-2025.json | B | Aurora | Mid | Mid | Vi (Jungle → Jungle) · Ezreal (Bot → Bot) · Alistar (Support → Support) · Jayce (Top → Top) | GIANTX | LEC/2025 Season/Winter Season_Week 3_2_1 |
| lec-2025.json | B | Cho'Gath | Top | Top | Vi (Jungle → Jungle) · Ezreal (Bot → Bot) · Leona (Support → Support) · Ahri (Mid → Mid) | G2 Esports | LEC/2025 Season/Winter Season_Week 3_3_1 |
| lec-2025.json | B | Lillia | Jungle | Jungle | Corki (Mid → Mid) · K'Sante (Top → Top) · Draven (Bot → Bot) · Rell (Support → Support) | Team Heretics | LEC/2025 Season/Winter Season_Week 3_4_1 |
| lec-2025.json | B | Ornn | Top | Top | Ezreal (Bot → Bot) · Wukong (Jungle → Jungle) · Rakan (Support → Support) · Orianna (Mid → Mid) | SK Gaming | LEC/2025 Season/Winter Season_Week 3_6_1 |
| lec-2025.json | B | Nocturne | Jungle | ∅ | Orianna (Mid → ∅) · Kalista (Bot → ∅) · Renekton (Top → ∅) · Gragas (Support → ∅) | GIANTX | LEC/2025 Season/Winter Season_Week 3_7_1 |
| lec-2025.json | B | Aurora | Mid | Mid | Vi (Jungle → Jungle) · Kai'Sa (Bot → Bot) · Ambessa (Top → Top) · Rakan (Support → Support) | Fnatic | LEC/2025 Season/Winter Season_Week 3_8_1 |
| lec-2025.json | B | Smolder | Mid | Jungle | Varus (Bot → Bot) · Rell (Support → Support) · Taliyah (Jungle → Mid) · Jayce (Top → Top) | Team Heretics | LEC/2025 Season/Winter Season_Week 3_9_1 |
| lec-2025.json | B | Ornn | Top | Top | Ezreal (Bot → Bot) · Wukong (Jungle → Jungle) · Leona (Support → Support) | G2 Esports | LEC/2025 Season/Winter Season_Week 3_10_1 |
| lec-2025.json | B | Aurora | Mid | Mid | Ezreal (Bot → Bot) · Wukong (Jungle → Jungle) · Leona (Support → Support) | G2 Esports | LEC/2025 Season/Winter Season_Week 3_10_1 |
| lec-2025.json | B | Gwen | Top | Top | Varus (Bot → Bot) · Vi (Jungle → Jungle) · Rakan (Support → Support) · Taliyah (Mid → Mid) | Movistar KOI | LEC/2025 Season/Winter Season_Week 3_10_1 |
| lec-2025.json | B | Sion | Top | Top | Corki (Mid → Mid) · Zyra (Jungle → Jungle) · Leona (Support → Support) · Miss Fortune (Bot → Bot) | GIANTX | LEC/2025 Season/Winter Season_Week 3_11_1 |
| lec-2025.json | B | Ziggs | Bot | Mid | Corki (Mid → Bot) · Rell (Support → Support) · Jayce (Top → Top) · Sejuani (Jungle → Jungle) | Movistar KOI | LEC/2025 Season/Winter Season_Week 3_12_1 |
| lec-2025.json | B | Sion | Top | Top | Varus (Bot → Bot) · Xin Zhao (Jungle → Jungle) · Alistar (Support → Support) · Viktor (Mid → Mid) | Rogue (European Team) | LEC/2025 Season/Winter Season_Week 3_12_1 |
| lec-2025.json | B | Ornn | Top | Top | Ezreal (Bot → Bot) · Zyra (Jungle → Jungle) · Rell (Support → Support) | Team BDS | LEC/2025 Season/Winter Season_Week 3_13_1 |
| lec-2025.json | B | Aurora | Mid | Mid | Ezreal (Bot → Bot) · Zyra (Jungle → Jungle) · Rell (Support → Support) | Team BDS | LEC/2025 Season/Winter Season_Week 3_13_1 |
| lec-2025.json | B | Cho'Gath | Top | Top | Ezreal (Bot → Bot) · Vi (Jungle → Jungle) · Leona (Support → Support) · Ahri (Mid → Mid) | G2 Esports | LEC/2025 Season/Winter Season_Week 3_14_1 |
| lec-2025.json | A | Maokai | Top | ∅ | Corki (Bot → ∅) · Rakan (Support → ∅) · Wukong (Jungle → ∅) · Sylas (Mid → ∅) | Team Heretics | LEC/2025 Season/Winter Season_Week 3_14_1 |
| lec-2025.json | B | Diana | Jungle | Top | Corki (Mid → Mid) · Varus (Bot → Bot) · Poppy (Support → Support) | SK Gaming | LEC/2025 Season/Winter Season_Week 3_15_1 |
| lec-2025.json | B | Ornn | Top | Jungle | Corki (Mid → Mid) · Varus (Bot → Bot) · Poppy (Support → Support) | SK Gaming | LEC/2025 Season/Winter Season_Week 3_15_1 |
| lec-2025.json | B | Gnar | Top | Top | Ezreal (Bot → Bot) · Zyra (Jungle → Jungle) · Rell (Support → Support) · Yone (Mid → Mid) | Fnatic | LEC/2025 Season/Winter Season_Week 3_15_1 |
| lec-2025.json | B | Yasuo | Top | Top | Corki (Bot → Bot) · Alistar (Support → Support) · Zyra (Jungle → Jungle) · Yone (Mid → Mid) | Team Heretics | LEC/2025 Season/Winter Playoffs_Round 1_1_2 |
| lec-2025.json | B | Pantheon | Jungle | Jungle | Kalista (Bot → Bot) · Renata Glasc (Support → Support) · Azir (Mid → Mid) | G2 Esports | LEC/2025 Season/Winter Playoffs_Round 1_2_1 |
| lec-2025.json | B | Warwick | Top | Top | Kalista (Bot → Bot) · Renata Glasc (Support → Support) · Azir (Mid → Mid) | G2 Esports | LEC/2025 Season/Winter Playoffs_Round 1_2_1 |
| lec-2025.json | B | Neeko | Support | Support | Ambessa (Top → Top) · Vi (Jungle → Jungle) · Varus (Bot → Bot) · Ahri (Mid → Mid) | GIANTX | LEC/2025 Season/Winter Playoffs_Round 1_2_1 |
| lec-2025.json | B | Mel | Bot | Bot | Skarner (Jungle → Jungle) · Jayce (Mid → Mid) · Galio (Support → Support) · Jax (Top → Top) | GIANTX | LEC/2025 Season/Winter Playoffs_Round 1_2_2 |
| lec-2025.json | B | Lulu | Support | Bot | Xin Zhao (Jungle → Jungle) · Aurora (Mid → Mid) · Maokai (Top → Top) | G2 Esports | LEC/2025 Season/Winter Playoffs_Round 1_2_2 |
| lec-2025.json | B | Sivir | Bot | Support | Xin Zhao (Jungle → Jungle) · Aurora (Mid → Mid) · Maokai (Top → Top) | G2 Esports | LEC/2025 Season/Winter Playoffs_Round 1_2_2 |
| lec-2025.json | B | Viego | Jungle | Jungle | Ambessa (Top → Top) · Aurora (Mid → Mid) · Corki (Bot → Bot) · Rakan (Support → Support) | Team BDS | LEC/2025 Season/Winter Playoffs_Round 1_3_1 |
| lec-2025.json | B | Tristana | Mid | Mid | Maokai (Jungle → Jungle) · Varus (Bot → Bot) · Rumble (Top → Top) · Renata Glasc (Support → Support) | Team BDS | LEC/2025 Season/Winter Playoffs_Round 1_3_2 |
| lec-2025.json | B | Karma | Top | Top | Yone (Mid → Mid) · Sejuani (Jungle → Jungle) · Ezreal (Bot → Bot) · Nautilus (Support → Support) | Movistar KOI | LEC/2025 Season/Winter Playoffs_Round 1_3_2 |
| lec-2025.json | B | Sivir | Bot | Bot | Viktor (Mid → Mid) · Sejuani (Jungle → Jungle) · Rakan (Support → Support) · Jax (Top → Top) | Team Vitality | LEC/2025 Season/Winter Playoffs_Round 1_4_2 |
| lec-2025.json | B | Mel | Mid | Mid | Vi (Jungle → Jungle) · Corki (Bot → Bot) · K'Sante (Top → Top) · Poppy (Support → Support) | Fnatic | LEC/2025 Season/Winter Playoffs_Round 2_1_1 |
| lec-2025.json | B | Pantheon | Jungle | Jungle | Ezreal (Bot → Bot) · Leona (Support → Support) · Aurora (Mid → Mid) | G2 Esports | LEC/2025 Season/Winter Playoffs_Round 2_1_1 |
| lec-2025.json | B | Swain | Top | Top | Ezreal (Bot → Bot) · Leona (Support → Support) · Aurora (Mid → Mid) | G2 Esports | LEC/2025 Season/Winter Playoffs_Round 2_1_1 |
| lec-2025.json | B | Warwick | Top | Support | Maokai (Jungle → Jungle) · Azir (Mid → Mid) | G2 Esports | LEC/2025 Season/Winter Playoffs_Round 2_1_2 |
| lec-2025.json | B | Lulu | Support | Top | Maokai (Jungle → Jungle) · Azir (Mid → Mid) | G2 Esports | LEC/2025 Season/Winter Playoffs_Round 2_1_2 |
| lec-2025.json | B | Sivir | Bot | Bot | Maokai (Jungle → Jungle) · Azir (Mid → Mid) | G2 Esports | LEC/2025 Season/Winter Playoffs_Round 2_1_2 |
| lec-2025.json | B | Xayah | Bot | Jungle | Azir (Mid → Mid) · Rakan (Support → Support) | Movistar KOI | LEC/2025 Season/Winter Playoffs_Round 2_2_2 |
| lec-2025.json | B | Karma | Top | Top | Azir (Mid → Mid) · Rakan (Support → Support) | Movistar KOI | LEC/2025 Season/Winter Playoffs_Round 2_2_2 |
| lec-2025.json | B | Lee Sin | Jungle | Bot | Azir (Mid → Mid) · Rakan (Support → Support) | Movistar KOI | LEC/2025 Season/Winter Playoffs_Round 2_2_2 |
| lec-2025.json | B | Lulu | Support | Support | Wukong (Jungle → Jungle) · Ahri (Mid → Mid) · Gragas (Top → Top) · Zeri (Bot → Bot) | Team Vitality | LEC/2025 Season/Winter Playoffs_Round 1_5_2 |
| lec-2025.json | B | Sivir | Bot | Bot | Maokai (Jungle → Jungle) · Jayce (Mid → Mid) · Rumble (Top → Top) | Team BDS | LEC/2025 Season/Winter Playoffs_Round 1_5_3 |
| lec-2025.json | B | Blitzcrank | Support | Support | Maokai (Jungle → Jungle) · Jayce (Mid → Mid) · Rumble (Top → Top) | Team BDS | LEC/2025 Season/Winter Playoffs_Round 1_5_3 |
| lec-2025.json | B | Mel | Mid | Mid | Ivern (Jungle → Jungle) · Nautilus (Support → Support) · Gnar (Top → Top) · Kai'Sa (Bot → Bot) | Team Vitality | LEC/2025 Season/Winter Playoffs_Round 1_5_3 |
| lec-2025.json | B | Pantheon | Jungle | Jungle | Ambessa (Top → Top) · Ezreal (Bot → Bot) · Azir (Mid → Mid) · Elise (Support → Support) | Team Heretics | LEC/2025 Season/Winter Playoffs_Round 1_6_1 |
| lec-2025.json | B | Tristana | Mid | Mid | Maokai (Jungle → Jungle) · Rell (Support → Support) · Varus (Bot → Bot) | Team Heretics | LEC/2025 Season/Winter Playoffs_Round 1_6_2 |
| lec-2025.json | B | Camille | Top | Top | Maokai (Jungle → Jungle) · Rell (Support → Support) · Varus (Bot → Bot) | Team Heretics | LEC/2025 Season/Winter Playoffs_Round 1_6_2 |
| lec-2025.json | B | Syndra | Mid | Mid | Rumble (Top → Top) · Corki (Bot → Bot) · Alistar (Support → Support) · Xin Zhao (Jungle → Jungle) | GIANTX | LEC/2025 Season/Winter Playoffs_Round 1_6_2 |
| lec-2025.json | B | Yuumi | Support | Support | Jayce (Top → Top) · Zeri (Bot → Bot) · Sejuani (Jungle → Jungle) · Orianna (Mid → Mid) | GIANTX | LEC/2025 Season/Winter Playoffs_Round 1_6_3 |
| lec-2025.json | B | Lulu | Support | Bot | Wukong (Jungle → Jungle) · Sion (Top → Top) · Sylas (Mid → Mid) | Team Heretics | LEC/2025 Season/Winter Playoffs_Round 1_6_3 |
| lec-2025.json | B | Sivir | Bot | Support | Wukong (Jungle → Jungle) · Sion (Top → Top) · Sylas (Mid → Mid) | Team Heretics | LEC/2025 Season/Winter Playoffs_Round 1_6_3 |
| lec-2025.json | B | Xayah | Bot | Mid | Zyra (Jungle → Jungle) · Corki (Mid → Bot) · K'Sante (Top → Top) · Rakan (Support → Support) | Fnatic | LEC/2025 Season/Winter Playoffs_Round 2_3_1 |
| lec-2025.json | B | Pantheon | Jungle | Jungle | Azir (Mid → Mid) · Poppy (Top → Top) · Leona (Support → Support) · Jhin (Bot → Bot) | Fnatic | LEC/2025 Season/Winter Playoffs_Round 2_3_3 |
| lec-2025.json | B | Syndra | Mid | Mid | Ambessa (Top → Top) · Xin Zhao (Jungle → Jungle) · Jinx (Bot → Bot) · Braum (Support → Support) | Team BDS | LEC/2025 Season/Winter Playoffs_Round 2_3_3 |
| lec-2025.json | B | Vex | Top | Top | Vi (Jungle → Jungle) · Yone (Mid → Mid) · Ezreal (Bot → Bot) · Rakan (Support → Support) | Movistar KOI | LEC/2025 Season/Winter Playoffs_Round 2_4_1 |
| lec-2025.json | B | Lee Sin | Mid | Mid | Ambessa (Top → Top) · Sejuani (Jungle → Jungle) · Kai'Sa (Bot → Bot) · Rell (Support → Support) | GIANTX | LEC/2025 Season/Winter Playoffs_Round 2_4_1 |
| lec-2025.json | B | Lulu | Support | Support | Azir (Mid → Mid) · K'Sante (Top → Top) · Varus (Bot → Bot) · Sejuani (Jungle → Jungle) | Karmine Corp | LEC/2025 Season/Winter Playoffs_Round 4_1_1 |
| lec-2025.json | B | Blitzcrank | Support | Top | Ezreal (Bot → Bot) · Maokai (Jungle → Jungle) · Poppy (Top → Support) · Taliyah (Mid → Mid) | G2 Esports | LEC/2025 Season/Winter Playoffs_Round 4_1_1 |
| lec-2025.json | A | Galio | Top | ∅ | Aurora (Mid → ∅) · Rell (Support → ∅) · Kai'Sa (Bot → ∅) · Nocturne (Jungle → ∅) | G2 Esports | LEC/2025 Season/Winter Playoffs_Round 4_1_2 |
| lec-2025.json | B | Senna | Support | Support | Diana (Jungle → Jungle) · Jayce (Mid → Mid) · Ornn (Top → Top) | Karmine Corp | LEC/2025 Season/Winter Playoffs_Round 4_1_3 |
| lec-2025.json | B | Yasuo | Bot | Bot | Diana (Jungle → Jungle) · Jayce (Mid → Mid) · Ornn (Top → Top) | Karmine Corp | LEC/2025 Season/Winter Playoffs_Round 4_1_3 |
| lec-2025.json | B | Viego | Jungle | Mid | Draven (Bot → Bot) · Sion (Top → Top) · Seraphine (Support → Support) | Karmine Corp | LEC/2025 Season/Winter Playoffs_Round 4_1_4 |
| lec-2025.json | B | Ryze | Mid | Jungle | Draven (Bot → Bot) · Sion (Top → Top) · Seraphine (Support → Support) | Karmine Corp | LEC/2025 Season/Winter Playoffs_Round 4_1_4 |
| lec-2025.json | B | Caitlyn | Bot | Bot | Xin Zhao (Jungle → Jungle) · Braum (Support → Support) · Cho'Gath (Top → Top) | G2 Esports | LEC/2025 Season/Winter Playoffs_Round 4_1_4 |
| lec-2025.json | B | Anivia | Mid | Mid | Xin Zhao (Jungle → Jungle) · Braum (Support → Support) · Cho'Gath (Top → Top) | G2 Esports | LEC/2025 Season/Winter Playoffs_Round 4_1_4 |
| lec-2025.json | B | Jarvan IV | Jungle | Jungle | Kalista (Bot → Bot) · Braum (Support → Support) · Ahri (Mid → Mid) · Sion (Top → Top) | Movistar KOI | LEC/2025 Season/Winter Playoffs_Round 3_1_3 |
| lec-2025.json | B | Lee Sin | Jungle | Jungle | Draven (Bot → Bot) · Aurora (Mid → Mid) · Renata Glasc (Support → Support) · Cho'Gath (Top → Top) | Fnatic | LEC/2025 Season/Winter Playoffs_Round 3_1_3 |
| lec-2025.json | B | Karma | Support | Support | Skarner (Jungle → Jungle) · Zeri (Bot → Bot) · Jayce (Top → Top) | Fnatic | LEC/2025 Season/Winter Playoffs_Round 3_1_4 |
| lec-2025.json | B | Syndra | Mid | Mid | Skarner (Jungle → Jungle) · Zeri (Bot → Bot) · Jayce (Top → Top) | Fnatic | LEC/2025 Season/Winter Playoffs_Round 3_1_4 |
| lec-2025.json | B | Sivir | Bot | Mid |  | Movistar KOI | LEC/2025 Season/Winter Playoffs_Round 3_1_4 |
| lec-2025.json | B | Lulu | Support | Top |  | Movistar KOI | LEC/2025 Season/Winter Playoffs_Round 3_1_4 |
| lec-2025.json | B | Amumu | Jungle | Support |  | Movistar KOI | LEC/2025 Season/Winter Playoffs_Round 3_1_4 |
| lec-2025.json | B | Ryze | Mid | Jungle |  | Movistar KOI | LEC/2025 Season/Winter Playoffs_Round 3_1_4 |
| lec-2025.json | B | Camille | Top | Bot |  | Movistar KOI | LEC/2025 Season/Winter Playoffs_Round 3_1_4 |
| lec-2025.json | B | Pantheon | Jungle | Support | Viktor (Mid → Mid) · Gnar (Top → Top) · Zeri (Bot → Bot) | Karmine Corp | LEC/2025 Season/Winter Playoffs_Round 4_2_3 |
| lec-2025.json | B | Zilean | Support | Jungle | Viktor (Mid → Mid) · Gnar (Top → Top) · Zeri (Bot → Bot) | Karmine Corp | LEC/2025 Season/Winter Playoffs_Round 4_2_3 |
| lec-2025.json | B | Xayah | Bot | Bot | Rakan (Support → Support) · Wukong (Jungle → Jungle) · Ornn (Top → Top) | Fnatic | LEC/2025 Season/Winter Playoffs_Round 4_2_3 |
| lec-2025.json | B | Aurelion Sol | Mid | Mid | Rakan (Support → Support) · Wukong (Jungle → Jungle) · Ornn (Top → Top) | Fnatic | LEC/2025 Season/Winter Playoffs_Round 4_2_3 |
| lec-2025.json | B | Caitlyn | Bot | Mid | Zyra (Jungle → Jungle) · Corki (Mid → Bot) · Jax (Top → Top) · Braum (Support → Support) | Karmine Corp | LEC/2025 Season/Winter Playoffs_Round 4_2_4 |
| lec-2025.json | B | Pyke | Support | Support | Yone (Mid → Mid) · Vi (Jungle → Jungle) · Kai'Sa (Bot → Bot) · Sion (Top → Top) | Fnatic | LEC/2025 Season/Winter Playoffs_Round 4_2_4 |
| lec-2025.json | B | Lulu | Support | Jungle | Miss Fortune (Bot → Bot) · Sylas (Mid → Mid) | Fnatic | LEC/2025 Season/Winter Playoffs_Round 4_2_5 |
| lec-2025.json | B | Volibear | Jungle | Top | Miss Fortune (Bot → Bot) · Sylas (Mid → Mid) | Fnatic | LEC/2025 Season/Winter Playoffs_Round 4_2_5 |
| lec-2025.json | B | Camille | Top | Support | Miss Fortune (Bot → Bot) · Sylas (Mid → Mid) | Fnatic | LEC/2025 Season/Winter Playoffs_Round 4_2_5 |
| lec-2025.json | B | Jarvan IV | Jungle | Support | Aurora (Mid → Mid) · Jhin (Bot → Bot) · Renekton (Top → Top) | Karmine Corp | LEC/2025 Season/Winter Playoffs_Round 4_2_5 |
| lec-2025.json | B | Karma | Support | Jungle | Aurora (Mid → Mid) · Jhin (Bot → Bot) · Renekton (Top → Top) | Karmine Corp | LEC/2025 Season/Winter Playoffs_Round 4_2_5 |
| lec-2025.json | B | Aatrox | Top | Top | Varus (Bot → Bot) · Maokai (Jungle → Jungle) · Taliyah (Mid → Mid) · Rell (Support → Support) | Karmine Corp | LEC/2025 Season/Winter Playoffs_Finals_1_1 |
| lec-2025.json | B | Tristana | Mid | Mid | Zyra (Jungle → Jungle) · K'Sante (Top → Top) · Corki (Bot → Bot) | G2 Esports | LEC/2025 Season/Winter Playoffs_Finals_1_2 |
| lec-2025.json | B | Blitzcrank | Support | Support | Zyra (Jungle → Jungle) · K'Sante (Top → Top) · Corki (Bot → Bot) | G2 Esports | LEC/2025 Season/Winter Playoffs_Finals_1_2 |
| lec-2025.json | B | Caitlyn | Bot | Mid |  | G2 Esports | LEC/2025 Season/Winter Playoffs_Finals_1_3 |
| lec-2025.json | B | Ryze | Mid | Top |  | G2 Esports | LEC/2025 Season/Winter Playoffs_Finals_1_3 |
| lec-2025.json | B | Pantheon | Jungle | Support |  | G2 Esports | LEC/2025 Season/Winter Playoffs_Finals_1_3 |
| lec-2025.json | B | Thresh | Support | Jungle |  | G2 Esports | LEC/2025 Season/Winter Playoffs_Finals_1_3 |
| lec-2025.json | B | Urgot | Top | Bot |  | G2 Esports | LEC/2025 Season/Winter Playoffs_Finals_1_3 |
| lec-2025.json | A | Aurora | Top | ∅ | Vi (Jungle → ∅) · Yone (Mid → ∅) · Ashe (Bot → ∅) · Alistar (Support → ∅) | Rogue (European Team) | LEC/2025 Season/Spring Season_Week 1_2_1 |
| lec-2025.json | A | Aurora | Top | ∅ | Skarner (Jungle → ∅) · Azir (Mid → ∅) · Ezreal (Bot → ∅) · Alistar (Support → ∅) | Movistar KOI | LEC/2025 Season/Spring Season_Week 1_3_1 |
| lec-2025.json | B | Sett | Top | Top | Ashe (Bot → Bot) · Xin Zhao (Jungle → Jungle) · Nautilus (Support → Support) · Ahri (Mid → Mid) | G2 Esports | LEC/2025 Season/Spring Season_Week 1_3_2 |
| lec-2025.json | B | Dr. Mundo | Jungle | Jungle | Caitlyn (Bot → Bot) · Neeko (Support → Support) · Viktor (Mid → Mid) · Gnar (Top → Top) | G2 Esports | LEC/2025 Season/Spring Season_Week 1_3_3 |
| lec-2025.json | B | Annie | Top | Top | Skarner (Jungle → Jungle) · Yone (Mid → Mid) · Rell (Support → Support) · Ezreal (Bot → Bot) | Movistar KOI | LEC/2025 Season/Spring Season_Week 1_5_1 |
| lec-2025.json | A | Aurora | Top | ∅ | Xin Zhao (Jungle → ∅) · Taliyah (Mid → ∅) · Kai'Sa (Bot → ∅) · Nautilus (Support → ∅) | Movistar KOI | LEC/2025 Season/Spring Season_Week 1_5_2 |
| lec-2025.json | B | Bard | Support | Support | Corki (Bot → Bot) · Vi (Jungle → Jungle) · Gwen (Top → Top) · Ahri (Mid → Mid) | Rogue (European Team) | LEC/2025 Season/Spring Season_Week 1_6_2 |
| lec-2025.json | B | LeBlanc | Mid | ∅ | Ashe (Bot → ∅) · Pantheon (Jungle → ∅) · Braum (Support → ∅) · Volibear (Top → ∅) | Rogue (European Team) | LEC/2025 Season/Spring Season_Week 1_6_3 |
| lec-2025.json | B | Naafiri | Jungle | Jungle | Yone (Mid → Mid) · Galio (Top → Top) · Varus (Bot → Bot) · Alistar (Support → Support) | Fnatic | LEC/2025 Season/Spring Season_Week 1_7_1 |
| lec-2025.json | B | Lucian | Mid | Mid | Zyra (Jungle → Jungle) · Ashe (Bot → Bot) · Gnar (Top → Top) · Leona (Support → Support) | Team BDS | LEC/2025 Season/Spring Season_Week 2_2_1 |
| lec-2025.json | A | Pantheon | Support | ∅ | Azir (Mid → ∅) · Xin Zhao (Jungle → ∅) · Jhin (Bot → ∅) · Vladimir (Top → ∅) | SK Gaming | LEC/2025 Season/Spring Season_Week 3_3_2 |
| lec-2025.json | B | Vladimir | Top | ∅ | Azir (Mid → ∅) · Xin Zhao (Jungle → ∅) · Jhin (Bot → ∅) · Pantheon (Support → ∅) | SK Gaming | LEC/2025 Season/Spring Season_Week 3_3_2 |
| lec-2025.json | B | Fiddlesticks | Support | Support | Miss Fortune (Bot → Bot) · Vi (Jungle → Jungle) · Akali (Mid → Mid) · Gnar (Top → Top) | Karmine Corp | LEC/2025 Season/Spring Season_Week 3_3_2 |
| lec-2025.json | A | Poppy | Jungle | ∅ | Yone (Mid → ∅) · Rell (Support → ∅) · Corki (Bot → ∅) · Gragas (Top → ∅) | Fnatic | LEC/2025 Season/Spring Season_Week 3_4_2 |
| lec-2025.json | A | Varus | Top | ∅ | Azir (Mid → ∅) · Ivern (Jungle → ∅) · Ezreal (Bot → ∅) · Alistar (Support → ∅) | Movistar KOI | LEC/2025 Season/Spring Season_Week 3_5_1 |
| lec-2025.json | A | Varus | Top | ∅ | Sejuani (Jungle → ∅) · Corki (Bot → ∅) · Rell (Support → ∅) · Sylas (Mid → ∅) | SK Gaming | LEC/2025 Season/Spring Season_Week 3_6_1 |
| lec-2025.json | B | Vladimir | Top | Top | Yone (Mid → Mid) · Kai'Sa (Bot → Bot) · Rakan (Support → Support) · Nocturne (Jungle → Jungle) | SK Gaming | LEC/2025 Season/Spring Season_Week 3_6_2 |
| lec-2025.json | B | Kog'Maw | Bot | Bot | Maokai (Jungle → Jungle) · Viktor (Mid → Mid) · Renekton (Top → Top) · Braum (Support → Support) | Karmine Corp | LEC/2025 Season/Spring Season_Week 4_2_3 |
| lec-2025.json | A | Sylas | Top | ∅ | Naafiri (Jungle → ∅) · Miss Fortune (Bot → ∅) · Ryze (Mid → ∅) · Rakan (Support → ∅) | Team Vitality | LEC/2025 Season/Spring Season_Week 4_6_2 |
| lec-2025.json | B | Malphite | Top | Top | Aurora (Mid → Mid) · Xin Zhao (Jungle → Jungle) · Ezreal (Bot → Bot) · Alistar (Support → Support) | G2 Esports | LEC/2025 Season/Spring Season_Week 5_1_1 |
| lec-2025.json | A | Wukong | Top | ∅ | Azir (Mid → ∅) · Xin Zhao (Jungle → ∅) · Miss Fortune (Bot → ∅) · Nautilus (Support → ∅) | Fnatic | LEC/2025 Season/Spring Season_Week 5_2_2 |
| lec-2025.json | A | Gragas | Mid | ∅ | Miss Fortune (Bot → ∅) · Leona (Support → ∅) · Zyra (Jungle → ∅) · Aatrox (Top → ∅) | G2 Esports | LEC/2025 Season/Spring Season_Week 5_3_3 |
| lec-2025.json | A | Yone | Top | ∅ | Miss Fortune (Bot → ∅) · Wukong (Jungle → ∅) · Rakan (Support → ∅) · Ahri (Mid → ∅) | Team Vitality | LEC/2025 Season/Spring Season_Week 5_6_2 |
| lec-2025.json | B | Shen | Top | Top | Orianna (Mid → Mid) · Varus (Bot → Bot) · Nocturne (Jungle → Jungle) · Alistar (Support → Support) | Team BDS | LEC/2025 Season/Spring Season_Week 6_1_2 |
| lec-2025.json | B | Yorick | Top | Top | Xin Zhao (Jungle → Jungle) · Viktor (Mid → Mid) · Kai'Sa (Bot → Bot) · Rakan (Support → Support) | Rogue (European Team) | LEC/2025 Season/Spring Season_Week 6_2_2 |
| lec-2025.json | B | Shen | Top | Top | Sejuani (Jungle → Jungle) · Azir (Mid → Mid) · Zeri (Bot → Bot) · Rell (Support → Support) | Team BDS | LEC/2025 Season/Spring Season_Week 6_3_2 |
| lec-2025.json | B | Kennen | Top | Jungle | Poppy (Jungle → Top) · Viktor (Mid → Mid) · Rell (Support → Support) · Zeri (Bot → Bot) | Movistar KOI | LEC/2025 Season/Spring Season_Week 6_6_2 |
| lec-2025.json | B | Kennen | Top | Top | Miss Fortune (Bot → Bot) · Naafiri (Jungle → Jungle) · Ryze (Mid → Mid) · Rell (Support → Support) | Karmine Corp | LEC/2025 Season/Spring Season_Week 7_2_2 |
| lec-2025.json | B | Nami | Support | Support | Sejuani (Jungle → Jungle) · Corki (Bot → Bot) · Aurelion Sol (Mid → Mid) · Aatrox (Top → Top) | Team Vitality | LEC/2025 Season/Spring Season_Week 7_2_3 |
| lec-2025.json | B | Shen | Top | Top | Viktor (Mid → Mid) · Caitlyn (Bot → Bot) · Braum (Support → Support) · Lillia (Jungle → Jungle) | G2 Esports | LEC/2025 Season/Spring Season_Week 7_4_2 |
| lec-2025.json | A | Sion | Mid | ∅ | Nidalee (Jungle → ∅) · Jax (Top → ∅) · Kai'Sa (Bot → ∅) · Gragas (Support → ∅) | GIANTX | LEC/2025 Season/Spring Season_Week 7_5_1 |
| lec-2025.json | B | Yorick | Top | Top | Taliyah (Mid → Mid) · Pantheon (Jungle → Jungle) · Kai'Sa (Bot → Bot) · Rell (Support → Support) | Rogue (European Team) | LEC/2025 Season/Spring Season_Week 7_6_1 |
| lec-2025.json | B | Taric | Support | Support | Kalista (Bot → Bot) · Gwen (Top → Top) · Skarner (Jungle → Jungle) · Hwei (Mid → Mid) | Fnatic | LEC/2025 Season/Spring Playoffs_Round 1_1_3 |
| lec-2025.json | B | Trundle | Jungle | Jungle | Kai'Sa (Bot → Bot) · Leona (Support → Support) · Ambessa (Top → Top) · Galio (Mid → Mid) | G2 Esports | LEC/2025 Season/Spring Playoffs_Round 1_1_4 |
| lec-2025.json | A | Nidalee | Top | ∅ | Taliyah (Mid → ∅) · Senna (Bot → ∅) · Nautilus (Support → ∅) · Trundle (Jungle → ∅) | Movistar KOI | LEC/2025 Season/Spring Playoffs_Round 1_2_3 |
| lec-2025.json | B | Trundle | Jungle | ∅ | Taliyah (Mid → ∅) · Senna (Bot → ∅) · Nautilus (Support → ∅) · Nidalee (Top → ∅) | Movistar KOI | LEC/2025 Season/Spring Playoffs_Round 1_2_3 |
| lec-2025.json | B | Zoe | Mid | Mid | Wukong (Jungle → Jungle) · Jhin (Bot → Bot) · Pyke (Support → Support) · Aatrox (Top → Top) | Karmine Corp | LEC/2025 Season/Spring Playoffs_Round 1_2_5 |
| lec-2025.json | A | Smolder | Bot | ∅ | Pantheon (Jungle → ∅) · Rell (Support → ∅) · Ambessa (Top → ∅) · Ryze (Mid → ∅) | Movistar KOI | LEC/2025 Season/Spring Playoffs_Round 3_1_1 |
| lec-2025.json | B | Trundle | Jungle | Jungle | Braum (Support → Support) · Xayah (Bot → Bot) · Gwen (Top → Top) · Annie (Mid → Mid) | G2 Esports | LEC/2025 Season/Spring Playoffs_Round 3_1_3 |
| lec-2025.json | A | Rumble | Support | ∅ | Corki (Bot → ∅) · Sejuani (Jungle → ∅) · Yorick (Top → ∅) · Viktor (Mid → ∅) | GIANTX | LEC/2025 Season/Spring Playoffs_Round 1_3_3 |
| lec-2025.json | B | Milio | Support | Support | Ornn (Top → Top) · Lucian (Bot → Bot) · Maokai (Jungle → Jungle) · Sylas (Mid → Mid) | Fnatic | LEC/2025 Season/Spring Playoffs_Round 1_3_3 |
| lec-2025.json | B | Zoe | Mid | Top | Lucian (Bot → Bot) · Xin Zhao (Jungle → Jungle) · Nami (Support → Support) · Galio (Top → Mid) | Karmine Corp | LEC/2025 Season/Spring Playoffs_Round 2_1_2 |
| lec-2025.json | A | Neeko | Top | ∅ | Yone (Mid → ∅) · Kai'Sa (Bot → ∅) · Naafiri (Jungle → ∅) · Nautilus (Support → ∅) | Movistar KOI | LEC/2025 Season/Spring Playoffs_Round 3_2_2 |
| lec-2025.json | A | Nidalee | Top | ∅ | Azir (Mid → ∅) · Lucian (Bot → ∅) · Nami (Support → ∅) · Skarner (Jungle → ∅) | Karmine Corp | LEC/2025 Season/Spring Playoffs_Round 3_2_2 |
| lec-2025.json | B | Kassadin | Mid | Top | Varus (Top → Bot) · Xin Zhao (Jungle → Jungle) · Alistar (Support → Support) · Tristana (Bot → Mid) | Movistar KOI | LEC/2025 Season/Spring Playoffs_Round 3_2_3 |
| lec-2025.json | B | Trundle | Jungle | ∅ | Senna (Bot → ∅) · Nautilus (Support → ∅) · Ryze (Mid → ∅) · Camille (Top → ∅) | G2 Esports | LEC/2025 Season/Spring Playoffs_Finals_1_2 |
| lec-2025.json | A | Nidalee | Top | Jungle | Poppy (Jungle → Top) · Braum (Support → Support) · Zeri (Bot → Bot) · Sylas (Mid → Mid) | Movistar KOI | LEC/2025 Season/Spring Playoffs_Finals_1_3 |
| lec-2025.json | B | Kassadin | Mid | Mid | Leona (Support → Support) · Ezreal (Bot → Bot) · Naafiri (Jungle → Jungle) · K'Sante (Top → Top) | Movistar KOI | LEC/2025 Season/Spring Playoffs_Finals_1_4 |
| lec-2025.json | A | Dr. Mundo | Top | ∅ | Jinx (Bot → ∅) · Thresh (Support → ∅) · Skarner (Jungle → ∅) · Orianna (Mid → ∅) | G2 Esports | LEC/2025 Season/Spring Playoffs_Finals_1_4 |
| lec-2025.json | B | Yunara | Bot | Bot | Pantheon (Jungle → Jungle) · Orianna (Mid → Mid) · Aatrox (Top → Top) · Alistar (Support → Support) | Natus Vincere | LEC/2025 Season/Summer Season_Week 1_1_1 |
| lec-2025.json | B | Yunara | Bot | Bot | K'Sante (Top → Top) · Taliyah (Mid → Mid) · Rell (Support → Support) · Nocturne (Jungle → Jungle) | Team Heretics | LEC/2025 Season/Summer Season_Week 1_2_1 |
| lec-2025.json | B | Aphelios | Bot | Bot | Ryze (Mid → Mid) · Thresh (Support → Support) · Sejuani (Jungle → Jungle) · Camille (Top → Top) | Team Heretics | LEC/2025 Season/Summer Season_Week 1_2_2 |
| lec-2025.json | A | Jax | Jungle | ∅ | Xayah (Bot → ∅) · Rakan (Support → ∅) · Aurora (Mid → ∅) · Aatrox (Top → ∅) | Team Heretics | LEC/2025 Season/Summer Season_Week 1_2_3 |
| lec-2025.json | B | Aphelios | Bot | Bot | Sejuani (Jungle → Jungle) · Jayce (Top → Top) · Viktor (Mid → Mid) · Braum (Support → Support) | Team BDS | LEC/2025 Season/Summer Season_Week 1_3_2 |
| lec-2025.json | B | Aphelios | Bot | Bot | Aurora (Mid → Mid) · K'Sante (Top → Top) · Pantheon (Jungle → Jungle) · Thresh (Support → Support) | Karmine Corp | LEC/2025 Season/Summer Season_Week 1_4_2 |
| lec-2025.json | B | Yunara | Bot | Bot | Rumble (Top → Top) · Wukong (Jungle → Jungle) · Orianna (Mid → Mid) · Braum (Support → Support) | Fnatic | LEC/2025 Season/Summer Season_Week 1_5_1 |
| lec-2025.json | B | Yunara | Bot | Bot | Azir (Mid → Mid) · Wukong (Jungle → Jungle) · K'Sante (Top → Top) · Braum (Support → Support) | Team Heretics | LEC/2025 Season/Summer Season_Week 2_1_1 |
| lec-2025.json | B | Aphelios | Bot | Bot | Ryze (Mid → Mid) · Poppy (Jungle → Jungle) · Ornn (Top → Top) · Alistar (Support → Support) | Movistar KOI | LEC/2025 Season/Summer Season_Week 2_2_3 |
| lec-2025.json | B | Aphelios | Bot | Bot | Sion (Top → Top) · Viktor (Mid → Mid) · Xin Zhao (Jungle → Jungle) · Rakan (Support → Support) | Team BDS | LEC/2025 Season/Summer Season_Week 2_3_1 |
| lec-2025.json | B | Yunara | Bot | Bot | Azir (Mid → Mid) · Poppy (Jungle → Jungle) · Neeko (Support → Support) · Yorick (Top → Top) | Fnatic | LEC/2025 Season/Summer Season_Week 2_3_2 |
| lec-2025.json | B | Yunara | Bot | Bot | Azir (Mid → Mid) · Rumble (Top → Top) · Skarner (Jungle → Jungle) · Milio (Support → Support) | Karmine Corp | LEC/2025 Season/Summer Season_Week 2_4_1 |
| lec-2025.json | B | Aphelios | Bot | Bot | Yone (Mid → Mid) · Aurora (Top → Top) · Lillia (Jungle → Jungle) · Alistar (Support → Support) | Movistar KOI | LEC/2025 Season/Summer Season_Week 2_4_1 |
| lec-2025.json | B | Kled | Top | Top | Taliyah (Mid → Mid) · Pantheon (Jungle → Jungle) · Kai'Sa (Bot → Bot) · Alistar (Support → Support) | G2 Esports | LEC/2025 Season/Summer Season_Week 3_4_1 |
| lec-2025.json | B | Rek'Sai | Top | Top | Xin Zhao (Jungle → Jungle) · Karma (Support → Support) · Galio (Mid → Mid) · Ezreal (Bot → Bot) | G2 Esports | LEC/2025 Season/Summer Season_Week 3_4_2 |
| lec-2025.json | B | Twisted Fate | Mid | Mid | Yasuo (Top → Top) · Xin Zhao (Jungle → Jungle) · Nautilus (Support → Support) · Xayah (Bot → Bot) | Team Vitality | LEC/2025 Season/Summer Season_Week 4_3_2 |
| lec-2025.json | A | Maokai | Support | ∅ | Azir (Mid → ∅) · Jhin (Bot → ∅) · Jayce (Top → ∅) · Sejuani (Jungle → ∅) | Karmine Corp | LEC/2025 Season/Summer Playoffs_Round 1_1_4 |
| lec-2025.json | B | Twitch | Bot | Bot | Nautilus (Support → Support) · Viktor (Mid → Mid) · Sion (Top → Top) · Ivern (Jungle → Jungle) | Fnatic | LEC/2025 Season/Summer Playoffs_Round 1_2_4 |
| lec-2025.json | B | Qiyana | Jungle | Jungle | Taliyah (Mid → Mid) · Jinx (Bot → Bot) · Rek'Sai (Top → Top) · Leona (Support → Support) | Movistar KOI | LEC/2025 Season/Summer Playoffs_Round 1_2_4 |
| lec-2025.json | A | Maokai | Support | ∅ | Renekton (Top → ∅) · Smolder (Bot → ∅) · Trundle (Jungle → ∅) · LeBlanc (Mid → ∅) | Fnatic | LEC/2025 Season/Summer Playoffs_Round 1_2_5 |
| lec-2025.json | B | Morgana | Mid | Mid | Rumble (Top → Top) · Pantheon (Jungle → Jungle) · Varus (Bot → Bot) · Nautilus (Support → Support) | Team Vitality | LEC/2025 Season/Summer Playoffs_Round 1_3_1 |
| lec-2025.json | B | Zed | Jungle | Jungle | Ryze (Mid → Mid) · Yorick (Top → Top) · Sivir (Bot → Bot) · Lulu (Support → Support) | Team Vitality | LEC/2025 Season/Summer Playoffs_Round 1_3_3 |
| lec-2025.json | B | Tahm Kench | Support | Support | Jayce (Top → Top) · Sejuani (Jungle → Jungle) · Jhin (Bot → Bot) · Zoe (Mid → Mid) | Team Vitality | LEC/2025 Season/Summer Playoffs_Round 1_3_4 |
| lec-2025.json | B | Vayne | Bot | Bot | Ryze (Mid → Mid) · Nautilus (Support → Support) · Jarvan IV (Jungle → Jungle) · Rek'Sai (Top → Top) | Fnatic | LEC/2025 Season/Summer Playoffs_Round 1_4_3 |
| lec-2025.json | A | Trundle | Top | Jungle | Varus (Bot → Bot) · Hwei (Mid → Mid) · Leona (Support → Support) · Poppy (Jungle → Top) | Fnatic | LEC/2025 Season/Summer Playoffs_Round 3_2_4 |
| lfl-2025.json | B | Corki | Bot | Top | Sejuani (Jungle → Jungle) | BK ROG Esports | LFL/2025 Season/Flash In Groups_Week 1_1_1 |
| lfl-2025.json | B | Ambessa | Top | Support | Sejuani (Jungle → Jungle) | BK ROG Esports | LFL/2025 Season/Flash In Groups_Week 1_1_1 |
| lfl-2025.json | B | Orianna | Mid | Bot | Sejuani (Jungle → Jungle) | BK ROG Esports | LFL/2025 Season/Flash In Groups_Week 1_1_1 |
| lfl-2025.json | B | Rakan | Support | Mid | Sejuani (Jungle → Jungle) | BK ROG Esports | LFL/2025 Season/Flash In Groups_Week 1_1_1 |
| lfl-2025.json | B | Rumble | Top | Bot | Vi (Jungle → Jungle) · Rell (Support → Support) | Team BDS Academy | LFL/2025 Season/Flash In Groups_Week 1_1_1 |
| lfl-2025.json | B | Kalista | Bot | Mid | Vi (Jungle → Jungle) · Rell (Support → Support) | Team BDS Academy | LFL/2025 Season/Flash In Groups_Week 1_1_1 |
| lfl-2025.json | B | Taliyah | Mid | Top | Vi (Jungle → Jungle) · Rell (Support → Support) | Team BDS Academy | LFL/2025 Season/Flash In Groups_Week 1_1_1 |
| lfl-2025.json | B | Viktor | Mid | Mid | K'Sante (Top → Top) · Maokai (Jungle → Jungle) | Galions | LFL/2025 Season/Flash In Groups_Week 1_2_1 |
| lfl-2025.json | B | Jinx | Bot | Bot | K'Sante (Top → Top) · Maokai (Jungle → Jungle) | Galions | LFL/2025 Season/Flash In Groups_Week 1_2_1 |
| lfl-2025.json | B | Rakan | Support | Support | K'Sante (Top → Top) · Maokai (Jungle → Jungle) | Galions | LFL/2025 Season/Flash In Groups_Week 1_2_1 |
| lfl-2025.json | B | Jayce | Top | Top | Ezreal (Bot → Bot) · Leona (Support → Support) · Azir (Mid → Mid) | Ici Japon Corp. Esport | LFL/2025 Season/Flash In Groups_Week 1_2_1 |
| lfl-2025.json | B | Xin Zhao | Jungle | Jungle | Ezreal (Bot → Bot) · Leona (Support → Support) · Azir (Mid → Mid) | Ici Japon Corp. Esport | LFL/2025 Season/Flash In Groups_Week 1_2_1 |
| lfl-2025.json | B | Caitlyn | Bot | Top | Vi (Jungle → Jungle) · Nautilus (Support → Support) | Gentle Mates | LFL/2025 Season/Flash In Groups_Week 1_3_1 |
| lfl-2025.json | B | Rumble | Top | Bot | Vi (Jungle → Jungle) · Nautilus (Support → Support) | Gentle Mates | LFL/2025 Season/Flash In Groups_Week 1_3_1 |
| lfl-2025.json | B | Orianna | Mid | Mid | Vi (Jungle → Jungle) · Nautilus (Support → Support) | Gentle Mates | LFL/2025 Season/Flash In Groups_Week 1_3_1 |
| lfl-2025.json | B | Kalista | Bot | Jungle | Syndra (Mid → Mid) | GameWard | LFL/2025 Season/Flash In Groups_Week 1_3_1 |
| lfl-2025.json | B | Jayce | Top | Top | Syndra (Mid → Mid) | GameWard | LFL/2025 Season/Flash In Groups_Week 1_3_1 |
| lfl-2025.json | B | Neeko | Support | Bot | Syndra (Mid → Mid) | GameWard | LFL/2025 Season/Flash In Groups_Week 1_3_1 |
| lfl-2025.json | B | Xin Zhao | Jungle | Support | Syndra (Mid → Mid) | GameWard | LFL/2025 Season/Flash In Groups_Week 1_3_1 |
| lfl-2025.json | B | Rumble | Top | Support | Maokai (Jungle → Jungle) · Ezreal (Bot → Bot) | Karmine Corp Blue | LFL/2025 Season/Flash In Groups_Week 1_4_1 |
| lfl-2025.json | B | Corki | Mid | Mid | Maokai (Jungle → Jungle) · Ezreal (Bot → Bot) | Karmine Corp Blue | LFL/2025 Season/Flash In Groups_Week 1_4_1 |
| lfl-2025.json | B | Alistar | Support | Top | Maokai (Jungle → Jungle) · Ezreal (Bot → Bot) | Karmine Corp Blue | LFL/2025 Season/Flash In Groups_Week 1_4_1 |
| lfl-2025.json | B | Varus | Bot | Jungle | K'Sante (Top → Top) · Rell (Support → Support) | Joblife | LFL/2025 Season/Flash In Groups_Week 1_4_1 |
| lfl-2025.json | B | Xin Zhao | Jungle | Mid | K'Sante (Top → Top) · Rell (Support → Support) | Joblife | LFL/2025 Season/Flash In Groups_Week 1_4_1 |
| lfl-2025.json | B | Hwei | Mid | Bot | K'Sante (Top → Top) · Rell (Support → Support) | Joblife | LFL/2025 Season/Flash In Groups_Week 1_4_1 |
| lfl-2025.json | B | Corki | Bot | Mid | Maokai (Jungle → Jungle) · Rell (Support → Support) | Ici Japon Corp. Esport | LFL/2025 Season/Flash In Groups_Week 1_5_1 |
| lfl-2025.json | B | Jayce | Top | Top | Maokai (Jungle → Jungle) · Rell (Support → Support) | Ici Japon Corp. Esport | LFL/2025 Season/Flash In Groups_Week 1_5_1 |
| lfl-2025.json | B | Akali | Mid | Bot | Maokai (Jungle → Jungle) · Rell (Support → Support) | Ici Japon Corp. Esport | LFL/2025 Season/Flash In Groups_Week 1_5_1 |
| lfl-2025.json | B | Kalista | Bot | Bot | Aurora (Mid → Mid) | Team BDS Academy | LFL/2025 Season/Flash In Groups_Week 1_5_1 |
| lfl-2025.json | B | Annie | Top | Jungle | Aurora (Mid → Mid) | Team BDS Academy | LFL/2025 Season/Flash In Groups_Week 1_5_1 |
| lfl-2025.json | B | Nocturne | Jungle | Support | Aurora (Mid → Mid) | Team BDS Academy | LFL/2025 Season/Flash In Groups_Week 1_5_1 |
| lfl-2025.json | B | Alistar | Support | Top | Aurora (Mid → Mid) | Team BDS Academy | LFL/2025 Season/Flash In Groups_Week 1_5_1 |
| lfl-2025.json | B | Rumble | Top | Mid | Maokai (Jungle → Jungle) · Kai'Sa (Bot → Bot) · Nautilus (Support → Support) | Galions | LFL/2025 Season/Flash In Groups_Week 1_6_1 |
| lfl-2025.json | B | Jayce | Mid | Top | Maokai (Jungle → Jungle) · Kai'Sa (Bot → Bot) · Nautilus (Support → Support) | Galions | LFL/2025 Season/Flash In Groups_Week 1_6_1 |
| lfl-2025.json | B | Corki | Mid | Mid | K'Sante (Top → Top) · Ezreal (Bot → Bot) | Solary | LFL/2025 Season/Flash In Groups_Week 1_6_1 |
| lfl-2025.json | B | Ivern | Jungle | Jungle | K'Sante (Top → Top) · Ezreal (Bot → Bot) | Solary | LFL/2025 Season/Flash In Groups_Week 1_6_1 |
| lfl-2025.json | B | Rakan | Support | Support | K'Sante (Top → Top) · Ezreal (Bot → Bot) | Solary | LFL/2025 Season/Flash In Groups_Week 1_6_1 |
| lfl-2025.json | B | Varus | Bot | Top | Sejuani (Jungle → Jungle) · Yone (Mid → Mid) | GameWard | LFL/2025 Season/Flash In Groups_Week 1_7_1 |
| lfl-2025.json | B | Renata Glasc | Support | Support | Sejuani (Jungle → Jungle) · Yone (Mid → Mid) | GameWard | LFL/2025 Season/Flash In Groups_Week 1_7_1 |
| lfl-2025.json | B | Gwen | Top | Bot | Sejuani (Jungle → Jungle) · Yone (Mid → Mid) | GameWard | LFL/2025 Season/Flash In Groups_Week 1_7_1 |
| lfl-2025.json | B | Xin Zhao | Jungle | Support | Ezreal (Bot → Bot) · Maokai (Support → Jungle) · Aurora (Mid → Mid) · Jax (Top → Top) | Joblife | LFL/2025 Season/Flash In Groups_Week 1_7_1 |
| lfl-2025.json | B | Corki | Mid | Mid | K'Sante (Top → Top) · Rell (Support → Support) · Brand (Jungle → Jungle) · Ezreal (Bot → Bot) | Karmine Corp Blue | LFL/2025 Season/Flash In Groups_Week 1_8_1 |
| lfl-2025.json | B | Ambessa | Top | Support | Sejuani (Jungle → Jungle) · Kai'Sa (Mid → Bot) | Vitality.Bee | LFL/2025 Season/Flash In Groups_Week 1_8_1 |
| lfl-2025.json | B | Varus | Bot | Top | Sejuani (Jungle → Jungle) · Kai'Sa (Mid → Bot) | Vitality.Bee | LFL/2025 Season/Flash In Groups_Week 1_8_1 |
| lfl-2025.json | B | Rakan | Support | Mid | Sejuani (Jungle → Jungle) · Kai'Sa (Mid → Bot) | Vitality.Bee | LFL/2025 Season/Flash In Groups_Week 1_8_1 |
| lfl-2025.json | B | Ambessa | Top | Bot | Vi (Jungle → Jungle) · Rell (Support → Support) | Ici Japon Corp. Esport | LFL/2025 Season/Flash In Groups_Week 1_9_1 |
| lfl-2025.json | B | Orianna | Mid | Mid | Vi (Jungle → Jungle) · Rell (Support → Support) | Ici Japon Corp. Esport | LFL/2025 Season/Flash In Groups_Week 1_9_1 |
| lfl-2025.json | B | Jinx | Bot | Top | Vi (Jungle → Jungle) · Rell (Support → Support) | Ici Japon Corp. Esport | LFL/2025 Season/Flash In Groups_Week 1_9_1 |
| lfl-2025.json | B | Varus | Bot | Jungle | K'Sante (Top → Top) · Azir (Mid → Mid) · Nautilus (Support → Support) | BK ROG Esports | LFL/2025 Season/Flash In Groups_Week 1_9_1 |
| lfl-2025.json | B | Wukong | Jungle | Bot | K'Sante (Top → Top) · Azir (Mid → Mid) · Nautilus (Support → Support) | BK ROG Esports | LFL/2025 Season/Flash In Groups_Week 1_9_1 |
| lfl-2025.json | B | Viktor | Mid | Top | Maokai (Jungle → Jungle) | Solary | LFL/2025 Season/Flash In Groups_Week 1_10_1 |
| lfl-2025.json | B | Kalista | Bot | Bot | Maokai (Jungle → Jungle) | Solary | LFL/2025 Season/Flash In Groups_Week 1_10_1 |
| lfl-2025.json | B | Jayce | Top | Mid | Maokai (Jungle → Jungle) | Solary | LFL/2025 Season/Flash In Groups_Week 1_10_1 |
| lfl-2025.json | B | Renata Glasc | Support | Support | Maokai (Jungle → Jungle) | Solary | LFL/2025 Season/Flash In Groups_Week 1_10_1 |
| lfl-2025.json | B | Corki | Bot | Jungle | Azir (Mid → Mid) | Team BDS Academy | LFL/2025 Season/Flash In Groups_Week 1_10_1 |
| lfl-2025.json | B | Xin Zhao | Jungle | Support | Azir (Mid → Mid) | Team BDS Academy | LFL/2025 Season/Flash In Groups_Week 1_10_1 |
| lfl-2025.json | B | Gnar | Top | Top | Azir (Mid → Mid) | Team BDS Academy | LFL/2025 Season/Flash In Groups_Week 1_10_1 |
| lfl-2025.json | B | Neeko | Support | Bot | Azir (Mid → Mid) | Team BDS Academy | LFL/2025 Season/Flash In Groups_Week 1_10_1 |
| lfl-2025.json | B | Kalista | Bot | Bot | Maokai (Jungle → Jungle) · Syndra (Mid → Mid) | GameWard | LFL/2025 Season/Flash In Groups_Week 1_11_1 |
| lfl-2025.json | B | Renata Glasc | Support | Support | Maokai (Jungle → Jungle) · Syndra (Mid → Mid) | GameWard | LFL/2025 Season/Flash In Groups_Week 1_11_1 |
| lfl-2025.json | B | Gnar | Top | Top | Maokai (Jungle → Jungle) · Syndra (Mid → Mid) | GameWard | LFL/2025 Season/Flash In Groups_Week 1_11_1 |
| lfl-2025.json | A | Poppy | Support | ∅ | Varus (Bot → ∅) · K'Sante (Top → ∅) · Vi (Jungle → ∅) · Viktor (Mid → ∅) | Karmine Corp Blue | LFL/2025 Season/Flash In Groups_Week 1_11_1 |
| lfl-2025.json | B | Varus | Bot | ∅ | K'Sante (Top → ∅) · Vi (Jungle → ∅) · Poppy (Support → ∅) | Karmine Corp Blue | LFL/2025 Season/Flash In Groups_Week 1_11_1 |
| lfl-2025.json | B | Viktor | Mid | ∅ | K'Sante (Top → ∅) · Vi (Jungle → ∅) · Poppy (Support → ∅) | Karmine Corp Blue | LFL/2025 Season/Flash In Groups_Week 1_11_1 |
| lfl-2025.json | B | Corki | Bot | Jungle |  | Gentle Mates | LFL/2025 Season/Flash In Groups_Week 1_12_1 |
| lfl-2025.json | B | Wukong | Jungle | Bot |  | Gentle Mates | LFL/2025 Season/Flash In Groups_Week 1_12_1 |
| lfl-2025.json | B | Rumble | Top | Support |  | Gentle Mates | LFL/2025 Season/Flash In Groups_Week 1_12_1 |
| lfl-2025.json | B | Alistar | Support | Top |  | Gentle Mates | LFL/2025 Season/Flash In Groups_Week 1_12_1 |
| lfl-2025.json | B | Orianna | Mid | Mid |  | Gentle Mates | LFL/2025 Season/Flash In Groups_Week 1_12_1 |
| lfl-2025.json | B | Varus | Bot | Jungle | K'Sante (Top → Top) · Nautilus (Support → Support) · Sylas (Mid → Mid) | Vitality.Bee | LFL/2025 Season/Flash In Groups_Week 1_12_1 |
| lfl-2025.json | B | Ivern | Jungle | Bot | K'Sante (Top → Top) · Nautilus (Support → Support) · Sylas (Mid → Mid) | Vitality.Bee | LFL/2025 Season/Flash In Groups_Week 1_12_1 |
| lfl-2025.json | B | Corki | Bot | Mid | Leona (Support → Support) | Galions | LFL/2025 Season/Flash In Groups_Week 2_1_1 |
| lfl-2025.json | B | Xin Zhao | Jungle | Bot | Leona (Support → Support) | Galions | LFL/2025 Season/Flash In Groups_Week 2_1_1 |
| lfl-2025.json | B | Viktor | Mid | Top | Leona (Support → Support) | Galions | LFL/2025 Season/Flash In Groups_Week 2_1_1 |
| lfl-2025.json | B | Jayce | Top | Jungle | Leona (Support → Support) | Galions | LFL/2025 Season/Flash In Groups_Week 2_1_1 |
| lfl-2025.json | B | Kalista | Bot | Bot | Maokai (Jungle → Jungle) · Renekton (Top → Top) | Solary | LFL/2025 Season/Flash In Groups_Week 2_2_1 |
| lfl-2025.json | B | Viktor | Mid | Mid | Maokai (Jungle → Jungle) · Renekton (Top → Top) | Solary | LFL/2025 Season/Flash In Groups_Week 2_2_1 |
| lfl-2025.json | B | Renata Glasc | Support | Support | Maokai (Jungle → Jungle) · Renekton (Top → Top) | Solary | LFL/2025 Season/Flash In Groups_Week 2_2_1 |
| lfl-2025.json | B | Ambessa | Top | Bot | Sejuani (Jungle → Jungle) | BK ROG Esports | LFL/2025 Season/Flash In Groups_Week 2_2_1 |
| lfl-2025.json | B | Corki | Bot | Top | Sejuani (Jungle → Jungle) | BK ROG Esports | LFL/2025 Season/Flash In Groups_Week 2_2_1 |
| lfl-2025.json | B | Akali | Mid | Support | Sejuani (Jungle → Jungle) | BK ROG Esports | LFL/2025 Season/Flash In Groups_Week 2_2_1 |
| lfl-2025.json | B | Neeko | Support | Mid | Sejuani (Jungle → Jungle) | BK ROG Esports | LFL/2025 Season/Flash In Groups_Week 2_2_1 |
| lfl-2025.json | B | Kalista | Bot | Bot | Vi (Jungle → Jungle) · Syndra (Mid → Mid) | GameWard | LFL/2025 Season/Flash In Groups_Week 2_3_1 |
| lfl-2025.json | B | Gnar | Top | Top | Vi (Jungle → Jungle) · Syndra (Mid → Mid) | GameWard | LFL/2025 Season/Flash In Groups_Week 2_3_1 |
| lfl-2025.json | B | Neeko | Support | Support | Vi (Jungle → Jungle) · Syndra (Mid → Mid) | GameWard | LFL/2025 Season/Flash In Groups_Week 2_3_1 |
| lfl-2025.json | B | Varus | Bot | Mid | K'Sante (Top → Top) · Rell (Support → Support) · Zyra (Jungle → Jungle) | Vitality.Bee | LFL/2025 Season/Flash In Groups_Week 2_3_1 |
| lfl-2025.json | B | Yasuo | Mid | Bot | K'Sante (Top → Top) · Rell (Support → Support) · Zyra (Jungle → Jungle) | Vitality.Bee | LFL/2025 Season/Flash In Groups_Week 2_3_1 |
| lfl-2025.json | B | Caitlyn | Bot | Mid | K'Sante (Top → Top) · Vi (Jungle → Jungle) · Rell (Support → Support) | Gentle Mates | LFL/2025 Season/Flash In Groups_Week 2_4_1 |
| lfl-2025.json | B | Hwei | Mid | Bot | K'Sante (Top → Top) · Vi (Jungle → Jungle) · Rell (Support → Support) | Gentle Mates | LFL/2025 Season/Flash In Groups_Week 2_4_1 |
| lfl-2025.json | B | Corki | Bot | Mid |  | Joblife | LFL/2025 Season/Flash In Groups_Week 2_4_1 |
| lfl-2025.json | B | Viktor | Mid | Top |  | Joblife | LFL/2025 Season/Flash In Groups_Week 2_4_1 |
| lfl-2025.json | B | Gnar | Top | Jungle |  | Joblife | LFL/2025 Season/Flash In Groups_Week 2_4_1 |
| lfl-2025.json | B | Nocturne | Jungle | Support |  | Joblife | LFL/2025 Season/Flash In Groups_Week 2_4_1 |
| lfl-2025.json | B | Bard | Support | Bot |  | Joblife | LFL/2025 Season/Flash In Groups_Week 2_4_1 |
| lfl-2025.json | B | Varus | Bot | Top | Vi (Jungle → Jungle) · Aurora (Mid → Mid) · Nautilus (Support → Support) | Solary | LFL/2025 Season/Flash In Groups_Week 2_5_1 |
| lfl-2025.json | B | Sion | Top | Bot | Vi (Jungle → Jungle) · Aurora (Mid → Mid) · Nautilus (Support → Support) | Solary | LFL/2025 Season/Flash In Groups_Week 2_5_1 |
| lfl-2025.json | B | Kalista | Bot | Bot | Sejuani (Jungle → Jungle) | Ici Japon Corp. Esport | LFL/2025 Season/Flash In Groups_Week 2_5_1 |
| lfl-2025.json | B | Jayce | Top | Top | Sejuani (Jungle → Jungle) | Ici Japon Corp. Esport | LFL/2025 Season/Flash In Groups_Week 2_5_1 |
| lfl-2025.json | B | Akali | Mid | Support | Sejuani (Jungle → Jungle) | Ici Japon Corp. Esport | LFL/2025 Season/Flash In Groups_Week 2_5_1 |
| lfl-2025.json | B | Alistar | Support | Mid | Sejuani (Jungle → Jungle) | Ici Japon Corp. Esport | LFL/2025 Season/Flash In Groups_Week 2_5_1 |
| lfl-2025.json | B | Jayce | Mid | Top | Ezreal (Bot → Bot) · Nautilus (Support → Support) | BK ROG Esports | LFL/2025 Season/Flash In Groups_Week 2_6_1 |
| lfl-2025.json | B | Amumu | Jungle | Mid | Ezreal (Bot → Bot) · Nautilus (Support → Support) | BK ROG Esports | LFL/2025 Season/Flash In Groups_Week 2_6_1 |
| lfl-2025.json | B | Gnar | Top | Jungle | Ezreal (Bot → Bot) · Nautilus (Support → Support) | BK ROG Esports | LFL/2025 Season/Flash In Groups_Week 2_6_1 |
| lfl-2025.json | B | Corki | Mid | Top | Zyra (Jungle → Jungle) · Leona (Support → Support) · Kai'Sa (Bot → Bot) | Galions | LFL/2025 Season/Flash In Groups_Week 2_6_1 |
| lfl-2025.json | B | Malphite | Top | Mid | Zyra (Jungle → Jungle) · Leona (Support → Support) · Kai'Sa (Bot → Bot) | Galions | LFL/2025 Season/Flash In Groups_Week 2_6_1 |
| lfl-2025.json | B | Ambessa | Top | Mid | Zyra (Jungle → Jungle) · Ezreal (Bot → Bot) · Nautilus (Support → Support) | Joblife | LFL/2025 Season/Flash In Groups_Week 2_7_1 |
| lfl-2025.json | B | Jayce | Mid | Top | Zyra (Jungle → Jungle) · Ezreal (Bot → Bot) · Nautilus (Support → Support) | Joblife | LFL/2025 Season/Flash In Groups_Week 2_7_1 |
| lfl-2025.json | B | Wukong | Jungle | Support | Seraphine (Bot → Bot) | Vitality.Bee | LFL/2025 Season/Flash In Groups_Week 2_7_1 |
| lfl-2025.json | B | Senna | Support | Jungle | Seraphine (Bot → Bot) | Vitality.Bee | LFL/2025 Season/Flash In Groups_Week 2_7_1 |
| lfl-2025.json | B | Irelia | Top | Mid | Seraphine (Bot → Bot) | Vitality.Bee | LFL/2025 Season/Flash In Groups_Week 2_7_1 |
| lfl-2025.json | B | Yasuo | Mid | Top | Seraphine (Bot → Bot) | Vitality.Bee | LFL/2025 Season/Flash In Groups_Week 2_7_1 |
| lfl-2025.json | B | Rumble | Top | Bot | Rell (Support → Support) · Azir (Mid → Mid) | Karmine Corp Blue | LFL/2025 Season/Flash In Groups_Week 2_8_1 |
| lfl-2025.json | B | Xin Zhao | Jungle | Jungle | Rell (Support → Support) · Azir (Mid → Mid) | Karmine Corp Blue | LFL/2025 Season/Flash In Groups_Week 2_8_1 |
| lfl-2025.json | B | Jinx | Bot | Top | Rell (Support → Support) · Azir (Mid → Mid) | Karmine Corp Blue | LFL/2025 Season/Flash In Groups_Week 2_8_1 |
| lfl-2025.json | B | Ambessa | Top | Mid | Sejuani (Jungle → Jungle) · Ezreal (Bot → Bot) · Nautilus (Support → Support) | Gentle Mates | LFL/2025 Season/Flash In Groups_Week 2_8_1 |
| lfl-2025.json | B | Xerath | Mid | Top | Sejuani (Jungle → Jungle) · Ezreal (Bot → Bot) · Nautilus (Support → Support) | Gentle Mates | LFL/2025 Season/Flash In Groups_Week 2_8_1 |
| lfl-2025.json | B | Draven | Bot | Top | Maokai (Jungle → Jungle) | Karmine Corp Blue | LFL/2025 Season/Flash In Groups_Tiebreakers_1_1 |
| lfl-2025.json | B | Renata Glasc | Support | Support | Maokai (Jungle → Jungle) | Karmine Corp Blue | LFL/2025 Season/Flash In Groups_Tiebreakers_1_1 |
| lfl-2025.json | B | Ambessa | Top | Bot | Maokai (Jungle → Jungle) | Karmine Corp Blue | LFL/2025 Season/Flash In Groups_Tiebreakers_1_1 |
| lfl-2025.json | B | Taliyah | Mid | Mid | Maokai (Jungle → Jungle) | Karmine Corp Blue | LFL/2025 Season/Flash In Groups_Tiebreakers_1_1 |
| lfl-2025.json | B | Kalista | Bot | Support | Vi (Jungle → Jungle) · K'Sante (Top → Top) | GameWard | LFL/2025 Season/Flash In Groups_Tiebreakers_1_1 |
| lfl-2025.json | B | Soraka | Support | Bot | Vi (Jungle → Jungle) · K'Sante (Top → Top) | GameWard | LFL/2025 Season/Flash In Groups_Tiebreakers_1_1 |
| lfl-2025.json | B | Viktor | Mid | Mid | Vi (Jungle → Jungle) · K'Sante (Top → Top) | GameWard | LFL/2025 Season/Flash In Groups_Tiebreakers_1_1 |
| lfl-2025.json | B | Jayce | Top | Top | Vi (Jungle → Jungle) | GameWard | LFL/2025 Season/Flash In Groups_Tiebreakers_2_1 |
| lfl-2025.json | B | Kalista | Bot | Bot | Vi (Jungle → Jungle) | GameWard | LFL/2025 Season/Flash In Groups_Tiebreakers_2_1 |
| lfl-2025.json | B | Braum | Support | Mid | Vi (Jungle → Jungle) | GameWard | LFL/2025 Season/Flash In Groups_Tiebreakers_2_1 |
| lfl-2025.json | B | Akali | Mid | Support | Vi (Jungle → Jungle) | GameWard | LFL/2025 Season/Flash In Groups_Tiebreakers_2_1 |
| lfl-2025.json | B | Varus | Bot | Top | Rell (Support → Support) | Joblife | LFL/2025 Season/Flash In Groups_Tiebreakers_2_1 |
| lfl-2025.json | B | Ambessa | Top | Mid | Rell (Support → Support) | Joblife | LFL/2025 Season/Flash In Groups_Tiebreakers_2_1 |
| lfl-2025.json | B | Wukong | Jungle | Jungle | Rell (Support → Support) | Joblife | LFL/2025 Season/Flash In Groups_Tiebreakers_2_1 |
| lfl-2025.json | B | Vladimir | Mid | Bot | Rell (Support → Support) | Joblife | LFL/2025 Season/Flash In Groups_Tiebreakers_2_1 |
| lfl-2025.json | B | Corki | Bot | Bot | K'Sante (Top → Top) · Aurora (Mid → Mid) · Viego (Jungle → Jungle) · Nautilus (Support → Support) | Joblife | LFL/2025 Season/Flash In Groups_Tiebreakers_3_1 |
| lfl-2025.json | B | Rumble | Top | Support | Sejuani (Jungle → Jungle) · Yone (Mid → Mid) · Kai'Sa (Bot → Bot) | Karmine Corp Blue | LFL/2025 Season/Flash In Groups_Tiebreakers_3_1 |
| lfl-2025.json | B | Alistar | Support | Top | Sejuani (Jungle → Jungle) · Yone (Mid → Mid) · Kai'Sa (Bot → Bot) | Karmine Corp Blue | LFL/2025 Season/Flash In Groups_Tiebreakers_3_1 |
| lfl-2025.json | B | Nilah | Bot | Bot | Maokai (Jungle → Jungle) · Rumble (Top → Top) · Smolder (Mid → Mid) · Senna (Support → Support) | Vitality.Bee | LFL/2025 Season/Flash In Swiss_Round 1_1_1 |
| lfl-2025.json | B | Galio | Top | Top | Vi (Jungle → Jungle) · Miss Fortune (Bot → Bot) · Nautilus (Support → Support) · Orianna (Mid → Mid) | Joblife | LFL/2025 Season/Flash In Swiss_Round 1_2_2 |
| lfl-2025.json | B | Sivir | Bot | Bot | Maokai (Jungle → Jungle) · Ambessa (Top → Top) · Leona (Support → Support) · Orianna (Mid → Mid) | Gentle Mates | LFL/2025 Season/Flash In Swiss_Round 1_3_1 |
| lfl-2025.json | A | Nautilus | Jungle | ∅ | Ezreal (Bot → ∅) · Renekton (Top → ∅) · Rakan (Support → ∅) · Azir (Mid → ∅) | Solary | LFL/2025 Season/Flash In Swiss_Round 1_3_1 |
| lfl-2025.json | B | Ashe | Bot | Bot | Vi (Jungle → Jungle) · Jax (Top → Top) · Viktor (Mid → Mid) · Bard (Support → Support) | Gentle Mates | LFL/2025 Season/Flash In Swiss_Round 1_3_3 |
| lfl-2025.json | B | Gragas | Top | Mid | Varus (Bot → Bot) · Xin Zhao (Jungle → Jungle) · Renata Glasc (Support → Support) | Solary | LFL/2025 Season/Flash In Swiss_Round 1_3_3 |
| lfl-2025.json | B | Ahri | Mid | Top | Varus (Bot → Bot) · Xin Zhao (Jungle → Jungle) · Renata Glasc (Support → Support) | Solary | LFL/2025 Season/Flash In Swiss_Round 1_3_3 |
| lfl-2025.json | B | Xayah | Bot | Bot | Rell (Support → Support) · Sejuani (Jungle → Jungle) · Ornn (Top → Top) · Orianna (Mid → Mid) | Galions | LFL/2025 Season/Flash In Swiss_Round 1_4_2 |
| lfl-2025.json | B | Ahri | Mid | Mid | Leona (Support → Support) · Ezreal (Bot → Bot) · Jarvan IV (Jungle → Jungle) · Sion (Top → Top) | Karmine Corp Blue | LFL/2025 Season/Flash In Swiss_Round 1_4_3 |
| lfl-2025.json | B | Xayah | Bot | Bot | Jayce (Top → Top) · Rakan (Support → Support) · Wukong (Jungle → Jungle) | Vitality.Bee | LFL/2025 Season/Flash In Swiss_Round 2_1_1 |
| lfl-2025.json | B | Galio | Mid | Mid | Jayce (Top → Top) · Rakan (Support → Support) · Wukong (Jungle → Jungle) | Vitality.Bee | LFL/2025 Season/Flash In Swiss_Round 2_1_1 |
| lfl-2025.json | B | Vel'Koz | Mid | Mid | Gnar (Top → Top) · Varus (Bot → Bot) · Zyra (Jungle → Jungle) · Nautilus (Support → Support) | Gentle Mates | LFL/2025 Season/Flash In Swiss_Round 2_2_2 |
| lfl-2025.json | B | Pantheon | Jungle | Jungle | Ezreal (Bot → Bot) · Taliyah (Mid → Mid) · Rakan (Support → Support) · Ornn (Top → Top) | BK ROG Esports | LFL/2025 Season/Flash In Swiss_Round 2_3_2 |
| lfl-2025.json | B | Ashe | Bot | Mid | Vi (Jungle → Jungle) · Braum (Support → Support) · Jax (Top → Top) | BK ROG Esports | LFL/2025 Season/Flash In Swiss_Round 2_3_3 |
| lfl-2025.json | B | Galio | Mid | Bot | Vi (Jungle → Jungle) · Braum (Support → Support) · Jax (Top → Top) | BK ROG Esports | LFL/2025 Season/Flash In Swiss_Round 2_3_3 |
| lfl-2025.json | B | Xayah | Bot | Mid | Corki (Mid → Bot) · Sejuani (Jungle → Jungle) · Rumble (Top → Top) · Rakan (Support → Support) | Karmine Corp Blue | LFL/2025 Season/Flash In Swiss_Round 2_4_1 |
| lfl-2025.json | A | Poppy | Jungle | ∅ | K'Sante (Top → ∅) · Leona (Support → ∅) · Miss Fortune (Bot → ∅) · Azir (Mid → ∅) | Solary | LFL/2025 Season/Flash In Swiss_Round 2_4_2 |
| lfl-2025.json | B | Pantheon | Support | Support | Sejuani (Jungle → Jungle) · Ziggs (Bot → Bot) · Yone (Mid → Mid) · Ornn (Top → Top) | BK ROG Esports | LFL/2025 Season/Flash In Swiss_Round 3_1_3 |
| lfl-2025.json | B | Gragas | Top | Bot | Wukong (Jungle → Jungle) · Aurora (Mid → Mid) · Braum (Support → Support) | Solary | LFL/2025 Season/Flash In Swiss_Round 3_1_3 |
| lfl-2025.json | B | Sivir | Bot | Top | Wukong (Jungle → Jungle) · Aurora (Mid → Mid) · Braum (Support → Support) | Solary | LFL/2025 Season/Flash In Swiss_Round 3_1_3 |
| lfl-2025.json | B | Ahri | Mid | Mid | Sejuani (Jungle → Jungle) · Jax (Top → Top) · Corki (Bot → Bot) · Renata Glasc (Support → Support) | Gentle Mates | LFL/2025 Season/Flash In Swiss_Round 3_2_1 |
| lfl-2025.json | B | Cassiopeia | Mid | Mid | Ezreal (Bot → Bot) · Gnar (Top → Top) · Wukong (Jungle → Jungle) · Rell (Support → Support) | Gentle Mates | LFL/2025 Season/Flash In Swiss_Round 3_2_2 |
| lfl-2025.json | B | Camille | Top | Top | Xin Zhao (Jungle → Jungle) · Leona (Support → Support) · Azir (Mid → Mid) | Galions | LFL/2025 Season/Flash In Swiss_Round 3_2_2 |
| lfl-2025.json | B | Vayne | Bot | Bot | Xin Zhao (Jungle → Jungle) · Leona (Support → Support) · Azir (Mid → Mid) | Galions | LFL/2025 Season/Flash In Swiss_Round 3_2_2 |
| lfl-2025.json | A | Jax | Jungle | Top | Varus (Bot → Bot) · Lulu (Support → Mid) · Mel (Mid → Support) · Volibear (Top → Jungle) | Solary | LFL/2025 Season/Flash In Playoffs_Round 1_2_2 |
| lfl-2025.json | B | Lulu | Support | Mid | Varus (Bot → Bot) · Jax (Jungle → Top) | Solary | LFL/2025 Season/Flash In Playoffs_Round 1_2_2 |
| lfl-2025.json | B | Mel | Mid | Support | Varus (Bot → Bot) · Jax (Jungle → Top) | Solary | LFL/2025 Season/Flash In Playoffs_Round 1_2_2 |
| lfl-2025.json | B | Volibear | Top | Jungle | Varus (Bot → Bot) · Jax (Jungle → Top) | Solary | LFL/2025 Season/Flash In Playoffs_Round 1_2_2 |
| lfl-2025.json | B | Swain | Top | Top | Ezreal (Bot → Bot) · Hwei (Mid → Mid) · Nautilus (Support → Support) · Pantheon (Jungle → Jungle) | Galions | LFL/2025 Season/Flash In Playoffs_Round 1_2_3 |
| lfl-2025.json | B | Karma | Support | Support | Jayce (Top → Top) · Jhin (Bot → Bot) · Sylas (Mid → Mid) | Solary | LFL/2025 Season/Flash In Playoffs_Round 1_2_5 |
| lfl-2025.json | B | Zac | Jungle | Jungle | Jayce (Top → Top) · Jhin (Bot → Bot) · Sylas (Mid → Mid) | Solary | LFL/2025 Season/Flash In Playoffs_Round 1_2_5 |
| lfl-2025.json | B | Pyke | Support | Support | Caitlyn (Bot → Bot) · Gnar (Top → Top) · Wukong (Jungle → Jungle) · Akali (Mid → Mid) | Galions | LFL/2025 Season/Flash In Playoffs_Round 1_2_5 |
| lfl-2025.json | B | Lulu | Support | Support | Sivir (Bot → Bot) · Xin Zhao (Jungle → Jungle) · Sion (Top → Top) · Taliyah (Mid → Mid) | Ici Japon Corp. Esport | LFL/2025 Season/Flash In Playoffs_Round 2_1_2 |
| lfl-2025.json | B | Aatrox | Top | ∅ | Tristana (Bot → ∅) · Viktor (Mid → ∅) · Braum (Support → ∅) | Ici Japon Corp. Esport | LFL/2025 Season/Flash In Playoffs_Round 2_1_4 |
| lfl-2025.json | B | Zac | Jungle | ∅ | Tristana (Bot → ∅) · Viktor (Mid → ∅) · Braum (Support → ∅) | Ici Japon Corp. Esport | LFL/2025 Season/Flash In Playoffs_Round 2_1_4 |
| lfl-2025.json | B | Nunu &amp; Willump | Jungle | Jungle | Gnar (Top → Top) · Orianna (Mid → Mid) · Leona (Support → Support) · Xayah (Bot → Bot) | Solary | LFL/2025 Season/Flash In Playoffs_Round 2_1_4 |
| lfl-2025.json | B | Blitzcrank | Support | ∅ | Aurora (Mid → ∅) · Tristana (Bot → ∅) · Amumu (Jungle → ∅) · Jax (Top → ∅) | Ici Japon Corp. Esport | LFL/2025 Season/Flash In Playoffs_Finals_1_3 |
| lfl-2025.json | B | Lulu | Support | ∅ | Zeri (Bot → ∅) · Wukong (Jungle → ∅) · Vladimir (Mid → ∅) · Gragas (Top → ∅) | Karmine Corp Blue | LFL/2025 Season/Flash In Playoffs_Finals_1_3 |
| lfl-2025.json | A | Aurora | Top | ∅ | Vi (Jungle → ∅) · Yasuo (Mid → ∅) · Ashe (Bot → ∅) · Renata Glasc (Support → ∅) | GameWard | LFL/2025 Season/Spring Split_Week 1_1_1 |
| lfl-2025.json | B | Shen | Top | Top | Miss Fortune (Bot → Bot) · Lillia (Jungle → Jungle) · Corki (Mid → Mid) · Leona (Support → Support) | Team BDS Academy | LFL/2025 Season/Spring Split_Week 1_2_1 |
| lfl-2025.json | B | Elise | Support | Support | Rumble (Top → Top) · Tristana (Mid → Mid) · Sejuani (Jungle → Jungle) · Sivir (Bot → Bot) | Vitality.Bee | LFL/2025 Season/Spring Split_Week 1_8_1 |
| lfl-2025.json | B | Gangplank | Top | Top | Xin Zhao (Jungle → Jungle) · Ahri (Mid → Mid) · Varus (Bot → Bot) · Rell (Support → Support) | Vitality.Bee | LFL/2025 Season/Spring Split_Week 2_4_1 |
| lfl-2025.json | B | Naafiri | Jungle | Jungle | Ahri (Mid → Mid) · Sion (Top → Top) · Miss Fortune (Bot → Bot) · Nautilus (Support → Support) | Solary | LFL/2025 Season/Spring Split_Week 2_11_1 |
| lfl-2025.json | B | Warwick | Top | Top | Xin Zhao (Jungle → Jungle) · Ezreal (Bot → Bot) · Ahri (Mid → Mid) · Alistar (Support → Support) | Gentle Mates | LFL/2025 Season/Spring Split_Week 2_12_1 |
| lfl-2025.json | A | Ambessa | Mid | ∅ | Rumble (Top → ∅) · Vi (Jungle → ∅) · Kai'Sa (Bot → ∅) · Rell (Support → ∅) | Galions | LFL/2025 Season/Spring Split_Week 2_16_1 |
| lfl-2025.json | B | Naafiri | Jungle | Jungle | Azir (Mid → Mid) · Volibear (Top → Top) · Miss Fortune (Bot → Bot) · Leona (Support → Support) | Solary | LFL/2025 Season/Spring Split_Week 2_19_1 |
| lfl-2025.json | B | Ryze | Mid | Mid | Xin Zhao (Jungle → Jungle) · Varus (Bot → Bot) · Leona (Support → Support) · Ambessa (Top → Top) | GameWard | LFL/2025 Season/Spring Split_Week 3_6_1 |
| lfl-2025.json | B | Zoe | Mid | Mid | Varus (Bot → Bot) · Ambessa (Top → Top) · Naafiri (Jungle → Jungle) · Blitzcrank (Support → Support) | Vitality.Bee | LFL/2025 Season/Spring Split_Week 3_11_1 |
| lfl-2025.json | B | Ryze | Mid | Mid | Vi (Jungle → Jungle) · Kalista (Bot → Bot) · Renekton (Top → Top) · Renata Glasc (Support → Support) | GameWard | LFL/2025 Season/Spring Split_Week 3_11_1 |
| lfl-2025.json | B | Fiddlesticks | Support | Support | Varus (Bot → Bot) · Naafiri (Jungle → Jungle) · Ambessa (Top → Top) · Vladimir (Mid → Mid) | Joblife | LFL/2025 Season/Spring Split_Week 3_13_1 |
| lfl-2025.json | B | Aurelion Sol | Mid | Mid | Skarner (Jungle → Jungle) · Miss Fortune (Bot → Bot) · Neeko (Support → Support) · Renekton (Top → Top) | Galions | LFL/2025 Season/Spring Swiss_Round 1_1_3 |
| lfl-2025.json | B | Aurelion Sol | Mid | Mid | Miss Fortune (Bot → Bot) · Gnar (Top → Top) · Rell (Support → Support) | Gentle Mates | LFL/2025 Season/Spring Swiss_Round 1_2_2 |
| lfl-2025.json | B | Diana | Jungle | Jungle | Miss Fortune (Bot → Bot) · Gnar (Top → Top) · Rell (Support → Support) | Gentle Mates | LFL/2025 Season/Spring Swiss_Round 1_2_2 |
| lfl-2025.json | B | Ryze | Mid | Mid | Xin Zhao (Jungle → Jungle) · Ambessa (Top → Top) · Corki (Bot → Bot) · Nautilus (Support → Support) | Vitality.Bee | LFL/2025 Season/Spring Swiss_Round 1_4_1 |
| lfl-2025.json | B | Milio | Support | Support | Rumble (Top → Top) · Skarner (Jungle → Jungle) · Corki (Mid → Mid) · Jinx (Bot → Bot) | Ici Japon Corp. Esport | LFL/2025 Season/Spring Swiss_Round 2_1_1 |
| lfl-2025.json | B | Sett | Top | Top | Ezreal (Bot → Bot) · Pantheon (Jungle → Jungle) · Azir (Mid → Mid) · Leona (Support → Support) | Gentle Mates | LFL/2025 Season/Spring Swiss_Round 2_1_2 |
| lfl-2025.json | B | Yorick | Top | Top | Pantheon (Jungle → Jungle) · Nilah (Bot → Bot) · Senna (Support → Support) · Aurelion Sol (Mid → Mid) | Vitality.Bee | LFL/2025 Season/Spring Swiss_Round 2_4_3 |
| lfl-2025.json | B | Kennen | Top | Top | Sejuani (Jungle → Jungle) · Lulu (Support → Support) · Ashe (Bot → Bot) · Yone (Mid → Mid) | GameWard | LFL/2025 Season/Spring Playoffs_Last Chance Round 1_2_2 |
| lfl-2025.json | B | LeBlanc | Mid | Mid | Xin Zhao (Jungle → Jungle) · Rumble (Top → Top) · Ezreal (Bot → Bot) · Nautilus (Support → Support) | BK ROG Esports | LFL/2025 Season/Spring Playoffs_Last Chance Round 2_1_1 |
| lfl-2025.json | B | Yuumi | Support | Support | Pantheon (Jungle → Jungle) · Taliyah (Mid → Mid) · Gwen (Top → Top) · Zeri (Bot → Bot) | GameWard | LFL/2025 Season/Spring Playoffs_Last Chance Round 2_1_1 |
| lfl-2025.json | B | Milio | Support | Support | Wukong (Jungle → Jungle) · Orianna (Mid → Mid) · Ambessa (Top → Top) · Tristana (Bot → Bot) | GameWard | LFL/2025 Season/Spring Playoffs_Last Chance Round 2_1_3 |
| lfl-2025.json | B | Trundle | Jungle | ∅ | Zoe (Mid → ∅) · Blitzcrank (Support → ∅) · Smolder (Bot → ∅) · Yorick (Top → ∅) | Vitality.Bee | LFL/2025 Season/Spring Playoffs_Round 1_1_5 |
| lfl-2025.json | B | Cho'Gath | Top | Top | Dr. Mundo (Jungle → Jungle) · Jinx (Bot → Bot) · Braum (Support → Support) · Akali (Mid → Mid) | Galions | LFL/2025 Season/Spring Playoffs_Round 1_1_5 |
| lfl-2025.json | B | Lucian | Bot | Bot | Wukong (Jungle → Jungle) · Annie (Mid → Mid) · Rakan (Support → Support) · Renekton (Top → Top) | Ici Japon Corp. Esport | LFL/2025 Season/Spring Playoffs_Round 1_2_3 |
| lfl-2025.json | B | Lucian | Bot | Bot | Maokai (Jungle → Jungle) · Braum (Support → Support) · Viktor (Mid → Mid) · Ambessa (Top → Top) | Karmine Corp Blue | LFL/2025 Season/Spring Playoffs_Round 2_1_3 |
| lfl-2025.json | A | Ezreal | Mid | ∅ | Maokai (Jungle → ∅) · Ambessa (Top → ∅) · Senna (Support → ∅) · Nilah (Bot → ∅) | Vitality.Bee | LFL/2025 Season/Spring Playoffs_Round 2_2_2 |
| lfl-2025.json | B | Riven | Top | Top | Tristana (Mid → Bot) · Ivern (Jungle → Jungle) · Leona (Support → Support) · Smolder (Bot → Mid) | Vitality.Bee | LFL/2025 Season/Spring Playoffs_Round 2_2_3 |
| lfl-2025.json | A | Senna | Bot | ∅ | Nautilus (Support → ∅) · Ambessa (Top → ∅) · Galio (Mid → ∅) · Naafiri (Jungle → ∅) | Gentle Mates | LFL/2025 Season/Spring Playoffs_Semifinals_1_1 |
| lfl-2025.json | B | Lucian | Bot | Mid | Gwen (Top → Top) · Maokai (Jungle → Jungle) · Corki (Mid → Bot) · Braum (Support → Support) | Gentle Mates | LFL/2025 Season/Spring Playoffs_Semifinals_1_2 |
| lfl-2025.json | B | Rammus | Jungle | Jungle | Jhin (Bot → Bot) · Leona (Support → Support) · Sylas (Mid → Mid) · Yorick (Top → Top) | Gentle Mates | LFL/2025 Season/Spring Playoffs_Semifinals_1_3 |
| lfl-2025.json | B | Tahm Kench | Support | Support | Sejuani (Jungle → Jungle) · Jax (Top → Top) · Viktor (Mid → Mid) · Jinx (Bot → Bot) | Gentle Mates | LFL/2025 Season/Spring Playoffs_Semifinals_1_4 |
| lfl-2025.json | B | Trundle | Jungle | Jungle | Miss Fortune (Bot → Bot) · Rakan (Support → Support) · Renekton (Top → Top) · Cassiopeia (Mid → Mid) | BK ROG Esports | LFL/2025 Season/Spring Playoffs_Finals_1_4 |
| lfl-2025.json | B | Kog'Maw | Bot | Bot | Nocturne (Jungle → Jungle) · Galio (Mid → Mid) · Yorick (Top → Top) · Lulu (Support → Support) | Karmine Corp Blue | LFL/2025 Season/Spring Playoffs_Finals_1_5 |
| lfl-2025.json | B | Nami | Support | Support | Annie (Mid → Mid) · Lucian (Bot → Bot) · Jarvan IV (Jungle → Jungle) · Aatrox (Top → Top) | BK ROG Esports | LFL/2025 Season/Summer Split_Week 1_3_2 |
| lfl-2025.json | B | Nami | Support | Support | Lucian (Bot → Bot) · Lee Sin (Jungle → Jungle) · Galio (Top → Top) · Orianna (Mid → Mid) | GameWard | LFL/2025 Season/Summer Split_Week 2_4_3 |
| lfl-2025.json | B | Yunara | Bot | Bot | Wukong (Jungle → Jungle) · Orianna (Mid → Mid) · Gnar (Top → Top) · Pyke (Support → Support) | BK ROG Esports | LFL/2025 Season/Summer Split_Week 3_1_1 |
| lfl-2025.json | B | Yunara | Bot | Bot | Azir (Mid → Mid) · Wukong (Jungle → Jungle) · Galio (Top → Top) · Rakan (Support → Support) | Ici Japon Corp. Esport | LFL/2025 Season/Summer Split_Week 3_3_1 |
| lfl-2025.json | B | Yunara | Bot | Bot | Azir (Mid → Mid) · Skarner (Jungle → Jungle) · Nautilus (Support → Support) · K'Sante (Top → Top) | Vitality.Bee | LFL/2025 Season/Summer Split_Week 3_4_1 |
| lfl-2025.json | B | Aphelios | Bot | Bot | Taliyah (Mid → Mid) · Xin Zhao (Jungle → Jungle) · Aurora (Top → Top) · Braum (Support → Support) | Team BDS Academy | LFL/2025 Season/Summer Split_Week 3_4_1 |
| lfl-2025.json | B | Yunara | Bot | Bot | Taliyah (Mid → Mid) · Xin Zhao (Jungle → Jungle) · Gragas (Top → Top) · Lulu (Support → Support) | GameWard | LFL/2025 Season/Summer Split_Week 3_6_1 |
| lfl-2025.json | B | Yunara | Bot | Bot | Xin Zhao (Jungle → Jungle) · Galio (Mid → Mid) · Rumble (Top → Top) · Rell (Support → Support) | Gentle Mates | LFL/2025 Season/Summer Split_Week 3_5_2 |
| lfl-2025.json | B | Aphelios | Bot | Bot | K'Sante (Top → Top) · Jarvan IV (Jungle → Jungle) · Orianna (Mid → Mid) · Renata Glasc (Support → Support) | GameWard | LFL/2025 Season/Summer Split_Week 3_6_3 |
| lfl-2025.json | B | Kayn | Top | Top | Ryze (Mid → Mid) · Jarvan IV (Jungle → Jungle) · Corki (Bot → Bot) · Neeko (Support → Support) | Vitality.Bee | LFL/2025 Season/Summer Split_Week 3_7_1 |
| lfl-2025.json | A | Yone | Top | ∅ | Sejuani (Jungle → ∅) · Ziggs (Bot → ∅) · Ezreal (Mid → ∅) · Alistar (Support → ∅) | Vitality.Bee | LFL/2025 Season/Summer Split_Week 3_7_3 |
| lfl-2025.json | B | Yunara | Bot | Bot | Taliyah (Mid → Mid) · Ornn (Top → Top) · Rell (Support → Support) · Dr. Mundo (Jungle → Jungle) | GameWard | LFL/2025 Season/Summer Split_Week 3_7_3 |
| lfl-2025.json | B | Yunara | Bot | Bot | Sion (Top → Top) · Maokai (Jungle → Jungle) · Jayce (Mid → Mid) · Rakan (Support → Support) | Galions | LFL/2025 Season/Summer Split_Week 4_1_1 |
| lfl-2025.json | B | Yunara | Bot | Bot | Xin Zhao (Jungle → Jungle) · K'Sante (Top → Top) · Annie (Mid → Mid) · Renata Glasc (Support → Support) | Solary | LFL/2025 Season/Summer Split_Week 4_2_2 |
| lfl-2025.json | B | Yunara | Bot | Bot | Aurora (Top → Mid) · Wukong (Jungle → Jungle) · Galio (Mid → Top) · Bard (Support → Support) | Joblife | LFL/2025 Season/Summer Split_Week 4_3_1 |
| lfl-2025.json | B | Yunara | Bot | Bot | Ivern (Jungle → Jungle) · Alistar (Support → Support) · Viktor (Mid → Mid) · Ambessa (Top → Top) | Vitality.Bee | LFL/2025 Season/Summer Split_Week 4_4_2 |
| lfl-2025.json | B | Aphelios | Bot | Bot | Wukong (Jungle → Jungle) · Lulu (Support → Support) · Akali (Mid → Mid) · Ornn (Top → Top) | GameWard | LFL/2025 Season/Summer Split_Week 4_5_1 |
| lfl-2025.json | B | Yunara | Bot | Bot | Trundle (Jungle → Jungle) · Orianna (Mid → Mid) · Blitzcrank (Support → Support) · Ambessa (Top → Top) | Karmine Corp Blue | LFL/2025 Season/Summer Split_Week 4_5_1 |
| lfl-2025.json | B | Yunara | Bot | Bot | Gwen (Top → Top) · Jarvan IV (Jungle → Jungle) · Taliyah (Mid → Mid) · Alistar (Support → Support) | Ici Japon Corp. Esport | LFL/2025 Season/Summer Split_Week 4_6_1 |
| lfl-2025.json | B | Aphelios | Bot | Bot | Sion (Top → Top) · Lulu (Support → Support) · Taliyah (Mid → Mid) · Vi (Jungle → Jungle) | GameWard | LFL/2025 Season/Summer Split_Week 4_7_1 |
| lfl-2025.json | B | Yunara | Bot | Bot | Xin Zhao (Jungle → Jungle) · Nautilus (Support → Support) · Cho'Gath (Top → Top) · Viktor (Mid → Mid) | Joblife | LFL/2025 Season/Summer Split_Week 4_7_1 |
| lfl-2025.json | B | Yunara | Bot | Bot | Xin Zhao (Jungle → Jungle) · Syndra (Mid → Mid) · Yorick (Top → Top) · Bard (Support → Support) | Karmine Corp Blue | LFL/2025 Season/Summer Split_Week 4_8_2 |
| lfl-2025.json | A | Rumble | Jungle | ∅ | Rell (Support → ∅) · Jayce (Mid → ∅) · Senna (Bot → ∅) · Vladimir (Top → ∅) | Galions | LFL/2025 Season/Summer Split_Week 5_3_2 |
| lfl-2025.json | A | Sylas | Jungle | ∅ | Yunara (Bot → ∅) · Yone (Mid → ∅) · Aatrox (Top → ∅) · Leona (Support → ∅) | BK ROG Esports | LFL/2025 Season/Summer Split_Week 5_5_2 |
| lfl-2025.json | B | Kled | Top | Top | Vi (Jungle → Jungle) · Yunara (Bot → Bot) · Rakan (Support → Support) · Ahri (Mid → Mid) | Gentle Mates | LFL/2025 Season/Summer Split_Week 5_7_2 |
| lfl-2025.json | B | Qiyana | Jungle | Jungle | Kai'Sa (Bot → Bot) · Ambessa (Top → Top) · Bard (Support → Support) · Akali (Mid → Mid) | BK ROG Esports | LFL/2025 Season/Summer Split_Week 5_7_3 |
| lfl-2025.json | B | Udyr | Top | Top | Varus (Bot → Bot) · Trundle (Jungle → Jungle) · Akali (Mid → Mid) · Nautilus (Support → Support) | GameWard | LFL/2025 Season/Summer Split_Week 6_1_1 |
| lfl-2025.json | B | Morgana | Mid | Mid | Varus (Bot → Bot) · Pantheon (Jungle → Jungle) · Gwen (Top → Top) · Alistar (Support → Support) | Gentle Mates | LFL/2025 Season/Summer Playoffs_Round 1_1_1 |
| lfl-2025.json | B | Kayle | Top | Top | Corki (Bot → Bot) · Syndra (Mid → Mid) · Alistar (Support → Support) · Skarner (Jungle → Jungle) | BK ROG Esports | LFL/2025 Season/Summer Playoffs_Round 1_2_3 |
| lfl-2025.json | B | Thresh | Support | Support | Azir (Mid → Mid) · Ezreal (Bot → Bot) · Gnar (Top → Top) · Lillia (Jungle → Jungle) | BK ROG Esports | LFL/2025 Season/Summer Playoffs_Round 1_2_4 |
| lfl-2025.json | B | Rek'Sai | Jungle | Jungle | Blitzcrank (Support → Support) · Zoe (Mid → Mid) · Gragas (Top → Top) · Jinx (Bot → Bot) | Vitality.Bee | LFL/2025 Season/Summer Playoffs_Round 1_2_5 |
| lfl-2025.json | B | Nidalee | Jungle | Jungle | Ryze (Mid → Mid) · Pyke (Support → Support) · Camille (Top → Top) · Miss Fortune (Bot → Bot) | BK ROG Esports | LFL/2025 Season/Summer Playoffs_Round 1_2_5 |
| lfl-2025.json | A | Varus | Top | Bot | Pantheon (Jungle → Jungle) · Galio (Mid → Top) · Rell (Support → Support) · Corki (Bot → Mid) | Vitality.Bee | LFL/2025 Season/Summer Playoffs_Round 2_2_1 |
| lfl-2025.json | B | Rek'Sai | Jungle | Jungle | Nautilus (Support → Support) · Ezreal (Bot → Bot) · Ziggs (Mid → Mid) | Gentle Mates | LFL/2025 Season/Summer Playoffs_Round 2_2_3 |
| lfl-2025.json | B | Fiora | Top | Top | Nautilus (Support → Support) · Ezreal (Bot → Bot) · Ziggs (Mid → Mid) | Gentle Mates | LFL/2025 Season/Summer Playoffs_Round 2_2_3 |
| lfl-2025.json | A | Cho'Gath | Jungle | Top | Ryze (Mid → Mid) · Fiora (Top → Jungle) · Lucian (Bot → Bot) · Nami (Support → Support) | Gentle Mates | LFL/2025 Season/Summer Playoffs_Semifinals_1_5 |
| lfl-2025.json | B | Fiora | Top | Jungle | Cho'Gath (Jungle → Top) · Ryze (Mid → Mid) · Lucian (Bot → Bot) · Nami (Support → Support) | Gentle Mates | LFL/2025 Season/Summer Playoffs_Semifinals_1_5 |
| lfl-2025.json | B | Zed | Jungle | Jungle | Sion (Top → Top) · Xayah (Bot → Bot) · Rakan (Support → Support) · Syndra (Mid → Mid) | Karmine Corp Blue | LFL/2025 Season/Summer Playoffs_Finals_1_3 |
| lpl-2025.json | B | Renata Glasc | Support | Mid | K'Sante (Top → Top) · Ashe (Bot → Bot) · Viego (Jungle → Jungle) | Top Esports | LPL/2025 Season/Split 1_Week 3_5_2 |
| lpl-2025.json | B | Hwei | Mid | Support | K'Sante (Top → Top) · Ashe (Bot → Bot) · Viego (Jungle → Jungle) | Top Esports | LPL/2025 Season/Split 1_Week 3_5_2 |
| lpl-2025.json | B | Urgot | Top | Top | Lee Sin (Jungle → Jungle) · Azir (Mid → Mid) · Lulu (Support → Support) · Tristana (Bot → Bot) | Top Esports | LPL/2025 Season/Split 1_Week 3_5_4 |
| lpl-2025.json | B | Renata Glasc | Support | Support | Kalista (Bot → Bot) · Nocturne (Jungle → Jungle) · Akali (Mid → Mid) · Ornn (Top → Top) | Invictus Gaming | LPL/2025 Season/Split 1_Week 3_7_2 |
| lpl-2025.json | B | Zac | Jungle | Jungle | Caitlyn (Bot → Bot) · Renekton (Top → Top) · Braum (Support → Support) | Invictus Gaming | LPL/2025 Season/Split 1_Week 3_7_4 |
| lpl-2025.json | B | Zeri | Mid | Mid | Caitlyn (Bot → Bot) · Renekton (Top → Top) · Braum (Support → Support) | Invictus Gaming | LPL/2025 Season/Split 1_Week 3_7_4 |
| lpl-2025.json | B | Renata Glasc | Support | Support | Ashe (Bot → Bot) · Wukong (Jungle → Jungle) · Orianna (Mid → Mid) · Udyr (Top → Top) | FunPlus Phoenix | LPL/2025 Season/Split 1_Week 4_1_2 |
| lpl-2025.json | B | Hwei | Mid | Mid | Nidalee (Jungle → Jungle) · Renekton (Top → Top) · Leona (Support → Support) · Miss Fortune (Bot → Bot) | JD Gaming | LPL/2025 Season/Split 1_Week 4_2_2 |
| lpl-2025.json | B | Renata Glasc | Support | Support | Kalista (Bot → Bot) · Kennen (Top → Top) · Lee Sin (Jungle → Jungle) · Ryze (Mid → Mid) | JD Gaming | LPL/2025 Season/Split 1_Week 4_2_4 |
| lpl-2025.json | A | Jax | Jungle | ∅ | Rumble (Top → ∅) · Ezreal (Bot → ∅) · Leona (Support → ∅) · Azir (Mid → ∅) | Team WE | LPL/2025 Season/Split 1_Week 5_1_1 |
| lpl-2025.json | B | Zeri | Bot | Bot | Lulu (Support → Support) · Galio (Mid → Mid) · Camille (Top → Top) · Sejuani (Jungle → Jungle) | Anyone's Legend | LPL/2025 Season/Split 1_Week 5_1_4 |
| lpl-2025.json | A | Wukong | Top | ∅ | Corki (Mid → ∅) · Varus (Bot → ∅) · Sejuani (Jungle → ∅) · Braum (Support → ∅) | LNG Esports | LPL/2025 Season/Split 1_Week 5_2_1 |
| lpl-2025.json | B | Lux | Support | Support | K'Sante (Top → Top) · Pantheon (Jungle → Jungle) · Aurora (Mid → Mid) · Caitlyn (Bot → Bot) | LNG Esports | LPL/2025 Season/Split 1_Week 5_2_3 |
| lpl-2025.json | A | Pantheon | Mid | ∅ | Leona (Support → ∅) · Miss Fortune (Bot → ∅) · Nidalee (Jungle → ∅) · Gragas (Top → ∅) | Ninjas in Pyjamas.CN | LPL/2025 Season/Split 1_Week 5_4_2 |
| lpl-2025.json | A | Pantheon | Support | ∅ | Aurora (Mid → ∅) · Vi (Jungle → ∅) · Ezreal (Bot → ∅) · Galio (Top → ∅) | ThunderTalk Gaming | LPL/2025 Season/Split 1_Week 5_5_3 |
| lpl-2025.json | B | Taric | Support | Support | Aatrox (Top → Top) · Wukong (Jungle → Jungle) · Xayah (Bot → Bot) · Syndra (Mid → Mid) | Bilibili Gaming | LPL/2025 Season/Split 1_Week 5_5_5 |
| lpl-2025.json | B | Zeri | Mid | Mid | Zyra (Jungle → Jungle) · Ashe (Bot → Bot) · Braum (Support → Support) · Gnar (Top → Top) | FunPlus Phoenix | LPL/2025 Season/Split 1_Week 5_6_2 |
| lpl-2025.json | A | Aurora | Top | ∅ | Ezreal (Bot → ∅) · Alistar (Support → ∅) · Lee Sin (Jungle → ∅) · Ryze (Mid → ∅) | Invictus Gaming | LPL/2025 Season/Split 1_Week 5_6_3 |
| lpl-2025.json | B | Renata Glasc | Support | Support | Kalista (Bot → Bot) · Jayce (Top → Top) · Orianna (Mid → Mid) | Top Esports | LPL/2025 Season/Split 1_Week 5_7_1 |
| lpl-2025.json | B | Olaf | Jungle | Jungle | Kalista (Bot → Bot) · Jayce (Top → Top) · Orianna (Mid → Mid) | Top Esports | LPL/2025 Season/Split 1_Week 5_7_1 |
| lpl-2025.json | B | Draven | Bot | Bot | Udyr (Top → Top) · Wukong (Jungle → Jungle) · Ryze (Mid → Mid) · Nautilus (Support → Support) | LGD Gaming | LPL/2025 Season/Split 1_Week 5_7_3 |
| lpl-2025.json | B | Hwei | Mid | Mid | Varus (Bot → Bot) · Aatrox (Top → Top) · Nidalee (Jungle → Jungle) · Rell (Support → Support) | Top Esports | LPL/2025 Season/Split 1_Week 5_7_3 |
| lpl-2025.json | A | Ornn | Support | ∅ | Jayce (Top → ∅) · Viego (Jungle → ∅) · Ryze (Mid → ∅) · Senna (Bot → ∅) | JD Gaming | LPL/2025 Season/Split 1 Playoffs_Round 2_1_3 |
| lpl-2025.json | B | Senna | Bot | ∅ | Jayce (Top → ∅) · Viego (Jungle → ∅) · Ryze (Mid → ∅) · Ornn (Support → ∅) | JD Gaming | LPL/2025 Season/Split 1 Playoffs_Round 2_1_3 |
| lpl-2025.json | B | Skarner | Jungle | Jungle | Rumble (Top → Top) · Ashe (Bot → Bot) · Azir (Mid → Mid) · Renata Glasc (Support → Support) | Anyone's Legend | LPL/2025 Season/Split 1 Playoffs_Round 2_2_2 |
| lpl-2025.json | A | Smolder | Bot | ∅ | Aurora (Mid → ∅) · Wukong (Jungle → ∅) · Poppy (Top → ∅) · Bard (Support → ∅) | Ninjas in Pyjamas.CN | LPL/2025 Season/Split 1 Playoffs_Round 2_2_3 |
| lpl-2025.json | A | Karma | Mid | ∅ | Rakan (Support → ∅) · Jax (Jungle → ∅) · Aphelios (Bot → ∅) · Maokai (Top → ∅) | Ninjas in Pyjamas.CN | LPL/2025 Season/Split 1 Playoffs_Round 2_2_4 |
| lpl-2025.json | B | Shen | Support | Support | Ziggs (Bot → Bot) · Sejuani (Jungle → Jungle) · Yone (Mid → Mid) · Aatrox (Top → Top) | Anyone's Legend | LPL/2025 Season/Split 1 Playoffs_Round 2_2_5 |
| lpl-2025.json | B | Yuumi | Support | Support | Maokai (Top → Top) · Zeri (Bot → Bot) · Orianna (Mid → Mid) · Wukong (Jungle → Jungle) | Invictus Gaming | LPL/2025 Season/Split 1 Playoffs_Round 1_2_4 |
| lpl-2025.json | B | Senna | Bot | ∅ | Jayce (Mid → ∅) · Zyra (Jungle → ∅) · Renekton (Top → ∅) · Sion (Support → ∅) | Ninjas in Pyjamas.CN | LPL/2025 Season/Split 1 Playoffs_Round 2_4_3 |
| lpl-2025.json | B | Yuumi | Support | Support | Xin Zhao (Jungle → Jungle) · Zeri (Bot → Bot) · Gragas (Top → Top) · Yasuo (Mid → Mid) | Ninjas in Pyjamas.CN | LPL/2025 Season/Split 1 Playoffs_Round 2_4_4 |
| lpl-2025.json | B | Shen | Jungle | Jungle | Camille (Top → Top) · Ziggs (Bot → Bot) · Tristana (Mid → Mid) · Rell (Support → Support) | Anyone's Legend | LPL/2025 Season/Split 1 Playoffs_Round 4_1_4 |
| lpl-2025.json | B | Shyvana | Jungle | Jungle | Gnar (Top → Top) · Varus (Bot → Bot) · Poppy (Support → Support) · Ahri (Mid → Mid) | Top Esports | LPL/2025 Season/Split 1 Playoffs_Round 3_1_3 |
| lpl-2025.json | B | Mel | Mid | Mid | Gragas (Top → Top) · Ashe (Bot → Bot) · Braum (Support → Support) · Lee Sin (Jungle → Jungle) | Top Esports | LPL/2025 Season/Split 1 Playoffs_Round 4_2_3 |
| lpl-2025.json | A | Corki | Top | ∅ | Varus (Bot → ∅) · Vi (Jungle → ∅) · Rakan (Support → ∅) · Sylas (Mid → ∅) | Team WE | LPL/2025 Season/Split 2 Placements_Day 1_3_1 |
| lpl-2025.json | B | Gwen | Top | ∅ | Kalista (Bot → ∅) · Vi (Jungle → ∅) · Senna (Support → ∅) · Aurora (Mid → ∅) | LNG Esports | LPL/2025 Season/Split 2 Placements_Day 2_2_1 |
| lpl-2025.json | B | Gwen | Top | Top | Vi (Jungle → Jungle) · Taliyah (Mid → Mid) · Xayah (Bot → Bot) · Alistar (Support → Support) | LGD Gaming | LPL/2025 Season/Split 2 Placements_Day 2_3_1 |
| lpl-2025.json | B | Gwen | Top | Top | Varus (Bot → Bot) · Azir (Mid → Mid) · Nocturne (Jungle → Jungle) · Rakan (Support → Support) | LNG Esports | LPL/2025 Season/Split 2 Placements_Day 2_5_1 |
| lpl-2025.json | B | Gwen | Top | Top | Vi (Jungle → Jungle) · Varus (Bot → Bot) · Ahri (Mid → Mid) · Alistar (Support → Support) | JD Gaming | LPL/2025 Season/Split 2 Placements_Day 2_6_1 |
| lpl-2025.json | B | Gwen | Top | Top | Yone (Mid → Mid) · Sejuani (Jungle → Jungle) · Renata Glasc (Support → Support) · Varus (Bot → Bot) | Anyone's Legend | LPL/2025 Season/Split 2 Placements_Day 3_2_1 |
| lpl-2025.json | B | Naafiri | Jungle | Jungle | Varus (Bot → Bot) · Galio (Mid → Mid) · Leona (Support → Support) | Ultra Prime | LPL/2025 Season/Split 2 Placements_Day 3_3_1 |
| lpl-2025.json | B | Gwen | Top | Top | Varus (Bot → Bot) · Galio (Mid → Mid) · Leona (Support → Support) | Ultra Prime | LPL/2025 Season/Split 2 Placements_Day 3_3_1 |
| lpl-2025.json | B | Gwen | Top | Top | Galio (Mid → Mid) · Wukong (Jungle → Jungle) · Corki (Bot → Bot) · Alistar (Support → Support) | Anyone's Legend | LPL/2025 Season/Split 2 Placements_Day 3_4_1 |
| lpl-2025.json | A | Akali | Top | Mid | Xin Zhao (Jungle → Jungle) · Ambessa (Mid → Top) · Ashe (Bot → Bot) · Braum (Support → Support) | ThunderTalk Gaming | LPL/2025 Season/Split 2 Placements_Day 3_4_1 |
| lpl-2025.json | B | Gwen | Top | Top | Varus (Bot → Bot) · Alistar (Support → Support) · Ryze (Mid → Mid) · Lee Sin (Jungle → Jungle) | Ultra Prime | LPL/2025 Season/Split 2 Placements_Day 3_5_1 |
| lpl-2025.json | B | Gwen | Top | Top | Vi (Jungle → Jungle) · Aurora (Mid → Mid) · Kai'Sa (Bot → Bot) · Rell (Support → Support) | Royal Never Give Up | LPL/2025 Season/Split 2 Placements_Day 3_6_1 |
| lpl-2025.json | A | Vladimir | Top | ∅ | Yone (Mid → ∅) · Sejuani (Jungle → ∅) · Ezreal (Bot → ∅) · Leona (Support → ∅) | Anyone's Legend | LPL/2025 Season/Split 2 Placements_Day 3_6_1 |
| lpl-2025.json | B | Gwen | Top | Top | Vi (Jungle → Jungle) · Galio (Mid → Mid) · Jhin (Bot → Bot) · Alistar (Support → Support) | Ninjas in Pyjamas.CN | LPL/2025 Season/Split 2 Placements_Day 4_1_1 |
| lpl-2025.json | B | Naafiri | Jungle | Jungle | Rumble (Top → Top) · Taliyah (Mid → Mid) · Miss Fortune (Bot → Bot) · Alistar (Support → Support) | Top Esports | LPL/2025 Season/Split 2 Placements_Day 4_4_1 |
| lpl-2025.json | B | Gwen | Top | Top | Xin Zhao (Jungle → Jungle) · Kai'Sa (Bot → Bot) · Taliyah (Mid → Mid) · Rakan (Support → Support) | Ninjas in Pyjamas.CN | LPL/2025 Season/Split 2 Placements_Day 4_5_1 |
| lpl-2025.json | B | Naafiri | Jungle | Jungle | Jayce (Top → Top) · Varus (Bot → Bot) · Ryze (Mid → Mid) · Alistar (Support → Support) | Top Esports | LPL/2025 Season/Split 2 Placements_Day 4_6_1 |
| lpl-2025.json | B | Gwen | Top | Top | Sejuani (Jungle → Jungle) · Yone (Mid → Mid) · Ziggs (Bot → Bot) · Leona (Support → Support) | EDward Gaming | LPL/2025 Season/Split 2 Placements_Day 5_1_1 |
| lpl-2025.json | B | Gwen | Top | Top | Neeko (Support → Support) · Xin Zhao (Jungle → Jungle) · Jhin (Bot → Bot) · Taliyah (Mid → Mid) | Weibo Gaming | LPL/2025 Season/Split 2 Placements_Day 5_3_1 |
| lpl-2025.json | B | Naafiri | Jungle | Jungle | Jayce (Top → Top) · Ezreal (Bot → Bot) · Galio (Mid → Mid) · Rell (Support → Support) | Team WE | LPL/2025 Season/Split 2 Placements_Day 5_6_1 |
| lpl-2025.json | B | Naafiri | Jungle | Jungle | Rumble (Top → Top) · Taliyah (Mid → Mid) · Xayah (Bot → Bot) · Alistar (Support → Support) | LGD Gaming | LPL/2025 Season/Split 2 Placements_Day 6_1_1 |
| lpl-2025.json | B | Gwen | Top | Top | Vi (Jungle → Jungle) · Ahri (Mid → Mid) · Kai'Sa (Bot → Bot) · Rakan (Support → Support) | Invictus Gaming | LPL/2025 Season/Split 2 Placements_Day 6_1_1 |
| lpl-2025.json | B | Gwen | Top | Top | Vi (Jungle → Jungle) · Ryze (Mid → Mid) · Jhin (Bot → Bot) · Rakan (Support → Support) | JD Gaming | LPL/2025 Season/Split 2 Placements_Day 6_3_1 |
| lpl-2025.json | B | Gwen | Top | Jungle | Poppy (Jungle → Top) · Corki (Mid → Mid) · Ezreal (Bot → Bot) · Alistar (Support → Support) | LNG Esports | LPL/2025 Season/Split 2 Placements_Day 6_4_1 |
| lpl-2025.json | B | Naafiri | Jungle | Jungle | Jax (Top → Top) · Aurora (Mid → Mid) · Miss Fortune (Bot → Bot) · Nautilus (Support → Support) | LGD Gaming | LPL/2025 Season/Split 2 Placements_Day 6_4_1 |
| lpl-2025.json | B | Gwen | Top | Top | Xin Zhao (Jungle → Jungle) · Taliyah (Mid → Mid) · Ezreal (Bot → Bot) · Alistar (Support → Support) | JD Gaming | LPL/2025 Season/Split 2 Placements_Day 6_5_1 |
| lpl-2025.json | B | Naafiri | Jungle | Jungle | Jax (Top → Top) · Akali (Mid → Mid) · Varus (Bot → Bot) · Rell (Support → Support) | LGD Gaming | LPL/2025 Season/Split 2 Placements_Day 6_5_1 |
| lpl-2025.json | B | Gwen | Top | Top | Ryze (Mid → Mid) · Ezreal (Bot → Bot) · Braum (Support → Support) | Invictus Gaming | LPL/2025 Season/Split 2 Placements_Day 6_6_1 |
| lpl-2025.json | B | Naafiri | Jungle | Jungle | Ryze (Mid → Mid) · Ezreal (Bot → Bot) · Braum (Support → Support) | Invictus Gaming | LPL/2025 Season/Split 2 Placements_Day 6_6_1 |
| lpl-2025.json | B | Naafiri | Jungle | Jungle | Ryze (Mid → Mid) · Sion (Top → Top) · Kai'Sa (Bot → Bot) · Nautilus (Support → Support) | Anyone's Legend | LPL/2025 Season/Split 2 Placements_Day 7_3_1 |
| lpl-2025.json | B | Gwen | Top | Top | Vi (Jungle → Jungle) · Akali (Mid → Mid) · Xayah (Bot → Bot) · Rakan (Support → Support) | Ultra Prime | LPL/2025 Season/Split 2 Placements_Day 7_4_1 |
| lpl-2025.json | B | Gwen | Top | Top | Sejuani (Jungle → Jungle) · Yone (Mid → Mid) · Corki (Bot → Bot) · Braum (Support → Support) | Royal Never Give Up | LPL/2025 Season/Split 2 Placements_Tiebreakers_2_1 |
| lpl-2025.json | B | Gwen | Top | Mid | Kai'Sa (Bot → Bot) · Rakan (Support → Support) · Pantheon (Mid → Jungle) · Maokai (Jungle → Top) | Ninjas in Pyjamas.CN | LPL/2025 Season/Split 2 Placements_Day 8_3_1 |
| lpl-2025.json | B | Gwen | Top | Jungle | Maokai (Jungle → Top) · Corki (Mid → Mid) · Jhin (Bot → Bot) · Alistar (Support → Support) | FunPlus Phoenix | LPL/2025 Season/Split 2 Placements_Day 8_4_1 |
| lpl-2025.json | B | Naafiri | Jungle | Jungle | Jayce (Top → Top) · Ryze (Mid → Mid) · Ezreal (Bot → Bot) · Neeko (Support → Support) | Top Esports | LPL/2025 Season/Split 2 Placements_Day 8_5_1 |
| lpl-2025.json | B | Gwen | Top | Jungle | Poppy (Jungle → Top) · Taliyah (Mid → Mid) · Jinx (Bot → Bot) · Nautilus (Support → Support) | Oh My God | LPL/2025 Season/Split 2 Placements_Day 8_5_1 |
| lpl-2025.json | B | Naafiri | Jungle | Jungle | Sylas (Mid → Mid) · Ambessa (Top → Top) · Kalista (Bot → Bot) · Neeko (Support → Support) | FunPlus Phoenix | LPL/2025 Season/Split 2 Placements_Day 8_6_1 |
| lpl-2025.json | B | Singed | Top | Top | Varus (Bot → Bot) · Vi (Jungle → Jungle) · Renata Glasc (Support → Support) · Pantheon (Mid → Mid) | Ninjas in Pyjamas.CN | LPL/2025 Season/Split 2 Placements_Day 8_6_1 |
| lpl-2025.json | B | Gwen | Top | Top | Xin Zhao (Jungle → Jungle) · Galio (Mid → Mid) · Miss Fortune (Bot → Bot) · Nautilus (Support → Support) | FunPlus Phoenix | LPL/2025 Season/Split 2 Placements_Round 1_1_1 |
| lpl-2025.json | B | Gwen | Top | Top | Xin Zhao (Jungle → Jungle) · Taliyah (Mid → Mid) · Ezreal (Bot → Bot) · Karma (Support → Support) | Team WE | LPL/2025 Season/Split 2 Placements_Round 1_2_1 |
| lpl-2025.json | B | Naafiri | Jungle | Mid | Rumble (Top → Top) · Alistar (Support → Support) · Kai'Sa (Bot → Bot) | Ultra Prime | LPL/2025 Season/Split 2 Placements_Round 1_2_1 |
| lpl-2025.json | B | Zed | Mid | Jungle | Rumble (Top → Top) · Alistar (Support → Support) · Kai'Sa (Bot → Bot) | Ultra Prime | LPL/2025 Season/Split 2 Placements_Round 1_2_1 |
| lpl-2025.json | B | Naafiri | Jungle | Jungle | Galio (Mid → Mid) · Miss Fortune (Bot → Bot) · Neeko (Support → Support) | FunPlus Phoenix | LPL/2025 Season/Split 2 Placements_Round 2_1_1 |
| lpl-2025.json | B | Gwen | Top | Top | Galio (Mid → Mid) · Miss Fortune (Bot → Bot) · Neeko (Support → Support) | FunPlus Phoenix | LPL/2025 Season/Split 2 Placements_Round 2_1_1 |
| lpl-2025.json | B | Zed | Mid | Mid | Lillia (Jungle → Jungle) · Renekton (Top → Top) · Leona (Support → Support) · Jhin (Bot → Bot) | Ultra Prime | LPL/2025 Season/Split 2 Placements_Round 2_1_3 |
| lpl-2025.json | B | Naafiri | Jungle | Jungle | Rumble (Top → Top) · Ryze (Mid → Mid) · Varus (Bot → Bot) · Alistar (Support → Support) | Team WE | LPL/2025 Season/Split 2 Placements_Round 1_3_1 |
| lpl-2025.json | B | Gwen | Top | Top | Aurora (Mid → Mid) · Vi (Jungle → Jungle) · Kalista (Bot → Bot) · Renata Glasc (Support → Support) | LGD Gaming | LPL/2025 Season/Split 2 Placements_Round 1_3_1 |
| lpl-2025.json | B | Gwen | Top | Top | Ryze (Mid → Mid) · Xin Zhao (Jungle → Jungle) · Nautilus (Support → Support) · Corki (Bot → Bot) | Team WE | LPL/2025 Season/Split 2 Placements_Round 2_2_1 |
| lpl-2025.json | A | Nidalee | Top | Jungle | Varus (Bot → Bot) · Rell (Support → Support) · Aurora (Mid → Top) · Lee Sin (Jungle → Mid) | Invictus Gaming | LPL/2025 Season/Split 2_Week 1_1_2 |
| lpl-2025.json | B | Lissandra | Mid | Mid | Naafiri (Jungle → Jungle) · Poppy (Top → Top) · Corki (Bot → Bot) · Alistar (Support → Support) | Ninjas in Pyjamas.CN | LPL/2025 Season/Split 2_Week 1_4_2 |
| lpl-2025.json | A | Gragas | Support | Top | Varus (Bot → Bot) · Viego (Jungle → Jungle) · Viktor (Mid → Mid) · Poppy (Top → Support) | EDward Gaming | LPL/2025 Season/Split 2_Week 2_1_3 |
| lpl-2025.json | B | Cho'Gath | Top | Top | Vi (Jungle → Jungle) · Miss Fortune (Bot → Bot) · Viktor (Mid → Mid) · Nautilus (Support → Support) | Invictus Gaming | LPL/2025 Season/Split 2_Week 2_4_2 |
| lpl-2025.json | A | Gwen | Jungle | ∅ | Rumble (Top → ∅) · Corki (Mid → ∅) · Jhin (Bot → ∅) · Nautilus (Support → ∅) | Team WE | LPL/2025 Season/Split 2_Week 2_6_1 |
| lpl-2025.json | B | Yorick | Top | Jungle | Neeko (Support → Support) · Corki (Mid → Mid) · Maokai (Jungle → Top) · Miss Fortune (Bot → Bot) | Anyone's Legend | LPL/2025 Season/Split 2_Week 2_8_2 |
| lpl-2025.json | A | Sejuani | Top | ∅ | Naafiri (Jungle → ∅) · Ezreal (Bot → ∅) · Karma (Support → ∅) · Viktor (Mid → ∅) | Anyone's Legend | LPL/2025 Season/Split 2_Week 2_8_3 |
| lpl-2025.json | B | Yorick | Top | Top | Xin Zhao (Jungle → Jungle) · Azir (Mid → Mid) · Jinx (Bot → Bot) · Braum (Support → Support) | Anyone's Legend | LPL/2025 Season/Split 2_Week 2_9_1 |
| lpl-2025.json | A | Nidalee | Top | ∅ | Skarner (Jungle → ∅) · Orianna (Mid → ∅) · Jinx (Bot → ∅) · Alistar (Support → ∅) | Invictus Gaming | LPL/2025 Season/Split 2_Week 2_10_3 |
| lpl-2025.json | A | Nidalee | Top | Jungle | Varus (Bot → Bot) · Sylas (Mid → Mid) · Rell (Support → Support) · Jarvan IV (Jungle → Top) | Invictus Gaming | LPL/2025 Season/Split 2_Week 2_12_3 |
| lpl-2025.json | B | Jarvan IV | Jungle | Top | Varus (Bot → Bot) · Nidalee (Top → Jungle) · Sylas (Mid → Mid) · Rell (Support → Support) | Invictus Gaming | LPL/2025 Season/Split 2_Week 2_12_3 |
| lpl-2025.json | B | Yorick | Top | Top | Sejuani (Jungle → Jungle) · Viktor (Mid → Mid) · Jhin (Bot → Bot) · Karma (Support → Support) | ThunderTalk Gaming | LPL/2025 Season/Split 2_Week 2_12_3 |
| lpl-2025.json | B | Yorick | Top | Top | Kalista (Bot → Bot) · Neeko (Support → Support) · Naafiri (Jungle → Jungle) · Hwei (Mid → Mid) | JD Gaming | LPL/2025 Season/Split 2_Week 2_13_2 |
| lpl-2025.json | B | Ivern | Jungle | Jungle | Rumble (Top → Top) · Yone (Mid → Mid) · Miss Fortune (Bot → Bot) · Alistar (Support → Support) | Weibo Gaming | LPL/2025 Season/Split 2_Week 2_16_2 |
| lpl-2025.json | B | Yorick | Top | Top | Taliyah (Mid → Mid) · Skarner (Jungle → Jungle) · Xayah (Bot → Bot) · Renata Glasc (Support → Support) | Ultra Prime | LPL/2025 Season/Split 2_Week 3_1_3 |
| lpl-2025.json | B | Kassadin | Mid | Mid | Vi (Jungle → Jungle) · Miss Fortune (Bot → Bot) · Neeko (Support → Support) · K'Sante (Top → Top) | FunPlus Phoenix | LPL/2025 Season/Split 2_Week 3_2_3 |
| lpl-2025.json | A | Nidalee | Top | ∅ | Sejuani (Jungle → ∅) · Azir (Mid → ∅) · Xayah (Bot → ∅) · Rakan (Support → ∅) | Invictus Gaming | LPL/2025 Season/Split 2_Week 3_4_3 |
| lpl-2025.json | B | Yorick | Top | Jungle | Maokai (Jungle → Top) · Sylas (Mid → Mid) · Jhin (Bot → Bot) · Karma (Support → Support) | Ninjas in Pyjamas.CN | LPL/2025 Season/Split 2_Week 3_4_3 |
| lpl-2025.json | B | Yorick | Top | Top | Vi (Jungle → Jungle) · Miss Fortune (Bot → Bot) · Taliyah (Mid → Mid) · Leona (Support → Support) | Bilibili Gaming | LPL/2025 Season/Split 2_Week 3_7_2 |
| lpl-2025.json | B | Yorick | Top | Jungle | Ezreal (Bot → Bot) · Maokai (Jungle → Top) · Rell (Support → Support) · Aurora (Mid → Mid) | Weibo Gaming | LPL/2025 Season/Split 2_Week 3_8_2 |
| lpl-2025.json | B | Yorick | Top | Top | Naafiri (Jungle → Jungle) · Miss Fortune (Bot → Bot) · Viktor (Mid → Mid) · Braum (Support → Support) | Ninjas in Pyjamas.CN | LPL/2025 Season/Split 2_Week 3_9_2 |
| lpl-2025.json | B | Yorick | Top | Top | Sejuani (Jungle → Jungle) · Miss Fortune (Bot → Bot) · Viktor (Mid → Mid) · Nautilus (Support → Support) | JD Gaming | LPL/2025 Season/Split 2_Week 3_10_1 |
| lpl-2025.json | B | Annie | Mid | Mid | Ezreal (Bot → Bot) · Alistar (Support → Support) · Jax (Top → Top) · Viego (Jungle → Jungle) | Bilibili Gaming | LPL/2025 Season/Split 2_Week 3_14_3 |
| lpl-2025.json | B | Annie | Mid | Mid | Yorick (Top → Top) · Lee Sin (Jungle → Jungle) · Miss Fortune (Bot → Bot) · Nautilus (Support → Support) | Royal Never Give Up | LPL/2025 Season/Split 2_Week 4_3_2 |
| lpl-2025.json | A | Ashe | Support | ∅ | Kalista (Bot → ∅) · Naafiri (Jungle → ∅) · Sion (Top → ∅) · Lissandra (Mid → ∅) | JD Gaming | LPL/2025 Season/Split 2_Week 4_15_1 |
| lpl-2025.json | B | Aurelion Sol | Mid | Mid | Vi (Jungle → Jungle) · Miss Fortune (Bot → Bot) · Ambessa (Top → Top) · Braum (Support → Support) | Royal Never Give Up | LPL/2025 Season/Split 2_Week 5_9_3 |
| lpl-2025.json | B | Trundle | Jungle | Jungle | Ezreal (Bot → Bot) · Viktor (Mid → Mid) · Leona (Support → Support) · Ornn (Top → Top) | Team WE | LPL/2025 Season/Split 2_Week 6_1_2 |
| lpl-2025.json | B | Trundle | Jungle | Jungle | Azir (Mid → Mid) · Ornn (Top → Top) · Jhin (Bot → Bot) · Nautilus (Support → Support) | Team WE | LPL/2025 Season/Split 2_Week 6_3_2 |
| lpl-2025.json | B | Milio | Support | Support | Lucian (Bot → Bot) · Maokai (Jungle → Jungle) · Hwei (Mid → Mid) · Ambessa (Top → Top) | Ninjas in Pyjamas.CN | LPL/2025 Season/Split 2_Week 6_8_2 |
| lpl-2025.json | B | Trundle | Jungle | Jungle | Sion (Top → Top) · Lucian (Bot → Bot) · Nami (Support → Support) · Viktor (Mid → Mid) | Anyone's Legend | LPL/2025 Season/Split 2_Week 6_9_3 |
| lpl-2025.json | B | Trundle | Jungle | Jungle | Ezreal (Bot → Bot) · Leona (Support → Support) · Viktor (Mid → Mid) · Ambessa (Top → Top) | Team WE | LPL/2025 Season/Split 2_Week 6_10_2 |
| lpl-2025.json | A | Ornn | Mid | ∅ | Rumble (Top → ∅) · Varus (Bot → ∅) · Viego (Jungle → ∅) · Renata Glasc (Support → ∅) | Royal Never Give Up | LPL/2025 Season/Split 2_Week 6_11_2 |
| lpl-2025.json | A | Ambessa | Jungle | Top | Alistar (Support → Support) · Aurelion Sol (Mid → Mid) · Jax (Top → Jungle) · Sivir (Bot → Bot) | Royal Never Give Up | LPL/2025 Season/Split 2_Week 6_11_3 |
| lpl-2025.json | B | Graves | Jungle | Jungle | Lucian (Bot → Bot) · Annie (Mid → Mid) · Nami (Support → Support) · Shen (Top → Top) | Team WE | LPL/2025 Season/Split 2_Week 6_13_2 |
| lpl-2025.json | B | Nasus | Top | Top | Neeko (Support → Support) · Pantheon (Jungle → Jungle) · Ezreal (Bot → Bot) · Ryze (Mid → Mid) | Anyone's Legend | LPL/2025 Season/Split 2_Week 7_1_2 |
| lpl-2025.json | B | Kled | Mid | Mid | Miss Fortune (Bot → Bot) · Maokai (Jungle → Jungle) · Renekton (Top → Top) · Rell (Support → Support) | Ninjas in Pyjamas.CN | LPL/2025 Season/Split 2_Week 7_3_3 |
| lpl-2025.json | B | Milio | Support | Mid | Zeri (Bot → Bot) · Sejuani (Jungle → Jungle) · Ambessa (Top → Top) · Karma (Mid → Support) | Ninjas in Pyjamas.CN | LPL/2025 Season/Split 2_Week 7_7_3 |
| lpl-2025.json | B | Trundle | Jungle | Jungle | Azir (Mid → Mid) · K'Sante (Top → Top) · Nautilus (Support → Support) · Kai'Sa (Bot → Bot) | Top Esports | LPL/2025 Season/Split 2_Week 7_11_2 |
| lpl-2025.json | B | Talon | Jungle | Jungle | Azir (Mid → Mid) · Kalista (Bot → Bot) · Renata Glasc (Support → Support) · K'Sante (Top → Top) | Top Esports | LPL/2025 Season/Split 2_Week 7_13_2 |
| lpl-2025.json | B | Nasus | Top | Top | Pantheon (Jungle → Jungle) · Xayah (Bot → Bot) · Rakan (Support → Support) · Akali (Mid → Mid) | Anyone's Legend | LPL/2025 Season/Split 2_Week 8_5_2 |
| lpl-2025.json | B | Trundle | Jungle | Jungle | Varus (Bot → Bot) · Yorick (Top → Top) · Annie (Mid → Mid) · Renata Glasc (Support → Support) | Team WE | LPL/2025 Season/Split 2_Week 8_7_1 |
| lpl-2025.json | A | Viego | Mid | Jungle | Rumble (Top → Top) · Braum (Support → Support) · Senna (Bot → Bot) · Diana (Jungle → Mid) | FunPlus Phoenix | LPL/2025 Season/Split 2 Playoffs_Round 1_1_4 |
| lpl-2025.json | B | Diana | Jungle | Mid | Rumble (Top → Top) · Braum (Support → Support) · Senna (Bot → Bot) · Viego (Mid → Jungle) | FunPlus Phoenix | LPL/2025 Season/Split 2 Playoffs_Round 1_1_4 |
| lpl-2025.json | B | Diana | Jungle | Jungle | Corki (Bot → Bot) · Rell (Support → Support) · Cho'Gath (Top → Top) · Yasuo (Mid → Mid) | Invictus Gaming | LPL/2025 Season/Split 2 Playoffs_Round 1_5_4 |
| lpl-2025.json | B | Tahm Kench | Support | Support | Jayce (Top → Top) · Senna (Bot → Bot) · Lillia (Jungle → Jungle) · Aurora (Mid → Mid) | Top Esports | LPL/2025 Season/Split 2 Playoffs_Round 2_4_4 |
| lpl-2025.json | B | Fiora | Top | Top | Lucian (Bot → Bot) · Skarner (Jungle → Jungle) · Nami (Support → Support) · Viktor (Mid → Mid) | Top Esports | LPL/2025 Season/Split 2 Playoffs_Round 2_4_5 |
| lpl-2025.json | B | Cassiopeia | Mid | Mid | Kalista (Bot → Bot) · Trundle (Jungle → Jungle) · Ashe (Support → Support) · Cho'Gath (Top → Top) | Anyone's Legend | LPL/2025 Season/Split 2 Playoffs_Round 4_1_3 |
| lpl-2025.json | B | Soraka | Support | Support | Kalista (Bot → Bot) · Nidalee (Top → Top) · Azir (Mid → Mid) · Jarvan IV (Jungle → Jungle) | Invictus Gaming | LPL/2025 Season/Split 2 Playoffs_Round 4_2_3 |
| lpl-2025.json | B | Cassiopeia | Mid | Mid | Jayce (Top → Top) · Varus (Bot → Bot) · Xin Zhao (Jungle → Jungle) · Karma (Support → Support) | Bilibili Gaming | LPL/2025 Season/Split 2 Playoffs_Round 4_2_4 |
| lpl-2025.json | B | Cassiopeia | Mid | Mid | Rakan (Support → Support) · Trundle (Jungle → Jungle) · Xayah (Bot → Bot) · Gnar (Top → Top) | Bilibili Gaming | LPL/2025 Season/Split 2 Playoffs_Finals_1_4 |
| lpl-2025.json | B | Twisted Fate | Mid | Mid | Lee Sin (Jungle → Jungle) · Rakan (Support → Support) · K'Sante (Top → Top) · Zeri (Bot → Bot) | Ninjas in Pyjamas.CN | LPL/2025 Season/Split 3_Week 2_2_2 |
| lpl-2025.json | B | Ekko | Mid | Mid | Varus (Bot → Bot) · Sion (Top → Top) · Jarvan IV (Jungle → Jungle) · Alistar (Support → Support) | Ultra Prime | LPL/2025 Season/Split 3_Week 2_11_2 |
| lpl-2025.json | A | Smolder | Top | ∅ | Lucian (Bot → ∅) · Bard (Support → ∅) · Sylas (Mid → ∅) · Jarvan IV (Jungle → ∅) | Anyone's Legend | LPL/2025 Season/Split 3_Week 2_15_3 |
| lpl-2025.json | A | Ziggs | Mid | ∅ | Varus (Bot → ∅) · Ornn (Top → ∅) · Nautilus (Support → ∅) · Jarvan IV (Jungle → ∅) | Bilibili Gaming | LPL/2025 Season/Split 3_Week 3_7_2 |
| lpl-2025.json | B | Twisted Fate | Mid | Mid | Xin Zhao (Jungle → Jungle) · K'Sante (Top → Top) · Kai'Sa (Bot → Bot) · Alistar (Support → Support) | Ultra Prime | LPL/2025 Season/Split 3_Week 3_11_3 |
| lpl-2025.json | A | Ziggs | Mid | ∅ | Trundle (Jungle → ∅) · Jhin (Bot → ∅) · Nautilus (Support → ∅) · Rumble (Top → ∅) | Bilibili Gaming | LPL/2025 Season/Split 3_Week 3_14_1 |
| lpl-2025.json | B | Yunara | Bot | Bot | Taliyah (Mid → Mid) · Skarner (Jungle → Jungle) · Nautilus (Support → Support) · Yorick (Top → Top) | Team WE | LPL/2025 Season/Split 3_Week 4_1_2 |
| lpl-2025.json | B | Yunara | Bot | Bot | Vi (Jungle → Jungle) · Taliyah (Mid → Mid) · Ambessa (Top → Top) · Rell (Support → Support) | Ninjas in Pyjamas.CN | LPL/2025 Season/Split 3_Week 4_2_1 |
| lpl-2025.json | B | Yunara | Bot | Bot | Pantheon (Jungle → Jungle) · Annie (Mid → Mid) · Rumble (Top → Top) · Rell (Support → Support) | Anyone's Legend | LPL/2025 Season/Split 3_Week 4_3_1 |
| lpl-2025.json | B | Yunara | Bot | Bot | Rumble (Top → Top) · Taliyah (Mid → Mid) · Wukong (Jungle → Jungle) · Renata Glasc (Support → Support) | JD Gaming | LPL/2025 Season/Split 3_Week 4_4_1 |
| lpl-2025.json | B | Yunara | Bot | Bot | Pantheon (Jungle → Jungle) · Orianna (Mid → Mid) · Rell (Support → Support) · Ornn (Top → Top) | Invictus Gaming | LPL/2025 Season/Split 3_Week 4_5_1 |
| lpl-2025.json | B | Yunara | Bot | Bot | Annie (Mid → Mid) · Vi (Jungle → Jungle) · Lulu (Support → Support) · Ornn (Top → Top) | ThunderTalk Gaming | LPL/2025 Season/Split 3_Week 4_7_1 |
| lpl-2025.json | B | Yunara | Bot | Bot | Rumble (Top → Top) · Alistar (Support → Support) · Yone (Mid → Mid) · Sejuani (Jungle → Jungle) | FunPlus Phoenix | LPL/2025 Season/Split 3_Week 4_9_1 |
| lpl-2025.json | B | Yunara | Bot | Bot | Wukong (Jungle → Jungle) · Annie (Mid → Mid) · Nautilus (Support → Support) · Sion (Top → Top) | Top Esports | LPL/2025 Season/Split 3_Week 4_11_1 |
| lpl-2025.json | B | Yunara | Bot | Bot | Wukong (Jungle → Jungle) · Nautilus (Support → Support) · Orianna (Mid → Mid) · Aatrox (Top → Top) | EDward Gaming | LPL/2025 Season/Split 3_Week 4_13_2 |
| lpl-2025.json | B | Yunara | Bot | Bot | Ornn (Top → Top) · Nautilus (Support → Support) · Annie (Mid → Mid) · Nocturne (Jungle → Jungle) | Bilibili Gaming | LPL/2025 Season/Split 3_Week 5_6_3 |
| lpl-2025.json | B | Yunara | Bot | Bot | Wukong (Jungle → Jungle) · Aurora (Mid → Mid) · Gwen (Top → Top) · Rell (Support → Support) | Bilibili Gaming | LPL/2025 Season/Split 3_Week 5_10_1 |
| lpl-2025.json | B | Yunara | Bot | Bot | Skarner (Jungle → Jungle) · Neeko (Support → Support) · Rumble (Top → Top) · Orianna (Mid → Mid) | Team WE | LPL/2025 Season/Split 3_Week 5_11_1 |
| lpl-2025.json | B | Yunara | Bot | Bot | Sion (Top → Top) · Galio (Mid → Mid) · Wukong (Jungle → Jungle) · Bard (Support → Support) | Invictus Gaming | LPL/2025 Season/Split 3_Week 6_2_2 |
| lpl-2025.json | B | Qiyana | Jungle | Jungle | Ryze (Mid → Mid) · Kalista (Bot → Bot) · Renata Glasc (Support → Support) · Aatrox (Top → Top) | Top Esports | LPL/2025 Season/Split 3_Week 7_4_3 |
| lpl-2025.json | B | Qiyana | Jungle | Jungle | Ryze (Mid → Mid) · Sion (Top → Top) · Sivir (Bot → Bot) · Braum (Support → Support) | Weibo Gaming | LPL/2025 Season/Split 3_Week 7_7_2 |
| lpl-2025.json | B | Morgana | Jungle | Jungle | Ziggs (Bot → Bot) · Leona (Support → Support) · Tristana (Mid → Mid) · Sion (Top → Top) | Bilibili Gaming | LPL/2025 Season/Grand Finals_Round 1_1_4 |
| lpl-2025.json | A | Sylas | Jungle | ∅ | Ryze (Mid → ∅) · Senna (Bot → ∅) · Nautilus (Support → ∅) · Renekton (Top → ∅) | EDward Gaming | LPL/2025 Season/Grand Finals_Round 1_2_3 |
| lpl-2025.json | B | Morgana | Mid | Mid | Rell (Support → Support) · Jarvan IV (Jungle → Jungle) · Zeri (Bot → Bot) · Aatrox (Top → Top) | Weibo Gaming | LPL/2025 Season/Grand Finals_Round 1_3_4 |
| lpl-2025.json | B | Rek'Sai | Top | Top | Vi (Jungle → Jungle) · Lucian (Bot → Bot) · Nami (Support → Support) · LeBlanc (Mid → Mid) | Anyone's Legend | LPL/2025 Season/Grand Finals_Round 1_3_5 |
| lpl-2025.json | A | Sion | Mid | ∅ | Rumble (Top → ∅) · Kai'Sa (Bot → ∅) · Nautilus (Support → ∅) · Jarvan IV (Jungle → ∅) | Ninjas in Pyjamas.CN | LPL/2025 Season/Grand Finals_Round 1_4_1 |
| lpl-2025.json | A | Sylas | Jungle | ∅ | Varus (Bot → ∅) · Alistar (Support → ∅) · Ryze (Mid → ∅) · Yorick (Top → ∅) | Ninjas in Pyjamas.CN | LPL/2025 Season/Grand Finals_Round 1_4_2 |
| lpl-2025.json | B | Morgana | Mid | Mid | Ambessa (Top → Top) · Trundle (Jungle → Jungle) · Leona (Support → Support) | Weibo Gaming | LPL/2025 Season/Grand Finals_Round 2_2_4 |
| lpl-2025.json | B | Vayne | Bot | Bot | Ambessa (Top → Top) · Trundle (Jungle → Jungle) · Leona (Support → Support) | Weibo Gaming | LPL/2025 Season/Grand Finals_Round 2_2_4 |
| lpl-2025.json | A | Sylas | Jungle | ∅ | Varus (Bot → ∅) · Jayce (Mid → ∅) · Rell (Support → ∅) · Aatrox (Top → ∅) | Invictus Gaming | LPL/2025 Season/Grand Finals_Round 2_4_3 |
| lpl-2025.json | B | Morgana | Jungle | Jungle | Rumble (Top → Top) · Nautilus (Support → Support) · Varus (Bot → Bot) · Tristana (Mid → Mid) | Bilibili Gaming | LPL/2025 Season/Grand Finals_Round 4_1_3 |
| lpl-2025.json | A | Sylas | Jungle | ∅ | Xayah (Bot → ∅) · Rakan (Support → ∅) · Ornn (Top → ∅) · Yasuo (Mid → ∅) | Top Esports | LPL/2025 Season/Grand Finals_Round 4_1_3 |
| lpl-2025.json | B | Veigar | Mid | Mid | Renekton (Top → Top) · Xin Zhao (Jungle → Jungle) · Ziggs (Bot → Bot) · Nautilus (Support → Support) | Anyone's Legend | LPL/2025 Season/Grand Finals_Round 4_2_4 |
| lpl-2025.json | B | Rek'Sai | Top | Top | Aurora (Mid → Mid) · Vi (Jungle → Jungle) · Ziggs (Bot → Bot) · Leona (Support → Support) | Invictus Gaming | LPL/2025 Season/Regional Finals_Round 1_1_3 |
| lpl-2025.json | A | Lulu | Mid | ∅ | Skarner (Jungle → ∅) · Miss Fortune (Bot → ∅) · Bard (Support → ∅) · Gwen (Top → ∅) | Invictus Gaming | LPL/2025 Season/Regional Finals_Round 1_1_4 |

## Couverture — sides écartés par cause

- lck-2026.json : 674 sides scannés ; fold vide (premier patch) : 102.
- lec-2026.json : 492 sides scannés ; fold vide (premier patch) : 36.
- lfl-2026.json : 382 sides scannés ; fold vide (premier patch) : 24.
- lpl-2026.json : 890 sides scannés ; fold vide (premier patch) : 150 · patch non plaçable : 4.
- lec-2025.json : 616 sides scannés ; fold vide (premier patch) : 30.
- lfl-2025.json : 634 sides scannés ; fold vide (premier patch) : 22.
- lpl-2025.json : 1634 sides scannés ; fold vide (premier patch) : 86.

## Notes

- Flux rng UNIQUE mulberry32(42) consommé en ordre fixe : primaire → S3 → S4 (1000 resamples chacun, statistique recalculée par resample, patron S2 du chantier C) ; S1/S2/S5 et les baselines de contexte sont publiées SANS IC bootstrap et ne consomment rien.
- Resamples sans score d’un des deux groupes écartés et comptés (colonne kept) — patron du ρ S2.
- Cluster = série (corpus, matchId) ; game sans série = son propre cluster.
- Confound déclaré : les sides à événement diffèrent des sides sains (games plus tardives, métas plus étranges) — non éliminable.
- Un side peut porter les deux classes (compté dans chacune — colonne « Sides A∧B »).
- Une règle, un run : tout rouge est gelé ; toute nouvelle piste = NOUVEL en-tête daté.

