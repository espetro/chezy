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

## Enriched tables (2026-09-19 snapshot)

`enriched/` holds derived tables computed once over the 300 listings above. They are a one-off
snapshot: the pipeline that produced them is not in this repository, so treat them as fixtures,
not as reproducible output. Join key is `(platform, platform_id)`; `media_features` also carries
`position` and `path` to join `media.parquet`. Checksums: `enriched/SHA256SUMS`.

| path | rows | what |
|---|---|---|
| `enriched/listing_geo.parquet` | 300 | `lat`, `lon`, `location_accuracy`, `geo_source`, `matched_place` (Nominatim) |
| `enriched/listing_poi.parquet` | 300 | OSM POI counts at 400 m and 800 m plus nearest distance for gym, bus stop, station, school, supermarket |
| `enriched/listing_dedup.parquet` | 300 | `cluster_id`, `cluster_size`: cross-portal duplicate clusters |
| `enriched/listing_text.parquet` | 300 | `text_flags`, `inconsistency_flags`, `mentioned_places` from title and description |
| `enriched/media_features.parquet` | 6530 | per photo VLM output (`room_type_pred`, `brightness`, `condition`, `kitchen_modern`, `bath_modern`, `outdoor_space`, `view`, ...) plus `luminance`, `sharpness`, `phash`, `model`, `ok` |
| `enriched/listing_enrichment.parquet` | 300 | the join of all of the above plus `price_per_m2`, `area_median_ppm2`, `deal_percentile`, `days_on_market`, `has_price_drop`, `photo_quality`, `has_balcony_photo`, `has_terrace_photo` |
| `enriched/poi_bcn.parquet` | 6965 | the OSM POIs used for `listing_poi` (`category`, `osm_type`, `osm_id`, `name`, `lat`, `lon`) |

Nothing in `apps/web` reads these yet. The VLM columns are model output, not ground truth; the
`ok` flag in `media_features` marks rows where the model call succeeded.

Scraped from public listing pages for internal development. Respect each portal's terms.
