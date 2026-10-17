import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures');
export const fixture = (name: string): string => readFileSync(join(fixturesDir, name), 'utf8');
/** Hand-written valid fixtures (generated gen-* models are tested in scale.test.ts). */
export const validFixtures = (): string[] =>
  readdirSync(fixturesDir).filter((f) => f.endsWith('.arch') && !f.startsWith('gen-')).sort();
export const expectedErrors = (): Record<string, { code: string; line: number }[]> =>
  JSON.parse(fixture('errors/expected.json'));
