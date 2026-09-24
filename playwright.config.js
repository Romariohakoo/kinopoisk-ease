const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests/e2e',
    timeout: 30_000,
    expect: { timeout: 7_000 },
    fullyParallel: true,
    workers: process.env.CI ? 2 : 4,
    retries: 0,
    reporter: [['list']],
    outputDir: 'test-results',
});
