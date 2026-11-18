// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../src/App';

vi.mock('../src/lib/content', () => ({
  content: {
    site: { title: 'Тестовый сайт', shortTitle: 'Тест', description: 'Объяснения и задания', academicYear: '2026', footer: 'Учебные материалы', adminUrl: '', githubUrl: 'https://github.com/example', demo: false },
    subjects: [
      { id: 'math', title: 'Математика', description: 'Задачи', icon: 'calculator', color: 'blue', sections: [{ id: 'algebra', title: 'Алгебра', order: 1 }] },
      { id: 'empty', title: 'Пустая дисциплина', description: 'Пока готовится', icon: 'book', color: 'mint', sections: [] },
    ],
    topics: [{
      subject: 'math', section: 'algebra', slug: 'equations', title: 'Уравнения', summary: 'Проверяем Markdown', order: 1,
      updatedAt: '2026-11-18', published: true,
      body: '## Пример\n\n**Важное правило**\n\n| x | 2x |\n| - | - |\n| 3 | 6 |\n\n<script>window.__unsafe = true</script>\n\n[Опасная ссылка](javascript:alert(1))',
    }],
    assignments: [{
      subject: 'math', section: 'algebra', slug: 'equations', title: 'Практика уравнений', summary: 'Задание на дом', order: 1,
      pdf: '/files/equations.pdf', updatedAt: '2026-11-18', published: true,
      body: '## Выполните работу\n\n**Решите сами:**\n\n1. Найдите x в уравнении 2x = 6.\n2. Проверьте ответ.',
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

  it('отображает текст отдельного домашнего задания и скачивание PDF с base path', () => {
    render(<MemoryRouter initialEntries={['/subjects/math/homework/equations']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Практика уравнений' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Выполните работу' })).toBeInTheDocument();
    expect(screen.getByText('Решите сами:').tagName).toBe('STRONG');
    expect(screen.getByRole('link', { name: 'Скачать задание' })).toHaveAttribute('href', '/test-base/files/equations.pdf');
    expect(screen.getByRole('link', { name: 'Скачать задание' })).toHaveAttribute('download');
    expect(screen.queryByRole('heading', { name: 'Пример' })).not.toBeInTheDocument();
  });

  it('показывает ссылку автора в footer из настроек сайта', () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(within(screen.getByRole('contentinfo')).getByRole('link', { name: 'мой github' })).toHaveAttribute('href', 'https://github.com/example');
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
