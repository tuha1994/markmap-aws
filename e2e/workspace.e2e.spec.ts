import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

const forbiddenFixtureVocabulary = [
  'AKIAIOSFODNN7EXAMPLE',
  'aws_secret_access_key=fixture-secret',
  'AWS_PARTNER_INTERNAL_ONLY',
  'PRIVATE_MAP_DO_NOT_PUBLISH'
];

function bundleFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? bundleFiles(path) : [path];
  });
}

async function signInToLocalWorkspace(page: Page, account: 'approved' | 'denied' = 'approved') {
  await page.getByRole('button', { name: `Sign in as local ${account} test user` }).click();
}

test('denies a signed-in allow-list-denied user at a direct private entrypoint without rendering private map content at 1280px', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('./private');

  await signInToLocalWorkspace(page, 'denied');
  await expect(page.getByRole('main', { name: 'Access denied' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText('This account has not been granted access.');
  await expect(page.getByRole('main', { name: 'Markmap AWS workspace' })).toHaveCount(0);
});

test('keeps the authorized workspace Maps, Edit, and Preview panes operable at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('./');

  await signInToLocalWorkspace(page);
  await expect(page.getByRole('main', { name: 'Markmap AWS workspace' })).toBeVisible();
  await page.getByRole('tab', { name: 'Maps' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('E2E workspace map');
  await page.getByRole('tab', { name: 'Edit' }).click();
  await expect(page.getByRole('textbox', { name: 'Markdown' })).toHaveValue('# E2E workspace map');
  await page.getByRole('tab', { name: 'Preview' }).click();
  await expect(page.getByRole('img', { name: 'Markmap preview' }).locator('.markmap-node')).toHaveCount(1);
});

test('renders the native workspace Markmap preview and exercises its fit control', async ({ page }) => {
  await page.goto('./');
  await signInToLocalWorkspace(page);

  const preview = page.getByRole('img', { name: 'Markmap preview' });
  await expect(preview).toBeVisible();
  await expect(preview.locator('.markmap-node')).toHaveCount(1);
  await page.getByRole('button', { name: 'Fit preview' }).click();
  await expect(preview.locator('.markmap-node')).toHaveCount(1);
});

test('shows a conflict in one browser page after another page writes', async ({ browser }) => {
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  await Promise.all([firstPage.goto('./'), secondPage.goto('./')]);
  await Promise.all([signInToLocalWorkspace(firstPage), signInToLocalWorkspace(secondPage)]);
  await firstPage.getByRole('textbox', { name: 'Markdown' }).fill('# Local device draft');
  await secondPage.getByRole('textbox', { name: 'Markdown' }).fill('# Remote device draft');
  await secondPage.getByRole('button', { name: 'Save version' }).first().click();

  const conflict = firstPage.getByRole('dialog', { name: 'Remote change detected' });
  await expect(conflict).toBeVisible();
  await expect(conflict.getByText('# Local device draft')).toBeVisible();
  await expect(conflict.getByText('# Remote device draft')).toBeVisible();
  await conflict.getByRole('button', { name: 'Use remote' }).click();
  await expect(firstPage.getByRole('textbox', { name: 'Markdown' })).toHaveValue('# Remote device draft');

  await firstContext.close();
  await secondContext.close();
});

test('does not publish explicit credential or internal-marker fixtures in emitted text assets', () => {
  for (const file of bundleFiles('dist')) {
    if (!/\.(?:css|html|js|json|map|txt)$/i.test(file)) continue;
    const content = readFileSync(file, 'utf8');
    for (const forbidden of forbiddenFixtureVocabulary) {
      expect(content, `${file} exposed ${forbidden}`).not.toContain(forbidden);
    }
  }
});

test.skip('validates Google popup sign-in against an approved non-production Firebase project', async () => {
  // Manual QA only: use an approved test project and grant the literal post-sign-in UID out of band.
});
