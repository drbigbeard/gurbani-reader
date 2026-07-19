# Gurbani Platform

Local-first Android and iOS Gurbani reader, reading-data pipeline and scholarly enrichment model.

## Repository layout

- `gurbani-reader-app/` — React, Capacitor, Android/iOS projects and SQLite gateway.
- `gurbani-corpus-poc/` — BaniDB ingestion, canonical model, tokenisation, analysis and SikhRI/TGGSP crosswalk tooling.

## Data policy

The checksummed v5 mobile reading database is the versioned base for reproducible builds. The v0.13 build fetches its source-scoped BaniDB delta, requires the audited snapshot checksum, and upgrades the base to v6 before running the release audit. The repository contains the machine-readable scope and checksums alongside schemas, ingestion code and audits.

Canonical Gurbani data is powered by BaniDB, a Khalis Foundation initiative. SikhRI/TGGSP content is maintained as separately attributed provider material and is used with permission.

## Current checkpoint

`v0.15.0-rc.1` rebuilds practical discovery around tolerant Roman, Gurmukhi, voice-alternative and first-letter search. The Read and Library structures are simplified, translation provenance uses compact rails, and an isolated Identify Keertan beta records only local transcripts, result references and tester verdicts. The installed reading profile remains SGPC-only.
