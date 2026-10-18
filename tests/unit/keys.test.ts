import { describe, expect, it } from 'vitest';
import { nextDetail } from '../../src/app/keys';

describe('detail keys', () => {
  it('+ and = give more, - less, 0 resets, other keys nothing', () => {
    expect(nextDetail('+', 1)).toBe(1.5);
    expect(nextDetail('=', 1)).toBe(1.5);
    expect(nextDetail('-', 1.5)).toBe(1);
    expect(nextDetail('0', 2.25)).toBe(1);
    expect(nextDetail('a', 1)).toBeNull();
  });
});
