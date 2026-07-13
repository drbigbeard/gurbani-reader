# Gurbani Platform

Local-first Android and iOS Gurbani reader, corpus pipeline and scholarly enrichment model.

## Repository layout

- `gurbani-reader-app/` — React, Capacitor, Android/iOS projects and SQLite gateway.
- `gurbani-corpus-poc/` — BaniDB ingestion, canonical model, tokenisation, analysis and SikhRI/TGGSP crosswalk tooling.

## Data policy

Large corpus snapshots, generated analysis indexes and mobile SQLite databases are release artifacts and are intentionally excluded from Git. The versioned repository contains schemas, ingestion code, tests, fixtures, manifests documentation and native application source.

Canonical corpus data is powered by BaniDB, a Khalis Foundation initiative. SikhRI/TGGSP content is maintained as separately attributed provider layers and is used with permission.

## Current checkpoint

`v0.11.0-pass.1` combines the first two v0.11 implementation stages. It adds native Android Back handling, a separate personal-data database, a full in-app Gurmukhi keyboard, universal search with source/Raag/contributor/TGGSP filters, scope-preserving exact counts and concordance, exact-line opening, repaired SikhRI/TGGSP display and a permanent Android signing identity. Bhai Gurdas Ji and Bhai Gurdas Singh Ji are presented as one contributor while their upstream records remain intact.
