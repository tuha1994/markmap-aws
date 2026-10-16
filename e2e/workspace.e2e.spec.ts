import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

const publicBundleForbiddenContent = [
  'PRIVATE_MAP_DO_NOT_PUBLISH',
  'AWS_SECRET_ACCESS_KEY',
  'Synthetic confidential map body'
];

function bundleFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? bundleFiles(path) : [path];
  });
}

test('denies an unauthorized direct route without rendering private map content at 1280px', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('./');

  await expect(page.getByRole('main', { name: 'Authentication required' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByText('Synthetic confidential map body')).toHaveCount(0);
});

test('keeps the unauthorized entrypoint operable at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('./');

  await expect(page.getByRole('main', { name: 'Authentication required' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
});

test('renders a native Markmap preview and exercises its fit control', async ({ page }) => {
  await page.goto('e2e/markmap.html');

  await expect(page.getByRole('img', { name: 'Synthetic Markmap preview' })).toBeVisible();
  await expect(page.locator('.markmap-node')).toHaveCount(3);
  await page.getByRole('button', { name: 'Fit preview' }).click();
  await expect(page.getByRole('status')).toHaveText('fit');
});

test('shows a conflict in one browser page after another page writes', async ({ browser }) => {
  const context = await browser.newContext();
  const firstPage = await context.newPage();
  const secondPage = await context.newPage();

  await Promise.all([firstPage.goto('e2e/conflict.html'), secondPage.goto('e2e/conflict.html')]);
  await firstPage.getByRole('textbox', { name: 'Markdown' }).fill('# Local device draft');
  await secondPage.getByRole('textbox', { name: 'Markdown' }).fill('# Remote device draft');
  await secondPage.getByRole('button', { name: 'Save competing revision' }).click();

  const conflict = firstPage.getByRole('dialog', { name: 'Remote change detected' });
  await expect(conflict).toBeVisible();
  await expect(conflict.getByText('# Local device draft')).toBeVisible();
  await expect(conflict.getByText('# Remote device draft')).toBeVisible();
  await conflict.getByRole('button', { name: 'Use remote' }).click();
  await expect(firstPage.getByRole('textbox', { name: 'Markdown' })).toHaveValue('# Remote device draft');

  await context.close();
});

test('does not publish secrets or synthetic private content in the production bundle', () => {
  for (const file of bundleFiles('dist')) {
    const content = readFileSync(file, 'utf8');
    for (const forbidden of publicBundleForbiddenContent) {
      expect(content, `${file} exposed ${forbidden}`).not.toContain(forbidden);
    }
  }
});

test.skip('validates Google popup sign-in against an approved non-production Firebase project', async () => {
  // Manual QA only: use an approved test project and grant the literal post-sign-in UID out of band.
});
