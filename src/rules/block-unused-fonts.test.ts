import { describe, expect, it } from 'vitest';
import rules from './block-unused-fonts.json';

describe('block-unused-fonts ruleset', () => {
  it('only blocks same-origin Font Awesome stylesheets on SEP', () => {
    expect(rules).toHaveLength(1);
    const [rule] = rules;
    expect(rule?.action.type).toBe('block');
    expect(rule?.condition.initiatorDomains).toEqual(['plato.stanford.edu']);
    expect(rule?.condition.requestDomains).toEqual(['plato.stanford.edu']);
    expect(rule?.condition.urlFilter).toBe('font-awesome');
    expect(rule?.condition.resourceTypes).toEqual(['stylesheet']);
  });

  it('uses a lower priority than the per-tab restore rule', () => {
    for (const rule of rules) {
      expect((rule as { priority?: number }).priority ?? 1).toBeLessThan(2);
    }
  });

  it('gives every rule a unique id', () => {
    const ids = rules.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
