import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error - plain .mjs script without types
import { PLACEHOLDER_PUBLISHER, publisherIdProblem, releaseProblems } from '../../scripts/release-checks.mjs';

const root = join(import.meta.dirname, '..', '..');

describe('publisher ID', () => {
  it('accepts IDs and explains display names', () => {
    expect(publisherIdProblem('heydarchi')).toBeNull();
    expect(publisherIdProblem('Mohammad-Heydarchi2')).toBeNull();
    expect(publisherIdProblem('Mohammad Hossein Heydarchi')).toMatch(/display name/);
    expect(publisherIdProblem('a.b')).toMatch(/letters, digits and hyphens/);
    expect(publisherIdProblem(PLACEHOLDER_PUBLISHER)).toMatch(/placeholder/);
    expect(publisherIdProblem(undefined)).toMatch(/missing/);
  });
});

describe('release checks', () => {
  const copy = join(root, 'test-results', 'release-check');
  const fresh = () => {
    rmSync(copy, { recursive: true, force: true });
    mkdirSync(copy, { recursive: true });
    for (const f of ['package.json', 'README.md', 'CHANGELOG.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'icon.png', 'images']) cpSync(join(root, 'vscode', f), join(copy, f), { recursive: true });
    return copy;
  };
  const setManifest = (patch: Record<string, unknown>) => {
    const f = join(copy, 'package.json');
    writeFileSync(f, JSON.stringify({ ...JSON.parse(readFileSync(f, 'utf8')), ...patch }));
  };

  it('the extension is ready except for the publisher ID', () => {
    const problems: string[] = releaseProblems(fresh());
    expect(problems.filter((p) => !p.startsWith('publisher:'))).toEqual([]);
  });
  it('passes with a real publisher ID', () => {
    fresh();
    setManifest({ publisher: 'heydarchi' });
    expect(releaseProblems(copy)).toEqual([]);
  });
  it('catches a version without a changelog entry and a missing icon', () => {
    fresh();
    setManifest({ publisher: 'heydarchi', version: '9.9.0' });
    rmSync(join(copy, 'icon.png'));
    expect(releaseProblems(copy)).toEqual(['CHANGELOG.md has no "## 9.9.0" entry', 'icon.png is missing']);
  });
});
