// @ts-check
/** @type {import('@playwright/test').PlaywrightTestConfig} */
require('dotenv').config(); // Only needed if not already loaded
const config = {
  testDir: './tests/playwright',
  timeout: 30000,
  retries: 0,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost',
  },
};

module.exports = config;