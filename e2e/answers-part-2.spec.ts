import { expect, test } from '@playwright/test';

test('ответы второй части раскрываются и содержат формулы', async ({ page }) => {
  await page.goto('./#/subjects/mathematics/homework/review-7-9-part-2');
  const details = page.locator('details').filter({ has: page.getByText('Ответы для самопроверки', { exact: true }) });
  await expect(details).not.toHaveAttribute('open', '');
  await details.locator('summary').click();
  await expect(details).toHaveAttribute('open', '');
  await expect(details.getByText('Рациональные уравнения', { exact: true })).toBeVisible();
  expect(await details.locator('.katex math').count()).toBeGreaterThan(0);
  await expect(details.locator('.katex-error')).toHaveCount(0);
  await details.locator('summary').click();
  await expect(details).not.toHaveAttribute('open', '');
});

test('карточки без подписей, метка new и выделение сообщения', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => errors.push(request.url()));
  await page.goto('./#/subjects/mathematics');
  await expect(page.locator('.material-card p, .course-card p')).toHaveCount(0);
  const card = page.locator('a[href$="/homework/review-7-9-part-2"]');
  await expect(card.locator('.new-badge')).toBeVisible();
  await expect(page.locator('.new-badge')).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({path: testInfo.outputPath('cards.png'), fullPage:true});
  await card.click();
  const notice = page.locator('.submission-notice');
  await expect(notice.locator('strong')).toHaveText('Отправлять преподавателю не нужно.');
  expect(await notice.evaluate(el => getComputedStyle(el).color !== getComputedStyle(el.parentElement!).color)).toBe(true);
  await page.locator('summary').click();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(async () => {
    const fonts = await document.fonts.load('20px KaTeX_Main', '\ue020');
    return fonts.length > 0 && fonts.every(font => font.status === 'loaded');
  })).toBe(true);
  await expect(page.locator('.katex-error')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.locator('details').screenshot({path:testInfo.outputPath('answers.png')});
  await notice.screenshot({path:testInfo.outputPath('notice.png')});
  expect(errors).toEqual([]);
});
