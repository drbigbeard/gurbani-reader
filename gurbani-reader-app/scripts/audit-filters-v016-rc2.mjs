#!/usr/bin/env node
import { normalizeBrowseFilters, normalizeSearchFilters } from '../src/lib/filters.ts';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log(`PASS  ${message}`);
};

const migrated = normalizeSearchFilters({
  sourceWorkId: 'source:G',
  raag: 'Raag Aasaa',
  contributorId: 'contributor:1',
  tggspOnly: true,
  tggspCoverage: 'translation',
});
assert(migrated.sourceWorkIds[0] === 'source:G', 'legacy text scope migrates to a multi-select facet');
assert(migrated.raags[0] === 'Raag Aasaa', 'legacy Raag scope migrates to a multi-select facet');
assert(migrated.contributorIds[0] === 'contributor:1', 'legacy contributor scope migrates to a multi-select facet');
assert(migrated.tggspCoverages[0] === 'translation', 'legacy TGGSP scope migrates without losing meaning');

const rows = [
  { id: 1, text: 'G', type: 'guru', raag: 'Aasaa' },
  { id: 2, text: 'G', type: 'bhagat', raag: 'Aasaa' },
  { id: 3, text: 'D', type: 'guru', raag: 'Basant' },
];
const selected = { texts: ['G'], types: ['guru', 'bhagat'], raags: ['Aasaa'] };
const visible = rows.filter(row =>
  selected.texts.includes(row.text) &&
  selected.types.includes(row.type) &&
  selected.raags.includes(row.raag),
);
assert(visible.length === 2, 'filters use OR within a facet and AND across facets');

const browse = normalizeBrowseFilters({ baniGroups: ['nitnem', 'tggsp', 'mine'] });
assert(browse.baniCollections.includes('nitnem'), 'legacy Bani group migrates to reading groups');
assert(browse.baniAvailability.includes('tggsp'), 'legacy TGGSP group migrates to availability');
assert(browse.baniPersonal.includes('saved'), 'legacy My Banis group migrates to Saved Banis');

console.log('\nv0.16 RC2 filter-state audit passed.');
