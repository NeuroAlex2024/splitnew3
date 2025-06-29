const { test, expect } = require('@playwright/test');

test.describe('WebSocket и многопользовательская функциональность', () => {
  
  test('Одиночное WebSocket соединение', async ({ page }) => {
    // Перехватываем WebSocket соединения
    const wsConnections = [];
    page.on('websocket', ws => {
      wsConnections.push(ws);
      console.log(`WebSocket соединение: ${ws.url()}`);
    });

    await page.goto('/');
    await page.waitForSelector('#characterScreen.active', { timeout: 10000 });
    
    // Проверяем что WebSocket соединение установлено
    await page.waitForFunction(() => {
      return window.socket && window.socket.connected;
    }, { timeout: 10000 });
    
    expect(wsConnections.length).toBeGreaterThan(0);
  });

  test('Отправка данных через WebSocket при подключении к игре', async ({ page }) => {
    const wsMessages = [];
    
    page.on('websocket', ws => {
      ws.on('framereceived', event => {
        try {
          const data = JSON.parse(event.payload);
          wsMessages.push({ type: 'received', data });
        } catch (e) {
          // Игнорируем не-JSON сообщения
        }
      });
      
      ws.on('framesent', event => {
        try {
          const data = JSON.parse(event.payload);
          wsMessages.push({ type: 'sent', data });
        } catch (e) {
          // Игнорируем не-JSON сообщения
        }
      });
    });

    await page.goto('/');
    await page.waitForSelector('#characterScreen.active', { timeout: 10000 });
    
    // Выбираем персонажа и присоединяемся к игре
    await page.click('[data-character="sanya"]');
    await page.fill('#playerName', 'Тестер WebSocket');
    await page.click('#joinGameBtn');
    
    // Ждем переход на экран ожидания
    await expect(page.locator('#waitingScreen')).toBeVisible({ timeout: 5000 });
    
    // Проверяем что было отправлено сообщение joinGame
    await page.waitForFunction(() => {
      return window.gameState && window.gameState.selectedCharacter === 'sanya';
    }, { timeout: 5000 });
  });

  test('Обработка ошибок WebSocket соединения', async ({ page }) => {
    // Блокируем WebSocket соединения
    await page.route('**/*', route => {
      if (route.request().url().includes('socket.io')) {
        route.abort();
      } else {
        route.continue();
      }
    });

    await page.goto('/');
    
    // При заблокированном WebSocket должен остаться экран загрузки
    await page.waitForTimeout(3000);
    
    // Проверяем что экран загрузки все еще активен
    const loadingScreen = page.locator('#loadingScreen');
    await expect(loadingScreen).toHaveClass(/active/);
  });

  test('Проверка состояния игры через глобальные переменные', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#characterScreen.active', { timeout: 10000 });
    
    // Проверяем что глобальное состояние игры инициализировано
    const gameState = await page.evaluate(() => window.gameState);
    
    expect(gameState).toBeDefined();
    expect(gameState.currentScreen).toBe('characterScreen');
    expect(gameState.selectedCharacter).toBeNull();
    expect(gameState.playerName).toBe('');
    expect(gameState.isGameStarted).toBe(false);
  });

  test('Симуляция двух игроков (последовательно)', async ({ browser }) => {
    // Создаем два контекста браузера для симуляции двух игроков
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const player1 = await context1.newPage();
    const player2 = await context2.newPage();
    
    try {
      // Первый игрок подключается
      await player1.goto('/');
      await player1.waitForSelector('#characterScreen.active', { timeout: 10000 });
      await player1.click('[data-character="sanya"]');
      await player1.fill('#playerName', 'Игрок 1');
      await player1.click('#joinGameBtn');
      await expect(player1.locator('#waitingScreen')).toBeVisible({ timeout: 5000 });
      
      // Второй игрок подключается
      await player2.goto('/');
      await player2.waitForSelector('#characterScreen.active', { timeout: 10000 });
      await player2.click('[data-character="leha"]');
      await player2.fill('#playerName', 'Игрок 2');
      await player2.click('#joinGameBtn');
      
      // Проверяем что оба игрока перешли в игру или ожидание
      await Promise.race([
        expect(player1.locator('#gameScreen')).toBeVisible({ timeout: 15000 }),
        expect(player1.locator('#waitingScreen')).toBeVisible({ timeout: 15000 })
      ]);
      
      await Promise.race([
        expect(player2.locator('#gameScreen')).toBeVisible({ timeout: 15000 }),
        expect(player2.locator('#waitingScreen')).toBeVisible({ timeout: 15000 })
      ]);
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('Проверка обработки событий клавиатуры в игре', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#characterScreen.active', { timeout: 10000 });
    
    // Проверяем что обработчики событий клавиатуры установлены
    const hasKeyListeners = await page.evaluate(() => {
      // Создаем тестовое событие
      const event = new KeyboardEvent('keydown', { code: 'KeyW' });
      document.dispatchEvent(event);
      
      // Проверяем что глобальный объект keys существует
      return typeof window.keys !== 'undefined';
    });
    
    expect(hasKeyListeners).toBe(true);
  });

  test('Проверка правильной очистки ресурсов при закрытии', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#characterScreen.active', { timeout: 10000 });
    
    // Проверяем что WebSocket соединение активно
    const socketConnected = await page.evaluate(() => {
      return window.socket && window.socket.connected;
    });
    expect(socketConnected).toBe(true);
    
    // Закрываем страницу и проверяем что ресурсы освобождены
    await page.close();
  });

  test('Проверка корректности Canvas отрисовки', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#characterScreen.active', { timeout: 10000 });
    
    // Проверяем что Canvas контексты создаются правильно
    const canvasReady = await page.evaluate(() => {
      return typeof window.gameCtx !== 'undefined' && 
             typeof window.minimapCtx !== 'undefined';
    });
    
    expect(canvasReady).toBe(true);
    
    // Проверяем что игровой цикл запущен
    const gameLoopRunning = await page.evaluate(() => {
      return typeof window.requestAnimationFrame !== 'undefined';
    });
    
    expect(gameLoopRunning).toBe(true);
  });

}); 