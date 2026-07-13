# Gurbani Platform

Local-first Android and iOS Gurbani reader, corpus pipeline and scholarly enrichment model.

## Repository layout

- `gurbani-reader-app/` — React, Capacitor, Android/iOS projects and SQLite gateway.
- `gurbani-corpus-poc/` — BaniDB ingestion, canonical model, tokenisation, analysis and SikhRI/TGGSP crosswalk tooling.

## Data policy

Large corpus snapshots, generated analysis indexes and mobile SQLite databases are release artifacts and are intentionally excluded from Git. The versioned repository contains schemas, ingestion code, tests, fixtures, manifests documentation and native application source.

Canonical corpus data is powered by BaniDB, a Khalis Foundation initiative. SikhRI/TGGSP content is maintained as separately attributed provider layers and is used with permission.

## Current checkpoint

`v0.10.0-alpha.1` is the navigation, source-scoping and reading-interface release. It includes Guru Granth Sahib and one combined Vaaran Bhai Gurdas collection, continuous Reading and action-enabled Study modes, full contributor/Bani/Raag/word browsing, multilingual and first-letter search, and independently selectable SikhRI/TGGSP layers.
