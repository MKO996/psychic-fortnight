# Rungs

A word ladder game: change one letter at a time to climb from START to TARGET.
FISH → FIST → FIAT → FEAT → BEAT → BOAT.

Expo SDK 58 · React Native · TypeScript (strict) · Expo Router.

## Status

| Phase | What | State |
|---|---|---|
| 1 | Game engine + tests | ✅ done |
| 2 | Solo core loop (animation, haptics, sound) | next |
| 3 | Daily, Endless, stats, streak, share | |
| 4 | Pass & Play | |
| 5 | Online Room (Supabase) | |
| 6 | Nearby (Bluetooth) | |
| 7 | Polish and release | |

## Commands

```bash
npm install
npm test               # engine tests (Jest)
npm run typecheck
npx expo start         # run the app (from Phase 2)
npm run build:words    # rebuild src/engine/data/words.json (needs: pip install -r wordlists/requirements.txt)
```

## Layout

```
src/engine/        pure TypeScript game rules, no UI
  dictionary.ts    word tiers (endpoint ⊂ path ⊂ valid)
  moves.ts         isValidMove / checkMove
  graph.ts         word graph + BFS (par)
  generator.ts     puzzles, difficulty, daily puzzle
  hint.ts          which letter to change next
  ladder.ts        game state for one ladder
  __tests__/       Jest tests
wordlists/         raw sources + hand-curated filters
scripts/           build_words.py
src/app/           screens (Expo Router)
```

Decisions and their reasons: [DECISIONS.md](./DECISIONS.md).

## Credits

- Word list: ENABLE (public domain).
- Profanity filter: [LDNOOBW](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words), CC-BY 4.0.
- Word frequencies used at build time: [wordfreq](https://github.com/rspeer/wordfreq).
