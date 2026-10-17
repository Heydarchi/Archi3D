// Own file so the ELK instance is cold for this measurement.
import { expect, it } from 'vitest';
import { parse } from '../../src/core/dsl/parse';
import { layout } from '../../src/core/layout';
import { buildModel } from '../../src/core/model/build';
import { fixture } from './helpers';

it('northwind lays out in under 1 s (first call, cold)', async () => {
  const m = buildModel(parse(fixture('northwind.arch3d')));
  const t0 = performance.now();
  await layout(m);
  const ms = performance.now() - t0;
  console.log(`northwind cold layout: ${ms.toFixed(0)} ms`);
  expect(ms).toBeLessThan(1000);
});
