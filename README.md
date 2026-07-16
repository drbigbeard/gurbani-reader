# Gurbani Platform

Local-first Android and iOS Gurbani reader, corpus pipeline and scholarly enrichment model.

## Repository layout

- `gurbani-reader-app/` — React, Capacitor, Android/iOS projects and SQLite gateway.
- `gurbani-corpus-poc/` — BaniDB ingestion, canonical model, tokenisation, analysis and SikhRI/TGGSP crosswalk tooling.

## Data policy

Large corpus snapshots, generated analysis indexes and mobile SQLite databases are release artifacts and are intentionally excluded from Git. The versioned repository contains schemas, ingestion code, tests, fixtures, manifests documentation and native application source.

Canonical Gurbani data is powered by BaniDB, a Khalis Foundation initiative. SikhRI/TGGSP content is maintained as separately attributed provider material and is used with permission.

## Current checkpoint

`v0.12.0-rc.1` adds a customisable Home screen, live universal search, Gurmukhi keyboard access, Roman and experimental English-concept dictionary lookup, explicit All-text search scope, richer TGGSP availability filters, compact reader controls, last-Ang resume, independent TGGSP layers and languages, and correctly labelled line-versus-passage translations. The Android workflow now produces a signed, installable, 16 KB-alignment-verified local APK.
