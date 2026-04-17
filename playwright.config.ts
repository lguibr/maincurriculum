import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  workers: 1, 
  reporter: 'html',
  use: {
    actionTimeout: 0,
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run dev -w @maincurriculum/backend',
      url: 'http://127.0.0.1:3001/api/profile/latest',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        // Use a dummy gemini or test environment flag if needed
        NODE_ENV: 'test',
        GOOGLE_API_KEY: 'mock_key'
      }
    },
    {
      command: 'npm run dev -w @maincurriculum/frontend',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    }
  ],
});
