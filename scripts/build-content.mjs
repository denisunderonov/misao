import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent } from './content.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  const content = loadContent(root);
  const target = path.join(root, 'src/generated/content.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(content, null, 2)}\n`);
  console.log(`Content validated: ${content.subjects.length} subjects, ${content.topics.length} published topics, ${content.assignments.length} homework assignments.`);
} catch (error) {
  console.error('Content validation failed:', error.message);
  process.exitCode = 1;
}
