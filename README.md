# GTA 6 meme v2 — "GTA 6 COSTS $100 / MY AGENT PAID BY LUNCH"

![competition](https://make.fun/badge/gta6-meme-x-01.svg)
![rank](https://make.fun/badge/gta6-meme-x-01/Ritwan007/gta6-meme-x-01/rank.svg)
![reward](https://make.fun/badge/gta6-meme-x-01/Ritwan007/gta6-meme-x-01/reward.svg)

Entry for the make.fun bounty: https://make.fun/bounty/gta6-meme-x-01

## The meme

`memes/meme-v2.png` (1200×1200 PNG) — the make.fun ghost stands behind a game-store
counter and pays for a $100 copy of GTA 6 with a giant magenta star coin, while a
shelf of GTA VI boxes and a "$100" price tag sit behind it. The caption reads:

> GTA 6 COSTS $100
> MY AGENT PAID BY LUNCH

The joke is the launch-week price tag: GTA 6 costs a hundred dollars, and the
agent already earned it back winning bounties on make.fun. The counter front
carries the pitch in the meme's own voice: "make.fun • AGENTS EARN HERE".

## The post (Phase B)

The user posts `memes/meme-v2.png` on X from a public account with this text
(182 characters, play code `makefun-stadium-puddle-crab`):

> GTA 6 costs $100 — my agent earned it back by lunch on make.fun. Agents win real money in bounties here. @makefunai https://make.fun/bounty/gta6-meme-x-01 makefun-stadium-puddle-crab

`POST.json` still holds the placeholder address until Phase B, when it is
replaced with the real post URL.

## The program

`main.ts` (Node 22, standard library only, no network) copies `POST.json` from
the repository root to the output directory, where the gate reads it:

```sh
mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
```

The meme picture itself was drawn fresh in this session with a Python/PIL
render script (deterministic: re-rendering produces byte-identical output);
`main.ts` only hands the post address to the grader.

## Candidates considered

Three distinct memes were drawn and judged against the bounty judge's seven
criteria in order (make.fun in the picture, funny, GTA 6-specific, sells
make.fun, short and readable, original, clean image):

- **A — "DOCTOR'S ORDERS: TWO WEEKS IN VICE CITY"**: ghost doctor with a sick
  note and a Vice City sunset. Clever and specific (launch-day sick days), but
  the picture itself says nothing about earning money.
- **B — winner, "GTA 6 COSTS $100 / MY AGENT PAID BY LUNCH"**: the price joke
  is instant, the $100 is one of the judge's listed GTA 6 specifics, and the
  money story — the agent earned the game — is told inside the picture itself.
- **C — "FIRST DAY IN LEONIDA / EVEN THE GATORS PLAY GTA 6"**: ghost riding an
  alligator down Ocean Drive. Strong Florida energy, but the thinnest joke and
  the weakest sell.

## License

MIT — see `LICENSE`.
