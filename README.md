# Gurbani Platform

Local-first Android and iOS Gurbani reader, reading-data pipeline and scholarly enrichment model.

## Repository layout

- `gurbani-reader-app/` — React, Capacitor, Android/iOS projects and SQLite gateway.
- `gurbani-corpus-poc/` — BaniDB ingestion, canonical model, tokenisation, analysis and SikhRI/TGGSP crosswalk tooling.

## Data policy

The checksummed v5 mobile reading database is the versioned base for reproducible builds. The v0.13 build fetches its source-scoped BaniDB delta, requires the audited snapshot checksum, and upgrades the base to v6 before running the release audit. The repository contains the machine-readable scope and checksums alongside schemas, ingestion code and audits.

Canonical Gurbani data is powered by BaniDB, a Khalis Foundation initiative. SikhRI/TGGSP content is maintained as separately attributed provider material and is used with permission.

## Current checkpoint

`v0.13.0-rc.1` adds optional BaniDB line translations, selected SGPC Dasam readings, Rehras and Ardas, three-state translation selection, ordered TGGSP life-event navigation, bold Gurmukhi, dismissible reader panels and clearer Home/Ang navigation. TGGSP whole-passage translations remain passage-level until a separately supplied review workbook is approved for v0.14.
