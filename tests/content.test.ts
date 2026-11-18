import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent, validateContent } from '../scripts/content.mjs';

const rootDir = fileURLToPath(new URL('..', import.meta.url));

function fixture() {
  return {
    site: {
      title: 'МИСАО', shortTitle: 'МИСАО', description: 'Учебные материалы',
      academicYear: '2026 / 2027', footer: 'МИСАО',
      adminUrl: 'https://app.pagescms.org', githubUrl: 'https://github.com/example', demo: true,
    },
    subjects: [{
      id: 'mathematics', title: 'Математика', description: 'Основы математики',
      icon: 'calculator', color: 'blue',
      sections: [{ id: 'algebra', title: 'Основы алгебры', order: 1 }],
    }],
    topics: [{
      subject: 'mathematics', section: 'algebra', slug: 'linear-equations',
      title: 'Линейные уравнения', summary: 'Разбираем уравнения.', order: 1,
      updatedAt: '2026-11-18',
      published: true, body: '# Линейные уравнения\n\nРешим уравнение 2x = 6.',
    }],
    assignments: [{
      subject: 'mathematics', section: 'algebra', slug: 'linear-equations',
      title: 'Практика линейных уравнений', summary: 'Самостоятельная работа.', order: 1,
      pdf: '/files/linear-equations.pdf', updatedAt: '2026-11-18',
      published: true, body: 'Решите задания из PDF и проверьте ответы подстановкой.',
    }],
  };
}

describe('Проверка учебных материалов перед публикацией', () => {
  let publicDir: string;

  beforeEach(async () => {
    publicDir = await mkdtemp(path.join(tmpdir(), 'misao-content-test-'));
    await mkdir(path.join(publicDir, 'files'));
    await writeFile(path.join(publicDir, 'files/linear-equations.pdf'), '%PDF-1.4\n%%EOF\n');
  });

  afterEach(async () => {
    await rm(publicDir, { recursive: true, force: true });
  });

  it('принимает корректную структуру и сохраняет текст темы', async () => {
    const input = fixture();
    const result = await validateContent(input, { publicDir });
    expect(result.subjects).toHaveLength(1);
    expect(result.topics).toHaveLength(1);
    expect(result.topics[0].body).toContain('2x = 6');
    expect(result.topics[0]).not.toHaveProperty('pdf');
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].pdf).toBe('/files/linear-equations.pdf');
  });

  it('принимает одинаковый slug теории и ДЗ: у них разные адреса', async () => {
    const result = await validateContent(fixture(), { publicDir });
    expect(result.topics[0].slug).toBe(result.assignments[0].slug);
  });

  it('не требует PDF для базы знаний даже при проверке файлов', async () => {
    const input = { ...fixture(), assignments: [] };
    const result = await validateContent(input, { publicDir });
    expect(result.topics).toHaveLength(1);
    expect(result.assignments).toEqual([]);
  });

  it('принимает удаление последней записи, когда Git больше не содержит каталоги коллекций', async () => {
    const repository = path.join(publicDir, 'empty-repository');
    await mkdir(path.join(repository, 'content'), { recursive: true });
    const input = fixture();
    await writeFile(path.join(repository, 'content/site.json'), JSON.stringify(input.site));
    await writeFile(path.join(repository, 'content/subjects.json'), JSON.stringify({ subjects: input.subjects }));
    const result = await loadContent(repository);
    expect(result.topics).toEqual([]);
    expect(result.assignments).toEqual([]);
    expect(result.subjects).toHaveLength(1);
  });

  it.each(['http://github.com/example', 'https://example.com/profile', 'https://github.com/example/repo'])('отклоняет неподходящий адрес автора %s', async (githubUrl) => {
    const input = fixture();
    input.site.githubUrl = githubUrl;
    await expect(Promise.resolve().then(() => validateContent(input, { publicDir }))).rejects.toThrow();
  });

  it('требует PDF для опубликованного домашнего задания', async () => {
    const input = fixture();
    input.assignments[0].pdf = '';
    await expect(Promise.resolve().then(() => validateContent(input, { publicDir }))).rejects.toThrow();
  });

  it('не публикует черновик', async () => {
    const input = fixture();
    input.topics[0].published = false;
    const result = await validateContent(input, { publicDir });
    expect(result.topics).toHaveLength(0);
  });

  it('позволяет сохранить незаполненный черновик, не добавляя его на сайт', async () => {
    const input = { ...fixture(), topics: [{ published: false, title: 'Новая тема' }] };
    const result = await validateContent(input, { publicDir });
    expect(result.topics).toEqual([]);
  });

  it('не публикует черновик ДЗ без обязательных полей', async () => {
    const input = { ...fixture(), assignments: [{ published: false, title: 'Новая работа' }] };
    const result = await validateContent(input, { publicDir });
    expect(result.assignments).toEqual([]);
  });

  it('запрещает одинаковые идентификаторы дисциплин', async () => {
    const input = fixture();
    input.subjects.push({ ...input.subjects[0] });
    await expect(Promise.resolve().then(() => validateContent(input, { publicDir }))).rejects.toThrow();
  });

  it('запрещает одинаковые идентификаторы разделов внутри дисциплины', async () => {
    const input = fixture();
    input.subjects[0].sections.push({ ...input.subjects[0].sections[0] });
    await expect(Promise.resolve().then(() => validateContent(input, { publicDir }))).rejects.toThrow();
  });

  it('отклоняет тему с несуществующей дисциплиной', async () => {
    const input = fixture();
    input.topics[0].subject = 'missing';
    await expect(Promise.resolve().then(() => validateContent(input, { publicDir }))).rejects.toThrow();
  });

  it('отклоняет тему с несуществующим разделом', async () => {
    const input = fixture();
    input.topics[0].section = 'missing';
    await expect(Promise.resolve().then(() => validateContent(input, { publicDir }))).rejects.toThrow();
  });

  it('предотвращает коллизию адресов тем одной дисциплины', async () => {
    const input = fixture();
    input.topics.push({ ...input.topics[0], title: 'Другая тема' });
    await expect(Promise.resolve().then(() => validateContent(input, { publicDir }))).rejects.toThrow();
  });

  it('предотвращает коллизию адресов домашних заданий одной дисциплины', async () => {
    const input = fixture();
    input.assignments.push({ ...input.assignments[0], title: 'Другая работа' });
    await expect(Promise.resolve().then(() => validateContent(input, { publicDir }))).rejects.toThrow();
  });

  it.each(['subject', 'section'] as const)('отклоняет ДЗ с несуществующим %s', async (field) => {
    const input = fixture();
    input.assignments[0][field] = 'missing';
    await expect(Promise.resolve().then(() => validateContent(input, { publicDir }))).rejects.toThrow();
  });

  it.each([
    '/files/../secret.pdf',
    '../secret.pdf',
    'https://example.com/homework.pdf',
    '//example.com/homework.pdf',
    '/files/linear-equations.txt',
    '/files/%2e%2e/secret.pdf',
    '/files/linear-equations.pdf?download=1',
  ])('отклоняет небезопасный или неверный PDF-путь %s', async (pdf) => {
    const input = fixture();
    input.assignments[0].pdf = pdf;
    await expect(Promise.resolve().then(() => validateContent(input, { publicDir }))).rejects.toThrow();
  });

  it('останавливает сборку при отсутствующем PDF', async () => {
    const input = fixture();
    input.assignments[0].pdf = '/files/missing.pdf';
    await expect(Promise.resolve().then(() => validateContent(input, { publicDir }))).rejects.toThrow();
  });

  it('отклоняет переименованный текстовый файл вместо PDF', async () => {
    await writeFile(path.join(publicDir, 'files/linear-equations.pdf'), 'Это не PDF');
    await expect(Promise.resolve().then(() => validateContent(fixture(), { publicDir }))).rejects.toThrow();
  });

  it('отклоняет пустое объяснение', async () => {
    const input = fixture();
    input.topics[0].body = ' \n\n ';
    await expect(Promise.resolve().then(() => validateContent(input, { publicDir }))).rejects.toThrow();
  });

  it.each(['not-a-date', '2026-02-30'])('отклоняет неверную дату %s', async (date) => {
    const input = fixture();
    input.topics[0].updatedAt = date;
    await expect(Promise.resolve().then(() => validateContent(input, { publicDir }))).rejects.toThrow();
  });
});

describe('Настоящий контент репозитория', () => {
  it('загружает согласованные источники и проверяет все опубликованные файлы', async () => {
    const result = await loadContent(rootDir);
    expect(result.site.title.trim()).not.toBe('');
    expect(Array.isArray(result.subjects)).toBe(true);
    expect(Array.isArray(result.topics)).toBe(true);
    expect(Array.isArray(result.assignments)).toBe(true);
    const validatedAgain = await validateContent(result, { publicDir: path.join(rootDir, 'public') });
    expect(validatedAgain).toEqual(result);
  });
});
