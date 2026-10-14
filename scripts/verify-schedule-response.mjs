// Start scripts/preview-portal-usability.mjs first. Fictional localhost data only.
// PORTAL_AUDIT_PLAYWRIGHT may point to an installed Playwright module;
// PORTAL_AUDIT_CHROME optionally selects a local Chrome executable.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PORTAL_AUDIT_PLAYWRIGHT;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PORTAL_AUDIT_CHROME ? { executablePath: process.env.PORTAL_AUDIT_CHROME } : {}),
});
const results = [];
try {
  for (const width of [390, 768, 1440]) for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: theme, hasTouch: width === 390 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      // The fixture intentionally leaves unrelated resources unavailable.
      if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(message.text());
    });
    await page.goto('http://127.0.0.1:4181/portal-audit.html?page=scheduling&display=portal');
    await page.getByRole('button', { name: 'Refresh schedule', exact: true }).waitFor();
    assert.equal(await page.locator('.scheduler').count(), 1, 'Only the current schedule screen remains');
    const navigate = async name => {
      if (width >= 1000 && await page.locator('.desktop-sidebar-toggle').getAttribute('aria-expanded') === 'false') {
        await page.locator('.desktop-sidebar-toggle').click();
      }
      await page.getByRole('navigation', { name: width < 1000 ? 'Primary mobile navigation' : 'Primary navigation' })
        .getByRole('button', { name, exact: true }).click();
    };
    for (let pass = 0; pass < 3; pass++) {
      await navigate('Response');
      await page.getByText('Ready — no active incident', { exact: true }).waitFor();
      assert.equal(await page.locator('.scheduler').count(), 0, 'Response removes Schedule');
      await navigate('Schedule');
      await page.getByRole('button', { name: 'Refresh schedule', exact: true }).waitFor();
      assert.equal(await page.getByText('Ready — no active incident', { exact: true }).count(), 0, 'Schedule removes Response');
    }
    await page.getByRole('navigation', { name: 'Scheduling tasks' }).getByRole('button', { name: 'Calendar', exact: true }).click();
    const scope = page.getByRole('group', { name: 'Show on calendar', exact: true });
    await scope.getByRole('button', { name: 'All scheduled', exact: true }).click();
    const times = page.getByRole('group', { name: 'Show calendar times', exact: true });
    for (const name of ['All times', 'Morning', 'Noon', 'Night']) {
      await times.getByRole('button', { name, exact: name === 'All times' }).click();
      assert.equal(await times.count(), 1, 'Calendar changes do not duplicate controls');
      assert.equal(await times.getByRole('button', { name, exact: name === 'All times' }).getAttribute('aria-pressed'), 'true');
    }
    await navigate('Response');
    await page.getByText('Ready — no active incident', { exact: true }).waitFor();
    await navigate('Schedule');
    await page.getByRole('button', { name: 'Refresh schedule', exact: true }).waitFor();
    assert.equal(await times.getByRole('button', { name: 'Night' }).getAttribute('aria-pressed'), 'true', 'Time choice survives navigation');
    assert.equal(await scope.getByRole('button', { name: 'All scheduled', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => window.portalAudit.writes()), 0, 'Navigation never writes records');
    assert.deepEqual(errors, [], 'No browser errors or duplicate React keys');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'No page overflow');
    results.push({ width, theme, passed: true });
    await page.close();
  }
  console.log(`${results.length} schedule, calendar and Response checks passed.`);
} finally {
  mkdirSync('outputs/schedule-response-navigation', { recursive: true });
  writeFileSync('outputs/schedule-response-navigation/results.json', JSON.stringify(results, null, 2));
  await browser.close();
}
