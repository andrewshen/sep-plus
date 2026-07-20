import { describe, expect, it } from 'vitest';
import { filterEntries } from './entryIndex';
import { formatEntryTitle } from './formatEntryTitle';
import type { EntryIndexItem } from './types';

function href(slug: string): string {
  return `https://plato.stanford.edu/entries/${slug}/`;
}

describe('formatEntryTitle', () => {
  it('inverts simple person names (#1)', () => {
    expect(
      formatEntryTitle('Ayer, Alfred Jules', href('ayer'))
    ).toBe('Alfred Jules Ayer');
    expect(
      formatEntryTitle('Beauvoir, Simone de', href('beauvoir'))
    ).toBe('Simone de Beauvoir');
    expect(
      formatEntryTitle('Châtelet, Émilie du', href('emilie-du-chatelet'))
    ).toBe('Émilie du Châtelet');
  });

  it('strips brackets from display but person-inverts first (#1+#2)', () => {
    expect(
      formatEntryTitle('Abelard [Abailard], Peter', href('abelard'))
    ).toBe('Peter Abelard');
    expect(
      formatEntryTitle('Burley [Burleigh], Walter', href('burley'))
    ).toBe('Walter Burley');
  });

  it('always strips [= gloss] brackets (#2)', () => {
    expect(
      formatEntryTitle('insolubles [= insolubilia]', href('insolubles'))
    ).toBe('Insolubles');
    expect(
      formatEntryTitle(
        'Albert the Great [= Albertus Magnus]',
        href('albert-great')
      )
    ).toBe('Albert the Great');
  });

  it('inverts allowlisted topic-of patterns (#3)', () => {
    expect(
      formatEntryTitle('architecture, philosophy of', href('architecture'))
    ).toBe('Philosophy of Architecture');
    expect(
      formatEntryTitle('abortion, ethics of', href('abortion'))
    ).toBe('The Ethics of Abortion');
    expect(
      formatEntryTitle('Aristotle, commentators on', href('aristotle-commentators'))
    ).toBe('Commentators on Aristotle');
    expect(
      formatEntryTitle('dirty hands, the problem of', href('dirty-hands'))
    ).toBe('The Problem of Dirty Hands');
  });

  it('fronts single-token adjectives (#4)', () => {
    expect(
      formatEntryTitle('bias, implicit', href('implicit-bias'))
    ).toBe('Implicit Bias');
    expect(
      formatEntryTitle('character, moral', href('moral-character'))
    ).toBe('Moral Character');
  });

  it('forms possessives for person: topic (#5)', () => {
    expect(
      formatEntryTitle('Hume, David: aesthetics', href('hume-aesthetics'))
    ).toBe('Hume’s Aesthetics');
    expect(
      formatEntryTitle('Plato: aesthetics', href('plato-aesthetics'))
    ).toBe('Plato’s Aesthetics');
    expect(
      formatEntryTitle(
        'Descartes, René: ontological argument',
        href('descartes-ontological')
      )
    ).toBe('Descartes’ Ontological Argument');
  });

  it('normalizes : and / : in without possessive (#6)', () => {
    expect(
      formatEntryTitle(
        'pornography: and censorship',
        href('pornography-censorship')
      )
    ).toBe('Pornography and Censorship');
    expect(
      formatEntryTitle(
        'aesthetics: in critical theory',
        href('aesthetics-critical-theory')
      )
    ).toBe('Aesthetics in Critical Theory');
    expect(
      formatEntryTitle(
        'Ramsey, Frank: and intergenerational welfare economics',
        href('ramsey-economics')
      )
    ).toBe('Ramsey and Intergenerational Welfare Economics');
  });

  it('reorders simple lowercase topic: qualifier when safe', () => {
    expect(
      formatEntryTitle('agency: shared', href('shared-agency'))
    ).toBe('Shared Agency');
    // Ambiguous colon order (H1 keeps head first) — leave structurally alone
    expect(
      formatEntryTitle('animal: cognition', href('cognition-animal'))
    ).toBe('Animal: Cognition');
  });

  it('uses small-word title case (#7)', () => {
    expect(
      formatEntryTitle('philosophy of chemistry', href('chemistry'))
    ).toBe('Philosophy of Chemistry');
  });

  it('honors slug display overrides', () => {
    expect(
      formatEntryTitle('Ockham [Occam], William', href('ockham'))
    ).toBe('William of Ockham');
    expect(
      formatEntryTitle(
        'Peter of Spain [= Petrus Hispanus]',
        href('peter-spain')
      )
    ).toBe('Peter of Spain');
  });

  it('does not invert do-not-invert slugs', () => {
    expect(
      formatEntryTitle(
        'Cusanus, Nicolaus [Nicolas of Cusa]',
        href('cusanus')
      )
    ).toBe('Cusanus, Nicolaus');
    expect(
      formatEntryTitle(
        'Novalis [Georg Friedrich Philipp von Hardenberg]',
        href('novalis')
      )
    ).toBe('Novalis');
  });

  it('leaves guarded non-transforms structurally alone', () => {
    expect(
      formatEntryTitle(
        'perfectionism, in moral and political philosophy',
        href('perfectionism-moral')
      )
    ).toBe('Perfectionism, in Moral and Political Philosophy');
    expect(
      formatEntryTitle(
        'British, in the 18th century',
        href('aesthetics-18th-british')
      )
    ).toBe('British, in the 18th Century');
  });
});

describe('filterEntries search text', () => {
  it('still matches bracket aliases in the raw TOC title', () => {
    const entries: EntryIndexItem[] = [
      {
        title: 'Abelard [Abailard], Peter',
        href: href('abelard'),
      },
      {
        title: 'social minimum [basic income]',
        href: href('social-minimum'),
      },
    ];

    expect(filterEntries(entries, 'abailard').map((e) => e.href)).toEqual([
      href('abelard'),
    ]);
    expect(filterEntries(entries, 'basic income').map((e) => e.href)).toEqual([
      href('social-minimum'),
    ]);
    // Display is sanitized; search key is not
    expect(formatEntryTitle(entries[0]!.title, entries[0]!.href)).toBe(
      'Peter Abelard'
    );
  });
});
