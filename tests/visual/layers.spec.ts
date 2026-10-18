// Layers: top-level "layer" containers are floors stacked on top of each other (fixtures/layers.arch3d).
import { test, openHarness, snap, expect } from './fixtures';

type St = { fadedFloors: string[]; containers: Record<string, string> };
const state = (page: import('@playwright/test').Page) => page.evaluate(() => window.__archi.state!() as St);

test('layers: the overview looks at the stack low and from the side', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=layers&cam=far');
  expect((await state(page)).fadedFloors).toEqual([]);
  await snap(page, 'layers', 'layers-far');
});

test('layers: close to the middle floor, the floor above fades to outlines', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=layers&cam=focus&focus=Middle&k=1');
  expect((await state(page)).fadedFloors).toEqual(['Top']);
  await snap(page, 'layers', 'layers-focus-middle');
});

test('layers: a selected element shows its links up and down the stack', async ({ page }) => {
  await openHarness(page, 'view=scene&fixture=layers&cam=far&select=Api');
  await snap(page, 'layers', 'layers-select-api');
});
