import { describe, expect, it } from 'vitest';
import {
  defaultRules,
  exportRules,
  importRules,
  isBlocked,
  matches,
  globMatch,
} from '../src/filtering/engine';
import type { FilterRule } from '../src/shared/types';
const rule = (
  kind: FilterRule['kind'],
  value: string,
  action: FilterRule['action'] = 'block',
): FilterRule => ({ id: `${kind}-${action}`, kind, value, action, enabled: true });
describe('app-owned filtering', () => {
  it('matches exact domains and subdomains, never suffix impostors', () => {
    const r = rule('domain', 'example.com');
    expect(matches(r, { text: '', url: 'https://sub.example.com/ad' })).toBe(true);
    expect(matches(r, { text: '', url: 'https://notexample.com' })).toBe(false);
    expect(matches(r, { text: '', url: 'invalid' })).toBe(false);
  });
  it('matches text and bounded wildcards case insensitively', () => {
    expect(matches(rule('text', 'SPONSORED'), { text: 'A sponsored card' })).toBe(true);
    expect(globMatch('*promo?ion*', 'A Promotion today')).toBe(true);
    expect(globMatch('promo?ion', 'promoion')).toBe(false);
    expect(globMatch('*a'.repeat(90), 'a'.repeat(5000) + 'b')).toBe(false);
  });
  it('gives allow rules precedence and respects both switches', () => {
    const rules = [rule('text', 'ad'), rule('text', 'adventure', 'allow')];
    expect(isBlocked({ text: 'ad' }, rules, true, true)).toBe(true);
    expect(isBlocked({ text: 'adventure' }, rules, true, true)).toBe(false);
    expect(isBlocked({ text: 'ad' }, rules, true, false)).toBe(false);
    expect(isBlocked({ text: 'ad' }, rules, false, true)).toBe(false);
  });
  it('only applies cosmetic rules to declared app promotions', () => {
    expect(isBlocked({ text: '', promotion: 'sponsored' }, defaultRules)).toBe(true);
    expect(isBlocked({ text: 'YouTube player' }, defaultRules)).toBe(false);
    expect(() => importRules(JSON.stringify([rule('cosmetic', 'iframe')]))).toThrow();
    expect(() => importRules(JSON.stringify([rule('cosmetic', 'body *')]))).toThrow();
  });
  it('round trips rule files and rejects duplicate IDs and malformed data', () => {
    expect(importRules(exportRules(defaultRules))).toEqual(defaultRules);
    expect(() => importRules('not json')).toThrow();
    expect(() => importRules(JSON.stringify([defaultRules[0], defaultRules[0]]))).toThrow('unique');
    expect(() => importRules('x'.repeat(250001))).toThrow('large');
  });
});
