import { describe, expect, it } from 'vitest';
import { orthogonalize, simplify, snapToPorts } from '../../src/core/layout/orthogonal';

describe('orthogonal routes', () => {
  it('inserts an elbow for a sub-unit jog', () => {
    expect(orthogonalize([{ x: 155, y: 181 }, { x: 230, y: 180.5 }, { x: 317, y: 180.5 }]))
      .toEqual([{ x: 155, y: 181 }, { x: 230, y: 181 }, { x: 230, y: 180.5 }, { x: 317, y: 180.5 }]);
  });
  it('removes duplicates and collinear middle points', () => {
    expect(simplify([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }]))
      .toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }]);
  });
  it('snaps ends onto port centres', () => {
    const r = snapToPorts([{ x: 160, y: 50 }, { x: 300, y: 50 }], { x: 155, y: 50 }, { x: 305, y: 50 });
    expect(r).toEqual([{ x: 155, y: 50 }, { x: 305, y: 50 }]);
  });
  it('does not mutate its input', () => {
    const input = [{ x: 0, y: 0 }, { x: 5, y: 1 }];
    orthogonalize(input);
    expect(input).toEqual([{ x: 0, y: 0 }, { x: 5, y: 1 }]);
  });
});
