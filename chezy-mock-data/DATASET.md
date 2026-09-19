# Chezy listings dataset: small (2026-09-19)

Barcelona rent and sale listings scraped from Spanish property portals, with text, structured
attributes, coordinates and photos, meant for developing and testing agentic workflows.

## What is inside

| platform and operation | listings |
|---|---|
| fotocasa rent | 50 |
| fotocasa sale | 50 |
| habitaclia rent | 50 |
| habitaclia sale | 50 |
| milanuncios rent | 50 |
| milanuncios sale | 50 |

Images: 6530 WebP files. Per listing, the first 25 photos and all floor plans are
included (19 of those failed to download). Further photos, videos and 3D tours are listed
in `media.parquet` with a null `path` and only their source url.
Each platform and operation slice is the first N listings of the portal's default ranking, so
this is a convenient sample, not a random sample of the market.

## Files

| path | what |
|---|---|
| `data/listings.parquet` | one row per listing, typed columns; load with polars or pandas |
| `data/listings.jsonl` | same listings as nested JSON, including a `media` array |
| `data/media.parquet` | one row per image: keys, position, kind, room_type, url, path |
| `schema/listing.schema.json` | JSON Schema of one JSONL line |
| `media/<platform>/<platform_id>/<nn>-<room>.webp` | photos, at most 1280 px, quality 80 |
| `SHA256SUMS` | checksums of every file; check with `shasum -a 256 -c SHA256SUMS` |

Join key everywhere: `(platform, platform_id)`. Images are plain files, never embedded in the
tables. `media.path` and `Media.local_path` are object keys relative to the archive root, so the
`media/` tree can stay on disk or be uploaded to S3 or R2 unchanged (key = path).

## Loading

```python
import polars as pl

listings = pl.read_parquet("data/listings.parquet")
media = pl.read_parquet("data/media.parquet")
photos = media.filter(pl.col("path").is_not_null())
```

`raw_features` and `source_raw` are JSON strings in Parquet (`json.loads` them) and objects in
the JSONL.

## Personal data

Publisher phone and email are removed, phone numbers and emails found in titles and descriptions are masked, and `source_raw` is empty.

## Known data quality caveats

Nothing here is deduplicated or validated yet. Expect:

- The same flat listed on several portals (fotocasa and habitaclia overlap heavily).
- Placeholder values: `built_m2 = 1` on some milanuncios ads, `bathrooms = 0` next to
  bedrooms, price 0 on "we buy your flat" ads.
- `is_temporary_rental` is reliable on fotocasa only; it is often null elsewhere.
- `location_accuracy` is a per portal heuristic. Fotocasa `zone` pins are usually within about
  20 m of the street pin.

Scraped from public listing pages for internal development. Respect each portal's terms.
