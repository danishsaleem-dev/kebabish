# Image credits — PLACEHOLDERS

Every image in this folder is a royalty-free stock photo from
[Pexels](https://www.pexels.com), used under the
[Pexels licence](https://www.pexels.com/license/) (free for commercial use,
no attribution required — credited here as good practice).

**These are stand-ins.** They are not Kebabish's food. Replace them with the
client's own photography before launch: drop a new file at the same path and
nothing in the code needs to change.

| Path | Pexels photo |
| --- | --- |
| `hero-poster.jpg` | [33556462](https://www.pexels.com/photo/33556462/) — flames inside a clay tandoor |
| `story/tandoor.jpg` | [14020936](https://www.pexels.com/photo/14020936/) — marinated chicken in a tandoor |
| `story/spices.jpg` | [2802527](https://www.pexels.com/photo/2802527/) — turmeric, cumin and chilli |
| `dishes/chicken-biryani.jpg` | [5410401](https://www.pexels.com/photo/5410401/) |
| `dishes/chicken-chapli-kebab.jpg` | [37080242](https://www.pexels.com/photo/37080242/) |
| `dishes/chicken-shoarma.jpg` | [5779364](https://www.pexels.com/photo/5779364/) |
| `dishes/zinger-burger.jpg` | [5474836](https://www.pexels.com/photo/5474836/) |
| `dishes/qeema-naan.jpg` | [16851842](https://www.pexels.com/photo/16851842/) |
| `dishes/milk-shake.jpg` | [32469289](https://www.pexels.com/photo/32469289/) |

## Hero video

`public/video/hero.mp4` is **not** in the repo yet — the client is supplying
it. Until the file exists, `src/lib/hero-video.ts` detects its absence at
build time and the hero falls back to `hero-poster.jpg`. Adding the file and
rebuilding switches the video on with no code change.
