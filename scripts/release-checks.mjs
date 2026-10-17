// Checks before releasing the VS Code extension. Pure functions, unit-tested.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const PLACEHOLDER_PUBLISHER = 'archi3d-local';

/** A Marketplace publisher ID: letters, digits and hyphens, no spaces (not the display name). */
export function publisherIdProblem(id) {
  if (!id) return 'missing, add --publisher <id>';
  if (/\s/.test(id)) return `"${id}" has spaces: that looks like the display name; the ID is the short name in marketplace.visualstudio.com/manage/publishers/<id>`;
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(id)) return `"${id}" may only contain letters, digits and hyphens`;
  if (id === PLACEHOLDER_PUBLISHER) return 'still the placeholder publisher';
  return null;
}

/** Everything that must be true before `vsce publish`. Returns a list of problems (empty = ready). */
export function releaseProblems(extDir) {
  const problems = [];
  const m = JSON.parse(readFileSync(join(extDir, 'package.json'), 'utf8'));
  const pub = publisherIdProblem(m.publisher);
  if (pub) problems.push(`publisher: ${pub}`);
  if (!/^\d+\.\d+\.\d+$/.test(m.version)) problems.push(`version "${m.version}" is not x.y.z`);
  const changelog = existsSync(join(extDir, 'CHANGELOG.md')) ? readFileSync(join(extDir, 'CHANGELOG.md'), 'utf8') : '';
  if (!new RegExp(`^## ${m.version.replace(/\./g, '\\.')}\\b`, 'm').test(changelog)) problems.push(`CHANGELOG.md has no "## ${m.version}" entry`);
  for (const f of ['README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', m.icon ?? 'icon.png']) {
    if (!existsSync(join(extDir, f))) problems.push(`${f} is missing`);
  }
  const icon = join(extDir, m.icon ?? 'icon.png');
  if (existsSync(icon)) {
    const b = readFileSync(icon);
    const [w, h] = [b.readUInt32BE(16), b.readUInt32BE(20)];
    if (b.toString('ascii', 1, 4) !== 'PNG' || w < 128 || h < 128) problems.push('icon must be a PNG of at least 128×128');
  }
  for (const img of readFileSync(join(extDir, 'README.md'), 'utf8').matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
    if (!/^https?:/.test(img[1]) && !existsSync(join(extDir, img[1]))) problems.push(`README image ${img[1]} is missing`);
  }
  if (!m.repository?.url) problems.push('repository URL is missing');
  if (m.license !== 'MIT') problems.push(`licence is "${m.license}", expected MIT`);
  return problems;
}
