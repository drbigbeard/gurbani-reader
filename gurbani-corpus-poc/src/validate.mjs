const UNIT_TYPES = new Set([
  'bani', 'composition', 'shabad', 'vaar', 'pauri', 'salok', 'ashtpadi', 'pada',
  'chhant', 'swayya', 'kabitt', 'heading', 'chapter', 'section', 'article',
  'anthology_entry', 'unclassified'
]);

function unique(records, field, label, errors) {
  const seen = new Set();
  for (const record of records) {
    const value = record[field];
    if (!value) errors.push(`${label} has no ${field}`);
    else if (seen.has(value)) errors.push(`Duplicate ${label} ${field}: ${value}`);
    seen.add(value);
  }
}

export function validateCanonical(corpus) {
  const errors = [];
  const sourceWorks = corpus.sourceWorks ?? [];
  const units = corpus.textUnits ?? [];
  const lines = corpus.lines ?? [];
  const contributors = corpus.contributors ?? [];
  const attributions = corpus.attributions ?? [];

  if (!corpus.corpusRelease?.id) errors.push('Missing corpusRelease.id');
  unique(sourceWorks, 'id', 'source work', errors);
  unique(units, 'id', 'text unit', errors);
  unique(lines, 'id', 'line', errors);
  unique(contributors, 'id', 'contributor', errors);
  unique(attributions, 'id', 'attribution', errors);

  const sourceIds = new Set(sourceWorks.map(row => row.id));
  const unitIds = new Set(units.map(row => row.id));
  const contributorIds = new Set(contributors.map(row => row.id));

  for (const unit of units) {
    if (!sourceIds.has(unit.sourceWorkId)) errors.push(`Text unit ${unit.id} has unknown sourceWorkId`);
    if (unit.parentId && !unitIds.has(unit.parentId)) errors.push(`Text unit ${unit.id} has unknown parentId`);
    if (!UNIT_TYPES.has(unit.unitType)) errors.push(`Text unit ${unit.id} has unsupported unitType ${unit.unitType}`);
  }

  for (const line of lines) {
    if (!sourceIds.has(line.sourceWorkId)) errors.push(`Line ${line.id} has unknown sourceWorkId`);
    if (!unitIds.has(line.textUnitId)) errors.push(`Line ${line.id} has unknown textUnitId`);
    if (typeof line.gurmukhi !== 'string' || line.gurmukhi.length === 0) errors.push(`Line ${line.id} has empty canonical text`);
  }

  for (const attribution of attributions) {
    if (!contributorIds.has(attribution.contributorId)) errors.push(`Attribution ${attribution.id} has unknown contributor`);
    if (attribution.targetType === 'textUnit' && !unitIds.has(attribution.targetId)) errors.push(`Attribution ${attribution.id} has unknown text unit target`);
  }

  const parentById = new Map(units.map(unit => [unit.id, unit.parentId]));
  for (const unit of units) {
    const visited = new Set([unit.id]);
    let current = unit.parentId;
    while (current) {
      if (visited.has(current)) {
        errors.push(`Cycle detected from text unit ${unit.id}`);
        break;
      }
      visited.add(current);
      current = parentById.get(current);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function assertValidCanonical(corpus) {
  const result = validateCanonical(corpus);
  if (!result.valid) throw new Error(`Canonical validation failed:\n- ${result.errors.join('\n- ')}`);
}
