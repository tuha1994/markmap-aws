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


type EditorGeometry = {
  editor: { x: number; width: number };
  preview: { x: number; width: number };
  splitWidth: number;
};

type PreviewGeometry = {
  panel: { clientWidth: number; clientHeight: number; scrollWidth: number; scrollHeight: number };
  section: { width: number; bottom: number };
  controls: { bottom: number };
  canvas: { y: number; width: number; height: number; bottom: number };
};

async function readPreviewGeometry(page: Page): Promise<PreviewGeometry> {
  return page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('[aria-label="Preview pane"]');
    const section = document.querySelector<HTMLElement>('.markmap-preview');
    const controls = document.querySelector<HTMLElement>('.markmap-preview-heading');
    const canvas = document.querySelector<SVGSVGElement>('.markmap-preview svg');
    if (!panel || !section || !controls || !canvas) throw new Error('Preview geometry is unavailable.');
    const sectionRect = section.getBoundingClientRect();
    const controlsRect = controls.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    return {
      panel: { clientWidth: panel.clientWidth, clientHeight: panel.clientHeight, scrollWidth: panel.scrollWidth, scrollHeight: panel.scrollHeight },
      section: { width: sectionRect.width, bottom: sectionRect.bottom },
      controls: { bottom: controlsRect.bottom },
      canvas: { y: canvasRect.y, width: canvasRect.width, height: canvasRect.height, bottom: canvasRect.bottom }
    };
  });
}

function expectPreviewCanvasFillsContent(geometry: PreviewGeometry) {
  const tolerance = 2;
  expect(geometry.canvas.width).toBeGreaterThan(0);
  expect(geometry.canvas.height).toBeGreaterThan(0);
  expect(geometry.canvas.y).toBeGreaterThanOrEqual(geometry.controls.bottom);
  expect(Math.abs(geometry.canvas.width - geometry.section.width)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(geometry.canvas.bottom - geometry.section.bottom)).toBeLessThanOrEqual(tolerance);
  expect(geometry.panel.scrollWidth).toBeLessThanOrEqual(geometry.panel.clientWidth + tolerance);
  expect(geometry.panel.scrollHeight).toBeLessThanOrEqual(geometry.panel.clientHeight + tolerance);
}

async function readEditorGeometry(editor: ReturnType<Page['getByLabel']>, previewPanel: ReturnType<Page['getByLabel']>): Promise<EditorGeometry> {
  const [editorBox, previewBox, splitWidth] = await Promise.all([
    editor.boundingBox(),
    previewPanel.boundingBox(),
    previewPanel.locator('..').evaluate((element) => element.clientWidth)
  ]);
  expect(editorBox).not.toBeNull();
  expect(previewBox).not.toBeNull();
  return {
    editor: { x: editorBox!.x, width: editorBox!.width },
    preview: { x: previewBox!.x, width: previewBox!.width },
    splitWidth
  };
}

function expectEditorGeometryAtLiveBound(geometry: EditorGeometry, bound: 'min' | 'max') {
  const previewMinimum = 320;
  const dividerWidth = 12;
  const previewSafeMax = (geometry.splitWidth - dividerWidth - previewMinimum) / geometry.splitWidth * 100;
  const effectiveMax = Math.min(62, Math.max(0, previewSafeMax));
  const effectiveMin = Math.min(27, effectiveMax);
  const editorPercent = geometry.editor.width / geometry.splitWidth * 100;
  const expected = bound === 'min' ? effectiveMin : effectiveMax;

  expect(geometry.preview.width).toBeGreaterThanOrEqual(previewMinimum);
  expect(geometry.editor.x + geometry.editor.width).toBeLessThanOrEqual(geometry.preview.x);
  expect(editorPercent).toBeGreaterThanOrEqual(effectiveMin - 0.75);
  expect(editorPercent).toBeLessThanOrEqual(effectiveMax + 0.75);
  expect(Math.abs(editorPercent - expected)).toBeLessThan(0.75);
}

async function dragDividerToExtreme(page: Page, divider: ReturnType<Page['getByRole']>, deltaX: number) {
  const box = await divider.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + deltaX, y, { steps: 8 });
  await page.mouse.up();
}

async function expectMobileToolbarTargets(toolbar: ReturnType<Page['getByRole']>) {
  const controls = toolbar.getByRole('button');
  const count = await controls.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const box = await controls.nth(index).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
}

test('renders access denial after a signed-in unapproved user is denied their authorization-record read at a direct private entrypoint without rendering private map content at 1280px', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('./private');

  await signInToLocalWorkspace(page, 'denied');
  await expect(page.getByRole('main', { name: 'Access denied' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText('This account has not been granted access.');
  await expect(page.getByRole('main', { name: 'Markmap AWS workspace' })).toHaveCount(0);
});

async function expectMobileHeaderTargets(headerActions: ReturnType<Page['getByLabel']>) {
  for (const name of ['Import Markdown', /Switch to (dark|light) theme/, 'Sign out']) {
    const action = headerActions.getByRole('button', { name });
    await expect(action).toBeVisible();
    const box = await action.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
}

test('keeps all mobile workspace header actions at least 44px at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('./');

  await signInToLocalWorkspace(page);
  await expectMobileHeaderTargets(page.getByLabel('Workspace actions'));
});

test('keeps only mobile panes and 44px actions operable at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('./');

  await signInToLocalWorkspace(page);
  await expect(page.getByRole('main', { name: 'Markmap AWS workspace' })).toBeVisible();
  await expect(page.locator('.workspace-layout-toolbar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^(Edit mode|Focus mode|Show sidebar|Hide sidebar)$/ })).toHaveCount(0);
  await expect(page.getByRole('separator')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Maps' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('E2E workspace map');
  await expectMobileToolbarTargets(page.getByRole('toolbar', { name: 'Map actions' }));

  await page.getByRole('tab', { name: 'Edit' }).click();
  await expect(page.getByRole('textbox', { name: 'Markdown' })).toHaveValue('# E2E workspace map');
  await expectMobileToolbarTargets(page.getByRole('toolbar', { name: 'Editor controls' }));

  await page.getByRole('tab', { name: 'Preview' }).click();
  await expect(page.getByRole('img', { name: 'Markmap preview' }).locator('.markmap-node')).toHaveCount(1);
  const previewToolbar = page.getByRole('toolbar', { name: 'Preview controls' });
  await expectMobileToolbarTargets(previewToolbar);
  await previewToolbar.getByRole('button', { name: 'Enter focus mode' }).click();
  await expect(page.getByRole('tab', { name: 'Preview' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Exit focus mode' })).toHaveCount(0);
  await expect(page.locator('.workspace-layout-toolbar')).toHaveCount(0);
});

test('uses real pointer drags to keep desktop workspace panels bounded and preserves an unsaved focus draft', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('./');
  await signInToLocalWorkspace(page);

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  const header = page.locator('.workspace-header');
  const desktopLayout = page.locator('.desktop-pane-layout');
  const [headerBox, desktopLayoutBox, scrollWidth] = await Promise.all([
    header.boundingBox(),
    desktopLayout.boundingBox(),
    page.evaluate(() => document.documentElement.scrollWidth)
  ]);
  expect(headerBox).not.toBeNull();
  expect(desktopLayoutBox).not.toBeNull();
  expect(headerBox!.height).toBeLessThanOrEqual(60);
  expect(desktopLayoutBox!.y + desktopLayoutBox!.height).toBeGreaterThanOrEqual(viewport!.height - 12);
  expect(scrollWidth).toBeLessThanOrEqual(viewport!.width);

  const sidebar = page.getByLabel('Workspace navigation');
  const editor = page.getByLabel('Markdown editor');
  const preview = page.getByRole('img', { name: 'Markmap preview' });
  const previewPanel = page.getByLabel('Preview pane');
  const sidebarDivider = page.getByRole('separator', { name: 'Sidebar width' });
  const editorDivider = page.getByRole('separator', { name: 'Editor width' });
  const initialGeometry = await readEditorGeometry(editor, previewPanel);
  const initialEditorPercent = initialGeometry.editor.width / initialGeometry.splitWidth * 100;
  expect(initialEditorPercent).toBeCloseTo(35, 0);
  expect(initialGeometry.preview.width).toBeGreaterThan(initialGeometry.editor.width);
  await expect(editorDivider).toHaveAttribute('aria-valuenow', '35');
  const sidebarBefore = await sidebar.boundingBox();
  const sidebarDividerBox = await sidebarDivider.boundingBox();
  expect(sidebarBefore).not.toBeNull();
  expect(sidebarDividerBox).not.toBeNull();

  await page.mouse.move(sidebarDividerBox!.x + sidebarDividerBox!.width / 2, sidebarDividerBox!.y + sidebarDividerBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(sidebarDividerBox!.x + sidebarDividerBox!.width / 2 + 88, sidebarDividerBox!.y + sidebarDividerBox!.height / 2, { steps: 8 });
  await page.mouse.up();

  const sidebarAfter = await sidebar.boundingBox();
  expect(sidebarAfter).not.toBeNull();
  expect(sidebarAfter!.width).toBeGreaterThan(sidebarBefore!.width + 70);
  expect(sidebarAfter!.width).toBeLessThan(sidebarBefore!.width + 106);
  expect(sidebarAfter!.width).toBeGreaterThanOrEqual(224);
  expect(sidebarAfter!.width).toBeLessThanOrEqual(420);
  await expect(sidebarDivider).toHaveAttribute('aria-valuenow', '388');

  const sidebarDividerAfterIntermediateDrag = await sidebarDivider.boundingBox();
  expect(sidebarDividerAfterIntermediateDrag).not.toBeNull();
  await page.mouse.move(sidebarDividerAfterIntermediateDrag!.x + sidebarDividerAfterIntermediateDrag!.width / 2, sidebarDividerAfterIntermediateDrag!.y + sidebarDividerAfterIntermediateDrag!.height / 2);
  await page.mouse.down();
  await page.mouse.move(sidebarDividerAfterIntermediateDrag!.x + sidebarDividerAfterIntermediateDrag!.width / 2 + 600, sidebarDividerAfterIntermediateDrag!.y + sidebarDividerAfterIntermediateDrag!.height / 2, { steps: 8 });
  await page.mouse.up();
  const sidebarAtMaximum = await sidebar.boundingBox();
  expect(sidebarAtMaximum).not.toBeNull();
  expect(sidebarAtMaximum!.width).toBeGreaterThanOrEqual(224);
  expect(sidebarAtMaximum!.width).toBeLessThanOrEqual(420);
  await expect(sidebarDivider).toHaveAttribute('aria-valuenow', '420');

  const sidebarDividerAtMaximum = await sidebarDivider.boundingBox();
  expect(sidebarDividerAtMaximum).not.toBeNull();
  await page.mouse.move(sidebarDividerAtMaximum!.x + sidebarDividerAtMaximum!.width / 2, sidebarDividerAtMaximum!.y + sidebarDividerAtMaximum!.height / 2);
  await page.mouse.down();
  await page.mouse.move(sidebarDividerAtMaximum!.x + sidebarDividerAtMaximum!.width / 2 - 1000, sidebarDividerAtMaximum!.y + sidebarDividerAtMaximum!.height / 2, { steps: 8 });
  await page.mouse.up();
  const sidebarAtMinimum = await sidebar.boundingBox();
  expect(sidebarAtMinimum).not.toBeNull();
  expect(sidebarAtMinimum!.width).toBeGreaterThanOrEqual(224);
  expect(sidebarAtMinimum!.width).toBeLessThanOrEqual(420);
  await expect(sidebarDivider).toHaveAttribute('aria-valuenow', '224');

  await dragDividerToExtreme(page, editorDivider, -1000);
  expectEditorGeometryAtLiveBound(await readEditorGeometry(editor, previewPanel), 'min');

  await dragDividerToExtreme(page, editorDivider, 1000);
  expectEditorGeometryAtLiveBound(await readEditorGeometry(editor, previewPanel), 'max');

  await dragDividerToExtreme(page, sidebarDivider, 1000);
  expectEditorGeometryAtLiveBound(await readEditorGeometry(editor, previewPanel), 'max');

  await dragDividerToExtreme(page, editorDivider, -1000);
  expectEditorGeometryAtLiveBound(await readEditorGeometry(editor, previewPanel), 'min');

  await dragDividerToExtreme(page, editorDivider, 1000);
  expectEditorGeometryAtLiveBound(await readEditorGeometry(editor, previewPanel), 'max');

  const draft = '# Focus-preserved E2E draft\n\n- exact local draft';
  const markdown = page.getByRole('textbox', { name: 'Markdown' });
  await markdown.fill(draft);
  await expect(page.getByRole('region', { name: 'Save status' })).toContainText('Unsaved changes');
  await page.getByRole('button', { name: 'Focus mode', exact: true }).click();
  await expect(page.getByLabel('Workspace navigation')).toBeHidden();
  await expect(page.getByLabel('Markdown editor')).toBeHidden();
  await expect(page.getByRole('separator')).toHaveCount(0);
  const focusedPreviewPanel = await previewPanel.boundingBox();
  expect(focusedPreviewPanel).not.toBeNull();
  expect(focusedPreviewPanel!.width).toBeGreaterThan(initialGeometry.preview.width);
  expect(focusedPreviewPanel!.x).toBeLessThanOrEqual(initialGeometry.preview.x);
  for (const name of ['Zoom in', 'Zoom out', 'Fit preview', 'Reset preview']) {
    await expect(page.getByRole('button', { name })).toBeVisible();
  }
  await expect(preview).toContainText('Focus-preserved E2E draft');
  await page.getByRole('button', { name: 'Exit focus mode' }).click();
  await expect(page.getByRole('separator')).toHaveCount(2);
  await expect(markdown).toHaveValue(draft);
  await expect(preview).toContainText('Focus-preserved E2E draft');
});

test('fills the live Explore content area below compact desktop controls after divider drag and in Focus mode', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('./');
  await signInToLocalWorkspace(page);

  const previewPanel = page.getByLabel('Preview pane');
  const previewToolbar = page.getByRole('toolbar', { name: 'Preview controls' });
  for (const name of ['Fit preview', 'Zoom in', 'Zoom out', 'Reset preview', 'Enter focus mode']) {
    const control = previewToolbar.getByRole('button', { name });
    await expect(control).toHaveAttribute('aria-label', name);
    await expect(control).toHaveAttribute('title', name);
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeLessThan(40);
  }

  const editorDivider = page.getByRole('separator', { name: 'Editor width' });
  await dragDividerToExtreme(page, editorDivider, -1000);
  await expect(page.getByRole('img', { name: 'Markmap preview' }).locator('.markmap-node')).toHaveCount(1);
  expectPreviewCanvasFillsContent(await readPreviewGeometry(page));

  await previewToolbar.getByRole('button', { name: 'Enter focus mode' }).click();
  await expect(previewPanel).toBeVisible();
  expectPreviewCanvasFillsContent(await readPreviewGeometry(page));
});

test('persists a desktop theme preference as UI-only local state', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('./');
  await signInToLocalWorkspace(page);

  const workspace = page.getByRole('main', { name: 'Markmap AWS workspace' });
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(workspace).toHaveAttribute('data-workspace-theme', 'dark');
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('markmap-aws.workspace-layout'))).toBe('{"theme":"dark","mode":"edit","sidebarCollapsed":false}');

  await page.reload();
  await expect(workspace).toHaveAttribute('data-workspace-theme', 'dark');
  await expect(page.getByRole('textbox', { name: 'Markdown' })).toHaveValue('# E2E workspace map');
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
