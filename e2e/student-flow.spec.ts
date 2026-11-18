import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadContent } from '../scripts/content.mjs';

// Repository materials stay editable: deterministic edge cases live in unit fixtures.
const course = loadContent(fileURLToPath(new URL('..', import.meta.url)));
const topic = course.topics[0];
const assignment = course.assignments[0];
const subject = course.subjects[0];
const subjectRoute = (id: string) => `#/subjects/${encodeURIComponent(id)}`;
const topicRoute = (item: { subject: string; slug: string }) => `${subjectRoute(item.subject)}/topics/${encodeURIComponent(item.slug)}`;
const homeworkRoute = (item: { subject: string; slug: string }) => `${subjectRoute(item.subject)}/homework/${encodeURIComponent(item.slug)}`;
const emptySubject = course.subjects.find((item: { id: string }) =>
  ![...course.topics, ...course.assignments].some((material: { subject: string }) => material.subject === item.id));
let pageErrors: string[];

test.beforeEach(async ({ page }, testInfo) => {
  pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript((theme) => {
    try {
      if (!localStorage.getItem('misao-theme')) localStorage.setItem('misao-theme', theme);
    } catch { /* The blocked-storage scenario intentionally rejects both calls. */ }
  }, testInfo.project.use.colorScheme as string);
});

test.afterEach(() => { expect(pageErrors).toEqual([]); });

test('главная показывает актуальные дисциплины и ссылку автора', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Дисциплины', exact: true, level: 1 })).toBeVisible();
  await expect(page.locator('main a[href^="#/subjects/"]')).toHaveCount(course.subjects.length);
  for (const entry of course.subjects) {
    await expect(page.locator(`main a[href="${subjectRoute(entry.id)}"]`)).toContainText(entry.title);
  }
  if (!course.subjects.length) await expect(page.getByText('Дисциплины пока не добавлены', { exact: true })).toBeVisible();
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'мой github' })).toHaveAttribute('href', course.site.githubUrl);
});

test('база знаний содержит объяснение без скачивания домашнего задания', async ({ page }) => {
  test.skip(!topic, 'В репозитории нет опубликованных материалов базы знаний. Их интерфейс покрыт независимыми App fixtures.');
  await page.goto('./');
  await page.locator(`main a[href="${subjectRoute(topic.subject)}"]`).click();
  await expect(page.getByRole('heading', { name: 'База знаний', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Домашние задания', exact: true })).toBeVisible();
  await page.getByRole('region', { name: 'База знаний' }).locator(`a[href="${topicRoute(topic)}"]`).click();
  await expect(page.locator('article > h1')).toHaveText(topic.title);
  await expect(page.locator('article .prose')).not.toBeEmpty();
  await expect(page.locator('a[download]')).toHaveCount(0);
});

test('домашнее задание открывается отдельно и скачивается как настоящий PDF', async ({ page, request }) => {
  test.skip(!assignment, 'В репозитории нет опубликованных домашних заданий. Их интерфейс покрыт независимыми App fixtures.');
  await page.goto(`./${subjectRoute(assignment.subject)}`);
  await page.getByRole('region', { name: 'Домашние задания' }).locator(`a[href="${homeworkRoute(assignment)}"]`).click();
  await expect(page.locator('article > h1')).toHaveText(assignment.title);
  await expect(page.locator('article .prose')).not.toBeEmpty();
  const downloadLink = page.getByRole('link', { name: 'Скачать задание', exact: true });
  const pdfPath = `/misao/${assignment.pdf.replace(/^\/+/, '')}`;
  await expect(downloadLink).toHaveAttribute('href', pdfPath);
  await expect(downloadLink).toHaveAttribute('download');
  const response = await request.get(pdfPath);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('application/pdf');
  expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
  const downloadPromise = page.waitForEvent('download');
  await downloadLink.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  expect(await download.failure()).toBeNull();
  const downloadedPath = await download.path();
  expect(downloadedPath).not.toBeNull();
  expect((await readFile(downloadedPath!)).subarray(0, 5).toString()).toBe('%PDF-');
});

test('прямые ссылки и перезагрузка работают для теории и ДЗ под GitHub Pages base', async ({ page }) => {
  const materials = [
    ...(topic ? [{ item: topic, route: topicRoute(topic), download: false }] : []),
    ...(assignment ? [{ item: assignment, route: homeworkRoute(assignment), download: true }] : []),
  ];
  test.skip(!materials.length, 'В репозитории пока нет опубликованных материалов обоих типов.');
  for (const { item, route, download } of materials) {
    await page.goto(`./${route}`);
    await expect(page.locator('article > h1')).toHaveText(item.title);
    await page.reload();
    await expect(page.locator('article > h1')).toHaveText(item.title);
    await expect(page.locator('a[download]')).toHaveCount(download ? 1 : 0);
    await page.locator(`main a[href="${subjectRoute(item.subject)}"]`).click();
    await expect(page.getByRole('heading', { name: 'База знаний', exact: true })).toBeVisible();
    await page.goBack();
    await expect(page.locator('article > h1')).toHaveText(item.title);
  }
});

test('дисциплина без материалов показывает два отдельных пустых раздела', async ({ page }) => {
  test.skip(!emptySubject, 'Все дисциплины заполнены: оба пустых раздела проверены компонентным тестом.');
  await page.goto(`./${subjectRoute(emptySubject.id)}`);
  await expect(page.getByRole('heading', { name: emptySubject.title, exact: true, level: 1 })).toBeVisible();
  for (const name of ['База знаний', 'Домашние задания']) {
    await expect(page.getByRole('region', { name }).getByText('Материалы скоро появятся', { exact: true })).toBeVisible();
  }
  await expect(page.locator('a[download]')).toHaveCount(0);
});

test('неизвестные адреса дисциплины, теории и ДЗ сохраняют навигацию', async ({ page }) => {
  const routes = ['#/subjects/__missing__', '#/__missing__'];
  if (subject) routes.push(`${subjectRoute(subject.id)}/topics/__missing__`, `${subjectRoute(subject.id)}/homework/__missing__`);
  for (const route of routes) {
    await page.goto(`./${route}`);
    await expect(page.getByRole('heading', { name: 'Такой страницы нет', exact: true })).toBeVisible();
    await page.getByRole('link', { name: /Все дисциплины/ }).click();
    await expect(page.getByRole('heading', { name: 'Дисциплины', exact: true, level: 1 })).toBeVisible();
  }
});

test('все страницы помещаются в экран и доступны с клавиатуры в выбранной теме', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const routes = [
    { name: 'home', route: '', title: 'Дисциплины' },
    ...course.subjects.map((item: { id: string; title: string }) => ({ name: `subject-${item.id}`, route: subjectRoute(item.id), title: item.title })),
    ...course.topics.map((item: { subject: string; slug: string; title: string }) => ({ name: `knowledge-${item.subject}-${item.slug}`, route: topicRoute(item), title: item.title })),
    ...course.assignments.map((item: { subject: string; slug: string; title: string }) => ({ name: `homework-${item.subject}-${item.slug}`, route: homeworkRoute(item), title: item.title })),
    { name: '404', route: '#/__missing__', title: 'Такой страницы нет' },
  ];
  for (const { name, route, title } of routes) {
    await page.goto(`./${route}`);
    await expect(page.locator('main')).toBeVisible();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe(route);
    await expect(page.locator('main h1.page-title')).toHaveText(title);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('html')).toHaveAttribute('data-theme', testInfo.project.use.colorScheme as string);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `Горизонтальное переполнение: ${route}`).toBe(true);
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'мой github' })).toHaveAttribute('href', course.site.githubUrl);
    // Capture the verified route before keyboard interaction can move focus.
    await page.screenshot({ path: `tmp/qa/${name}-${testInfo.project.name}.png`, fullPage: true });
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('A');
    await expect.poll(() => page.evaluate(() => location.hash)).toBe(route);
  }
});

test('NextArt и Gilroy действительно загружаются локально без ошибок', async ({ page }) => {
  const failedFonts: string[] = [];
  const isFont = (url: string) => /\.(?:ttf|otf|woff2?)(?:\?|$)/i.test(url);
  page.on('response', (response) => { if (isFont(response.url()) && !response.ok()) failedFonts.push(`${response.status()} ${response.url()}`); });
  page.on('requestfailed', (request) => { if (isFont(request.url())) failedFonts.push(request.url()); });
  await page.goto('./');
  const loaded = await page.evaluate(async () => {
    const requests = [
      { family: 'NextArt', weight: 400 }, { family: 'NextArt', weight: 600 }, { family: 'NextArt', weight: 700 },
      { family: 'Gilroy', weight: 400 }, { family: 'Gilroy', weight: 500 },
    ];
    return Promise.all(requests.map(async ({ family, weight }) => {
      const faces = await document.fonts.load(`${weight} 24px "${family}"`, 'МИСАО Математика Информатика');
      return { family, weight, count: faces.length, statuses: faces.map((face) => face.status) };
    }));
  });
  for (const font of loaded) {
    expect(font.count, `Отсутствует @font-face ${font.family} ${font.weight}`).toBeGreaterThan(0);
    expect(font.statuses.every((status) => status === 'loaded')).toBe(true);
  }
  expect(failedFonts).toEqual([]);
  expect(await page.locator('h1').evaluate((element) => getComputedStyle(element).fontFamily.split(',')[0].replace(/["']/g, '').trim())).toBe('NextArt');
  expect(await page.locator('body').evaluate((element) => getComputedStyle(element).fontFamily.split(',')[0].replace(/["']/g, '').trim())).toBe('Gilroy');
});

test('переключатель темы сохраняет выбор после настоящей перезагрузки', async ({ page }, testInfo) => {
  const initial = testInfo.project.use.colorScheme as 'light' | 'dark';
  const next = initial === 'dark' ? 'light' : 'dark';
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-theme', initial);
  await page.getByRole('button', { name: initial === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', next);
  expect(await page.evaluate(() => localStorage.getItem('misao-theme'))).toBe(next);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', next);
  expect(await page.locator('html').evaluate((element) => element.style.colorScheme)).toBe(next);
});

test('запрет localStorage не ломает сайт и переключение темы', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    for (const method of ['getItem', 'setItem']) {
      Object.defineProperty(Storage.prototype, method, { configurable: true, value() { throw new DOMException('Blocked', 'SecurityError'); } });
    }
  });
  const initial = testInfo.project.use.colorScheme as 'light' | 'dark';
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-theme', initial);
  await page.getByRole('button', { name: initial === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', initial === 'dark' ? 'light' : 'dark');
  await expect(page.getByRole('heading', { name: 'Дисциплины', exact: true, level: 1 })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', initial);
});
