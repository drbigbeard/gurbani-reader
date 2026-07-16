import schemaSql from './mobile-corpus-v1.sql?raw';

// Version the asset name when corpus tables/data change so an APK upgrade copies
// the new read-only corpus instead of silently retaining an older installed DB.
export const MOBILE_DATABASE_NAME = 'gurbani_reader_v6';
export const MOBILE_SCHEMA_VERSION = 6;
export const MOBILE_SCHEMA_SQL = schemaSql;
