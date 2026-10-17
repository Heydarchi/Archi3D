import { test, openHarness, snap } from './fixtures';

for (const mode of ['ortho', 'arc']) {
  test(`edges northwind ${mode} iso`, async ({ page }) => {
    await openHarness(page, `view=scene&fixture=northwind&cam=iso&edges=${mode}&lod=off`);
    await snap(page, 6, `edges-northwind-${mode}-iso`);
  });
}

test('app edge-mode toggle rebuilds the scene', async ({ page }) => {
  await page.goto('/index.html?test=1');
  await page.waitForFunction(() => window.__archi?.ready === true);
  await page.click('#edge-mode');
  await page.waitForFunction(() => document.getElementById('edge-mode')!.textContent === 'Edges: arc');
});
