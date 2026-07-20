/** Display-only TOC title sanitization. Search should keep using the raw title. */

const SMALL_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'on',
  'in',
  'for',
  'to',
  'vs',
  'vs.',
]);

const NAME_PARTICLES = new Set(['de', 'du', 'van', 'von', "d'", 'd’', 'al']);

const TOPIC_TAIL_WORDS = new Set([
  'ethics',
  'philosophy',
  'commentators',
  'theories',
  'principle',
  'definition',
  'concept',
  'status',
  'problem',
  'modeling',
  'relation',
]);

/** Exact right-hand sides for topic comma inversion. */
const TOPIC_OF_ALLOWLIST = new Set([
  'philosophy of',
  'ethics of',
  'theories of',
  'commentators on',
  'principle of',
  'definition of',
  'concept of the',
  'moral status of',
  'status of',
  'the problem of',
  'problem of',
]);

/** Prefix "The" after topic-of invert for these right-hand sides. */
const TOPIC_OF_THE_PREFIX = new Set([
  'ethics of',
  'the problem of',
  'problem of',
  'definition of',
  'concept of the',
  'axiom of',
]);

const ADJ_FRONT_BLOCKED = new Set(['in', 'and', 'of', 'for', 'on', 'the']);

/** Slugs that must not receive person-name inversion. */
const DO_NOT_INVERT = new Set(['cusanus', 'montesquieu', 'novalis']);

/** Fixed display titles for known idiosyncratic entries. */
const DISPLAY_OVERRIDES: Record<string, string> = {
  ockham: 'William of Ockham',
  'peter-spain': 'Peter of Spain',
};

function extractSlug(href?: string): string | null {
  if (!href) {
    return null;
  }
  const match = href.match(/\/entries\/([^/]+)\/?/);
  return match?.[1] ?? null;
}

/** Split on the first comma that is not inside […] or (…). */
function splitTopLevelComma(text: string): [string, string] | null {
  let depthSquare = 0;
  let depthParen = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '[') {
      depthSquare++;
    } else if (ch === ']') {
      depthSquare = Math.max(0, depthSquare - 1);
    } else if (ch === '(') {
      depthParen++;
    } else if (ch === ')') {
      depthParen = Math.max(0, depthParen - 1);
    } else if (ch === ',' && depthSquare === 0 && depthParen === 0) {
      const left = text.slice(0, i).trim();
      const right = text.slice(i + 1).trim();
      if (!left || !right) {
        return null;
      }
      return [left, right];
    }
  }
  return null;
}

function countTopLevelCommas(text: string): number {
  let depthSquare = 0;
  let depthParen = 0;
  let count = 0;
  for (const ch of text) {
    if (ch === '[') {
      depthSquare++;
    } else if (ch === ']') {
      depthSquare = Math.max(0, depthSquare - 1);
    } else if (ch === '(') {
      depthParen++;
    } else if (ch === ')') {
      depthParen = Math.max(0, depthParen - 1);
    } else if (ch === ',' && depthSquare === 0 && depthParen === 0) {
      count++;
    }
  }
  return count;
}

function stripBrackets(text: string): string {
  return text
    .replace(/\s*\[[^\]]*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeSurname(left: string): boolean {
  const bare = stripBrackets(left);
  if (!bare) {
    return false;
  }
  // al-Farabi, Ibn Sina, Van Orman-style, or capitalized surname
  if (/^(al-|ibn\b|van\b|von\b)/i.test(bare)) {
    return true;
  }
  return /^\p{Lu}/u.test(bare);
}

function looksLikeGivenNames(right: string): boolean {
  const bare = stripBrackets(right);
  if (!bare) {
    return false;
  }
  // Particle then capitalized name: de Beauvoir, du Châtelet, d’Holbach
  if (/^(de|du|van|von|d['’])\s+\p{Lu}/iu.test(bare)) {
    return true;
  }
  if (!/^\p{Lu}/u.test(bare)) {
    return false;
  }
  // Reject topic tails
  if (/\b(of|on|for|the)$/i.test(bare)) {
    return false;
  }
  const firstWord = bare.split(/\s+/)[0]?.toLowerCase() ?? '';
  if (TOPIC_TAIL_WORDS.has(firstWord)) {
    return false;
  }
  return true;
}

function tryPersonInvert(title: string, slug: string | null): string | null {
  if (slug && DO_NOT_INVERT.has(slug)) {
    return null;
  }
  if (title.includes(':')) {
    return null;
  }
  if (countTopLevelCommas(title) !== 1) {
    return null;
  }
  const parts = splitTopLevelComma(title);
  if (!parts) {
    return null;
  }
  const [left, right] = parts;
  if (!looksLikeSurname(left) || !looksLikeGivenNames(right)) {
    return null;
  }
  // Lowercase topic heads are not person surnames
  if (/^\p{Ll}/u.test(stripBrackets(left)) && !/^(al-|ibn\b)/i.test(left)) {
    return null;
  }
  return `${right} ${left}`;
}

function tryTopicOfInvert(title: string): string | null {
  if (title.includes(':')) {
    return null;
  }
  const parts = splitTopLevelComma(title);
  if (!parts) {
    return null;
  }
  const [left, right] = parts;
  const rightKey = right.toLowerCase();
  if (!TOPIC_OF_ALLOWLIST.has(rightKey)) {
    return null;
  }
  const inverted = `${right} ${left}`;
  if (TOPIC_OF_THE_PREFIX.has(rightKey) && !/^the\b/i.test(inverted)) {
    return `the ${inverted}`;
  }
  return inverted;
}

function tryAdjFront(title: string): string | null {
  if (title.includes(':')) {
    return null;
  }
  const match = title.match(/^([a-z][a-z0-9 -]+), ([a-z][a-z0-9-]+)$/);
  if (!match) {
    return null;
  }
  const left = match[1];
  const right = match[2];
  if (!left || !right) {
    return null;
  }
  if (ADJ_FRONT_BLOCKED.has(right)) {
    return null;
  }
  // Single token (hyphenated ok)
  if (/\s/.test(right)) {
    return null;
  }
  return `${right} ${left}`;
}

function surnameFromPersonLeft(left: string): string {
  // Text before first comma/bracket already; left may include [variant]
  const bare = left.trim();
  const bracketIdx = bare.search(/[\[(]/);
  const surname = (bracketIdx === -1 ? bare : bare.slice(0, bracketIdx)).trim();
  return surname;
}

function possessiveForm(surname: string): string {
  if (/s$/i.test(surname)) {
    return `${surname}’`;
  }
  return `${surname}’s`;
}

function tryPossessiveColon(title: string): string | null {
  if (!title.includes(':')) {
    return null;
  }
  if (/General Topics:/i.test(title)) {
    return null;
  }

  const colonIdx = title.indexOf(':');
  const left = title.slice(0, colonIdx).trim();
  const topic = title.slice(colonIdx + 1).trim();
  if (!left || !topic) {
    return null;
  }
  if (/^(and|in)\b/i.test(topic)) {
    return null;
  }
  const topicWords = topic.split(/\s+/).filter(Boolean);
  if (topicWords.length === 0 || topicWords.length > 4) {
    return null;
  }

  // Must look like a person-ish left: capitalized, optionally "Last, First"
  if (!/^\p{Lu}/u.test(left) && !/^(al-|ibn\b)/i.test(left)) {
    return null;
  }

  let surname: string;
  const commaParts = splitTopLevelComma(left);
  if (commaParts) {
    surname = surnameFromPersonLeft(commaParts[0]);
  } else {
    surname = surnameFromPersonLeft(left);
  }
  if (!surname) {
    return null;
  }

  return `${possessiveForm(surname)} ${topic}`;
}

function tryAndInColon(title: string): string | null {
  if (!/: and |: in /i.test(title)) {
    return null;
  }

  const colonIdx = title.search(/: (and|in) /i);
  if (colonIdx === -1) {
    return null;
  }
  let left = title.slice(0, colonIdx).trim();
  const rest = title.slice(colonIdx + 1).trim(); // "and …" or "in …"

  // If left is Last, First — reduce to surname
  if (!left.includes(':') && countTopLevelCommas(left) === 1) {
    const parts = splitTopLevelComma(left);
    if (parts && looksLikeSurname(parts[0]) && looksLikeGivenNames(parts[1])) {
      left = surnameFromPersonLeft(parts[0]);
    }
  }

  return `${left} ${rest}`;
}

/** Single-token qualifiers safe to front: `agency: shared` → `shared agency`. */
function isFrontableQualifier(word: string): boolean {
  if (
    /(?:al|ic|ive|ous|ary|ory|ent|ant|ed|ing|able|ible|ful|less)$/i.test(word)
  ) {
    return true;
  }
  return ['shared', 'ancient', 'modern', 'medieval', 'temporal'].includes(
    word.toLowerCase()
  );
}

/**
 * Tight topic colon reorder: `agency: shared` → `shared agency`.
 * Only lowercase topic heads with a single adjectival qualifier.
 * Skips noun qualifiers like `animal: cognition` (H1 keeps head-first order).
 */
function tryTopicColonReorder(title: string): string | null {
  if (!title.includes(':')) {
    return null;
  }
  if (/: (and|in) /i.test(title)) {
    return null;
  }
  const match = title.match(/^([a-z][a-z0-9 -]+): ([a-z][a-z0-9-]+)$/);
  if (!match) {
    return null;
  }
  const left = match[1];
  const right = match[2];
  if (!left || !right) {
    return null;
  }
  if (/^(and|in)\b/i.test(right) || /\bof$/i.test(right)) {
    return null;
  }
  if (/\s/.test(right) || !isFrontableQualifier(right)) {
    return null;
  }
  return `${right} ${left}`;
}

function capitalizeWord(word: string): string {
  if (!word) {
    return word;
  }
  // al-Farabi style
  if (/^al-/i.test(word)) {
    return `al-${word.slice(3).charAt(0).toUpperCase()}${word.slice(4).toLowerCase()}`;
  }
  // d' / d’ particles glued to next letter
  const particleMatch = word.match(/^(d['’])(.*)$/i);
  if (particleMatch) {
    const particle = particleMatch[1]!.toLowerCase().replace("'", '’');
    const rest = particleMatch[2] ?? '';
    if (!rest) {
      return particle;
    }
    return (
      particle + rest.charAt(0).toUpperCase() + rest.slice(1).toLowerCase()
    );
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** Title case with small-word and name-particle handling. */
export function toDisplayTitleCase(text: string): string {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  if (words.length === 0) {
    return '';
  }

  return words
    .map((word, index) => {
      const isFirst = index === 0;
      const isLast = index === words.length - 1;
      const leading = word.match(/^[^\p{L}\p{N}]*/u)?.[0] ?? '';
      const trailing = word.match(/[^\p{L}\p{N}]*$/u)?.[0] ?? '';
      const core = word.slice(leading.length, word.length - trailing.length);
      if (!core) {
        return word;
      }

      const lower = core.toLowerCase();

      if (!isFirst && !isLast && SMALL_WORDS.has(lower)) {
        const small = lower === 'vs.' ? 'vs.' : lower;
        return leading + small + trailing;
      }
      if (!isFirst && NAME_PARTICLES.has(lower)) {
        const particle = lower.startsWith('d')
          ? lower.replace("'", '’')
          : lower;
        return leading + particle + trailing;
      }
      // Hyphenated compounds: capitalize each side
      if (core.includes('-') && !/^al-/i.test(core)) {
        const cased = core
          .split('-')
          .map((part) => capitalizeWord(part))
          .join('-');
        return leading + cased + trailing;
      }
      return leading + capitalizeWord(core) + trailing;
    })
    .join(' ');
}

/**
 * Format a TOC entry title for palette display.
 * Does not mutate search text — callers should keep matching against the raw title.
 */
export function formatEntryTitle(title: string, href?: string): string {
  const trimmed = title.replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    return trimmed;
  }

  const slug = extractSlug(href);

  const override = slug ? DISPLAY_OVERRIDES[slug] : undefined;
  if (override) {
    return toDisplayTitleCase(override);
  }

  let result = trimmed;

  // #5 possessive colon OR #6 : and / : in OR tight topic colon reorder
  const possessive = tryPossessiveColon(result);
  if (possessive) {
    result = possessive;
  } else {
    const andIn = tryAndInColon(result);
    if (andIn) {
      result = andIn;
    } else {
      const topicColon = tryTopicColonReorder(result);
      if (topicColon) {
        result = topicColon;
      }
    }
  }

  // #1 person invert
  const person = tryPersonInvert(result, slug);
  if (person) {
    result = person;
  } else {
    // #3 topic of/on/for OR #4 adj-front
    const topicOf = tryTopicOfInvert(result);
    if (topicOf) {
      result = topicOf;
    } else {
      const adj = tryAdjFront(result);
      if (adj) {
        result = adj;
      }
    }
  }

  // #2 strip brackets for display
  result = stripBrackets(result);

  // #7 title case
  return toDisplayTitleCase(result);
}
