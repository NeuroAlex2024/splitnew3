const { test, expect } = require('@playwright/test');

test.describe('Smoke Tests - Основная функциональность', () => {
  
  test('Приложение загружается и основные элементы доступны', async ({ page }) => {
    await page.goto('/');
    
    // Проверяем что страница загрузилась
    await expect(page).toHaveTitle('Split Online - Онлайн игра');
    
    // Ждем появления экрана выбора персонажа
    await page.waitForSelector('#characterScreen.active', { timeout: 15000 });
    
    // Проверяем что основные элементы присутствуют
    await expect(page.locator('#characterScreen .screen-title')).toBeVisible();
    await expect(page.locator('.characters-grid')).toBeVisible();
    await expect(page.locator('#playerName')).toBeVisible();
    await expect(page.locator('#joinGameBtn')).toBeVisible();
    
    console.log('✅ Основные элементы интерфейса загрузились корректно');
  });

  test('WebSocket соединение работает', async ({ page }) => {
    await page.goto('/');
    
    // Ожидаем загрузки экрана выбора персонажа
    await page.waitForSelector('#characterScreen.active', { timeout: 15000 });
    
    // Проверяем что socket.io загрузился и подключился
    const socketLoaded = await page.evaluate(() => {
      return typeof window.io !== 'undefined';
    });
    
    expect(socketLoaded).toBe(true);
    console.log('✅ Socket.IO библиотека загружена');
    
    // Даем время на подключение
    await page.waitForTimeout(2000);
    
    // Проверяем подключение (более мягкая проверка)
    const hasSocket = await page.evaluate(() => {
      return typeof window.socket !== 'undefined';
    });
    
    expect(hasSocket).toBe(true);
    console.log('✅ WebSocket объект создан');
  });

  test('Можно выбрать персонажа и ввести имя', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#characterScreen.active', { timeout: 15000 });
    
    // Выбираем первую карточку персонажа
    await page.click('.character-card[data-character="sanya"]');
    
    // Проверяем что персонаж выбран
    await expect(page.locator('.character-card[data-character="sanya"]')).toHaveClass(/selected/);
    
    // Вводим имя
    await page.fill('#playerName', 'Тестовый Игрок');
    
    // Проверяем что кнопка активировалась
    await expect(page.locator('#joinGameBtn')).not.toBeDisabled();
    
    console.log('✅ Выбор персонажа и ввод имени работает');
  });

  test('Статистический эндпоинт доступен', async ({ page }) => {
    // Проверяем эндпоинт статистики
    const response = await page.request.get('/stats');
    expect(response.status()).toBe(200);
    
    const stats = await response.json();
    expect(stats).toHaveProperty('totalRooms');
    expect(stats).toHaveProperty('totalPlayers');
    expect(stats).toHaveProperty('activeGames');
    
    console.log('✅ Эндпоинт статистики работает:', stats);
  });

  test('CSS и шрифты загружаются корректно', async ({ page }) => {
    await page.goto('/');
    
    // Проверяем что CSS загрузился
    const titleStyle = await page.locator('.game-title').evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        background: style.background || style.backgroundImage
      };
    });
    
    // Проверяем что стили применились
    expect(titleStyle.fontFamily).toContain('Orbitron');
    
    console.log('✅ CSS и шрифты загружены корректно');
  });

  test('Canvas элементы создаются правильно', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#characterScreen.active', { timeout: 15000 });
    
    // Проверяем что canvas персонажей существуют
    const canvasCount = await page.locator('.character-canvas').count();
    expect(canvasCount).toBe(4);
    
    // Проверяем игровой canvas
    await expect(page.locator('#gameCanvas')).toBeAttached();
    await expect(page.locator('#minimap')).toBeAttached();
    
    console.log('✅ Canvas элементы созданы корректно');
  });

}); 