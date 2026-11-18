import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';

const text = z.string().trim().min(1);
const identifier = text.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const order = z.number().int().min(0);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date');

const siteSchema = z.object({
  title: text, shortTitle: text, description: text, academicYear: text, footer: text,
  adminUrl: z.union([z.literal(''), z.string().url().refine((value) => value.startsWith('https://'), 'Use HTTPS')]),
  demo: z.boolean(),
  githubUrl: z.string().url().refine((value) => /^https:\/\/github\.com\/[a-zA-Z0-9-]+\/?$/.test(value), 'Use a GitHub profile URL'),
});
const subjectSchema = z.object({
  id: identifier, title: text, description: text,
  icon: z.enum(['calculator', 'code', 'globe', 'database', 'braces', 'book']),
  color: z.enum(['blue', 'mint', 'violet', 'peach']),
  sections: z.array(z.object({ id: identifier, title: text, order })),
});
const topicSchema = z.object({
  subject: identifier, section: identifier, slug: identifier, title: text, summary: text,
  order, updatedAt: date, published: z.boolean().default(true), body: text,
});
const assignmentSchema = topicSchema.extend({ pdf: text });

function assertUnique(values, label) {
  if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label}`);
}

/** Validate published content. Unfinished drafts stay outside the public bundle. */
export function validateContent(input, { publicDir } = {}) {
  const site = siteSchema.parse(input.site);
  const subjects = z.array(subjectSchema).parse(input.subjects);
  assertUnique(subjects.map((subject) => subject.id), 'subject id');
  for (const subject of subjects) {
    assertUnique(subject.sections.map((section) => section.id), `section id in ${subject.id}`);
    subject.sections.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }
  if (!Array.isArray(input.topics)) throw new Error('topics must be an array');
  const topics = input.topics.filter((topic) => topic.published !== false).map((topic) => topicSchema.parse(topic));
  if (input.assignments !== undefined && !Array.isArray(input.assignments)) throw new Error('assignments must be an array');
  const assignments = (input.assignments ?? []).filter((assignment) => assignment.published !== false).map((assignment) => assignmentSchema.parse(assignment));
  assertUnique(topics.map((topic) => `${topic.subject}/${topic.slug}`), 'topic slug');
  assertUnique(assignments.map((assignment) => `${assignment.subject}/${assignment.slug}`), 'assignment slug');
  for (const topic of [...topics, ...assignments]) {
    const subject = subjects.find((item) => item.id === topic.subject);
    if (!subject) throw new Error(`Unknown subject: ${topic.subject}`);
    if (!subject.sections.some((section) => section.id === topic.section)) throw new Error(`Unknown section: ${topic.section}`);
  }
  for (const topic of assignments) {
    // Only repository-owned PDF files: no external URLs, traversal, query or encoded path segments.
    if (!/^\/files\/[a-zA-Z0-9_./-]+\.pdf$/.test(topic.pdf) || topic.pdf.split('/').some((segment) => segment === '..' || segment === '.')) {
      throw new Error(`Unsafe PDF path: ${topic.pdf}`);
    }
    if (publicDir) {
      const root = fs.realpathSync(publicDir);
      const file = path.resolve(root, `.${topic.pdf}`);
      if (!fs.existsSync(file)) throw new Error(`Missing PDF: ${topic.pdf}`);
      const realFile = fs.realpathSync(file);
      if (!realFile.startsWith(`${root}${path.sep}`)) throw new Error(`Unsafe PDF path: ${topic.pdf}`);
      if (!fs.statSync(realFile).isFile()) throw new Error(`Invalid PDF file: ${topic.pdf}`);
      const handle = fs.openSync(realFile, 'r');
      const header = Buffer.alloc(5);
      try { fs.readSync(handle, header, 0, 5, 0); } finally { fs.closeSync(handle); }
      if (header.toString('ascii') !== '%PDF-') throw new Error(`Invalid PDF header: ${topic.pdf}`);
    }
  }
  topics.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
  assignments.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
  return { site, subjects, topics, assignments };
}

export function loadContent(rootDir) {
  const contentDir = path.join(rootDir, 'content');
  const site = JSON.parse(fs.readFileSync(path.join(contentDir, 'site.json'), 'utf8'));
  const { subjects } = JSON.parse(fs.readFileSync(path.join(contentDir, 'subjects.json'), 'utf8'));
  function loadCollection(collection) {
    const directory = path.join(contentDir, collection);
    // Git does not retain empty directories after the owner removes the last entry.
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory).filter((name) => name.endsWith('.md')).sort().map((name) => {
      const { data, content } = matter(fs.readFileSync(path.join(directory, name), 'utf8'));
      if (data.updatedAt instanceof Date) data.updatedAt = data.updatedAt.toISOString().slice(0, 10);
      return { ...data, body: content.trim() };
    });
  }
  const topics = loadCollection('topics');
  const assignments = loadCollection('assignments');
  return validateContent({ site, subjects, topics, assignments }, { publicDir: path.join(rootDir, 'public') });
}
