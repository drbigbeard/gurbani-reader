import { createHash } from 'node:crypto';

const SOURCE_TITLES = {
  G: 'Guru Granth Sahib', D: 'Dasam Granth', B: 'Bhai Gurdas Ji Vaaran',
  S: 'Bhai Gurdas Singh Ji Vaaran', N: 'Bhai Nand Lal', A: 'Amrit Keertan',
  R: 'Rehatnamas and Panthic Sources'
};

export function canonicalFromBaniDbPages({ sourceId, pages, fetchedAt, releaseId, manifestChecksum }) {
  if (!SOURCE_TITLES[sourceId]) throw new Error(`Unsupported BaniDB source: ${sourceId}`);
  const verses = pages.flatMap(({ response }) => response.page ?? []);
  if (!verses.length) throw new Error(`BaniDB snapshot for ${sourceId} contains no verses`);
  const contributors = new Map();
  const shabads = new Map();
  const attributions = new Map();
  const lines = [];
  const dataGaps = [];

  for (const row of verses) {
    const verseId = required(row.verseId, 'verseId');
    const shabadId = required(row.shabadId, `shabadId for verse ${verseId}`);
    const gurmukhi = row.verse?.unicode;
    if (gurmukhi == null || gurmukhi === '') {
      dataGaps.push({ sourceId, upstreamVerseId: String(verseId), upstreamShabadId: String(shabadId),
        pageNo: numeric(row.pageNo, null), field: 'verse.unicode', reason: 'empty_upstream_canonical_text',
        disposition: 'excluded_from_unicode_analysis' });
      continue;
    }
    const writerId = row.writer?.writerId;
    const contributorId = writerId == null ? null : `contributor:banidb:${writerId}`;
    if (writerId != null && !contributors.has(contributorId)) {
      contributors.set(contributorId, {
        id: contributorId, upstreamId: String(writerId),
        name: row.writer?.english || row.writer?.unicode || `BaniDB writer ${writerId}`,
        gurmukhiName: row.writer?.unicode ?? null, type: classifyContributor(row.writer?.english)
      });
    }

    const textUnitId = `unit:banidb:${sourceId}:shabad:${shabadId}`;
    if (!shabads.has(textUnitId)) {
      shabads.set(textUnitId, {
        id: textUnitId, upstreamId: String(shabadId), sourceWorkId: `source:${sourceId}`,
        parentId: null, unitType: 'shabad', order: numeric(shabadId, numeric(verseId, shabads.size + 1)),
        title: `Shabad ${shabadId}`, reviewStatus: 'upstream_identifier_unclassified'
      });
    }

    if (contributorId) {
      const attributionId = `attribution:banidb:${sourceId}:${shabadId}:${writerId}`;
      if (!attributions.has(attributionId)) {
        attributions.set(attributionId, {
          id: attributionId, contributorId, targetType: 'textUnit', targetId: textUnitId,
          role: 'writer_attribution', status: 'imported_from_banidb'
        });
      }
    }

    lines.push({
      id: `line:banidb:${verseId}`, upstreamId: String(verseId), sourceWorkId: `source:${sourceId}`,
      textUnitId, contributorId, order: numeric(row.lineNo, lines.length + 1),
      ang: numeric(row.pageNo, null), lineClass: 'canonical_verse', gurmukhi,
      transliteration: row.transliteration?.english ?? row.transliteration?.en ?? null,
      upstreamShabadId: String(shabadId), raagId: row.raag?.raagId == null ? null : String(row.raag.raagId),
      raag: row.raag?.english ?? row.raag?.unicode ?? null, upstreamUpdatedAt: row.updated ?? null
    });
  }

  lines.sort((a, b) => (a.ang ?? 0) - (b.ang ?? 0) || a.order - b.order || a.id.localeCompare(b.id));
  return {
    corpusRelease: {
      id: releaseId, upstream: 'BaniDB API v2', generatedAt: fetchedAt,
      sourceUrl: 'https://api.banidb.com/v2/', manifestChecksum
    },
    sourceWorks: [{ id: `source:${sourceId}`, upstreamId: sourceId,
      title: SOURCE_TITLES[sourceId], profile: 'verse_corpus' }],
    contributors: [...contributors.values()],
    textUnits: [...shabads.values()].sort((a, b) => a.order - b.order),
    attributions: [...attributions.values()], lines, dataGaps
  };
}

export function snapshotManifest({ sourceId, pages, fetchedAt }) {
  const pageChecksums = pages.map(({ pageNo, response }) => ({
    pageNo, checksum: sha256(JSON.stringify(response)), verseCount: response.page?.length ?? 0
  }));
  const checksum = sha256(JSON.stringify({ sourceId, pageChecksums }));
  return {
    format: 'banidb-api-v2-ang-snapshot', sourceId, fetchedAt, pageCount: pages.length,
    verseCount: pageChecksums.reduce((sum, row) => sum + row.verseCount, 0), pageChecksums, checksum
  };
}

function classifyContributor(name = '') {
  if (/guru/i.test(name)) return 'guru';
  if (/bhagat|sheikh|sant/i.test(name)) return 'bhagat';
  if (/bhatt/i.test(name)) return 'bhatt';
  return 'contributor';
}

function required(value, label) {
  if (value == null || value === '') throw new Error(`BaniDB response is missing ${label}`);
  return value;
}

function numeric(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
