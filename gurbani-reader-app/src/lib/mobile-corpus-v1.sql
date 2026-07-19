PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_work (
  id TEXT PRIMARY KEY NOT NULL,
  upstream_id TEXT,
  title TEXT NOT NULL,
  profile TEXT NOT NULL,
  corpus_release_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS text_unit (
  id TEXT PRIMARY KEY NOT NULL,
  upstream_id TEXT,
  source_work_id TEXT NOT NULL,
  parent_id TEXT,
  unit_type TEXT NOT NULL,
  unit_order INTEGER NOT NULL,
  title TEXT,
  review_status TEXT NOT NULL DEFAULT 'unclassified',
  FOREIGN KEY (source_work_id) REFERENCES source_work(id),
  FOREIGN KEY (parent_id) REFERENCES text_unit(id)
);

CREATE TABLE IF NOT EXISTS contributor (
  id TEXT PRIMARY KEY NOT NULL,
  preferred_name TEXT NOT NULL,
  contributor_type TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attribution (
  id TEXT PRIMARY KEY NOT NULL,
  contributor_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  role TEXT NOT NULL,
  review_status TEXT NOT NULL,
  FOREIGN KEY (contributor_id) REFERENCES contributor(id)
);

CREATE TABLE IF NOT EXISTS canonical_line (
  id TEXT PRIMARY KEY NOT NULL,
  upstream_id TEXT,
  source_work_id TEXT NOT NULL,
  text_unit_id TEXT NOT NULL,
  contributor_id TEXT,
  line_order INTEGER NOT NULL,
  ang INTEGER,
  line_class TEXT NOT NULL,
  gurmukhi TEXT NOT NULL,
  transliteration TEXT,
  raag_id TEXT,
  raag TEXT,
  FOREIGN KEY (source_work_id) REFERENCES source_work(id),
  FOREIGN KEY (text_unit_id) REFERENCES text_unit(id),
  FOREIGN KEY (contributor_id) REFERENCES contributor(id)
);

CREATE TABLE IF NOT EXISTS token_occurrence (
  id TEXT PRIMARY KEY NOT NULL,
  line_id TEXT NOT NULL,
  text_unit_id TEXT NOT NULL,
  source_work_id TEXT NOT NULL,
  token_position INTEGER NOT NULL,
  exact_form TEXT NOT NULL,
  comparison_form TEXT NOT NULL,
  token_class TEXT NOT NULL,
  start_utf16 INTEGER NOT NULL,
  end_utf16 INTEGER NOT NULL,
  analysis_release_id TEXT NOT NULL,
  FOREIGN KEY (line_id) REFERENCES canonical_line(id),
  FOREIGN KEY (text_unit_id) REFERENCES text_unit(id),
  FOREIGN KEY (source_work_id) REFERENCES source_work(id)
);

CREATE INDEX IF NOT EXISTS idx_token_comparison ON token_occurrence(comparison_form, token_class);
CREATE INDEX IF NOT EXISTS idx_token_line ON token_occurrence(line_id);
CREATE INDEX IF NOT EXISTS idx_line_unit ON canonical_line(text_unit_id, line_order);
CREATE INDEX IF NOT EXISTS idx_line_source_ang ON canonical_line(source_work_id, ang);
CREATE INDEX IF NOT EXISTS idx_line_source_raag ON canonical_line(source_work_id, raag);

CREATE TABLE IF NOT EXISTS bani_collection (
  id TEXT PRIMARY KEY NOT NULL,
  upstream_id INTEGER NOT NULL,
  token TEXT NOT NULL,
  source_work_id TEXT NOT NULL,
  gurmukhi TEXT NOT NULL,
  transliteration TEXT,
  verse_count INTEGER NOT NULL,
  attribution_label TEXT NOT NULL,
  snapshot_sha256 TEXT NOT NULL,
  FOREIGN KEY (source_work_id) REFERENCES source_work(id)
);

CREATE TABLE IF NOT EXISTS bani_collection_line (
  bani_id TEXT NOT NULL,
  line_order INTEGER NOT NULL,
  upstream_verse_id INTEGER,
  header_level INTEGER NOT NULL DEFAULT 0,
  paragraph_number INTEGER,
  gurmukhi TEXT NOT NULL,
  transliteration TEXT,
  PRIMARY KEY (bani_id, line_order),
  FOREIGN KEY (bani_id) REFERENCES bani_collection(id)
);

CREATE INDEX IF NOT EXISTS idx_bani_source ON bani_collection(source_work_id, upstream_id);
CREATE INDEX IF NOT EXISTS idx_bani_line_order ON bani_collection_line(bani_id, line_order);

CREATE TABLE IF NOT EXISTS line_search_index (
  line_id TEXT PRIMARY KEY NOT NULL,
  source_work_id TEXT NOT NULL,
  initials_gurmukhi TEXT NOT NULL,
  initials_latin TEXT NOT NULL,
  FOREIGN KEY (line_id) REFERENCES canonical_line(id),
  FOREIGN KEY (source_work_id) REFERENCES source_work(id)
);

CREATE INDEX IF NOT EXISTS idx_line_search_gurmukhi ON line_search_index(source_work_id, initials_gurmukhi);
CREATE INDEX IF NOT EXISTS idx_line_search_latin ON line_search_index(source_work_id, initials_latin);

CREATE TABLE IF NOT EXISTS search_alias (
  id TEXT PRIMARY KEY NOT NULL,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  display_title TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_search_alias_normalized ON search_alias(normalized_alias);

CREATE TABLE IF NOT EXISTS provider_content (
  id TEXT PRIMARY KEY NOT NULL,
  provider TEXT NOT NULL,
  provider_release_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  canonical_line_id TEXT,
  text_unit_id TEXT,
  content TEXT NOT NULL,
  attribution_label TEXT NOT NULL,
  mapping_status TEXT NOT NULL,
  FOREIGN KEY (canonical_line_id) REFERENCES canonical_line(id),
  FOREIGN KEY (text_unit_id) REFERENCES text_unit(id)
);

CREATE INDEX IF NOT EXISTS idx_provider_unit_type ON provider_content(text_unit_id, content_type);
CREATE INDEX IF NOT EXISTS idx_provider_line_type ON provider_content(canonical_line_id, content_type);
CREATE INDEX IF NOT EXISTS idx_line_facets ON canonical_line(source_work_id, raag, contributor_id, text_unit_id);

CREATE TABLE IF NOT EXISTS tggsp_collection (
  code TEXT PRIMARY KEY NOT NULL,
  title_en TEXT NOT NULL,
  title_pa TEXT NOT NULL,
  navigation_title TEXT NOT NULL,
  collection_type TEXT NOT NULL,
  collection_order INTEGER NOT NULL,
  introduction_en TEXT NOT NULL,
  introduction_pa TEXT NOT NULL,
  provider_release_id TEXT NOT NULL,
  attribution_label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tggsp_collection_section (
  collection_code TEXT NOT NULL,
  section_id INTEGER NOT NULL,
  section_order INTEGER NOT NULL,
  title_en TEXT NOT NULL,
  title_pa TEXT NOT NULL,
  author_en TEXT NOT NULL,
  author_pa TEXT NOT NULL,
  first_ang INTEGER,
  last_ang INTEGER,
  mapped_unit_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_code, section_id),
  FOREIGN KEY (collection_code) REFERENCES tggsp_collection(code)
);

CREATE TABLE IF NOT EXISTS tggsp_line_alignment (
  id TEXT PRIMARY KEY NOT NULL,
  collection_code TEXT NOT NULL,
  section_id INTEGER NOT NULL,
  subsection_id INTEGER NOT NULL,
  section_order INTEGER NOT NULL,
  subsection_order INTEGER NOT NULL,
  provider_line_order INTEGER NOT NULL,
  text_unit_id TEXT NOT NULL,
  anchor_line_id TEXT NOT NULL,
  reference_gurmukhi TEXT NOT NULL,
  tggsp_transliteration TEXT NOT NULL,
  literal_translation_en TEXT NOT NULL,
  literal_translation_pa TEXT NOT NULL,
  translation_scope TEXT NOT NULL,
  mapping_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tggsp_line_member (
  alignment_id TEXT NOT NULL,
  canonical_line_id TEXT NOT NULL,
  member_order INTEGER NOT NULL,
  is_anchor INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (alignment_id, canonical_line_id)
);

CREATE TABLE IF NOT EXISTS tggsp_line_term (
  id TEXT PRIMARY KEY NOT NULL,
  collection_code TEXT NOT NULL,
  canonical_line_id TEXT NOT NULL,
  word_id INTEGER NOT NULL,
  headword TEXT NOT NULL,
  transliteration TEXT NOT NULL,
  meaning_en TEXT NOT NULL,
  grammar_en TEXT NOT NULL,
  etymology_en TEXT NOT NULL,
  meaning_pa TEXT NOT NULL,
  grammar_pa TEXT NOT NULL,
  etymology_pa TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bani_line_crosswalk (
  bani_id TEXT NOT NULL,
  line_order INTEGER NOT NULL,
  canonical_line_id TEXT,
  text_unit_id TEXT,
  mapping_status TEXT NOT NULL,
  PRIMARY KEY (bani_id, line_order)
);

CREATE INDEX IF NOT EXISTS idx_tggsp_alignment_anchor ON tggsp_line_alignment(anchor_line_id, collection_code);
CREATE INDEX IF NOT EXISTS idx_tggsp_alignment_collection ON tggsp_line_alignment(collection_code, section_order, subsection_order, provider_line_order);
CREATE INDEX IF NOT EXISTS idx_tggsp_member_line ON tggsp_line_member(canonical_line_id, alignment_id);
CREATE INDEX IF NOT EXISTS idx_tggsp_term_line ON tggsp_line_term(canonical_line_id, collection_code);
CREATE INDEX IF NOT EXISTS idx_bani_crosswalk_line ON bani_line_crosswalk(canonical_line_id, bani_id);

CREATE TABLE IF NOT EXISTS glossary_entry (
  id TEXT PRIMARY KEY NOT NULL,
  headword TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_release_id TEXT NOT NULL,
  content TEXT NOT NULL,
  review_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS term_form (
  id TEXT PRIMARY KEY NOT NULL,
  glossary_entry_id TEXT,
  written_form TEXT NOT NULL,
  comparison_form TEXT NOT NULL,
  transliteration TEXT,
  relation_type TEXT NOT NULL,
  FOREIGN KEY (glossary_entry_id) REFERENCES glossary_entry(id)
);

CREATE INDEX IF NOT EXISTS idx_term_form_comparison ON term_form(comparison_form);
CREATE INDEX IF NOT EXISTS idx_term_form_glossary ON term_form(glossary_entry_id);

CREATE TABLE IF NOT EXISTS token_mapping (
  id TEXT PRIMARY KEY NOT NULL,
  term_form_id TEXT NOT NULL,
  occurrence_id TEXT,
  canonical_line_id TEXT,
  mapping_type TEXT NOT NULL,
  review_status TEXT NOT NULL,
  FOREIGN KEY (term_form_id) REFERENCES term_form(id),
  FOREIGN KEY (occurrence_id) REFERENCES token_occurrence(id),
  FOREIGN KEY (canonical_line_id) REFERENCES canonical_line(id)
);
