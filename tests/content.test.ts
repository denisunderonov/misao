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
      id: 'mathematics', title: 'Математика',
      icon: 'calculator', color: 'blue',
      sections: [{ id: 'algebra', title: 'Основы алгебры', order: 1 }],
    }],
    topics: [{
      subject: 'mathematics', section: 'algebra', slug: 'linear-equations',
      title: 'Линейные уравнения', order: 1,
      updatedAt: '2026-11-18',
      published: true, body: '# Линейные уравнения\n\nРешим уравнение 2x = 6.',
    }],
    assignments: [{
      subject: 'mathematics', section: 'algebra', slug: 'linear-equations',
      title: 'Практика линейных уравнений', order: 1,
      updatedAt: '2026-11-18',
      published: true, body: '1. Решите 2x = 6.\n2. Проверьте ответ подстановкой.',
    }],
  };
}

describe('Проверка учебных материалов перед публикацией', () => {
  it('принимает корректную структуру и сохраняет текст темы', async () => {
    const input = fixture();
    const result = await validateContent(input);
    expect(result.subjects).toHaveLength(1);
    expect(result.subjects[0]).not.toHaveProperty('description');
    expect(result.topics).toHaveLength(1);
    expect(result.topics[0].body).toContain('2x = 6');
    expect(result.topics[0]).not.toHaveProperty('pdf');
    expect(result.topics[0]).not.toHaveProperty('summary');
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].body).toBe(input.assignments[0].body);
    expect(result.assignments[0]).not.toHaveProperty('pdf');
    expect(result.assignments[0]).not.toHaveProperty('summary');
  });

  it.each(['topics', 'assignments'] as const)('не переносит устаревшую подпись в публичные данные %s', async (collection) => {
    const input = fixture();
    Object.assign(input[collection][0], { summary: 'Устаревшая подпись' });
    const result = await validateContent(input);
    expect(result[collection][0]).not.toHaveProperty('summary');
  });

  it('принимает одинаковый slug теории и ДЗ: у них разные адреса', async () => {
    const result = await validateContent(fixture());
    expect(result.topics[0].slug).toBe(result.assignments[0].slug);
  });

  it('принимает базу знаний без домашних заданий', async () => {
    const input = { ...fixture(), assignments: [] };
    const result = await validateContent(input);
    expect(result.topics).toHaveLength(1);
    expect(result.assignments).toEqual([]);
  });

  it('принимает удаление последней записи, когда Git больше не содержит каталоги коллекций', async ({ onTestFinished }) => {
    const repository = await mkdtemp(path.join(tmpdir(), 'misao-empty-'));
    onTestFinished(() => rm(repository, { recursive: true, force: true }));
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
    await expect(Promise.resolve().then(() => validateContent(input))).rejects.toThrow();
  });

  it('требует непустое условие опубликованного домашнего задания', async () => {
    const input = fixture();
    input.assignments[0].body = '   ';
    await expect(Promise.resolve().then(() => validateContent(input))).rejects.toThrow();
  });

  it('не публикует черновик', async () => {
    const input = fixture();
    input.topics[0].published = false;
    const result = await validateContent(input);
    expect(result.topics).toHaveLength(0);
  });

  it('позволяет сохранить незаполненный черновик, не добавляя его на сайт', async () => {
    const input = { ...fixture(), topics: [{ published: false, title: 'Новая тема' }] };
    const result = await validateContent(input);
    expect(result.topics).toEqual([]);
  });

  it('не публикует черновик ДЗ без обязательных полей', async () => {
    const input = { ...fixture(), assignments: [{ published: false, title: 'Новая работа' }] };
    const result = await validateContent(input);
    expect(result.assignments).toEqual([]);
  });

  it('запрещает одинаковые идентификаторы дисциплин', async () => {
    const input = fixture();
    input.subjects.push({ ...input.subjects[0] });
    await expect(Promise.resolve().then(() => validateContent(input))).rejects.toThrow();
  });

  it('запрещает одинаковые идентификаторы разделов внутри дисциплины', async () => {
    const input = fixture();
    input.subjects[0].sections.push({ ...input.subjects[0].sections[0] });
    await expect(Promise.resolve().then(() => validateContent(input))).rejects.toThrow();
  });

  it('отклоняет тему с несуществующей дисциплиной', async () => {
    const input = fixture();
    input.topics[0].subject = 'missing';
    await expect(Promise.resolve().then(() => validateContent(input))).rejects.toThrow();
  });

  it('отклоняет тему с несуществующим разделом', async () => {
    const input = fixture();
    input.topics[0].section = 'missing';
    await expect(Promise.resolve().then(() => validateContent(input))).rejects.toThrow();
  });

  it('предотвращает коллизию адресов тем одной дисциплины', async () => {
    const input = fixture();
    input.topics.push({ ...input.topics[0], title: 'Другая тема' });
    await expect(Promise.resolve().then(() => validateContent(input))).rejects.toThrow();
  });

  it('предотвращает коллизию адресов домашних заданий одной дисциплины', async () => {
    const input = fixture();
    input.assignments.push({ ...input.assignments[0], title: 'Другая работа' });
    await expect(Promise.resolve().then(() => validateContent(input))).rejects.toThrow();
  });

  it.each(['subject', 'section'] as const)('отклоняет ДЗ с несуществующим %s', async (field) => {
    const input = fixture();
    input.assignments[0][field] = 'missing';
    await expect(Promise.resolve().then(() => validateContent(input))).rejects.toThrow();
  });

  it('отклоняет пустое объяснение', async () => {
    const input = fixture();
    input.topics[0].body = ' \n\n ';
    await expect(Promise.resolve().then(() => validateContent(input))).rejects.toThrow();
  });

  it.each(['not-a-date', '2026-02-30'])('отклоняет неверную дату %s', async (date) => {
    const input = fixture();
    input.topics[0].updatedAt = date;
    await expect(Promise.resolve().then(() => validateContent(input))).rejects.toThrow();
  });
});

describe('Безопасный YAML frontmatter', () => {
  let repository: string;
  beforeEach(async () => {
    repository = await mkdtemp(path.join(tmpdir(), 'misao-frontmatter-'));
    await mkdir(path.join(repository, 'content/topics'), { recursive: true });
    await mkdir(path.join(repository, 'content/assignments'), { recursive: true });
    const input = fixture();
    await writeFile(path.join(repository, 'content/site.json'), JSON.stringify(input.site));
    await writeFile(path.join(repository, 'content/subjects.json'), JSON.stringify({ subjects: input.subjects }));
  });
  afterEach(async () => {
    delete (globalThis as Record<string, unknown>).__misaoSecurityProbe;
    await rm(repository, { recursive: true, force: true });
  });
  it.each(['topics', 'assignments'])('не исполняет JavaScript из заголовка %s', async (collection) => {
    await writeFile(path.join(repository, `content/${collection}/probe.md`),
      '---javascript\n(globalThis.__misaoSecurityProbe = true, {})\n---\nBody');
    expect(() => loadContent(repository)).toThrow();
    expect((globalThis as Record<string, unknown>).__misaoSecurityProbe).toBeUndefined();
  });
  it.each(['---js', '---yaml', '---json', '--- javascript'])('отклоняет выбор движка %s', async (delimiter) => {
    await writeFile(path.join(repository, 'content/topics/probe.md'), `${delimiter}\ntitle: Probe\n---\nBody`);
    expect(() => loadContent(repository)).toThrow(/frontmatter/i);
  });
  it.each(['---\ntitle: Probe', 'title: Probe\n---\nBody', '---\ntitle: A\ntitle: B\n---\nBody', '---\nx: !!js/function function(){}\n---\nBody'])('отклоняет неполные или неоднозначные метаданные %#', async (source) => {
    await writeFile(path.join(repository, 'content/topics/probe.md'), source);
    expect(() => loadContent(repository)).toThrow(/frontmatter/i);
  });
  it.each(['\n', '\r\n'])('читает YAML, дату, кириллицу и Markdown с EOL %#', async (eol) => {
    const source = ['---', 'subject: mathematics', 'section: algebra', 'slug: test', 'title: Тест',
      'summary: Пример', 'order: 1', 'updatedAt: 2026-11-19', 'published: true', '---', '', '# Тема', '', '**Текст**.'].join(eol);
    await writeFile(path.join(repository, 'content/topics/probe.md'), source);
    const result = loadContent(repository);
    expect(result.topics[0]).toMatchObject({ title: 'Тест', updatedAt: '2026-11-19' });
    expect(result.topics[0].body).toContain('**Текст**.');
  });
});

describe('Настоящий контент репозитория', () => {
  it('загружает согласованные источники и проверяет все опубликованные файлы', async () => {
    const result = await loadContent(rootDir);
    expect(result.site.title.trim()).not.toBe('');
    expect(Array.isArray(result.subjects)).toBe(true);
    expect(Array.isArray(result.topics)).toBe(true);
    expect(Array.isArray(result.assignments)).toBe(true);
    for (const material of [...result.topics, ...result.assignments]) {
      expect(material).not.toHaveProperty('summary');
      expect(material.body).not.toMatch(/^#{1,6}\s+Источники для повторения\s*$/m);
    }
    const validatedAgain = await validateContent(result);
    expect(validatedAgain).toEqual(result);
  });
});

it('исключает устаревшие подписи и сохраняет булеву метку new', () => {
  const input = fixture();
  const result = validateContent({ ...input,
    topics: input.topics.map(topic => ({ ...topic, isNew: true })),
    assignments: input.assignments.map(item => ({ ...item, isNew: false })),
  });
  expect(result.topics[0]).not.toHaveProperty('summary');
  expect(result.assignments[0]).not.toHaveProperty('summary');
  expect(result.topics[0].isNew).toBe(true);
  expect(result.assignments[0].isNew).toBe(false);
  expect(result.subjects[0].isNew).toBe(false);
  expect(() => validateContent({ ...input, topics: input.topics.map(topic => ({ ...topic, isNew: 'true' })) })).toThrow();
});
