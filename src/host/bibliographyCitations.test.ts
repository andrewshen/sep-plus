/**
 * @vitest-environment happy-dom
 * @vitest-environment-options {"url":"https://plato.stanford.edu/entries/example/"}
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTextProjection } from './annotationAnchors';
import {
  buildPhilPapersSearchUrl,
  collectBibliographyEntries,
  findBibliographyCitationMatches,
  initBibliographyCitations,
  type BibliographyCitationController,
  type BibliographyCitationControllerOptions,
} from './bibliographyCitations';

const controllers: BibliographyCitationController[] = [];

function setDocument(prose: string, bibliography: string): void {
  document.documentElement.innerHTML = `
    <head></head>
    <body>
      <article id="article">
        <div id="article-content">
          ${prose}
          <div id="bibliography">
            <h2 id="Bib">Bibliography</h2>
            ${bibliography}
          </div>
        </div>
      </article>
    </body>
  `;
}

function mockMatchMedia(hover = false): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string): MediaQueryList => ({
      matches: query.includes('hover: hover') ? hover : false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

function initialize(
  onActiveChange?: BibliographyCitationControllerOptions['onActiveChange'],
): BibliographyCitationController {
  const controller = initBibliographyCitations({
    document,
    window,
    onActiveChange,
  });
  controllers.push(controller);
  return controller;
}

function triggerAt(index = 0): HTMLElement {
  const trigger = document.querySelectorAll<HTMLElement>(
    '[data-sep-plus-bibliography-citation]',
  )[index];
  if (!trigger) {
    throw new Error(`Missing bibliography trigger ${index}`);
  }
  return trigger;
}

beforeEach(() => {
  mockMatchMedia();
});

afterEach(() => {
  for (const controller of controllers.splice(0).reverse()) {
    controller.cleanup();
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.documentElement.innerHTML = '<head></head><body></body>';
});

describe('bibliography indexing', () => {
  it('inherits repeated authors in the Hume bibliography format', () => {
    setDocument(
      '<p>(Garrett 1997; Baxter 2011)</p>',
      `
        <h3 id="SecoSour">Secondary Sources</h3>
        <ul class="hanging">
          <li>Baxter, D., 1998, “Hume’s Labyrinth.”</li>
          <li>–––, 2011, “Hume, Distinctions of Reason.”</li>
          <li>Garrett, D., 1981, “Hume’s Self-Doubts.”</li>
          <li>–––, 1997, <em>Cognition and Commitment</em>.</li>
        </ul>
      `,
    );

    const index = collectBibliographyEntries(document);

    expect(
      index.entries.map((entry) => [
        entry.author,
        entry.year,
        entry.section,
      ]),
    ).toEqual([
      ['Baxter', '1998', 'Secondary Sources'],
      ['Baxter', '2011', 'Secondary Sources'],
      ['Garrett', '1981', 'Secondary Sources'],
      ['Garrett', '1997', 'Secondary Sources'],
    ]);
  });

  it('normalizes multiword and Unicode surnames without treating titles as authors', () => {
    setDocument(
      '<p>(Kemp Smith 1941; De Pierris 2015; Árdal 1966)</p>',
      `
        <h3>Hume’s Works and Abbreviations Used</h3>
        <ul class="hanging">
          <li><em>A Treatise of Human Nature</em>, 1739–40, Oxford.</li>
        </ul>
        <h3>Secondary Sources</h3>
        <ul class="hanging">
          <li>Kemp Smith N., 1941, <em>The Philosophy of David Hume</em>.</li>
          <li>De Pierris, G., 2015, <em>Ideas, Evidence, and Method</em>.</li>
          <li>Árdal, P., 1966, <em>Passion and Value</em>.</li>
        </ul>
      `,
    );

    const index = collectBibliographyEntries(document);

    expect(index.entries.map((entry) => entry.author)).toEqual([
      'Kemp Smith',
      'De Pierris',
      'Árdal',
    ]);
  });

  it('builds title-year-author PhilPapers searches from books and papers', () => {
    setDocument(
      '<p>(Kitcher 2011; Audi 2012a)</p>',
      `
        <ul class="hanging">
          <li>Kitcher, Patricia, 2011, <em>Kant’s Thinker</em>, Oxford: Oxford University Press.</li>
          <li>Audi, Paul, 2012a, “Grounding: Toward a Theory of the <em>In-Virtue-Of</em> Relation”, <em>Journal of Philosophy</em>.</li>
        </ul>
      `,
    );

    const entries = collectBibliographyEntries(document).entries;

    expect(entries.map((entry) => entry.title)).toEqual([
      'Kant’s Thinker',
      'Grounding: Toward a Theory of the In-Virtue-Of Relation',
    ]);
    expect(buildPhilPapersSearchUrl(entries[0]!)).toBe(
      'https://philpapers.org/s/Kant%E2%80%99s%20Thinker%202011%20Kitcher',
    );
    expect(buildPhilPapersSearchUrl(entries[1]!)).toBe(
      'https://philpapers.org/s/Grounding%3A%20Toward%20a%20Theory%20of%20the%20In-Virtue-Of%20Relation%202012%20Audi',
    );
  });
});

describe('citation keyboard access', () => {
  it('exposes citations as buttons and moves focus into the preview on Enter', () => {
    setDocument(
      '<p>See (Kripke 1980).</p>',
      '<ul class="hanging"><li>Kripke, Saul, 1980, <em>Naming and Necessity</em>.</li></ul>',
    );
    const onFocusPreview = vi.fn();
    const changes: Array<string | null> = [];
    const controller = initBibliographyCitations({
      document,
      window,
      onActiveChange: (target) => changes.push(target?.key ?? null),
      onFocusPreview,
    });
    controllers.push(controller);
    const trigger = triggerAt();
    expect(trigger.getAttribute('role')).toBe('button');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    trigger.focus();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    trigger.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    expect(onFocusPreview).toHaveBeenCalledTimes(1);

    controller.previewFocusEnter();
    controller.returnFocus();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(changes.at(-1)).toBeNull();
  });
});

describe('citation parsing across supplied SEP formats', () => {
  it('splits Hume-style semicolon citations into independent matches', () => {
    setDocument(
      '<p>(Garrett 1997; Baxter 2011)</p>',
      `
        <ul class="hanging">
          <li>Baxter, D., 1998, “Earlier.”</li>
          <li>–––, 2011, “Distinctions.”</li>
          <li>Garrett, D., 1981, “Earlier.”</li>
          <li>–––, 1997, <em>Cognition and Commitment</em>.</li>
        </ul>
      `,
    );
    const text = '(Garrett 1997; Baxter 2011)';
    const matches = findBibliographyCitationMatches(
      text,
      collectBibliographyEntries(document),
    );

    expect(matches.map((match) => text.slice(match.start, match.end))).toEqual([
      'Garrett 1997',
      'Baxter 2011',
    ]);
    expect(
      matches.map((match) => match.entries[0]?.element.textContent?.trim()),
    ).toEqual([
      '–––, 1997, Cognition and Commitment.',
      '–––, 2011, “Distinctions.”',
    ]);
  });

  it('links "X and Y (year)" to Y when X’s entry is a different work', () => {
    setDocument(
      '<p>Both Lewis and Kripke (1980) reject this.</p>',
      `
        <ul class="hanging">
          <li>Kripke, Saul, 1980, <em>Naming and Necessity</em>.</li>
          <li>Lewis, David, 1980, “Mad Pain and Martian Pain.”</li>
        </ul>
      `,
    );
    const text = 'Both Lewis and Kripke (1980) reject this.';
    const matches = findBibliographyCitationMatches(
      text,
      collectBibliographyEntries(document),
    );
    expect(matches.map((match) => text.slice(match.start, match.end))).toEqual([
      'Kripke (1980)',
    ]);
    expect(matches[0]?.entries[0]?.author).toBe('Kripke');
  });

  it('starts a parenthetical match at the author it resolved to', () => {
    setDocument(
      '<p>Some agree (Lewis and Kripke 1980).</p>',
      `
        <ul class="hanging">
          <li>Kripke, Saul, 1980, <em>Naming and Necessity</em>.</li>
          <li>Lewis, David, 1986, <em>Plurality</em>.</li>
        </ul>
      `,
    );
    const text = 'Some agree (Lewis and Kripke 1980).';
    const matches = findBibliographyCitationMatches(
      text,
      collectBibliographyEntries(document),
    );
    expect(matches.map((match) => text.slice(match.start, match.end))).toEqual([
      'Kripke 1980',
    ]);
  });

  it('keeps trying later authors after an unresolved narrative match', () => {
    setDocument(
      '<p>As Lewis and Kripke (1980) argue.</p>',
      `
        <ul class="hanging">
          <li>Kripke, Saul, 1980, <em>Naming and Necessity</em>.</li>
          <li>Lewis, David, 1986, <em>Plurality</em>.</li>
        </ul>
      `,
    );
    const text = 'As Lewis and Kripke (1980) argue.';
    const matches = findBibliographyCitationMatches(
      text,
      collectBibliographyEntries(document),
    );
    expect(matches[0]?.entries[0]?.author).toBe('Kripke');
  });

  it('links co-authored citations to the first author’s joint entry', () => {
    setDocument(
      '<p>See Heck and May (2006) and (Heck &amp; May 2011).</p>',
      `
        <ul class="hanging">
          <li>Heck, R., and R. May, 2006, “Frege’s Contribution.”</li>
          <li>–––, 2011, “The Composition of Thoughts.”</li>
          <li>May, R., 2006, “The Invariance of Sense.”</li>
        </ul>
      `,
    );
    const text = 'See Heck and May (2006) and (Heck & May 2011).';
    const matches = findBibliographyCitationMatches(
      text,
      collectBibliographyEntries(document),
    );
    expect(matches.map((match) => text.slice(match.start, match.end))).toEqual([
      'Heck and May (2006)',
      'Heck & May 2011',
    ]);
    expect(matches.map((match) => match.entries[0]?.title)).toEqual([
      'Frege’s Contribution.',
      'The Composition of Thoughts.',
    ]);
  });

  it('cites the author nearest the year inside parentheses', () => {
    setDocument(
      '<p>(Kripke’s reply to Lewis 1973)</p>',
      `
        <ul class="hanging">
          <li>Kripke, Saul, 1973, “Unrelated.”</li>
          <li>Lewis, David, 1973, <em>Counterfactuals</em>.</li>
        </ul>
      `,
    );
    const text = '(Kripke’s reply to Lewis 1973)';
    const matches = findBibliographyCitationMatches(
      text,
      collectBibliographyEntries(document),
    );
    expect(matches.map((match) => text.slice(match.start, match.end))).toEqual([
      'Lewis 1973',
    ]);
    expect(matches[0]?.entries[0]?.author).toBe('Lewis');
  });

  it('labels each entry with the heading before it, nested or not', () => {
    setDocument(
      '<p>(Alpha 2001; Beta 2002)</p>',
      `
        <div><h3>Primary</h3><ul><li>Alpha, A., 2001, “One.”</li></ul></div>
        <div><h3>Secondary</h3></div>
        <ul><li>Beta, B., 2002, “Two.”</li></ul>
      `,
    );
    expect(
      collectBibliographyEntries(document).entries.map((entry) => entry.section),
    ).toEqual(['Primary', 'Secondary']);
  });

  it('groups suffixed and repeated years in the Grounding format', () => {
    setDocument(
      '<p>(Audi 2012a; Schaffer 2009, 2012, 2016a; Trogdon 2013a)</p>',
      `
        <ul class="hanging">
          <li>Audi, Paul, 2012a, “Grounding.”</li>
          <li>Schaffer, Jonathan, 2009, “On What Grounds What.”</li>
          <li>–––, 2012, “Grounding, Transitivity, and Contrastivity.”</li>
          <li>–––, 2016a, “Grounding in the Image of Causation.”</li>
          <li>Trogdon, Kelly, 2013a, “An Introduction to Grounding.”</li>
        </ul>
      `,
    );
    const text =
      '(Audi 2012a; Schaffer 2009, 2012, 2016a; Trogdon 2013a)';
    const matches = findBibliographyCitationMatches(
      text,
      collectBibliographyEntries(document),
    );

    expect(matches.map((match) => text.slice(match.start, match.end))).toEqual([
      'Audi 2012a',
      'Schaffer 2009, 2012, 2016a',
      'Trogdon 2013a',
    ]);
    expect(matches[1]?.entries.map((entry) => entry.year)).toEqual([
      '2009',
      '2012',
      '2016a',
    ]);
  });

  it('maps Possible Worlds narrative citations with long year lists', () => {
    setDocument(
      '<p>D. M. Armstrong (1978a, 1978b, 1986a, 1989, 1997, 2004b, 2004c)</p>',
      `
        <ul class="hanging">
          <li>Armstrong, D. M., 1978a, <i>Universals I</i>.</li>
          <li>–––, 1978b, <i>Universals II</i>.</li>
          <li>–––, 1986a, “The Nature of Possibility.”</li>
          <li>–––, 1989, <i>A Combinatorial Theory</i>.</li>
          <li>–––, 1997, <i>A World of States of Affairs</i>.</li>
          <li>–––, 2004b, “Combinatorialism Revisited.”</li>
          <li>–––, 2004c, <i>Truth and Truthmakers</i>.</li>
        </ul>
      `,
    );
    const text =
      'D. M. Armstrong (1978a, 1978b, 1986a, 1989, 1997, 2004b, 2004c)';
    const matches = findBibliographyCitationMatches(
      text,
      collectBibliographyEntries(document),
    );

    expect(matches).toHaveLength(1);
    expect(text.slice(matches[0]?.start, matches[0]?.end)).toBe(
      'Armstrong (1978a, 1978b, 1986a, 1989, 1997, 2004b, 2004c)',
    );
    expect(matches[0]?.entries).toHaveLength(7);
  });

  it('maps Rawls narrative and comma-separated secondary sources', () => {
    setDocument(
      '<p>Freeman (2007) surveys the theory (Kim 2019, Töns 2021).</p>',
      `
        <h3>Works by Rawls Cited in this Entry</h3>
        <table><tbody><tr><td>1993</td><td><em>Political Liberalism</em> [<em>PL</em>].</td></tr></tbody></table>
        <h3>Secondary Sources</h3>
        <ul class="hanging">
          <li>Freeman, S. (ed.), 2003, <em>The Cambridge Companion</em>.</li>
          <li>–––, 2007, <em>Rawls</em>.</li>
          <li>Kim, H., 2019, “Climate Change.”</li>
          <li>Töns, J., 2021, <em>Environmental Justice</em>.</li>
        </ul>
      `,
    );
    const text =
      'Freeman (2007) surveys the theory (Kim 2019, Töns 2021).';
    const matches = findBibliographyCitationMatches(
      text,
      collectBibliographyEntries(document),
    );

    expect(matches.map((match) => text.slice(match.start, match.end))).toEqual([
      'Freeman (2007)',
      'Kim 2019',
      'Töns 2021',
    ]);
  });

  it('accepts optional commas and ignores locators when resolving', () => {
    setDocument(
      '<p>(Garrett, 1997, 36; Mills 2017, chs. 8 and 9)</p>',
      `
        <ul class="hanging">
          <li>Garrett, D., 1997, <em>Cognition and Commitment</em>.</li>
          <li>Mills, C., 2017, <em>Black Rights/White Wrongs</em>.</li>
        </ul>
      `,
    );
    const text = '(Garrett, 1997, 36; Mills 2017, chs. 8 and 9)';
    const matches = findBibliographyCitationMatches(
      text,
      collectBibliographyEntries(document),
    );

    expect(matches.map((match) => text.slice(match.start, match.end))).toEqual([
      'Garrett, 1997',
      'Mills 2017',
    ]);
  });

  it('uses the first listed author for multi-author and et al. citations', () => {
    setDocument(
      '<p>(Duncan, Miller, & Norton 2017; Chalmers et al. 2009)</p>',
      `
        <ul class="hanging">
          <li>Duncan, Michael, Kristie Miller, and James Norton, 2017, “Hyperintensionality.”</li>
          <li>Chalmers, David, David Manley, and Ryan Wasserman (eds.), 2009, <em>Metametaphysics</em>.</li>
        </ul>
      `,
    );
    const text = '(Duncan, Miller, & Norton 2017; Chalmers et al. 2009)';
    const matches = findBibliographyCitationMatches(
      text,
      collectBibliographyEntries(document),
    );

    expect(matches.map((match) => text.slice(match.start, match.end))).toEqual([
      'Duncan, Miller, & Norton 2017',
      'Chalmers et al. 2009',
    ]);
  });

  it('leaves ambiguous, date-only, shorthand, and title-only forms untouched', () => {
    setDocument(
      '<p>(Garrett 1997); (1711–1776); T3.2.2.10; Political Liberalism (1993)</p>',
      `
        <ul class="hanging">
          <li>Garrett, D., 1997, <em>First Work</em>.</li>
          <li>Garrett, E., 1997, <em>Second Work</em>.</li>
        </ul>
      `,
    );
    const text =
      '(Garrett 1997); (1711–1776); T3.2.2.10; Political Liberalism (1993)';

    expect(
      findBibliographyCitationMatches(
        text,
        collectBibliographyEntries(document),
      ),
    ).toEqual([]);
  });
});

describe('citation DOM linking and cleanup', () => {
  it('preserves article text, annotation projection, and harmless inline markup', () => {
    setDocument(
      '<p id="target">(Gar<em>rett</em> 1997; Baxter 2011)</p>',
      `
        <h3>Secondary Sources</h3>
        <ul class="hanging">
          <li>Baxter, D., 1998, “Earlier.”</li>
          <li>–––, 2011, “Distinctions.”</li>
          <li>Garrett, D., 1981, “Earlier.”</li>
          <li>–––, 1997, <em>Cognition and Commitment</em>.</li>
        </ul>
      `,
    );
    const article = document.getElementById('article-content');
    if (!article) {
      throw new Error('Missing article fixture');
    }
    const textBefore = article.textContent;
    const projectionBefore = buildTextProjection(article).text;

    const controller = initialize();
    const triggers = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-sep-plus-bibliography-citation]',
      ),
    );

    expect(triggers.map((trigger) => trigger.textContent)).toEqual([
      'Garrett 1997',
      'Baxter 2011',
    ]);
    expect(triggers[0]?.querySelector('em')?.textContent).toBe('rett');
    expect(triggers.every((trigger) => trigger.tabIndex === 0)).toBe(true);
    expect(article.textContent).toBe(textBefore);
    expect(buildTextProjection(article).text).toBe(projectionBefore);
    expect(
      document.querySelectorAll('[data-sep-plus-bibliography-entry-id]'),
    ).toHaveLength(2);

    controller.cleanup();

    expect(document.querySelector('[data-sep-plus-bibliography-citation]')).toBeNull();
    expect(
      document.querySelector('[data-sep-plus-bibliography-entry-id]'),
    ).toBeNull();
    expect(article.textContent).toBe(textBefore);
    expect(buildTextProjection(article).text).toBe(projectionBefore);
    expect(document.querySelector('#target em')?.textContent).toBe('rett');
  });

  it('does not wrap existing links, footnotes, or bibliography entries', () => {
    setDocument(
      `
        <p>(Garrett 1997)</p>
        <p><a href="/source">(Garrett 1997)</a></p>
        <p><sup>(Garrett 1997)</sup></p>
      `,
      `
        <ul class="hanging">
          <li>Garrett, D., 1997, <em>Cognition and Commitment</em>.</li>
        </ul>
      `,
    );

    initialize();

    expect(
      document.querySelectorAll('[data-sep-plus-bibliography-citation]'),
    ).toHaveLength(1);
    expect(document.querySelector('a [data-sep-plus-bibliography-citation]')).toBeNull();
    expect(
      document.querySelector('sup [data-sep-plus-bibliography-citation]'),
    ).toBeNull();
    expect(
      document.querySelector(
        '#bibliography [data-sep-plus-bibliography-citation]',
      ),
    ).toBeNull();
  });

  it('reinitializes without duplicate wrappers and keeps cleanup ownership', () => {
    setDocument(
      '<p>(Garrett 1997)</p>',
      `
        <ul class="hanging">
          <li>Garrett, D., 1997, <em>Cognition and Commitment</em>.</li>
        </ul>
      `,
    );

    const first = initialize();
    const second = initialize();

    expect(
      document.querySelectorAll('[data-sep-plus-bibliography-citation]'),
    ).toHaveLength(1);
    first.cleanup();
    expect(
      document.querySelectorAll('[data-sep-plus-bibliography-citation]'),
    ).toHaveLength(1);
    second.cleanup();
    expect(document.querySelector('[data-sep-plus-bibliography-citation]')).toBeNull();
  });
});

describe('citation preview interaction controller', () => {
  function interactionFixture(): void {
    setDocument(
      '<p>(Garrett 1997)</p>',
      `
        <ul class="hanging">
          <li>Garrett, D., 1997, <em>Cognition and Commitment</em>.</li>
        </ul>
      `,
    );
  }

  it('opens on fine hover and lets the pointer cross into the preview', () => {
    mockMatchMedia(true);
    interactionFixture();
    const onActive = vi.fn();
    const controller = initialize(onActive);
    const trigger = triggerAt();

    trigger.dispatchEvent(
      new PointerEvent('pointerover', {
        bubbles: true,
        pointerType: 'mouse',
      }),
    );
    expect(onActive.mock.calls.at(-1)?.[0]?.entries[0]?.year).toBe('1997');

    vi.useFakeTimers();
    trigger.dispatchEvent(
      new PointerEvent('pointerout', {
        bubbles: true,
        pointerType: 'mouse',
      }),
    );
    controller.previewPointerEnter();
    vi.advanceTimersByTime(80);
    expect(onActive.mock.calls.at(-1)?.[0]).not.toBeNull();

    controller.previewPointerLeave();
    vi.advanceTimersByTime(80);
    expect(onActive.mock.calls.at(-1)?.[0]).toBeNull();
  });

  it('suppresses touch hover and pointer-origin focus', () => {
    mockMatchMedia(true);
    interactionFixture();
    const onActive = vi.fn();
    initialize(onActive);
    const trigger = triggerAt();

    trigger.dispatchEvent(
      new PointerEvent('pointerover', {
        bubbles: true,
        pointerType: 'touch',
      }),
    );
    expect(onActive).not.toHaveBeenCalled();

    trigger.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        pointerType: 'touch',
      }),
    );
    trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(onActive).not.toHaveBeenCalled();
  });

  it('opens on keyboard focus and closes with Escape', () => {
    interactionFixture();
    const onActive = vi.fn();
    initialize(onActive);
    const trigger = triggerAt();

    trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(onActive.mock.calls.at(-1)?.[0]).not.toBeNull();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(onActive.mock.calls.at(-1)?.[0]).toBeNull();
  });

  it('dismisses on outside pointerdown without handling citation clicks', () => {
    mockMatchMedia(true);
    interactionFixture();
    const onActive = vi.fn();
    initialize(onActive);
    const trigger = triggerAt();
    trigger.dispatchEvent(
      new PointerEvent('pointerover', {
        bubbles: true,
        pointerType: 'mouse',
      }),
    );

    const click = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    expect(trigger.dispatchEvent(click)).toBe(true);
    expect(click.defaultPrevented).toBe(false);
    expect(onActive.mock.calls.at(-1)?.[0]).not.toBeNull();

    document.body.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        pointerType: 'mouse',
      }),
    );
    expect(onActive.mock.calls.at(-1)?.[0]).toBeNull();
  });

  it('recomputes active geometry on viewport changes', () => {
    mockMatchMedia(true);
    interactionFixture();
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const onActive = vi.fn();
    initialize(onActive);
    const trigger = triggerAt();
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(10, 20, 120, 18),
    );
    trigger.dispatchEvent(
      new PointerEvent('pointerover', {
        bubbles: true,
        pointerType: 'mouse',
      }),
    );
    const callsBeforeResize = onActive.mock.calls.length;

    window.dispatchEvent(new Event('resize'));
    frames.at(-1)?.(0);

    expect(onActive).toHaveBeenCalledTimes(callsBeforeResize + 1);
    expect(onActive.mock.calls.at(-1)?.[0]?.rect).toMatchObject({
      top: 20,
      left: 10,
      width: 120,
      height: 18,
    });
  });
});
