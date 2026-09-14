import { describe, expect, it } from 'vitest';
import { applyPhraseRules, type HushPhraseRule } from '@/lib/hush-personalization';

describe('applyPhraseRules', () => {
  it('expands snippets and corrects dictionary phrases case-insensitively', () => {
    const rules: HushPhraseRule[] = [
      { id: '1', kind: 'snippet', trigger: ';sig', replacement: 'Best,\nHenry' },
      { id: '2', kind: 'dictionary', trigger: 'meetily', replacement: 'Hush' },
    ];

    expect(applyPhraseRules('Send it to MEETILY ;sig', rules)).toBe('Send it to Hush Best,\nHenry');
  });

  it('prefers the longest overlapping trigger', () => {
    const rules: HushPhraseRule[] = [
      { id: '1', kind: 'dictionary', trigger: 'flow', replacement: 'short' },
      { id: '2', kind: 'dictionary', trigger: 'flow bar', replacement: 'Hush bar' },
    ];

    expect(applyPhraseRules('The flow bar is ready', rules)).toBe('The Hush bar is ready');
  });
});
