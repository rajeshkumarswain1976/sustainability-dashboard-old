import assert from 'node:assert/strict';
import { SECTORS } from '../src/data/sectorFeatures.js';

process.env.PLAYWRIGHT_BROWSERS_PATH = 'C:/Users/HP/Desktop/sustainability-dashboard/.browser-cache';
const { chromium } = await import('file:///C:/Users/HP/Desktop/sustainability-dashboard/node_modules/@playwright/test/index.mjs');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByRole('button', { name: 'Explore College features', exact: true }).waitFor({ state: 'visible', timeout: 60000 });
  await page.getByRole('dialog', { name: 'Welcome to Agenexus' }).waitFor({ state: 'hidden' });
  assert.match(await page.title(), /^Agenexus/);
  assert.equal(await page.getByRole('button', { name: /^Explore / }).count(), 28);
  if (!process.argv.includes('--mobile')) {
  await page.screenshot({ path: 'verification/agenexus-desktop.png', fullPage: false });
  for (const sector of Object.values(SECTORS)) {
    await page.getByRole('button', { name: `Explore ${sector.name} features`, exact: true }).click();
    const worldDetail = page.locator('#world-detail');
    await worldDetail.getByRole('button', { name: new RegExp(sector.name) }).getAttribute('class').then(value => assert.match(value, /is-active/));
    for (const node of sector.nodes) {
      await page.getByRole('button', { name: `Explore ${node.name}`, exact: true }).click();
      const panel = page.getByRole('complementary', { name: 'Feature details' });
      await panel.waitFor({ state: 'visible' });
      assert.equal(await panel.getByRole('heading', { name: node.name, exact: true }).count(), 1);
      assert.ok((await panel.innerText()).includes(node.solution));
      assert.match(await panel.innerText(), /Solution we provide:/i);
      assert.ok((await panel.innerText()).includes(sector.name));
      assert.ok(!/L4 Autonomous|Verified Telemetry|Active Agents/.test(await panel.innerText()));
      await panel.getByText(node.subskills[0].name, { exact: true }).click();
      assert.ok((await panel.innerText()).includes(node.subskills[0].detail));
      await panel.getByRole('button', { name: 'Close inspection panel (Esc)' }).click();
    }
  }
  console.log('Desktop: Agenexus title, four hubs, all 24 feature descriptions and solutions verified.');
  const feature = SECTORS.intelligence.nodes[4];
  await page.getByRole('button', { name: `Explore ${feature.name}`, exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('complementary', { name: 'Feature details' }).waitFor({ state: 'visible' });
  await page.screenshot({ path: 'verification/agenexus-feature.png', fullPage: false });
  await page.getByRole('button', { name: 'Close inspection panel (Esc)' }).click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.getByRole('button', { name: 'Explore Campus Water & Leak Alerts', exact: true }).click();
  const mobilePanel = page.getByRole('complementary', { name: 'Feature details' });
  await mobilePanel.waitFor({ state: 'visible' });
  const box = await mobilePanel.boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 391);
  await page.screenshot({ path: 'verification/agenexus-mobile.png', fullPage: false });
  await mobilePanel.getByRole('button', { name: 'Open Campus Water & Leak Alerts Dashboard', exact: true }).click();
  await page.getByRole('button', { name: 'Enter College', exact: true }).waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => sessionStorage.getItem('mindtree_active_node')), 'ag-cmp-02');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Enter College', exact: true }).click();
  await page.getByLabel('Shared campus status').waitFor({ state: 'visible', timeout: 60000 });
  assert.match(await page.locator('aside').first().innerText(), /Agenexus/);
  assert.match(await page.title(), /^Agenexus/);
  console.log('Running dashboard: demo sign-in and Agenexus branding verified.');
  assert.deepEqual(errors, []);
  console.log('Mobile: viewport fit, feature sheet, dashboard handoff and keyboard activation verified; no page errors.');
} finally {
  await browser.close();
}
