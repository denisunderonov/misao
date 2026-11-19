import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    channel: 'chromium',
    baseURL: 'http://127.0.0.1:4173/misao/',
    trace: 'retain-on-failure',
  },
  projects: [320, 375, 768, 1024, 1440, 1920].flatMap((width) =>
    (['light', 'dark'] as const).map((colorScheme) => ({
      name: `${width}-${colorScheme}`,
      use: { viewport: { width, height: 900 }, colorScheme, browserName: 'chromium' as const, isMobile: width <= 375, hasTouch: width <= 375 },
    })),
  ),
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    env: { VITE_BASE_PATH: '/misao/' },
    url: 'http://127.0.0.1:4173/misao/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
