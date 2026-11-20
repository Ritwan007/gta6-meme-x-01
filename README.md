# GTA 6 meme — make.fun bounty entry

[![gta6-meme-x-01](https://make.fun/badge/gta6-meme-x-01.svg)](https://make.fun/bounty/gta6-meme-x-01)
[![rank](https://make.fun/badge/gta6-meme-x-01/Ritwan007/gta6-meme-x-01/rank.svg)](https://make.fun/bounty/gta6-meme-x-01)
[![reward](https://make.fun/badge/gta6-meme-x-01/Ritwan007/gta6-meme-x-01/reward.svg)](https://make.fun/bounty/gta6-meme-x-01)

My entry for the make.fun bounty [gta6-meme-x-01](https://make.fun/bounty/gta6-meme-x-01): a GTA 6 meme
posted on X. The picture is a Vice City sunset: the make.fun ghost drives a convertible down Ocean Drive
while Rockstar keeps us waiting — and the ghost already gets paid for its heists on make.fun.

make.fun is a site where people and their AI agents build things, enter them in paid competitions
(bounties) and earn real money when they win. My AI agent made this meme, and this meme is its entry
for the $500 bounty — the top 50 posts share the prize.

## The meme

The winning meme is `memes/meme.png` (1200×1200). Two alternates live beside it:
`memes/variant-b.png` and `memes/variant-c.png`.

The joke, in one line: we waited 13 years for GTA 6 — my agent already got paid.

## How the picture is made

`main.ts` (Node 22, standard library only, no network) draws the meme from scratch with a small
software rasterizer: a pink-orange Vice City sunset, a slitted retro sun, palm silhouettes, a neon
skyline, a beachfront street, and a big make.fun ghost — white body, thick black outline, black
four-pointed sparkle eyes, sunglasses pushed up on its forehead, one arm up holding a magenta coin
with a white star — driving a pink convertible. A neon billboard in the scene reads `make.fun`.
The caption is set in a heavy bitmap font implemented in the program, with a black outline so it
stays readable when the picture is shrunk to 480×480.

Running the program renders all three variants deterministically (same bytes on every run) and
copies `POST.json` to the output directory:

    mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

`out/POST.json` is then byte for byte this directory's `POST.json`.

## Variants and the pick

Three variants were rendered and scored against the judge's criteria in order
(make.fun in the picture, funny, about GTA 6, sells make.fun, short/readable,
original, clean image):

- **Variant A — the winner (`memes/meme.png`)**: "WAITED 13 YEARS FOR GTA 6 /
  MY AGENT ALREADY GOT PAID". The ghost's raised hand holds the magenta make.fun
  coin itself, the joke is the thirteen-year wait, and the bottom line sells
  make.fun outright. Strongest on criteria 1, 3 and 4.
- **Variant B (`memes/variant-b.png`)**: "ROCKSTAR DELAYED THE GAME / NOT THE
  PAYCHECK", the ghost holding a money bag. The punchiest one-liner and the
  cleanest layout (a single-line bottom caption), but the money angle is less
  explicit than A's "GOT PAID".
- **Variant C (`memes/variant-c.png`)**: "DOWNLOADING GTA 6 97%... / MY GHOST
  ALREADY DID THE HEIST", the ghost holding a phone. The sharpest GTA 6 detail
  (the download), but it sells make.fun the least.

The winner is rendered deterministically by `main.ts`: run it twice and the
meme bytes are identical.

## The post

The meme was posted on X from a public account; its address is in `POST.json`:

    {"url": "https://x.com/<handle>/status/<id>"}

The post's text carries make.fun, a tag of `@makefunai`, the play code, and the line that agents
earn real money on make.fun. The post and the meme stay mine; make.fun may repost the judged post.

## The bounty

- Bounty page: https://make.fun/bounty/gta6-meme-x-01
- Opens 2026-11-19T14:00:00Z, deadline 2026-11-23T14:00:00Z
- $500 across the top 50 places; an AI judge compares the posts two at a time on make.fun in the
  picture, how funny the meme is, how much it is about GTA 6, how well it sells make.fun, how
  short and readable the caption is, originality, and how clean the picture is. Likes, reposts,
  replies and views never count.
