import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
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
let pageErrors: string[] = [];

async function revealThemeButton(page: Page) {
  const toggle = page.getByRole('button', { name: /^Включить (светлую|тёмную) тему$/ });
  if (!await toggle.isVisible()) await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
  await expect(toggle).toBeVisible();
  return toggle;
}

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
    await expect(page.locator(`main a[href="${subjectRoute(entry.id)}"]`)).toHaveAccessibleName(entry.title);
  }
  await expect(page.locator('.course-card p')).toHaveCount(0);
  if (!course.subjects.length) await expect(page.getByText('Дисциплины пока не добавлены', { exact: true })).toBeVisible();
  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('link', { name: 'Github', exact: true })).toHaveAttribute('href', course.site.githubUrl);
  await expect(footer).toContainText('Дизайн и разработка сайта:');
  await expect(footer).toContainText('© 2026');

  // Exercise wrapping with four cards even when the author's actual catalog is smaller.
  const catalog = page.locator('.course-list');
  const originalNodes = await catalog.evaluateHandle((list) => [...list.childNodes]);
  try {
    await catalog.evaluate((list) => {
      const template = list.querySelector('.course-card')?.cloneNode(true) as HTMLElement | undefined;
      const cards = Array.from({ length: 4 }, (_, index) => {
        const card = template ? template.cloneNode(true) as HTMLElement : document.createElement('a');
        card.classList.add('course-card');
        if (!card.querySelector('h2')) card.innerHTML = '<div><h2></h2></div>';
        card.querySelector('h2')!.textContent = `Дисциплина ${index + 1}`;
        return card;
      });
      list.replaceChildren(...cards);
    });
    await page.evaluate(() => document.fonts.ready);
    const cards = await catalog.locator('.course-card').evaluateAll((items) => items.map((item) => {
      const { x, y, width, height } = item.getBoundingClientRect();
      return { x, y, width, height };
    }));
    expect(cards).toHaveLength(4);
    if (page.viewportSize()!.width > 760) {
      expect(Math.abs(cards[0].y - cards[1].y)).toBeLessThanOrEqual(1);
      expect(Math.abs(cards[2].y - cards[3].y)).toBeLessThanOrEqual(1);
      expect(cards[1].x).toBeGreaterThanOrEqual(cards[0].x + cards[0].width - 1);
      expect(cards[2].y).toBeGreaterThanOrEqual(cards[0].y + cards[0].height - 1);
      expect(Math.abs(cards[2].x - cards[0].x)).toBeLessThanOrEqual(1);
      expect(Math.abs(cards[3].x - cards[1].x)).toBeLessThanOrEqual(1);
    } else {
      for (let index = 1; index < cards.length; index += 1) {
        expect(Math.abs(cards[index].x - cards[0].x)).toBeLessThanOrEqual(1);
        expect(cards[index].y).toBeGreaterThanOrEqual(cards[index - 1].y + cards[index - 1].height - 1);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  } finally {
    await catalog.evaluate((list, nodes) => list.replaceChildren(...nodes), originalNodes);
    await originalNodes.dispose();
  }
});

test('база знаний содержит объяснение без скачивания домашнего задания', async ({ page }) => {
  test.skip(!topic, 'В репозитории нет опубликованных материалов базы знаний. Их интерфейс покрыт независимыми App fixtures.');
  await page.goto('./');
  await page.locator(`main a[href="${subjectRoute(topic.subject)}"]`).click();
  await expect(page.getByRole('heading', { name: 'База знаний', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Домашние задания', exact: true })).toBeVisible();
  const knowledgeLink = page.getByRole('region', { name: 'База знаний' }).locator(`a[href="${topicRoute(topic)}"]`);
  await expect(knowledgeLink).toHaveAccessibleName(topic.title);
  await expect(knowledgeLink.locator('p')).toHaveCount(0);
  await knowledgeLink.click();
  await expect(page.locator('article > h1')).toHaveText(topic.title);
  await expect(page.locator('article .prose')).not.toBeEmpty();
  await expect(page.locator('a[download]')).toHaveCount(0);
});

test('сетки материалов переносят длинные названия и новые карточки без наложений', async ({ page }) => {
  test.skip(!topic && !assignment, 'Сетки требуют хотя бы один опубликованный материал.');
  const id = (topic ?? assignment).subject;
  await page.goto(`./${subjectRoute(id)}`);
  for (const list of await page.locator('.material-list').all()) {
    await list.evaluate((element) => {
      const template = element.querySelector('.material-card')!;
      const cards = Array.from({ length: 4 }, (_, index) => {
        const card = template.cloneNode(true) as HTMLElement;
        card.querySelector('h3')!.textContent = index === 0
          ? 'ОченьДлинноеНазваниеТемы'.repeat(5)
          : `Материал ${index + 1}: дополнительная практика`;
        return card;
      });
      element.replaceChildren(...cards);
    });
    await page.evaluate(() => document.fonts.ready);
    await expect(list.locator('.material-card p')).toHaveCount(0);
    const cards = await list.locator('.material-card').evaluateAll((elements) => elements.map((element) => {
      const card = element.getBoundingClientRect();
      const title = element.querySelector('h3')!.getBoundingClientRect();
      const arrow = element.querySelector('.row-arrow')!.getBoundingClientRect();
      return { x: card.x, y: card.y, width: card.width, height: card.height,
        inside: title.left >= card.left && title.right <= card.right + 1 && title.bottom <= card.bottom + 1 && arrow.right <= card.right + 1,
        separated: title.bottom <= arrow.top + 1 };
    }));
    expect(cards.every((card) => card.inside && card.separated)).toBe(true);
    const columns = page.viewportSize()!.width > 760 ? 2 : 1;
    for (let index = columns; index < cards.length; index += 1) {
      expect(Math.abs(cards[index].x - cards[index - columns].x)).toBeLessThanOrEqual(1);
      expect(cards[index].y).toBeGreaterThanOrEqual(cards[index - columns].y + cards[index - columns].height - 1);
    }
    if (columns === 2) expect(Math.abs(cards[0].y - cards[1].y)).toBeLessThanOrEqual(1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test('домашнее задание открывается отдельно и показывает условие на странице', async ({ page }) => {
  test.skip(!assignment, 'В репозитории нет опубликованных домашних заданий. Их интерфейс покрыт независимыми App fixtures.');
  await page.goto(`./${subjectRoute(assignment.subject)}`);
  const homeworkLink = page.getByRole('region', { name: 'Домашние задания' }).locator(`a[href="${homeworkRoute(assignment)}"]`);
  await expect(homeworkLink).toHaveAccessibleName(assignment.title);
  await expect(homeworkLink.locator('p')).toHaveCount(0);
  await homeworkLink.click();
  await expect(page.locator('article > h1')).toHaveText(assignment.title);
  await expect(page.locator('article .prose')).not.toBeEmpty();
  await expect(page.locator('a[download], a[href$=".pdf" i]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /скачать|pdf/i })).toHaveCount(0);
});

test('прямые ссылки и перезагрузка работают для теории и ДЗ под GitHub Pages base', async ({ page }) => {
  const materials = [
    ...(topic ? [{ item: topic, route: topicRoute(topic) }] : []),
    ...(assignment ? [{ item: assignment, route: homeworkRoute(assignment) }] : []),
  ];
  test.skip(!materials.length, 'В репозитории пока нет опубликованных материалов обоих типов.');
  for (const { item, route } of materials) {
    await page.goto(`./${route}`);
    await expect(page.locator('article > h1')).toHaveText(item.title);
    await page.reload();
    await expect(page.locator('article > h1')).toHaveText(item.title);
    await expect(page.locator('a[download]')).toHaveCount(0);
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
  const resourceErrors: string[] = [];
  const pdfRequests: string[] = [];
  page.on('request', (request) => {
    if (/\.pdf$/i.test(new URL(request.url()).pathname)) pdfRequests.push(request.url());
  });
  page.on('console', (message) => { if (message.type() === 'error') resourceErrors.push(`console: ${message.text()}`); });
  page.on('requestfailed', (request) => resourceErrors.push(`request: ${request.url()} ${request.failure()?.errorText}`));
  page.on('response', (response) => {
    if (new URL(response.url()).origin === 'http://127.0.0.1:4173' && response.status() >= 400)
      resourceErrors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
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
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Github', exact: true })).toHaveAttribute('href', course.site.githubUrl);
    // Capture the verified route before keyboard interaction can move focus.
    await page.screenshot({ path: `tmp/qa/${name}-${testInfo.project.name}.png`, fullPage: true });
    await page.keyboard.press('Tab');
    expect(['A', 'BUTTON']).toContain(await page.evaluate(() => document.activeElement?.tagName));
    await expect(page.locator(':focus')).toBeVisible();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe(route);
  }
  expect(resourceErrors).toEqual([]);
  expect(pdfRequests).toEqual([]);
});

test('production CSP блокирует посторонний код, подключения и встраивание', async ({ page }) => {
  // Run eval from a regular same-origin script: DevTools page.evaluate bypasses its CSP check.
  await page.route('**/assets/csp-eval-probe.js', (route) => route.fulfill({
    contentType: 'text/javascript',
    body: 'try { eval("window.__misaoEvalExecuted = true"); window.__misaoEvalBlocked = false; } catch { window.__misaoEvalBlocked = true; }',
  }));
  await page.goto('./');
  await expect(page.locator('main h1')).toHaveText('Дисциплины');
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("script-src 'self' 'sha256-");
  expect(csp?.match(/script-src[^;]+/)?.[0]).not.toMatch(/unsafe-(?:inline|eval)/);
  expect(csp).toContain("style-src-attr 'unsafe-inline'");
  expect(await page.locator('meta[name="referrer"]').getAttribute('content')).toBe('no-referrer');
  const result = await page.evaluate(async () => {
    const violations: string[] = [];
    const expected = new Set(['script-src-elem', 'script-src', 'connect-src', 'object-src']);
    let finish!: () => void;
    const complete = new Promise<void>((resolve) => { finish = resolve; });
    const listener = (event: SecurityPolicyViolationEvent) => {
      violations.push(event.effectiveDirective);
      expected.delete(event.effectiveDirective);
      if (!expected.size) finish();
    };
    document.addEventListener('securitypolicyviolation', listener);
    const probe = document.createElement('script');
    probe.textContent = 'window.__misaoInjectedCode = true';
    document.body.append(probe);
    const evalProbe = document.createElement('script');
    evalProbe.src = new URL('assets/csp-eval-probe.js', location.href).href;
    await new Promise<void>((resolve, reject) => {
      evalProbe.onload = () => resolve();
      evalProbe.onerror = () => reject(new Error('Same-origin CSP test script failed to load'));
      document.body.append(evalProbe);
    });
    let fetchBlocked = false;
    try { await fetch(new URL('csp-probe', location.href)); } catch { fetchBlocked = true; }
    const object = document.createElement('object');
    object.data = new URL('csp-probe', location.href).href;
    document.body.append(object);
    const timeout = setTimeout(finish, 2000);
    await complete;
    clearTimeout(timeout);
    document.removeEventListener('securitypolicyviolation', listener);
    probe.remove(); evalProbe.remove(); object.remove();
    const state = window as unknown as Record<string, unknown>;
    return { violations, evalBlocked: state.__misaoEvalBlocked, fetchBlocked, executed: Boolean(state.__misaoInjectedCode || state.__misaoEvalExecuted) };
  });
  expect(result.executed).toBe(false);
  expect(result.evalBlocked).toBe(true);
  expect(result.fetchBlocked).toBe(true);
  expect(result.violations).toEqual(expect.arrayContaining(['script-src-elem', 'script-src', 'connect-src', 'object-src']));
  await expect(page.locator('main h1')).toHaveText('Дисциплины');
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
  await (await revealThemeButton(page)).click();
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
  await (await revealThemeButton(page)).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', initial === 'dark' ? 'light' : 'dark');
  await expect(page.getByRole('heading', { name: 'Дисциплины', exact: true, level: 1 })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', initial);
});

test('header показывает сову, центрирует desktop-навигацию и управляет мобильным меню', async ({ page, request }, testInfo) => {
  await page.goto('./');
  const header = page.getByRole('banner');
  const brand = header.getByRole('link', { name: `${course.site.shortTitle} — главная`, exact: true });
  const logo = brand.locator('img');
  await expect(logo).toHaveAttribute('src', '/misao/owl-logo.svg');
  expect((await brand.textContent())?.trim()).toBe('');
  await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  const logoResponse = await request.get('/misao/owl-logo.svg');
  expect(logoResponse.ok()).toBe(true);
  expect(logoResponse.headers()['content-type']).toContain('image/svg+xml');

  const navigation = page.locator('#primary-navigation');
  const menuButton = header.getByRole('button', { name: /^(Открыть|Закрыть) меню$/ });
  const navLink = navigation.getByRole('link', { name: 'Дисциплины', exact: true });
  if (page.viewportSize()!.width > 760) {
    await expect(menuButton).toBeHidden();
    await expect(navigation).not.toHaveAttribute('hidden');
    await expect(navLink).toBeVisible();
    const linkBox = await navLink.boundingBox();
    expect(linkBox).not.toBeNull();
    expect(Math.abs(linkBox!.x + linkBox!.width / 2 - page.viewportSize()!.width / 2)).toBeLessThanOrEqual(2);
    const toggleBox = await header.getByRole('button', { name: /^Включить/ }).boundingBox();
    expect(toggleBox!.x).toBeGreaterThan(linkBox!.x + linkBox!.width);
  } else {
    await expect(navigation).toBeHidden();
    await menuButton.click();
    await expect(navigation).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `tmp/qa/menu-${testInfo.project.name}.png`, fullPage: true });
    await menuButton.click();
    await expect(navigation).toBeHidden();
  }

  await page.setViewportSize({ width: 760, height: 900 });
  await expect(menuButton).toBeVisible();
  await expect(navigation).toBeHidden();
  await page.setViewportSize({ width: 761, height: 900 });
  await expect(menuButton).toBeHidden();
  await expect(navLink).toBeVisible();
  await page.setViewportSize({ width: 375, height: 900 });
  await expect(menuButton).toBeVisible();
  await expect(menuButton).toHaveAttribute('aria-controls', 'primary-navigation');
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  await expect(navigation).toBeHidden();
  await expect(header.getByRole('button', { name: /^Включить/ })).toBeHidden();
  await menuButton.focus();
  await page.keyboard.press('Enter');
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  await expect(navigation).toBeVisible();
  await expect(navLink).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `tmp/qa/menu-375-${testInfo.project.name}.png`, fullPage: true });
  await page.keyboard.press('Escape');
  await expect(navigation).toBeHidden();
  await expect(menuButton).toBeFocused();
  await menuButton.click();
  await page.getByRole('contentinfo').click({ position: { x: 8, y: 8 } });
  await expect(navigation).toBeHidden();

  if (subject) {
    await page.goto(`./${subjectRoute(subject.id)}`);
    await menuButton.click();
    await navLink.click();
    await expect(page.locator('main h1.page-title')).toHaveText('Дисциплины');
    await expect(navigation).toBeHidden();
    await expect(page.locator('main')).toBeFocused();
    await page.goto(`./${subjectRoute(subject.id)}`);
    await menuButton.click();
    await brand.click();
    await expect(page.locator('main h1.page-title')).toHaveText('Дисциплины');
    await expect(navigation).toBeHidden();
  }

  await menuButton.click();
  await expect(navLink).toBeFocused();
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(menuButton).toBeHidden();
  await expect(navigation).not.toHaveAttribute('hidden');
  await expect(navLink).toBeVisible();
  await expect(page.locator('.menu-toggle')).toHaveAttribute('aria-expanded', 'false');
  await page.setViewportSize({ width: 375, height: 900 });
  await expect(navigation).toBeHidden();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  await expect(menuButton).toBeFocused();
});
