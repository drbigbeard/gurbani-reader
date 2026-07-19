const GURMUKHI_MARKS = /[\u0A01-\u0A03\u0A3C\u0A3E-\u0A4D\u0A51\u0A70-\u0A71\u0A75]/gu;
const GURMUKHI_PUNCTUATION = /[^\u0A00-\u0A7F\s]/gu;

export type SearchScore = {
  score: number;
  kind: 'text' | 'phonetic' | 'first-letters';
};

export function containsGurmukhi(value: string): boolean {
  return /[\u0A00-\u0A7F]/u.test(value);
}

export function normalizeRoman(value: string): string {
  return value.normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/\(([a-z])\)/gu, '$1')
    .replace(/[^a-z\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function phoneticWord(value: string): string {
  let word = normalizeRoman(value)
    .replace(/aa|aah/gu, 'a')
    .replace(/ee|ii/gu, 'i')
    .replace(/oo|uu/gu, 'u')
    .replace(/ai|ae/gu, 'e')
    .replace(/au/gu, 'o')
    .replace(/chh/gu, 'ch')
    .replace(/kh/gu, 'k')
    .replace(/gh/gu, 'g')
    .replace(/th/gu, 't')
    .replace(/dh/gu, 'd')
    .replace(/ph/gu, 'p')
    .replace(/bh/gu, 'b')
    .replace(/jh/gu, 'j')
    .replace(/sh/gu, 's')
    .replace(/ng/gu, 'g')
    .replace(/n(?=[mb])/gu, '')
    .replace(/w/gu, 'v')
    .replace(/y/gu, 'i')
    .replace(/q/gu, 'k')
    .replace(/x/gu, 'k')
    .replace(/([aeiou])\1+/gu, '$1');
  if (word.length > 3) word = word.replace(/(?:u|a|i|e|o|eh|ahi)$/u, '');
  return word;
}

export function phoneticRoman(value: string): string {
  const optionalNasals = value.replace(/\(n\)(?=h[aeiou])/giu, ' ').replace(/\(n\)/giu, '');
  return normalizeRoman(optionalNasals).split(' ').filter(Boolean).map(phoneticWord).join(' ');
}

export function consonantWord(value: string): string {
  return phoneticWord(value).replace(/[aeiou]/gu, '');
}

export function consonantRoman(value: string): string {
  return phoneticRoman(value).split(' ').filter(Boolean).map(word => word.replace(/[aeiou]/gu, '')).join(' ');
}

export function phoneticIndexText(value: string): string {
  const withoutOptionalNasals = phoneticRoman(value);
  const withOptionalNasals = phoneticRoman(value.replace(/\(n\)/giu, 'n'));
  return [...new Set(`${withoutOptionalNasals} ${withOptionalNasals}`.split(' ').filter(Boolean))].join(' ');
}

export function consonantIndexText(value: string): string {
  return [...new Set(phoneticIndexText(value).split(' ').map(word => word.replace(/[aeiou]/gu, '')).filter(Boolean))].join(' ');
}

export function normalizeGurmukhi(value: string): string {
  return value.normalize('NFC').replace(GURMUKHI_PUNCTUATION, ' ').replace(/\s+/gu, ' ').trim();
}

export function looseGurmukhi(value: string): string {
  return normalizeGurmukhi(value).replace(GURMUKHI_MARKS, '').replace(/\s+/gu, ' ').trim();
}

export function gurmukhiInitials(value: string): string {
  return normalizeGurmukhi(value).split(' ').filter(Boolean).map(word => looseGurmukhi(word)[0] ?? '').join('');
}

export function latinInitials(value: string): string {
  return normalizeRoman(value).split(' ').filter(Boolean).map(word => phoneticWord(word)[0] ?? '').join('');
}

export function buildRomanFtsQuery(value: string, allowOneOmission = false): string {
  const words = normalizeRoman(value).split(' ').filter(Boolean).slice(0, 12);
  const groups = words.map(word => {
    const exact = ftsToken(word);
    const phonetic = ftsToken(phoneticWord(word));
    const consonants = ftsToken(consonantWord(word));
    const options = [`roman:${exact}*`, `roman_phonetic:${phonetic}*`];
    if (consonants.length >= 3) options.push(`roman_consonants:${consonants}*`);
    return `(${[...new Set(options)].join(' OR ')})`;
  });
  return faultTolerantFts(groups, allowOneOmission);
}

export function buildGurmukhiFtsQuery(value: string, allowOneOmission = false): string {
  const words = normalizeGurmukhi(value).split(' ').filter(Boolean).slice(0, 12);
  const groups = words.map(word => {
    const exact = ftsToken(word);
    const loose = ftsToken(looseGurmukhi(word));
    return `(gurmukhi:${exact}* OR gurmukhi_loose:${loose}*)`;
  });
  return faultTolerantFts(groups, allowOneOmission);
}

export function scoreSearchCandidate(query: string, candidateGurmukhi: string, candidateRoman: string): SearchScore {
  if (containsGurmukhi(query)) return scoreGurmukhi(query, candidateGurmukhi);
  return scoreRoman(query, candidateRoman);
}

function scoreRoman(query: string, candidate: string): SearchScore {
  const wanted = normalizeRoman(query);
  const text = normalizeRoman(candidate);
  if (!wanted || !text) return { score: 0, kind: 'phonetic' };
  if (text === wanted) return { score: 1000, kind: 'text' };
  if (text.startsWith(`${wanted} `) || text.startsWith(wanted)) return { score: 960, kind: 'text' };
  if (text.includes(` ${wanted} `) || text.endsWith(` ${wanted}`)) return { score: 930, kind: 'text' };

  const wantedWords = wanted.split(' ');
  const textWords = text.split(' ');
  const phoneticWanted = phoneticRoman(query).split(' ').filter(Boolean);
  const phoneticText = phoneticRoman(candidate).split(' ').filter(Boolean);
  let ordered = orderedWordScore(phoneticWanted, phoneticText);
  let omittedRecognitionWord = false;
  if (ordered === 0 && phoneticWanted.length >= 4) {
    ordered = bestScoreWithOneOmission(phoneticWanted, phoneticText);
    omittedRecognitionWord = ordered > 0;
  }
  if (ordered > 0) {
    const atStart = orderedWordStart(phoneticWanted, phoneticText) === 0;
    return { score: (omittedRecognitionWord ? 590 : 700) + ordered * (omittedRecognitionWord ? 190 : 220) + (atStart ? 28 : 0), kind: 'phonetic' };
  }

  const initials = latinInitials(candidate);
  const compact = wanted.replaceAll(' ', '');
  if (compact.length >= 2 && compact.length <= 14 && /^[a-z]+$/u.test(compact)) {
    if (initials.startsWith(compact)) return { score: 740, kind: 'first-letters' };
    if (initials.includes(compact)) return { score: 650, kind: 'first-letters' };
  }
  return { score: 0, kind: 'phonetic' };
}

function scoreGurmukhi(query: string, candidate: string): SearchScore {
  const wanted = normalizeGurmukhi(query);
  const text = normalizeGurmukhi(candidate);
  if (!wanted || !text) return { score: 0, kind: 'text' };
  if (text === wanted) return { score: 1000, kind: 'text' };
  if (text.startsWith(wanted)) return { score: 970, kind: 'text' };
  if (text.includes(wanted)) return { score: 940, kind: 'text' };
  const looseWanted = looseGurmukhi(wanted);
  const looseText = looseGurmukhi(text);
  if (looseText.startsWith(looseWanted)) return { score: 900, kind: 'phonetic' };
  if (looseText.includes(looseWanted)) return { score: 860, kind: 'phonetic' };
  const wantedWords = looseWanted.split(' ').filter(Boolean);
  const textWords = looseText.split(' ').filter(Boolean);
  let ordered = orderedWordScore(wantedWords, textWords, 0.74);
  let omittedRecognitionWord = false;
  if (ordered === 0 && wantedWords.length >= 4) {
    ordered = bestScoreWithOneOmission(wantedWords, textWords, 0.74);
    omittedRecognitionWord = ordered > 0;
  }
  if (ordered > 0) return { score: (omittedRecognitionWord ? 560 : 610) + ordered * (omittedRecognitionWord ? 190 : 230), kind: 'phonetic' };
  const compact = wanted.replaceAll(' ', '');
  const initials = gurmukhiInitials(text);
  if (compact.length >= 2 && compact.length <= 14 && !/[\u0A01-\u0A03\u0A3C\u0A3E-\u0A4D\u0A51\u0A70-\u0A71\u0A75]/u.test(compact)) {
    if (initials.startsWith(compact)) return { score: 750, kind: 'first-letters' };
    if (initials.includes(compact)) return { score: 660, kind: 'first-letters' };
  }
  return { score: 0, kind: 'phonetic' };
}

function orderedWordScore(wanted: string[], available: string[], minimum = 0.68): number {
  if (!wanted.length || !available.length) return 0;
  const memo = new Map<string, number>();
  const visit = (wantedIndex: number, cursor: number): number => {
    if (wantedIndex === wanted.length) return 0;
    const key = `${wantedIndex}:${cursor}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let best = Number.NEGATIVE_INFINITY;
    const maximum = Math.min(available.length, cursor + 7);
    for (let index = cursor; index < maximum; index += 1) {
      const similarity = wordSimilarity(wanted[wantedIndex], available[index]);
      if (similarity < minimum) continue;
      const rest = visit(wantedIndex + 1, index + 1);
      if (Number.isFinite(rest)) best = Math.max(best, similarity - Math.min(0.12, Math.max(0, index - cursor) * 0.025) + rest);
    }
    memo.set(key, best);
    return best;
  };
  const total = visit(0, 0);
  return Number.isFinite(total) ? total / wanted.length : 0;
}

function orderedWordStart(wanted: string[], available: string[]): number {
  if (!wanted.length) return -1;
  for (let index = 0; index < available.length; index += 1) {
    if (wordSimilarity(wanted[0], available[index]) >= 0.68) return index;
  }
  return -1;
}

function bestScoreWithOneOmission(wanted: string[], available: string[], minimum = 0.68): number {
  let best = 0;
  for (let index = 0; index < wanted.length; index += 1) {
    best = Math.max(best, orderedWordScore(wanted.filter((_, wordIndex) => wordIndex !== index), available, minimum));
  }
  return best;
}

export function wordSimilarity(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length >= 3 && (left.startsWith(right) || right.startsWith(left))) return 0.9;
  const distance = levenshtein(left, right);
  const direct = 1 - distance / Math.max(left.length, right.length);
  const leftSkeleton = left.replace(/[aeiou]/gu, '');
  const rightSkeleton = right.replace(/[aeiou]/gu, '');
  const skeletonDistance = levenshtein(leftSkeleton, rightSkeleton);
  const skeleton = 1 - skeletonDistance / Math.max(1, leftSkeleton.length, rightSkeleton.length);
  return Math.max(direct, skeleton * 0.86);
}

function levenshtein(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return previous[right.length];
}

function ftsToken(value: string): string {
  return `"${value.replaceAll('"', '').trim()}"`;
}

function faultTolerantFts(groups: string[], allowOneOmission: boolean): string {
  const exact = groups.join(' AND ');
  if (!allowOneOmission || groups.length < 4) return exact;
  const omissions = groups.map((_, omitted) => `(${groups.filter((__, index) => index !== omitted).join(' AND ')})`);
  return `(${exact}) OR ${omissions.join(' OR ')}`;
}
