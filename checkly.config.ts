import { defineConfig } from 'checkly';
import { Frequency } from 'checkly/constructs';

export default defineConfig({
  projectName: 'TM Wishlist Monitoring',
  logicalId: 'tm-wishlist-monitoring',
  repoUrl: '', // Add repo URL if available
  checks: {
    playwrightConfigPath: './playwright.config.cjs',
    locations: ['us-east-1', 'eu-central-1'],
    playwrightChecks: [
        {
            name: 'Critical flows - Chrome',
            logicalId: 'critical-flows-chrome',
            pwProjects: ['chromium', 'mobile-chrome'],
            pwTags: ['@critical'],
            frequency: Frequency.EVERY_10M,
        },
        {
            name: 'Critical Webkit Test',
            logicalId: 'critical-webkit-test',
            pwProjects: ['webkit'],
            pwTags: ['@critical'],
            frequency: Frequency.EVERY_10M,
        },
    ],
  },
  cli: {
    runLocation: 'eu-central-1',
    retries: 0,
  },
});
