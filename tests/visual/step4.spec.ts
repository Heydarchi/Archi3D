import { test, openHarness, snap } from './fixtures';

const cases: [string, string][] = [
  ['proj-nested-deep-ortho', 'fixture=nested-deep&edges=ortho'],
  ['proj-nested-deep-arc', 'fixture=nested-deep&edges=arc'],
  ['proj-northwind-gap120', 'fixture=northwind&gap=120'],
];

for (const [name, q] of cases) {
  test(name, async ({ page }) => {
    await openHarness(page, `view=proj&${q}`);
    await snap(page, 4, name);
  });
}
