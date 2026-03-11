// @ts-check
/** @type {import('@playwright/test').PlaywrightTestConfig} */
require('dotenv').config(); // Only needed if not already loaded
const { devices } = require('@playwright/test');
const config = {
  testDir: './tests/playwright',
  timeout: 30000,
  retries: 0,
  use: {
    headless: true,
    trace: "on",
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://store.tailormade.uk',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      grep: /@critical/,
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      grep: /@critical/,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      grep: /@critical/,
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      grep: /@critical/,
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
      grep: /@critical/,
    },
  ],
};

module.exports = config;