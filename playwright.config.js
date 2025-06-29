// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  /* Максимальное время выполнения одного теста */
  timeout: 30 * 1000,
  expect: {
    /* Максимальное время ожидания для expect() */
    timeout: 5000
  },
  /* Отчеты о тестах */
  reporter: [['html'], ['list']],
  /* Конфигурация для всех проектов */
  use: {
    /* URL базового приложения */
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    /* Скриншоты только при падении */
    screenshot: 'only-on-failure',
    /* Видео только при падении */
    video: 'retain-on-failure',
    /* Трассировка при падении */
    trace: 'on-first-retry',
  },

  /* Настройка локального dev сервера */
  webServer: {
    command: 'npm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  /* Конфигурация для разных браузеров */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    /* Мобильные браузеры */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
}); 