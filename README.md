# Gurbani Platform

Local-first Android and iOS Gurbani reader, corpus pipeline and scholarly enrichment model.

## Repository layout

- `gurbani-reader-app/` — React, Capacitor, Android/iOS projects and SQLite gateway.
- `gurbani-corpus-poc/` — BaniDB ingestion, canonical model, tokenisation, analysis and SikhRI/TGGSP crosswalk tooling.

## Data policy

Large corpus snapshots, generated analysis indexes and mobile SQLite databases are release artifacts and are intentionally excluded from Git. The versioned repository contains schemas, ingestion code, tests, fixtures, manifests documentation and native application source.

Canonical corpus data is powered by BaniDB, a Khalis Foundation initiative. SikhRI/TGGSP content is maintained as separately attributed provider layers and is used with permission.

## Current checkpoint

`v0.11.0-rc.1` combines all four planned alphas into two implementation passes. It includes native Android Back handling, separate personal data, a full in-app Gurmukhi keyboard, universal faceted search, scope-preserving counts and concordance, exact-line opening, repaired SikhRI/TGGSP display, complete paginated frequency browsing, structured Browse and Saved areas, notes, collections, history, saved searches, backup/import, direct references, adaptive accessibility work and a permanent Android signing identity.
