import { describe, expect, it } from 'vitest';
import { formatEntryTitle } from './formatEntryTitle';

function href(slug: string): string {
  return `https://plato.stanford.edu/entries/${slug}/`;
}

function format(title: string, slug = 'x'): string {
  return formatEntryTitle(title, href(slug));
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

  it('inverts any comma tail ending in a preposition', () => {
    expect(format('belief, formal representations of')).toBe(
      'Formal Representations of Belief'
    );
    expect(format('children, philosophy for')).toBe('Philosophy for Children');
    expect(format('Christian theology, philosophy and')).toBe(
      'Philosophy and Christian Theology'
    );
    expect(format('Early Modern India, analytic philosophy in')).toBe(
      'Analytic Philosophy in Early Modern India'
    );
    expect(format('choice, axiom of')).toBe('The Axiom of Choice');
    expect(format('knowledge, value of')).toBe('The Value of Knowledge');
    expect(format('double effect, doctrine of')).toBe('Doctrine of Double Effect');
  });

  it('drops commas that only separate a trailing article or phrase', () => {
    expect(format('Sophists, The')).toBe('The Sophists');
    expect(format('repugnant conclusion, the')).toBe('The Repugnant Conclusion');
    expect(format('perfectionism, in moral and political philosophy')).toBe(
      'Perfectionism in Moral and Political Philosophy'
    );
    expect(format('underdetermination, of scientific theories')).toBe(
      'Underdetermination of Scientific Theories'
    );
    expect(format('social procedures, formal approaches')).toBe(
      'Formal Approaches to Social Procedures'
    );
  });

  it('fronts single-token adjectives (#4)', () => {
    expect(
      formatEntryTitle('bias, implicit', href('implicit-bias'))
    ).toBe('Implicit Bias');
    expect(
      formatEntryTitle('character, moral', href('moral-character'))
    ).toBe('Moral Character');
    expect(format('Marxism, analytical')).toBe('Analytical Marxism');
    expect(format('reparations, Black')).toBe('Black Reparations');
    expect(format('rationalism, early modern')).toBe('Early Modern Rationalism');
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
    expect(format('Aristotle, General Topics: logic')).toBe('Aristotle’s Logic');
    expect(format('Aquinas, Thomas: moral, political, and legal philosophy')).toBe(
      'Aquinas’ Moral, Political, and Legal Philosophy'
    );
  });

  it('never forms possessives for schools, traditions, or works', () => {
    expect(format('Chinese Philosophy: Mohism')).toBe('Chinese Philosophy: Mohism');
    expect(format('Japanese Philosophy: Kūkai')).toBe('Japanese Philosophy: Kūkai');
    expect(format('Chinese Philosophy: legalism in')).toBe(
      'Legalism in Chinese Philosophy'
    );
    expect(format('Principia Mathematica: notation in')).toBe(
      'Notation in Principia Mathematica'
    );
    expect(format('God, arguments for the existence of: moral arguments')).toBe(
      'Arguments for the Existence of God: Moral Arguments'
    );
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
    expect(format('Hume, David: on free will')).toBe('Hume on Free Will');
    expect(format('freedom: of speech')).toBe('Freedom of Speech');
    expect(format('folk psychology: as a theory')).toBe('Folk Psychology as a Theory');
    expect(
      format(
        'Condorcet, Marie-Jean-Antoine-Nicolas de Caritat, Marquis de: in the history of feminism'
      )
    ).toBe('Condorcet in the History of Feminism');
  });

  it('inverts colon tails ending in a preposition', () => {
    expect(format('truth: coherence theory of')).toBe(
      'The Coherence Theory of Truth'
    );
    expect(format('causation: medieval theories of')).toBe(
      'Medieval Theories of Causation'
    );
    expect(format('justification, epistemic: foundationalist theories of')).toBe(
      'Foundationalist Theories of Epistemic Justification'
    );
    expect(
      format('mathematics, philosophy of: indispensability arguments in the')
    ).toBe('Indispensability Arguments in the Philosophy of Mathematics');
    expect(format('music: history of western philosophy of, antiquity to 1800')).toBe(
      'History of Western Philosophy of Music: Antiquity to 1800'
    );
  });

  it('reorders lowercase topic: qualifier when safe', () => {
    expect(
      formatEntryTitle('agency: shared', href('shared-agency'))
    ).toBe('Shared Agency');
    expect(format('logic: fuzzy')).toBe('Fuzzy Logic');
    expect(format('ethics: virtue')).toBe('Virtue Ethics');
    expect(format('semantics: Montague')).toBe('Montague Semantics');
    expect(format('logical atomism: Russell’s')).toBe('Russell’s Logical Atomism');
    expect(format('liberty: positive and negative')).toBe(
      'Positive and Negative Liberty'
    );
    expect(
      formatEntryTitle('animal: cognition', href('cognition-animal'))
    ).toBe('Animal Cognition');
    // Head-first nouns and prepositional heads keep the colon
    expect(format('logic: action')).toBe('Logic: Action');
    expect(format('set theory: early development')).toBe(
      'Set Theory: Early Development'
    );
    expect(format('reasons for action: internal vs. external')).toBe(
      'Reasons for Action: Internal vs. External'
    );
  });

  it('drops a parent the tail already names', () => {
    expect(format('quantum theory: quantum gravity')).toBe('Quantum Gravity');
    expect(format('aesthetics: aesthetic judgment')).toBe('Aesthetic Judgment');
    expect(format('Zeno of Elea: Zeno’s paradoxes')).toBe('Zeno’s Paradoxes');
    // `history of logic: modal logic` is not the `logic: modal` entry
    expect(format('logic, history of: modal logic')).toBe(
      'History of Logic: Modal Logic'
    );
    expect(format('Chinese Philosophy: Chinese medicine')).toBe(
      'Chinese Philosophy: Chinese Medicine'
    );
  });

  it('folds TOC category labels into the title', () => {
    expect(format('feminist philosophy, topics: perspectives on disability')).toBe(
      'Feminist Perspectives on Disability'
    );
    expect(format('feminist philosophy, interventions: liberal feminism')).toBe(
      'Liberal Feminism'
    );
    expect(
      format('Arabic and Islamic Philosophy, special topics in: mysticism')
    ).toBe('Mysticism in Arabic and Islamic Philosophy');
    expect(
      format('mathematics, philosophy of: nominalism')
    ).toBe('Nominalism in the Philosophy of Mathematics');
  });

  it('uses small-word title case (#7)', () => {
    expect(
      formatEntryTitle('philosophy of chemistry', href('chemistry'))
    ).toBe('Philosophy of Chemistry');
    expect(format('prediction versus accommodation')).toBe(
      'Prediction versus Accommodation'
    );
    expect(format('analytic/synthetic distinction')).toBe(
      'Analytic/Synthetic Distinction'
    );
  });

  it('keeps source capitals in names and acronyms', () => {
    expect(format('McTaggart, John M. E.')).toBe('John M. E. McTaggart');
    expect(format('Du Bois, W.E.B.')).toBe('W.E.B. Du Bois');
    expect(format('Quine, Willard Van Orman')).toBe('Willard Van Orman Quine');
    expect(format('Ortega y Gasset, José')).toBe('José Ortega y Gasset');
    expect(format('set theory: constructive and intuitionistic ZF')).toBe(
      'Set Theory: Constructive and Intuitionistic ZF'
    );
    expect(format('neo-Kantianism')).toBe('Neo-Kantianism');
    expect(format('al-Qudat, ʿAyn')).toBe('ʿAyn al-Qudat');
    expect(format('al-Baghdadi, ‘Abd al-Latif')).toBe('‘Abd al-Latif al-Baghdadi');
    expect(format('Holbach, Paul-Henri Thiry (Baron) d’')).toBe(
      'Paul-Henri Thiry (Baron) d’Holbach'
    );
  });

  it('does not invert epithets as given names', () => {
    expect(format('Elisabeth, Princess of Bohemia')).toBe(
      'Elisabeth, Princess of Bohemia'
    );
  });

  it('honors display overrides', () => {
    expect(
      formatEntryTitle('Ockham [Occam], William', href('ockham'))
    ).toBe('William of Ockham');
    expect(
      formatEntryTitle(
        'Peter of Spain [= Petrus Hispanus]',
        href('peter-spain')
      )
    ).toBe('Peter of Spain');
    expect(format('George, Eliot', 'george-eliot')).toBe('George Eliot');
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
        'British, in the 18th century',
        href('aesthetics-18th-british')
      )
    ).toBe('British, in the 18th Century');
    expect(format('ontology, natural language')).toBe('Ontology, Natural Language');
  });

  it('passes already-clean titles through unchanged', () => {
    for (const title of [
      'Kant’s Transcendental Arguments',
      'The Cambridge Platonists',
      'Darwin: From the Origin of Species to the Descent of Man',
      'Atomism from the 17th to the 20th Century',
      'History of Western Philosophy of Music: since 1800',
      'Realism and Anti-Realism about Metaphysics',
      'Games, Full Abstraction and Full Completeness',
      'Plato’s Ethics: An Overview',
    ]) {
      expect(format(title)).toBe(title);
    }
    expect(format('The Logic of Peter of Spain', 'peter-spain')).toBe(
      'The Logic of Peter of Spain'
    );
  });
});
