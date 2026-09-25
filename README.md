# Scale Explorer

**See how big things really are.** Interactive visual scale comparisons for understanding how big real-world objects, animals, structures, vehicles, and space objects really are.

Live site: https://scale-explorer.freewebtoolss.workers.dev

- 32 objects in 6 categories (animals, vehicles, buildings, structures, nature, space), each with its own page, sourced measurements and a drawing to scale.
- Compare any two to five objects side by side, with or without a person for scale.
- Type your own size in meters, feet, kilometers or miles and see it next to familiar things.
- Very different sizes (a person next to Earth) get zoomed-in views and a step-by-step zoom, and every change of scale is labelled.
- Static site: no backend, database, accounts, analytics, tracking or third-party requests. All drawing and maths run in the browser.

## How it works

```
data/objects/*.json   one file per object: measurements, sources, description, drawing profile
data/categories.json  the categories
data/site.json        site URL, popular comparisons, featured objects
src/lib/              shared logic used by the build, the browser and the tests
  units.js            unit conversion, formatting and input parsing
  measures.js         measurement ranges and text
  layout.js           scale maths: drawing boxes, stage layout, zoom levels, zoom ladder
  render.js           SVG drawings and bar charts (returns strings)
  figure.js           figure markup shared by pre-rendered pages and the browser
  compare.js          plain-language comparisons ("about 3 times as long as ...")
  search.js           local fuzzy search
  silhouettes*.js     side-view silhouettes, one file per group
src/client/app.js     browser script: redraws at screen width, search box, compare and custom size pages
src/styles/site.css   all styles (light and dark)
build/                build script, data validation, page templates
static/               favicon and Open Graph images, copied as-is
public/               generated site (served by Cloudflare)
tools/                local server, browser tests, share-image and silhouette sheet generators
tests/                node:test unit and build tests
```

Every page is fully rendered at build time (titles, meta descriptions, canonical URLs, Open Graph tags, JSON-LD, sitemap), so it works and is indexable without JavaScript. The browser script then redraws the drawings at the real screen width and adds the interactive parts.

### Accuracy rules

- Each measurement is stored exactly as its source states it (value or min/max, in the source's own unit) with a `source` id pointing at the object's `sources` list, including the date it was checked.
- Ranges stay ranges. The drawing shows the low end solid and the high end as a faded outline; comparisons are given as ranges when sizes overlap.
- Conversions use exact definitions (1 ft = 0.3048 m, 1 mi = 1,609.344 m) and are rounded to the source's precision.
- Silhouettes are simplified. The measured dimension is exactly to scale; the rest of the outline is illustrative, and each object page notes where that matters.
- The build validates the data and refuses to run if a measurement has no source, a unit is unknown, a range is inverted, and so on.

## Updating the data

Edit one file in `data/objects/`, then build and test:

```bash
npm run build
npm test
```

To add an object, add `data/objects/<slug>.json` (copy an existing one), add or reuse a silhouette in `src/lib/silhouettes-*.js`, and run `node tools/shapes-sheet.mjs <shape>` to check it. The `profile` says which measurement scales the drawing (`x` for horizontal, `y` for vertical, or both). To add a category, add it to `data/categories.json`.

After changing data or silhouettes, regenerate the share images with `node tools/og-images.mjs`.

## Testing

```bash
npm test          # unit, data and build tests (node:test)
npm run e2e       # browser tests in headless Chrome against a local server
BASE_URL=https://scale-explorer.freewebtoolss.workers.dev node tools/e2e.mjs   # same tests against the live site
```

## Deploying

The site is a Cloudflare Workers static-assets deployment (no Worker script). `wrangler.jsonc` points at `./public` and runs the build first:

```bash
npx wrangler deploy
```

`public/_headers` sets a strict Content-Security-Policy (`script-src 'self'`, no inline scripts or style attributes) and long-lived caching for the fingerprinted `/assets/<hash>/` folder.

## Future ad placements

There are no ads. Pages contain empty, hidden placeholders where ads could go later without a redesign: `data-ad-slot="below-visualization"`, `data-ad-slot="between-sections"`, `data-ad-slot="below-form"` and a desktop sidebar (`<aside class="rail" data-ad-slot="sidebar">`). The object-page layout switches to two columns only when the sidebar is not hidden. Any ad script will need the CSP in `build/build.mjs` widened.

## License

Code: MIT. Measurements are facts from the cited sources; descriptions are original.
