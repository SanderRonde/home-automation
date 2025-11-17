import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E testing
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
	testDir: './app/client/e2e',
	testMatch: '**/*.e2e.ts', // Match .e2e.ts files instead of .spec.ts
	fullyParallel: false, // Run tests sequentially for now (server state management)
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1, // Single worker to avoid server conflicts
	reporter: 'html',
	use: {
		baseURL: 'http://localhost:3456',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
	},

	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],

	// Start the dev server before tests
	webServer: {
		command: 'bun run app/server/app.ts',
		url: 'http://localhost:3456',
		reuseExistingServer: !process.env.CI,
		timeout: 30 * 1000,
		env: {
			NODE_ENV: 'test',
			TEST_MODE: 'true',
		},
	},
});
