/**
 * Display-only TOC title sanitization: `truth: coherence theory of` →
 * `The Coherence Theory of Truth`. Search matches the raw title too.
 *
 * Every reorder keys off TOC conventions (lowercase topic heads, dangling
 * prepositions, `Surname, Given`), so already-clean titles like
 * `Kant’s Transcendental Arguments` pass through unchanged.
 */

const SMALL_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'nor',
  'but',
  'of',
  'on',
  'in',
  'for',
  'from',
  'to',
  'with',
  'at',
  'by',
  'as',
  'via',
  'vs',
  'versus',
]);

/** Lowercase in SEP’s own headings; kept lowercase when the title already is one. */
const LONG_PREPOSITIONS = new Set([
  'about',
  'after',
  'against',
  'among',
  'before',
  'between',
  'into',
  'over',
  'since',
  'through',
  'toward',
  'towards',
  'under',
  'upon',
  'within',
  'without',
]);

const NAME_PARTICLES = new Set([
  'de',
  'du',
  'da',
  'di',
  'della',
  'la',
  'van',
  'von',
  'der',
  'y',
  "d'",
  'd’',
  'al',
]);

/** A tail ending in one of these is the front half of the title: `X, theories of`. */
const DANGLING_TAIL =
  /\s(?:of|on|for|in|to|about|and|with|between|into)(?:\s+the)?$/;

/** A tail opening with one of these continues the head: `freedom: of speech`. */
const CONTINUING_TAIL =
  /^(?:and|in|on|of|as|versus|vs\.|over|by|about|for|with|from|without|within)\s/;

/** Singular `X of …` heads SEP titles with “The”: `The Problem of Evil`. */
const THE_OF_HEADS = new Set([
  'analysis',
  'axiom',
  'concept',
  'definition',
  'development',
  'ethics',
  'grounds',
  'logic',
  'meaning',
  'metaphysics',
  'neuroscience',
  'paradox',
  'problem',
  'psychology',
  'structure',
  'theory',
  'unity',
  'value',
]);

/** Second words that keep `adj X of` singular: `The Coherence Theory of Truth`. */
const THE_OF_SECOND = new Set(['theory', 'status']);

/** Words used attributively in TOC tails without an adjectival suffix. */
const ATTRIBUTIVE = new Set([
  'ancient',
  'backward',
  'black',
  'business',
  'climate',
  'dependence',
  'divine',
  'early',
  'free',
  'fuzzy',
  'group',
  'human',
  'hybrid',
  'justification',
  'linear',
  'medieval',
  'modern',
  'molecular',
  'montague',
  'narrow',
  'population',
  'preference',
  'provability',
  'relevance',
  'rule',
  'shared',
  'singular',
  'temporal',
  'transworld',
  'virtue',
]);

/** Nouns that happen to end in an adjectival suffix. */
const NOT_QUALIFIER = new Set([
  'agent',
  'category',
  'consent',
  'content',
  'covenant',
  'event',
  'history',
  'intent',
  'logic',
  'meaning',
  'memory',
  'music',
  'parent',
  'patient',
  'rhetoric',
  'student',
  'theory',
  'topic',
]);

/** `parent, label:` groupings in the TOC that are not part of the title. */
const CATEGORY_LABEL = /^(?:general topics|special topics|interventions|topics|approaches)$/i;

/** Single-word comma tails that are not modifiers: `X, in Y`. */
const ADJ_FRONT_BLOCKED = new Set(['in', 'and', 'of', 'for', 'on', 'the']);

/** Slugs that must not receive person-name inversion. */
const DO_NOT_INVERT = new Set(['cusanus', 'montesquieu', 'novalis']);

/**
 * Fixed display titles for idiosyncratic TOC titles (bracket-stripped,
 * lowercase). Keyed by title, not slug, so clean titles for the same entry
 * (new.html, H1s) are left alone.
 */
const DISPLAY_OVERRIDES: Record<string, string> = {
  'ockham, william': 'William of Ockham',
  'george, eliot': 'George Eliot',
  'many, problem of': 'The Problem of the Many',
};

function extractSlug(href?: string): string | null {
  if (!href) {
    return null;
  }
  const match = href.match(/\/entries\/([^/]+)\/?/);
  return match?.[1] ?? null;
}

/** Split on the first `sep` that is not inside (…). */
function splitTopLevel(text: string, sep: ',' | ':'): [string, string] | null {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth = Math.max(0, depth - 1);
    } else if (ch === sep && depth === 0) {
      const left = text.slice(0, i).trim();
      const right = text.slice(i + 1).trim();
      return left && right ? [left, right] : null;
    }
  }
  return null;
}

function countTopLevel(text: string, sep: ',' | ':'): number {
  let depth = 0;
  let count = 0;
  for (const ch of text) {
    if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth = Math.max(0, depth - 1);
    } else if (ch === sep && depth === 0) {
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

function words(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function startsLower(text: string): boolean {
  return /^\p{Ll}/u.test(text);
}

/** Strip transliteration marks so `ʿAyn` / `‘Abd` test as capitalized. */
function withoutLeadingMarks(text: string): string {
  return text.replace(/^[‘’'ʿʾ]+/u, '');
}

// ---------------------------------------------------------------------------
// People

function looksLikeSurname(left: string): boolean {
  return /^(?:al-|ibn\b)/i.test(left) || /^\p{Lu}/u.test(left);
}

function looksLikeGivenNames(right: string): boolean {
  const bare = withoutLeadingMarks(right);
  if (/^(?:de|du|van|von|d['’])\s+\p{Lu}/u.test(bare)) {
    return true;
  }
  if (!/^\p{Lu}/u.test(bare)) {
    return false;
  }
  if (CATEGORY_LABEL.test(bare)) {
    return false;
  }
  // `Princess of Bohemia`, `Full Abstraction and Full Completeness`: names
  // only carry lowercase particles
  return words(bare).every(
    (word) =>
      !startsLower(word) ||
      NAME_PARTICLES.has(word.replace(/,$/, '')) ||
      /^al-\p{Lu}/u.test(word)
  );
}

/** `Ayer, Alfred Jules` → `Alfred Jules Ayer`. */
function tryPersonInvert(title: string, slug: string | null): string | null {
  if (slug && DO_NOT_INVERT.has(slug)) {
    return null;
  }
  if (countTopLevel(title, ',') !== 1) {
    return null;
  }
  const parts = splitTopLevel(title, ',');
  if (!parts) {
    return null;
  }
  const [left, right] = parts;
  if (!looksLikeSurname(left) || !looksLikeGivenNames(right)) {
    return null;
  }
  // `Holbach, Paul-Henri Thiry (Baron) d’` → `… d’Holbach`
  const glued = right.match(/^(.*\S)\s+(d['’])$/);
  if (glued) {
    return `${glued[1]} ${glued[2]!.replace("'", '’')}${left}`;
  }
  return `${right} ${left}`;
}

type Person = { surname: string };

/** Person-like colon heads: `Hume, David`, `Plato`, `al-Farabi`, `Zeno of Elea`. */
function personHead(head: string): Person | null {
  const parts = splitTopLevel(head, ',');
  if (parts) {
    const [left, right] = parts;
    return looksLikeSurname(left) &&
      !startsLower(left) &&
      looksLikeGivenNames(right)
      ? { surname: left }
      : null;
  }
  if (/^(?:al-|ibn\s)/i.test(head)) {
    return { surname: head };
  }
  if (/^\p{Lu}[\p{L}’'-]*(?: of \p{Lu}[\p{L}-]*)?$/u.test(head)) {
    // Schools and doctrines are not people: `Daoism`, `Confucianism`
    return /(?:ism|ity|ics|logy|phy)$/.test(head) ? null : { surname: head };
  }
  return null;
}

function possessive(surname: string): string {
  return /s$/i.test(surname) ? `${surname}’` : `${surname}’s`;
}

// ---------------------------------------------------------------------------
// Topic phrases

function isQualifierWord(word: string): boolean {
  const lower = word.toLowerCase();
  if (ATTRIBUTIVE.has(lower)) {
    return true;
  }
  if (NOT_QUALIFIER.has(lower)) {
    return false;
  }
  if (/\p{L}[’']s$/u.test(word)) {
    return true;
  }
  if (/^\p{Lu}/u.test(word)) {
    // Proper adjectives: Bayesian, Mexican, Russellian
    return /(?:ian|an|ese|ish)$/.test(lower);
  }
  if (/-order$/.test(lower)) {
    return true;
  }
  if (/ment$/.test(lower)) {
    return false;
  }
  return /(?:al|ic|ive|ous|ary|ory|ent|ant|ist|ed|ing|able|ible|ful|less)$/.test(
    lower
  );
}

/** `fuzzy`, `positive and negative`, `intrinsic vs. extrinsic`, `dynamic epistemic`. */
function isQualifierPhrase(text: string, maxWords = 3): boolean {
  const parts = words(text);
  if (parts.length === 0 || parts.length > maxWords) {
    return false;
  }
  return parts.every((word, index) => {
    const isEdge = index === 0 || index === parts.length - 1;
    if (!isEdge && /^(?:and|vs\.|versus)$/.test(word)) {
      return true;
    }
    return isQualifierWord(word);
  });
}

/** Single-word adjectival heads read head-first: `animal: cognition`. */
function isAdjectivalHead(head: string): boolean {
  if (!/^\p{Ll}[\p{L}-]*$/u.test(head) || NOT_QUALIFIER.has(head)) {
    return false;
  }
  return head === 'divine' || /(?:al|ive|ous)$/.test(head);
}

/** `ethics of abortion` → `the ethics of abortion`, per SEP’s own titles. */
function withLeadingThe(phrase: string): string {
  const [first = '', second = '', third = ''] = words(phrase.toLowerCase());
  const singularOf =
    (THE_OF_HEADS.has(first) && second === 'of') ||
    (THE_OF_SECOND.has(second) && third === 'of');
  return singularOf ? `the ${phrase}` : phrase;
}

/**
 * Comma inversions within one phrase:
 * `abortion, ethics of` → `the ethics of abortion`,
 * `bias, implicit` → `implicit bias`, `Sophists, The` → `The Sophists`.
 */
function normalizeCommaPhrase(text: string, slug: string | null = null): string {
  const person = tryPersonInvert(text, slug);
  if (person) {
    return person;
  }
  if (countTopLevel(text, ',') !== 1) {
    return text;
  }
  const parts = splitTopLevel(text, ',');
  if (!parts) {
    return text;
  }
  const [left, right] = parts;
  if (/^the$/i.test(right)) {
    return `${right} ${left}`;
  }
  if (DANGLING_TAIL.test(` ${right}`)) {
    return withLeadingThe(`${right} ${left}`);
  }
  if (!startsLower(right) && !isQualifierWord(right)) {
    return text;
  }
  // `perfectionism, in moral and political philosophy`
  if (startsLower(left) && /^(?:in|of)\s/.test(right)) {
    return `${left} ${right}`;
  }
  // `social procedures, formal approaches`
  if (/^\p{Ll}[\p{L}-]*\sapproaches$/u.test(right)) {
    return `${right} to ${left}`;
  }
  // `bias, implicit` → `implicit bias`
  if (/^\p{Ll}[\p{L}\d-]*$/u.test(right) && !ADJ_FRONT_BLOCKED.has(right)) {
    return `${right} ${left}`;
  }
  if (isQualifierPhrase(right, 2)) {
    return `${right} ${left}`;
  }
  return text;
}

// ---------------------------------------------------------------------------
// Colon titles

function stem(word: string): string {
  const lower = word.toLowerCase();
  const stemmed = lower.replace(/(?:ism|s|y)$/, '');
  return stemmed.length >= 4 ? stemmed : lower;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The tail already names the head: `quantum theory: quantum gravity`. */
function isRedundantTail(head: string, tail: string): boolean {
  const headWords = words(head);
  const tailWords = words(tail);
  if (headWords.length === 0 || tailWords.length === 0) {
    return false;
  }
  const phrase = new RegExp(
    `(?:^|[^\\p{L}])${headWords
      .map((word) => `${escapeRegExp(stem(word))}\\p{L}*`)
      .join('\\s+')}(?:$|[^\\p{L}])`,
    'iu'
  );
  if (phrase.test(tail)) {
    return true;
  }
  const firstHead = headWords[0]!;
  const firstTail = tailWords[0]!;
  if (
    new RegExp(`^${escapeRegExp(firstHead)}[’']s$`, 'iu').test(firstTail)
  ) {
    return true;
  }
  // Plain lowercase compounds only: `history of logic: modal logic` is not
  // the same entry as `modal logic`.
  if (!/^\p{Ll}[\p{L}-]*(?:\s\p{Ll}[\p{L}-]*)?$/u.test(head)) {
    return false;
  }
  if (headWords.length === 1) {
    return firstTail.toLowerCase().startsWith(stem(firstHead));
  }
  return (
    firstTail.toLowerCase() === firstHead.toLowerCase() ||
    tailWords.at(-1)!.toLowerCase() === headWords.at(-1)!.toLowerCase()
  );
}

/**
 * `head: tail` → one natural phrase where TOC conventions make the order
 * unambiguous; otherwise keep the colon.
 */
function formatColonTitle(rawHead: string, rawTail: string): string {
  // Heading-style tails (`Darwin: From the Origin…`) are already clean.
  const firstTailWord = (words(rawTail)[0] ?? '').toLowerCase();
  if (
    /^\p{Lu}/u.test(rawTail) &&
    (SMALL_WORDS.has(firstTailWord) || LONG_PREPOSITIONS.has(firstTailWord))
  ) {
    return `${rawHead}: ${rawTail}`;
  }

  let head = rawHead;
  let label: string | null = null;
  const headParts =
    countTopLevel(rawHead, ',') === 1 ? splitTopLevel(rawHead, ',') : null;
  if (headParts && CATEGORY_LABEL.test(headParts[1])) {
    [head, label] = headParts;
  }

  // `feminist philosophy, topics: perspectives on X` → `feminist perspectives on X`
  const field = label ? head.match(/^(\p{Ll}+?)(?:ist|ic|al)? philosophy$/u) : null;
  if (field) {
    const adjective = head.split(' ')[0]!;
    return new RegExp(`\\b${field[1]}`, 'i').test(rawTail)
      ? rawTail
      : `${adjective} ${rawTail}`;
  }

  // `Arabic and Islamic Philosophy, special topics in: mysticism`
  const scope =
    !label && headParts && startsLower(headParts[1]) && /\sin$/.test(headParts[1])
      ? headParts[0]
      : null;
  if (scope) {
    return isRedundantTail(scope, rawTail) ? rawTail : `${rawTail} in ${scope}`;
  }

  const person = personHead(head);
  const phrase = person ? head : normalizeCommaPhrase(head);
  const short = person ? person.surname : phrase;

  // `truth: coherence theory of` → `the coherence theory of truth`;
  // `music: history of western philosophy of, since 1800` keeps its subtitle.
  const tailParts = splitTopLevel(rawTail, ',');
  const lead = tailParts && DANGLING_TAIL.test(` ${tailParts[0]}`) ? tailParts : null;
  if (lead) {
    return `${lead[0]} ${person ? short : phrase}: ${lead[1]}`;
  }
  if (DANGLING_TAIL.test(` ${rawTail}`)) {
    return withLeadingThe(`${rawTail} ${person ? short : phrase}`);
  }

  if (CONTINUING_TAIL.test(rawTail)) {
    return `${short} ${rawTail}`;
  }

  if (isRedundantTail(phrase, rawTail)) {
    return rawTail;
  }

  if (person) {
    // `Aristotle: textual transmission of Aristotelian corpus`
    const mentionsPerson = new RegExp(
      `(?:^|\\s)${escapeRegExp(person.surname.slice(0, 6))}`,
      'iu'
    ).test(rawTail);
    return mentionsPerson
      ? `${person.surname}: ${rawTail}`
      : `${possessive(person.surname)} ${rawTail}`;
  }

  // `logic: fuzzy` → `fuzzy logic`, `semantics: Montague` → `Montague semantics`
  const simpleHead =
    !phrase.includes(',') &&
    words(phrase).length <= 3 &&
    !/\s(?:of|and|for|in|on)\s/.test(phrase);
  if (simpleHead && (startsLower(phrase) || !phrase.includes(' '))) {
    if (isQualifierPhrase(rawTail)) {
      return `${rawTail} ${phrase}`;
    }
  } else if (simpleHead && /^\p{Ll}+$/u.test(rawTail) && isQualifierWord(rawTail)) {
    // Capitalized heads only take one plain word: `Africana Philosophy: contemporary`
    return `${rawTail} ${phrase}`;
  }

  if (!startsLower(rawTail)) {
    return `${phrase}: ${rawTail}`;
  }

  // `mathematics, philosophy of: nominalism`
  if (/^philosophy of\s/.test(phrase) && /^\p{L}+ism$/u.test(rawTail)) {
    return `${rawTail} in the ${phrase}`;
  }

  if (simpleHead) {
    if (/^[\p{Ll}\d][\p{L}\d-]*(?:\s[\p{Ll}][\p{L}-]*)?\sapproaches$/u.test(rawTail)) {
      return `${rawTail} to ${phrase}`;
    }
    if (/^[\p{Ll}\d][\p{L}\d-]*(?:\s[\p{Ll}][\p{L}-]*)?\stheories$/u.test(rawTail)) {
      return `${rawTail} of ${phrase}`;
    }
  }

  if (isAdjectivalHead(phrase) && /^\p{Ll}[\p{L}-]*(?:\s\p{Ll}[\p{L}-]*)?$/u.test(rawTail)) {
    return `${phrase} ${rawTail}`;
  }

  return `${phrase}: ${rawTail}`;
}

// ---------------------------------------------------------------------------
// Casing

function capitalizeWord(word: string): string {
  if (!word) {
    return word;
  }
  if (/^al-/i.test(word)) {
    return `al-${capitalizeWord(word.slice(3))}`;
  }
  const particleMatch = word.match(/^(d['’])(.*)$/i);
  if (particleMatch) {
    const particle = particleMatch[1]!.toLowerCase().replace("'", '’');
    return particle + capitalizeWord(particleMatch[2] ?? '');
  }
  return word.replace(/^(\p{Lm}*)(\p{Ll})/u, (_, marks: string, letter: string) =>
    marks + letter.toUpperCase()
  );
}

/** Already a heading: capitalized, with only small words/particles in lowercase. */
function isHeadingCased(parts: readonly string[]): boolean {
  if (!/^[^\p{L}]*\p{Lu}/u.test(parts[0] ?? '')) {
    return false;
  }
  return parts.every((word) => {
    const core = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    return (
      !startsLower(core) ||
      SMALL_WORDS.has(core) ||
      LONG_PREPOSITIONS.has(core) ||
      NAME_PARTICLES.has(core) ||
      /^(?:al-|d[’'])\p{Lu}/u.test(core)
    );
  });
}

/**
 * Title case with small-word and name-particle handling. Never lowercases:
 * source capitals carry names and acronyms (`McTaggart`, `W.E.B.`, `ZF`).
 */
export function toDisplayTitleCase(text: string): string {
  const parts = text.replace(/\s+/g, ' ').trim().split(' ');
  if (isHeadingCased(parts)) {
    return parts.join(' ');
  }
  let startsClause = true;

  return parts
    .map((word, index) => {
      const isFirst = startsClause;
      const isLast = index === parts.length - 1;
      startsClause = word.endsWith(':');
      const leading = word.match(/^[^\p{L}\p{N}]*/u)?.[0] ?? '';
      const trailing = word.match(/[^\p{L}\p{N}]*$/u)?.[0] ?? '';
      const core = word.slice(leading.length, word.length - trailing.length);
      if (!core) {
        return word;
      }
      if (/\p{Lu}/u.test(core)) {
        // `neo-Kantianism` → `Neo-Kantianism`; `al-Farabi`, `d’Holbach` stay
        return /^(?:al-|d[’'])/.test(core)
          ? word
          : leading + capitalizeWord(core) + trailing;
      }
      if (!isFirst && !isLast && SMALL_WORDS.has(core)) {
        return word;
      }
      if (!isFirst && NAME_PARTICLES.has(core)) {
        return leading + core.replace("'", '’') + trailing;
      }
      const cased = core
        .split(/(?<=[-/])/)
        .map((part) => capitalizeWord(part))
        .join('');
      return leading + cased + trailing;
    })
    .join(' ');
}

/**
 * Format a TOC entry title for display. Callers keep the raw title too: its
 * bracketed aliases (`Abelard [Abailard]`) are search terms.
 */
export function formatEntryTitle(title: string, href?: string): string {
  const trimmed = title.replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    return trimmed;
  }

  const slug = extractSlug(href);
  const bare = stripBrackets(trimmed);
  const override = DISPLAY_OVERRIDES[bare.toLowerCase()];
  if (override) {
    return override;
  }

  const colon = countTopLevel(bare, ':') === 1 ? splitTopLevel(bare, ':') : null;
  const result = colon
    ? formatColonTitle(colon[0], colon[1])
    : normalizeCommaPhrase(bare, slug);
  return toDisplayTitleCase(result);
}
