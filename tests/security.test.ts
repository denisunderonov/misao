import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { secureHtml } from '../scripts/security';

describe('Защита production HTML', () => {
  const script = '\nlocalStorage.getItem("misao-theme");\n';
  const source = `<!doctype html><html><head><meta charset="UTF-8"><script>${script}</script><script type="module" src="/misao/assets/app.js"></script></head><body></body></html>`;
  it('помещает CSP перед любым скриптом и запрещает постороннее выполнение', () => {
    const html = secureHtml(source);
    expect(html.indexOf('Content-Security-Policy')).toBeLessThan(html.indexOf('<script'));
    for (const directive of ["default-src 'none'", "script-src 'self'", "style-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'", "connect-src 'none'"])
      expect(html).toContain(directive);
    expect(html.match(/script-src[^;]+/)?.[0]).not.toContain("'unsafe-inline'");
    expect(html).toContain("style-src-attr 'unsafe-inline'");
    expect(html).toContain("frame-src https://www.youtube-nocookie.com");
    expect(html).not.toContain("'unsafe-eval'");
  });
  it('разрешает точный SHA256 раннего скрипта темы, сохраняя сам скрипт', () => {
    const hash = createHash('sha256').update(script).digest('base64');
    const html = secureHtml(source);
    expect(html).toContain(`'sha256-${hash}'`);
    expect(html).toContain(`<script>${script}</script>`);
    expect(secureHtml(source.replace(script, `${script}/* changed */`))).not.toContain(hash);
  });
  it('не хэширует внешний модуль, разрешённый через self', () => {
    expect(secureHtml(source).match(/sha256-/g)).toHaveLength(1);
  });
  it('останавливает сборку без раннего charset вместо небезопасной вставки', () => {
    expect(() => secureHtml('<html><head><script>test()</script></head></html>')).toThrow();
  });
});

describe('Границы доступа при публикации', () => {
  const workflow = parse(readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8'));
  it('проверяет PR с правом чтения и допускает публикацию только main после check', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(workflow.on).not.toHaveProperty('pull_request_target');
    expect(workflow.jobs.check.permissions).toBeUndefined();
    expect(workflow.jobs.build.if).toContain("github.event_name != 'pull_request'");
    expect(workflow.jobs.build.if).toContain("github.ref == 'refs/heads/main'");
    expect(workflow.jobs.build.needs).toBe('check');
    expect(workflow.jobs.build.permissions).toEqual({ contents: 'read', pages: 'read' });
    expect(workflow.jobs.deploy.needs).toBe('build');
    expect(workflow.jobs.deploy.permissions).toEqual({ pages: 'write', 'id-token': 'write' });
  });
  it('закрепляет Actions за SHA и не сохраняет Git credentials', () => {
    for (const job of Object.values(workflow.jobs) as { steps: Record<string, any>[] }[]) {
      for (const step of job.steps) {
        if (step.uses) expect(step.uses).toMatch(/^actions\/[a-z-]+@[a-f0-9]{40}$/);
        if (step.uses?.startsWith('actions/checkout@')) expect(step.with['persist-credentials']).toBe(false);
      }
    }
    expect(workflow.jobs.check.steps[0].with['fetch-depth']).toBe(0);
  });
  it('сканирует именно публикуемую сборку перед upload', () => {
    const steps = workflow.jobs.build.steps;
    const build = steps.findIndex((step: { run?: string }) => step.run === 'npm run build');
    const scan = steps.findIndex((step: { run?: string }) => step.run === 'bash scripts/ci-secret-scan.sh dist');
    const upload = steps.findIndex((step: { uses?: string }) => step.uses?.startsWith('actions/upload-pages-artifact@'));
    expect(scan).toBeGreaterThan(build);
    expect(scan).toBeLessThan(upload);
  });
  it('сохраняет traces ошибок, которые реально генерирует Playwright', () => {
    const report = workflow.jobs.check.steps.find((step: { uses?: string }) => step.uses?.startsWith('actions/upload-artifact@'));
    expect(report.if).toBe('failure()');
    expect(report.with.path).toContain('test-results/');
  });
});
