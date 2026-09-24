import { rulesSchema, type FilterRule } from '../shared/types';
export const defaultRules: FilterRule[] = [
  'sponsored',
  'banner',
  'affiliate',
  'advertisement',
  'overlay',
].map((category) => ({
  id: `default-${category}`,
  action: 'block',
  kind: 'cosmetic',
  value: `[data-promotion="${category}"]`,
  enabled: true,
}));
export interface FilterContent {
  text: string;
  url?: string;
  promotion?: string;
}
// Glob matching is bounded and does not execute user-supplied regular expressions.
export function globMatch(pattern: string, text: string): boolean {
  const p = pattern.toLowerCase(),
    t = text.toLowerCase().slice(0, 20000);
  let i = 0,
    j = 0,
    star = -1,
    mark = 0;
  while (j < t.length) {
    if (p[i] === '?' || p[i] === t[j]) {
      i++;
      j++;
    } else if (p[i] === '*') {
      star = i++;
      mark = j;
    } else if (star !== -1) {
      i = star + 1;
      j = ++mark;
    } else return false;
  }
  while (p[i] === '*') i++;
  return i === p.length;
}
export function matches(rule: FilterRule, content: FilterContent): boolean {
  if (!rule.enabled) return false;
  switch (rule.kind) {
    case 'text':
      return content.text.toLowerCase().includes(rule.value.toLowerCase());
    case 'pattern':
      return globMatch(rule.value, content.text);
    case 'domain':
      try {
        const host = new URL(content.url ?? '').hostname.toLowerCase();
        const domain = rule.value.toLowerCase();
        return host === domain || host.endsWith(`.${domain}`);
      } catch {
        return false;
      }
    case 'cosmetic':
      return rule.value === `[data-promotion="${content.promotion}"]`;
  }
}
export function isBlocked(
  content: FilterContent,
  rules: FilterRule[],
  enabled = true,
  advanced = false,
): boolean {
  if (!enabled) return false;
  const applicable = rules.filter(
    (r) => (advanced || r.kind === 'cosmetic') && matches(r, content),
  );
  return (
    !applicable.some((r) => r.action === 'allow') && applicable.some((r) => r.action === 'block')
  );
}
export function importRules(text: string): FilterRule[] {
  if (text.length > 250000) throw new Error('Filter file is too large (250 KB maximum).');
  const result = rulesSchema.safeParse(JSON.parse(text));
  if (!result.success) throw new Error(result.error.issues.map((x) => x.message).join(' '));
  return result.data;
}
export function exportRules(rules: FilterRule[]): string {
  return JSON.stringify(rulesSchema.parse(rules), null, 2);
}
