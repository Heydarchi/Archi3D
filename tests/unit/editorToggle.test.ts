import { describe, expect, it } from 'vitest';
import { startsHidden } from '../../src/app/editorToggle';

describe('editor toggle', () => {
  it('?editor=0 starts with the editor hidden', () => {
    expect(startsHidden('?editor=0')).toBe(true);
    expect(startsHidden('?fixture=tiny&editor=off')).toBe(true);
    expect(startsHidden('')).toBe(false);
    expect(startsHidden('?editor=1')).toBe(false);
  });
});
