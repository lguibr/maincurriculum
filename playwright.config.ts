import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 600_000, // 10 min — real pipeline with LLM + cloning
  expect: {
    timeout: 30_000
  },
  fullyParallel: false,
  workers: 1, 
  reporter: [['html'], ['list']],
  use: {
    actionTimeout: 30_000,
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    viewport: { width: 1440, height: 900 },
    screenshot: 'on',
    video: 'on',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // No webServer block: both backend (3001) and frontend (3000) 
  // must already be running via `npm run dev` before running tests.
});
