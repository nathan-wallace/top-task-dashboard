const { test, expect } = require('@playwright/test');

test.describe('Reports explorer page', () => {
  test('loads reports, supports search, and renders selected report', async ({ page }) => {
    await page.goto('/index.html');

    await expect(page.locator('#report-list button')).toHaveCount(7);
    const firstReport = page.locator('#report-list button').first();
    await expect(firstReport).toHaveClass(/active/);

    await page.fill('#report-search', 'OCR');
    await expect(page.locator('#report-list button')).toHaveCount(1);
    await expect(page.locator('#report-list button').first()).toContainText(/OCR/i);

    await page.fill('#report-search', '');
    await page.getByRole('button', { name: /belmont report 2/i }).click();
    await expect(page.locator('#report-view h2')).toContainText('Belmont Report 2');
    await expect(page.locator('#report-view .task-table tbody tr')).toHaveCount(12);
  });

  test('toggles reports sidebar and persists collapsed state', async ({ page }) => {
    await page.goto('/index.html');
    const layout = page.locator('#reports-layout');
    const toggle = page.locator('#toggle-report-panel');

    await expect(layout).not.toHaveClass(/sidebar-collapsed/);
    await toggle.click();

    await expect(layout).toHaveClass(/sidebar-collapsed/);
    await expect(toggle).toHaveAttribute('aria-label', 'Expand reports panel');

    await page.reload();
    await expect(layout).toHaveClass(/sidebar-collapsed/);
  });

  test('downloads selected report PDF and workbook', async ({ page }) => {
    await page.goto('/index.html');

    const [pdfDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#download-pdf')
    ]);
    expect(await pdfDownload.suggestedFilename()).toMatch(/-report\.pdf$/);

    const [workbookDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#download-report-workbook')
    ]);
    expect(await workbookDownload.suggestedFilename()).toMatch(/-report-workbook\.xls$/);
  });
});

test.describe('Overview page', () => {
  test('renders aggregate stats and sorted report table', async ({ page }) => {
    await page.goto('/overview.html');

    await expect(page.locator('#overview-count')).toContainText('7 reports');
    await expect(page.locator('#overview-stats .card')).toHaveCount(2);
    await expect(page.locator('#overview-table-body tr')).toHaveCount(7);

    const topRowScore = await page.locator('#overview-table-body tr').first().locator('td').nth(4).innerText();
    const lastRowScore = await page.locator('#overview-table-body tr').last().locator('td').nth(4).innerText();
    expect(Number(topRowScore)).toBeGreaterThanOrEqual(Number(lastRowScore));
  });

  test('downloads the portfolio CSV', async ({ page }) => {
    await page.goto('/overview.html');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#download-spreadsheet')
    ]);

    expect(await download.suggestedFilename()).toMatch(/^top-task-portfolio-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});

test.describe('Prompt builder page', () => {
  test('updates generated prompt from form fields', async ({ page }) => {
    await page.goto('/prompt.html');

    await page.fill('#prompt-url', 'https://example.gov/benefits');
    await page.fill('#prompt-audience', 'Veterans and families');
    await page.fill('#prompt-scope', 'section: /benefits');
    await page.fill('#prompt-max-tasks', '15');

    await expect(page.locator('#prompt-output')).toContainText('url: https://example.gov/benefits');
    await expect(page.locator('#prompt-output')).toContainText('audience: Veterans and families');
    await expect(page.locator('#prompt-output')).toContainText('scope: section: /benefits');
    await expect(page.locator('#prompt-output')).toContainText('max_tasks: 15');
  });

  test('handles successful copy to clipboard', async ({ context, page }) => {
    await context.grantPermissions(['clipboard-write']);
    await page.goto('/prompt.html');

    await page.click('#copy-prompt');
    await expect(page.locator('#copy-status')).toHaveText('Prompt copied.');
  });

  test('shows copy failure feedback when clipboard write rejects', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: () => Promise.reject(new Error('blocked'))
        },
        configurable: true
      });
    });

    await page.goto('/prompt.html');
    await page.click('#copy-prompt');

    await expect(page.locator('#copy-status')).toHaveText('Copy failed. Select and copy manually.');
  });
});

test('generated report page loads its forced report and can export', async ({ page }) => {
  await page.goto('/reports/press-room/index.html');

  await expect(page.locator('#report-view h2')).toContainText(/hhs.gov/i);

  const [pdfDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#download-pdf')
  ]);
  expect(await pdfDownload.suggestedFilename()).toBe('press-room-report.pdf');
});
