import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { loadContent } from '../scripts/content.mjs';

const course = loadContent(fileURLToPath(new URL('..', import.meta.url)));

test('все материалы математики показывают формулы и рисунки при production CSP', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const materials = [
    ...course.topics.map((item: any) => ({ ...item, kind: 'topics' })),
    ...course.assignments.map((item: any) => ({ ...item, kind: 'homework' })),
  ].filter((item) => item.subject === 'mathematics');
  expect(materials.length).toBeGreaterThan(0);
  for (const material of materials) {
    await page.goto(`./#/subjects/mathematics/${material.kind}/${material.slug}`);
    await expect(page.getByRole('heading', { name: material.title, exact: true, level: 1 })).toBeVisible();
    const article = page.getByRole('article');
    await expect(article).toBeVisible();
    await expect(article.locator('.katex-error')).toHaveCount(0);
    if (material.body.includes('$')) {
      expect(await article.locator('.katex math').count(), material.slug).toBeGreaterThan(0);
    }
    for (const image of await article.getByRole('img').all()) {
      await image.scrollIntoViewIfNeeded();
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), material.slug).toBe(true);
  }
  expect(errors).toEqual([]);
});
