/**
 * @vitest-environment happy-dom
 * @vitest-environment-options {"url":"https://plato.stanford.edu/"}
 */
import { describe, expect, it } from 'vitest';
import { filterEntries, parseContentsHtml } from './entryIndex';
import type { EntryIndexItem } from './types';

function href(slug: string): string {
  return `https://plato.stanford.edu/entries/${slug}/`;
}

const CONTENTS = `
<ul>
<li> <a href="entries/abortion/"><strong>abortion, ethics of</strong></a> (Elizabeth Harman) </li>
<li> accidental properties &mdash; see <a href="entries/essential-accidental/">essential vs. accidental properties</a> </li>
<li> <a href="entries/action/"><strong>action</strong></a> (Juan S. Piñeros Glasscock)
  <ul>
   <li> joint &mdash; see <a href="entries/shared-agency/">agency: shared</a> </li>
  </ul>
</li>
<li> aesthetics
   <ul>
   <li> <a href="entries/aesthetics-18th-british/"><strong>British, in the 18th century</strong></a> (James Shelley) </li>
   </ul>
</li>
<li> <a href="entries/agency/"><strong>agency</strong></a> (Markus Schlosser)
   <ul>
   <li> <a href="entries/shared-agency/"><strong>shared</strong></a> (Abraham Sesshu Roth) </li>
   </ul>
</li>
<li> distributive justice &mdash; see <a href="entries/justice-distributive/">justice: distributive</a>
   <ul>
   <li> <a href="entries/justice-moral-psych/"><strong>and empirical moral psychology</strong></a> (Jonathan Haidt) </li>
   </ul>
</li>
<li> <a href="entries/essential-accidental/"><strong>essential vs. accidental properties</strong></a> (Teresa Robertson Ishii) </li>
</ul>`;

describe('parseContentsHtml', () => {
  const entries = parseContentsHtml(CONTENTS);
  const titleOf = (slug: string) =>
    entries.find((entry) => entry.href === href(slug))?.title;

  it('prefixes nested entries with their parent heading', () => {
    expect(titleOf('aesthetics-18th-british')).toBe(
      'aesthetics: British, in the 18th century'
    );
    expect(titleOf('shared-agency')).toBe('agency: shared');
  });

  it('drops `— see` cross-references from parent headings', () => {
    expect(titleOf('justice-moral-psych')).toBe(
      'distributive justice: and empirical moral psychology'
    );
  });

  it('keeps top-level and cross-referenced titles as printed', () => {
    expect(titleOf('abortion')).toBe('abortion, ethics of');
    expect(titleOf('essential-accidental')).toBe(
      'essential vs. accidental properties'
    );
    expect(titleOf('justice-distributive')).toBe('justice: distributive');
    expect(entries).toHaveLength(8);
  });
});

describe('filterEntries', () => {
  const entries: EntryIndexItem[] = [
    { title: 'Abelard [Abailard], Peter', href: href('abelard') },
    { title: 'abortion, ethics of', href: href('abortion') },
    { title: 'Gödel, Kurt', href: href('goedel') },
    { title: 'Japanese Philosophy: Kūkai', href: href('kukai') },
    { title: 'social minimum [basic income]', href: href('social-minimum') },
    { title: 'Zeno of Elea: Zeno’s paradoxes', href: href('paradox-zeno') },
  ];
  const hrefs = (query: string) =>
    filterEntries(entries, query).map((entry) => entry.href);

  it('matches bracket aliases in the raw TOC title', () => {
    expect(hrefs('abailard')).toEqual([href('abelard')]);
    expect(hrefs('basic income')).toEqual([href('social-minimum')]);
  });

  it('matches the display title users see', () => {
    expect(hrefs('ethics of abortion')).toEqual([href('abortion')]);
    expect(hrefs('peter abelard')).toEqual([href('abelard')]);
  });

  it('ignores accents and curly quotes', () => {
    expect(hrefs('godel')).toEqual([href('goedel')]);
    expect(hrefs('kukai')).toEqual([href('kukai')]);
    expect(hrefs("zeno's")).toEqual([href('paradox-zeno')]);
  });

  it('ranks whole-phrase matches before scattered-word matches', () => {
    const pool: EntryIndexItem[] = [
      { title: 'logic and modal realism', href: href('scattered') },
      { title: 'logic: modal', href: href('logic-modal') },
    ];
    // `logic: modal` displays as `Modal Logic`
    expect(filterEntries(pool, 'modal logic').map((e) => e.href)).toEqual([
      href('logic-modal'),
      href('scattered'),
    ]);
  });

  it('ranks exact, then whole-word, then partial-word, then mid-word matches', () => {
    const pool: EntryIndexItem[] = [
      { title: 'Reminders in Ethics', href: href('mid-word') },
      { title: 'Other Minds', href: href('word-partial') },
      { title: 'Mindfulness', href: href('title-partial') },
      { title: 'Theories of the Mind', href: href('word-whole') },
      { title: 'Mind and World', href: href('title-whole') },
      { title: 'Mind', href: href('exact') },
    ];
    expect(filterEntries(pool, 'mind').map((e) => e.href)).toEqual([
      href('exact'),
      href('title-whole'),
      href('word-whole'),
      href('title-partial'),
      href('word-partial'),
      href('mid-word'),
    ]);
  });

  it('ranks a whole word above a longer word it starts', () => {
    const pool: EntryIndexItem[] = [
      { title: 'Logical Form', href: href('logical-form') },
      { title: 'Logic and Games', href: href('logic-games') },
    ];
    expect(filterEntries(pool, 'logic').map((e) => e.href)).toEqual([
      href('logic-games'),
      href('logical-form'),
    ]);
  });

  it('treats the surname of a person entry as an exact match', () => {
    const pool: EntryIndexItem[] = [
      { title: 'Kant and Leibniz', href: href('kant-leibniz') },
      { title: 'Kant, Immanuel', href: href('kant') },
    ];
    expect(filterEntries(pool, 'kant').map((e) => e.href)).toEqual([
      href('kant'),
      href('kant-leibniz'),
    ]);
  });

  it('does not treat comma topic heads as surnames', () => {
    const pool: EntryIndexItem[] = [
      { title: 'logic, history of: modal logic', href: href('logic-modal-history') },
      { title: 'Logic and Games', href: href('logic-games') },
    ];
    expect(filterEntries(pool, 'logic')[0]?.href).toBe(href('logic-games'));
  });

  it('breaks ties with the shorter title', () => {
    const pool: EntryIndexItem[] = [
      { title: 'Kant’s Philosophy of Religion', href: href('kant-religion') },
      { title: 'Kant’s Aesthetics', href: href('kant-aesthetics') },
    ];
    expect(filterEntries(pool, 'kant').map((e) => e.href)).toEqual([
      href('kant-aesthetics'),
      href('kant-religion'),
    ]);
  });

  it('ranks scattered words at word starts above mid-word ones', () => {
    const pool: EntryIndexItem[] = [
      { title: 'Unmodal Theories of Logic', href: href('mid-word') },
      { title: 'Logic and Modal Realism', href: href('word-starts') },
    ];
    expect(filterEntries(pool, 'modal logic').map((e) => e.href)).toEqual([
      href('word-starts'),
      href('mid-word'),
    ]);
  });

  it('keeps related entries ahead of better-ranked matches', () => {
    const related: EntryIndexItem[] = [
      { title: 'Theories of the Mind', href: href('related') },
    ];
    const pool: EntryIndexItem[] = [{ title: 'Mind', href: href('exact') }];
    expect(filterEntries(pool, 'mind', related).map((e) => e.href)).toEqual([
      href('related'),
      href('exact'),
    ]);
  });
});
