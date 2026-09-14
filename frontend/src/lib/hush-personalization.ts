export type HushPhraseRuleKind = 'dictionary' | 'snippet';

export interface HushPhraseRule {
  id: string;
  kind: HushPhraseRuleKind;
  trigger: string;
  replacement: string;
}

export const HUSH_PHRASE_RULES_KEY = 'hush-phrase-rules';

export function readPhraseRules(): HushPhraseRule[] {
  if (typeof window === 'undefined') return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(HUSH_PHRASE_RULES_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((rule): rule is HushPhraseRule => (
      typeof rule === 'object'
      && rule !== null
      && typeof rule.id === 'string'
      && (rule.kind === 'dictionary' || rule.kind === 'snippet')
      && typeof rule.trigger === 'string'
      && typeof rule.replacement === 'string'
      && rule.trigger.trim().length > 0
    ));
  } catch {
    return [];
  }
}

export function writePhraseRules(rules: HushPhraseRule[]): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(HUSH_PHRASE_RULES_KEY, JSON.stringify(rules));
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function applyPhraseRules(text: string, rules: HushPhraseRule[]): string {
  return [...rules]
    .sort((a, b) => b.trigger.length - a.trigger.length)
    .reduce((result, rule) => {
      const boundary = rule.kind === 'dictionary' ? '\\b' : '';
      return result.replace(
        new RegExp(`${boundary}${escapeRegExp(rule.trigger.trim())}${boundary}`, 'gi'),
        rule.replacement,
      );
    }, text);
}
