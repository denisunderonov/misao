import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

type Field = { name: string; type: string; list?: boolean; fields?: Field[]; options?: { extensions?: string[] } };
type Entry = { name: string; type: string; path: string; format: string; fields: Field[] };

const config = parse(readFileSync(fileURLToPath(new URL('../.pages.yml', import.meta.url)), 'utf8')) as {
  content: Entry[];
};

describe('Pages CMS редактирует тот же контент, который собирает сайт', () => {
  it('настройки и дисциплины записываются в исходные JSON-файлы', () => {
    expect(config.content.find((item) => item.name === 'site')).toMatchObject({
      type: 'file', path: 'content/site.json', format: 'json',
    });
    expect(config.content.find((item) => item.name === 'site')?.fields.some((field) => field.name === 'githubUrl')).toBe(true);
    const subjects = config.content.find((item) => item.name === 'subjects')!;
    expect(subjects).toMatchObject({ type: 'file', path: 'content/subjects.json', format: 'json' });
    const list = subjects.fields.find((field) => field.name === 'subjects')!;
    expect(list).toMatchObject({ type: 'object', list: true });
    expect(list.fields?.map((field) => field.name)).toEqual(expect.arrayContaining(['id', 'title', 'icon', 'color', 'sections']));
    expect(list.fields?.some((field) => field.name === 'description')).toBe(false);
    expect(list.fields?.find((field) => field.name === 'sections')?.fields?.map((field) => field.name)).toEqual(expect.arrayContaining(['id', 'title', 'order']));
  });

  it('редактор тем сохраняет Markdown, метаданные и переключатель публикации', () => {
    const topics = config.content.find((item) => item.name === 'topics')!;
    expect(topics).toMatchObject({ type: 'collection', path: 'content/topics', format: 'yaml-frontmatter' });
    expect(topics.fields.map((field) => field.name)).toEqual(expect.arrayContaining([
      'subject', 'section', 'slug', 'title', 'summary', 'order', 'updatedAt', 'published', 'body',
    ]));
    expect(topics.fields.find((field) => field.name === 'body')?.type).toBe('rich-text');
    expect(topics.fields.find((field) => field.name === 'published')?.type).toBe('boolean');
    expect(topics.fields.some((field) => field.name === 'pdf')).toBe(false);
  });

  it('хранит домашние задания в отдельной Markdown-коллекции', () => {
    const assignments = config.content.find((item) => item.name === 'assignments')!;
    expect(assignments).toMatchObject({ type: 'collection', path: 'content/assignments', format: 'yaml-frontmatter' });
    expect(assignments.fields.map((field) => field.name)).toEqual(expect.arrayContaining([
      'subject', 'section', 'slug', 'title', 'summary', 'order', 'updatedAt', 'published', 'body',
    ]));
    expect(assignments.fields.find((field) => field.name === 'body')?.type).toBe('rich-text');
  });

  it('редактор текстовых материалов не предлагает загрузку файлов', () => {
    expect(config).not.toHaveProperty('media');
    const fields = config.content.flatMap((entry) => entry.fields);
    expect(fields.some((field) => field.name === 'pdf' || field.type === 'file')).toBe(false);
  });
});
