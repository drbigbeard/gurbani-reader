# Gurbani corpus pipeline — proof of concept

This project tests the proposed ingestion, crosswalk, tokenisation, and counting rules before production BaniDB and SikhRI/TGGSP data is available.

## Important status

- The included JSON files are **technical fixtures**, not asserted BaniDB or SikhRI API responses.
- Interpretive content is intentionally omitted.
- No result produced from the fixtures is a real corpus statistic.
- Canonical source text is never overwritten by normalisation or tokenisation.

## What it proves

- immutable canonical-text ingestion;
- stable internal line and text-unit records;
- recursive text-unit validation;
- Unicode NFC comparison stored separately from display text;
- Gurmukhi-aware lexical tokenisation with reconstructable offsets;
- exact token, distinct-line, and distinct-unit counts;
- strict separation of exact forms and curated related forms;
- provider crosswalk states: exact, review required, and unmatched;
- reproducible analysis-release metadata;
- machine-readable audit output.

## Run

Requires Node.js 20 or later and no third-party packages.

```bash
npm test
npm run build:index
npm run query -- ਸੁਣਿਐ
```

Generated files are written to `build/`:

- `analysis-index.json`
- `crosswalk-report.json`
- `build-report.json`

## BaniDB API snapshot

The importer follows BaniDB API v2's published Ang response rather than scraping SikhiToTheMax. It preserves every raw response for audit/resume, generates per-Ang and whole-release checksums, and emits the canonical corpus input without changing `verse.unicode`.

```bash
npm run fetch:banidb -- \
  --source G --from 1 --to 1430 \
  --raw-dir imports/banidb-raw \
  --output imports/banidb-G-canonical.json \
  --manifest imports/banidb-G-manifest.json

npm run build:index -- \
  --canonical imports/banidb-G-canonical.json \
  --provider none \
  --output build-production
```

The default 300 ms delay and retry/checkpoint behaviour are deliberately conservative. A Guru Granth Sahib-only fetch is not a full wider-BaniDB delivery. It must not be presented as satisfying BaniDB's whole-dataset terms; the production corpus needs the authorised complete BaniDB export/delivery.

## Replace fixtures with partner data

Production work should add source-specific adapters rather than changing the internal model:

1. retain the raw authorised delivery unchanged;
2. validate its checksum and version;
3. map it into the internal canonical contract;
4. reject or quarantine malformed records;
5. build the analytical layer from the internal contract;
6. map SikhRI/TGGSP records through reviewed crosswalks;
7. publish only release-tagged counts.

The expected partner handoff requirements are described in `PARTNER_DATA_CONTRACT.md`.
