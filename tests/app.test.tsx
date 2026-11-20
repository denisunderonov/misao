// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../src/App';

vi.mock('../src/lib/content', () => ({
  content: {
    site: { title: 'Тестовый сайт', shortTitle: 'Тест', description: 'Объяснения и задания', academicYear: '2026', footer: 'Учебные материалы', adminUrl: '', githubUrl: 'https://github.com/example', demo: false },
    subjects: [
      { id: 'math', title: 'Математика', icon: 'calculator', color: 'blue', sections: [{ id: 'algebra', title: 'Алгебра', order: 1 }] },
      { id: 'empty', title: 'Пустая дисциплина', icon: 'book', color: 'mint', sections: [] },
    ],
    topics: [{
      subject: 'math', section: 'algebra', slug: 'equations', title: 'Уравнения', summary: 'Проверяем Markdown', order: 1,
      updatedAt: '2026-11-18', published: true,
      body: '## Пример\n\n**Важное правило**\n\n| x | 2x |\n| - | - |\n| 3 | 6 |\n\n<script>window.__unsafe = true</script>\n\n[Опасная ссылка](javascript:alert(1))\n\n$\\frac{1}{2}$\n\n$$\nx^2+2x+1\n$$',
    }],
    assignments: [{
      subject: 'math', section: 'algebra', slug: 'equations', title: 'Практика уравнений', summary: 'Задание на дом', order: 1,
      updatedAt: '2026-11-18', published: true,
      body: '## Выполните работу\n\n**Решите сами:**\n\n1. 2x = 6\n2. x + 5 = 9\n3. 3x = 12\n4. x − 7 = 1\n5. x / 2 = 5\n\nТри одинаковые тетради стоят 90 рублей. Найдите цену одной тетради.',
    }],
  },
  assetUrl: (path: string) => `/test-base/${path.replace(/^\/+/, '')}`,
  topicPath: (subject: string, slug: string) => `/subjects/${subject}/topics/${slug}`,
  homeworkPath: (subject: string, slug: string) => `/subjects/${subject}/homework/${slug}`,
  plural: (_count: number, forms: string[]) => forms[0],
}));

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = '';
  vi.stubGlobal('scrollTo', vi.fn());
  vi.stubGlobal('innerWidth', 1024);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Чтение материалов и состояния интерфейса', () => {
  it.each(['/subjects/missing', '/subjects/math/topics/missing', '/subjects/math/homework/missing', '/missing'])('показывает ошибку неизвестного адреса %s и позволяет вернуться к дисциплинам', async (route) => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Такой страницы нет' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /Все дисциплины/ }));
    expect(screen.getByRole('heading', { name: /^Дисциплины/ })).toBeInTheDocument();
    expect(document.title).toContain('Учебные материалы');
  });

  it('показывает пустую дисциплину без чужих тем и PDF', () => {
    render(<MemoryRouter initialEntries={['/subjects/empty']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Пустая дисциплина' })).toBeInTheDocument();
    expect(screen.getAllByText('Материалы скоро появятся', { exact: true })).toHaveLength(2);
    expect(screen.queryByRole('link', { name: /^Скачать задание/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Уравнения' })).not.toBeInTheDocument();
  });

  it('отображает Markdown и таблицу, не выполняя HTML и javascript-ссылки', () => {
    const { container } = render(<MemoryRouter initialEntries={['/subjects/math/topics/equations']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Пример' })).toBeInTheDocument();
    expect(screen.getByText('Важное правило').tagName).toBe('STRONG');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(container.querySelector('article script')).toBeNull();
    const unsafeLink = screen.getByText('Опасная ссылка');
    expect(unsafeLink.getAttribute('href') ?? '').not.toMatch(/^javascript:/i);
    expect(screen.queryByRole('link', { name: /^Скачать задание/ })).not.toBeInTheDocument();
  });

  it('разделяет ссылки на базу знаний и домашние задания одной дисциплины', () => {
    render(<MemoryRouter initialEntries={['/subjects/math']}><App /></MemoryRouter>);
    const knowledge = within(screen.getByRole('region', { name: 'База знаний' }));
    const homework = within(screen.getByRole('region', { name: 'Домашние задания' }));
    expect(knowledge.getByRole('link', { name: /Уравнения/ })).toHaveAttribute('href', '/subjects/math/topics/equations');
    expect(knowledge.queryByRole('link', { name: /Практика уравнений/ })).not.toBeInTheDocument();
    expect(homework.getByRole('link', { name: /Практика уравнений/ })).toHaveAttribute('href', '/subjects/math/homework/equations');
  });

  it('отображает текст отдельного домашнего задания со всеми условиями прямо на странице', () => {
    render(<MemoryRouter initialEntries={['/subjects/math/homework/equations']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Практика уравнений' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Выполните работу' })).toBeInTheDocument();
    expect(screen.getByText('Решите сами:').tagName).toBe('STRONG');
    const equations = within(screen.getByRole('article')).getAllByRole('listitem');
    expect(equations.map((item) => item.textContent)).toEqual(['2x = 6', 'x + 5 = 9', '3x = 12', 'x − 7 = 1', 'x / 2 = 5']);
    expect(screen.getByText('Три одинаковые тетради стоят 90 рублей. Найдите цену одной тетради.')).toBeInTheDocument();
    expect(document.querySelector('a[download], a[href$=".pdf" i]')).toBeNull();
    expect(screen.queryByRole('button', { name: /скачать|pdf/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Пример' })).not.toBeInTheDocument();
  });

  it('показывает ссылку автора в footer из настроек сайта', () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    const footer = within(screen.getByRole('contentinfo'));
    expect(footer.getByRole('link', { name: 'Github', exact: true })).toHaveAttribute('href', 'https://github.com/example');
    expect(footer.getByText(/Дизайн и разработка сайта:/)).toBeInTheDocument();
    expect(footer.getByText('© 2026', { exact: true })).toBeInTheDocument();
  });

  it('ссылка пропуска навигации переносит фокус в основное содержимое', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><App /></MemoryRouter>);
    await user.tab();
    expect(screen.getByRole('link', { name: 'Перейти к содержимому' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('main')).toHaveFocus();
  });
});

describe('Логотип и мобильная навигация', () => {
  it('использует изображение совы с base path и доступным именем ссылки на главную', () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    const brand = screen.getByRole('link', { name: 'Тест — главная' });
    expect(brand.querySelector('img')).toHaveAttribute('src', '/test-base/owl-logo.svg');
    expect(brand.textContent?.trim()).toBe('');
  });

  it('скрывает мобильные ссылки и тему, открывает с фокусом и закрывает по Escape и вне меню', async () => {
    vi.stubGlobal('innerWidth', 375);
    const user = userEvent.setup();
    render(<MemoryRouter><App /></MemoryRouter>);
    const navigation = document.getElementById('primary-navigation')!;
    const opener = screen.getByRole('button', { name: 'Открыть меню' });
    expect(opener).toHaveAttribute('aria-expanded', 'false');
    expect(opener).toHaveAttribute('aria-controls', navigation.id);
    expect(navigation).toHaveAttribute('hidden');
    expect(screen.queryByRole('button', { name: /^Включить/ })).not.toBeInTheDocument();
    await user.click(opener);
    expect(navigation).not.toHaveAttribute('hidden');
    expect(screen.getByRole('button', { name: 'Закрыть меню' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(navigation).getByRole('link', { name: 'Дисциплины' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(navigation).toHaveAttribute('hidden');
    expect(screen.getByRole('button', { name: 'Открыть меню' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Открыть меню' }));
    await user.click(screen.getByRole('heading', { name: 'Дисциплины' }));
    expect(navigation).toHaveAttribute('hidden');
    await user.click(screen.getByRole('button', { name: 'Открыть меню' }));
    await user.click(within(navigation).getByRole('link', { name: 'Дисциплины' }));
    expect(navigation).toHaveAttribute('hidden');
    expect(screen.getByRole('button', { name: 'Открыть меню' })).toHaveFocus();
  });

  it('закрывает мобильное меню после перехода по навигации и логотипу', async () => {
    vi.stubGlobal('innerWidth', 375);
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/subjects/math']}><App /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: 'Открыть меню' }));
    await user.click(within(screen.getByRole('navigation', { name: 'Основная навигация' })).getByRole('link', { name: 'Дисциплины' }));
    expect(screen.getByRole('heading', { name: 'Дисциплины' })).toBeInTheDocument();
    expect(document.getElementById('primary-navigation')).toHaveAttribute('hidden');
    await user.click(screen.getByRole('link', { name: /^Математика/ }));
    await user.click(screen.getByRole('button', { name: 'Открыть меню' }));
    await user.click(screen.getByRole('link', { name: 'Тест — главная' }));
    expect(screen.getByRole('heading', { name: 'Дисциплины' })).toBeInTheDocument();
    expect(document.getElementById('primary-navigation')).toHaveAttribute('hidden');
  });

  it('при переходе на desktop переносит фокус со скрываемого burger и сбрасывает меню', async () => {
    vi.stubGlobal('innerWidth', 375);
    const user = userEvent.setup();
    render(<MemoryRouter><App /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: 'Открыть меню' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Открыть меню' })).toHaveFocus();
    act(() => { vi.stubGlobal('innerWidth', 1024); window.dispatchEvent(new Event('resize')); });
    const navigation = screen.getByRole('navigation', { name: 'Основная навигация' });
    expect(navigation).not.toHaveAttribute('hidden');
    expect(within(navigation).getByRole('link', { name: 'Дисциплины' })).toHaveFocus();
    // CSS can hide and blur the desktop link before the browser dispatches resize.
    (document.activeElement as HTMLElement).blur();
    act(() => { vi.stubGlobal('innerWidth', 375); window.dispatchEvent(new Event('resize')); });
    expect(navigation).toHaveAttribute('hidden');
    expect(screen.getByRole('button', { name: 'Открыть меню' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Открыть меню' })).toHaveFocus();
  });
});

describe('Переключение оформления', () => {
  it('загружает сохранённую тему, переключает и восстанавливает её при новом открытии', async () => {
    localStorage.setItem('misao-theme', 'dark');
    const user = userEvent.setup();
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    await user.click(screen.getByRole('button', { name: 'Включить светлую тему' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(localStorage.getItem('misao-theme')).toBe('light');
    cleanup();
    delete document.documentElement.dataset.theme;
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(screen.getByRole('button', { name: 'Включить тёмную тему' })).toBeInTheDocument();
  });

  it('продолжает переключать тему при запрете чтения и записи localStorage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    const user = userEvent.setup();
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    await user.click(screen.getByRole('button', { name: 'Включить тёмную тему' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('heading', { name: 'Дисциплины' })).toBeInTheDocument();
  });
});

 it('отображает строчные и блочные формулы как KaTeX и MathML без ошибок', () => {
  render(<MemoryRouter initialEntries={['/subjects/math/topics/equations']}><App /></MemoryRouter>);
  expect(document.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(2);
  expect(document.querySelector('.katex-display math')).not.toBeNull();
  expect(document.querySelector('.katex-error')).toBeNull();
 });
