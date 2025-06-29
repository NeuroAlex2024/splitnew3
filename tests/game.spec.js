const { test, expect } = require('@playwright/test');

test.describe('Split Online Game', () => {
  
  test('Загрузка приложения и переход к экрану выбора персонажа', async ({ page }) => {
    await page.goto('/');
    
    // Проверяем что страница загрузилась
    await expect(page).toHaveTitle('Split Online - Онлайн игра');
    
    // Ждем появления экрана выбора персонажа
    await expect(page.locator('#characterScreen')).toBeVisible({ timeout: 10000 });
    
    // Проверяем заголовок экрана выбора персонажа
    await expect(page.locator('#characterScreen .screen-title')).toContainText('ВЫБЕРИ СВОЕГО ПЕРСОНАЖА');
  });

  test('Выбор персонажа и ввод имени', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#characterScreen.active', { timeout: 10000 });
    
    // Проверяем что все 4 персонажа отображаются
    const characters = ['sanya', 'leha', 'stepa', 'maks'];
    for (const character of characters) {
      await expect(page.locator(`[data-character="${character}"]`)).toBeVisible();
    }
    
    // Выбираем персонажа Саню
    await page.click('[data-character="sanya"]');
    await expect(page.locator('[data-character="sanya"]')).toHaveClass(/selected/);
    
    // Вводим имя игрока
    await page.fill('#playerName', 'Тестовый Игрок');
    
    // Проверяем что кнопка "Найти игру" стала активной
    const joinButton = page.locator('#joinGameBtn');
    await expect(joinButton).not.toBeDisabled();
  });

  test('Отображение информации о персонажах', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#characterScreen.active', { timeout: 10000 });
    
    // Проверяем информацию о Сане
    const sanyaCard = page.locator('[data-character="sanya"]');
    await expect(sanyaCard.locator('.character-name')).toContainText('САНЯ');
    await expect(sanyaCard.locator('.character-description')).toContainText('Панк с ирокезом');
    await expect(sanyaCard.locator('.ability-name')).toContainText('РЫВОК');
    await expect(sanyaCard.locator('.ability-cooldown')).toContainText('8 сек');
    
    // Проверяем информацию о Лехе
    const lehaCard = page.locator('[data-character="leha"]');
    await expect(lehaCard.locator('.character-name')).toContainText('ЛЕХА');
    await expect(lehaCard.locator('.character-description')).toContainText('Бизнесмен в костюме');
    await expect(lehaCard.locator('.ability-name')).toContainText('ЩИТ');
    await expect(lehaCard.locator('.ability-cooldown')).toContainText('12 сек');
  });

  test('Проверка Canvas элементов персонажей', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#characterScreen.active', { timeout: 10000 });
    
    // Проверяем что canvas элементы персонажей отображаются
    const characters = ['sanya', 'leha', 'stepa', 'maks'];
    for (const character of characters) {
      const canvas = page.locator(`[data-character="${character}"] .character-canvas`);
      await expect(canvas).toBeVisible();
      
      // Проверяем размеры canvas
      await expect(canvas).toHaveAttribute('width', '120');
      await expect(canvas).toHaveAttribute('height', '150');
    }
  });

  test('Валидация формы ввода', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#characterScreen.active', { timeout: 10000 });
    
    const joinButton = page.locator('#joinGameBtn');
    
    // Кнопка должна быть неактивной изначально
    await expect(joinButton).toBeDisabled();
    
    // Выбираем персонажа без ввода имени
    await page.click('[data-character="sanya"]');
    await expect(joinButton).toBeDisabled();
    
    // Вводим только имя без выбора персонажа
    await page.click('[data-character="sanya"]'); // Снимаем выделение
    await page.click('body'); // Клик вне персонажа
    await page.fill('#playerName', 'Тест');
    
    // Теперь выбираем персонажа и вводим имя
    await page.click('[data-character="stepa"]');
    await page.fill('#playerName', 'Валидный Игрок');
    await expect(joinButton).not.toBeDisabled();
  });

  test('Проверка адаптивности интерфейса', async ({ page }) => {
    // Тестируем на мобильном разрешении
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForSelector('#characterScreen.active', { timeout: 10000 });
    
    // Проверяем что элементы остаются видимыми на маленьком экране
    await expect(page.locator('.screen-title')).toBeVisible();
    await expect(page.locator('.characters-grid')).toBeVisible();
    
    // Проверяем что можно прокрутить до всех персонажей
    const characters = page.locator('.character-card');
    const count = await characters.count();
    expect(count).toBe(4);
  });

  test('Стили и анимации загружаются корректно', async ({ page }) => {
    await page.goto('/');
    
    // Проверяем что CSS загрузился
    const gameTitle = page.locator('.game-title');
    await expect(gameTitle).toBeVisible();
    
    // Проверяем применение стилей
    const titleStyle = await gameTitle.evaluate(el => 
      window.getComputedStyle(el).fontFamily
    );
    expect(titleStyle).toContain('Orbitron');
    
    // Проверяем что анимация спиннера работает
    const spinner = page.locator('.loading-spinner');
    await expect(spinner).toBeVisible();
  });

  test('WebSocket соединение устанавливается', async ({ page }) => {
    // Слушаем консольные сообщения
    const messages = [];
    page.on('console', msg => messages.push(msg.text()));
    
    await page.goto('/');
    await page.waitForSelector('#characterScreen.active', { timeout: 10000 });
    
    // Проверяем что есть сообщение о подключении к серверу
    await page.waitForFunction(() => {
      return window.socket && window.socket.connected;
    }, { timeout: 10000 });
    
    // Ожидаем сообщение об успешном подключении
    await page.waitForFunction(
      () => document.querySelector('#characterScreen.active') !== null,
      { timeout: 5000 }
    );
  });

  test('Функциональность поиска игры', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#characterScreen.active', { timeout: 10000 });
    
    // Выбираем персонажа и вводим имя
    await page.click('[data-character="maks"]');
    await page.fill('#playerName', 'Игрок Тест');
    
    // Нажимаем "Найти игру"
    await page.click('#joinGameBtn');
    
    // Должен появиться экран ожидания
    await expect(page.locator('#waitingScreen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.waiting-text')).toContainText('Ищем достойного соперника');
    
    // Проверяем отображение выбранного персонажа
    await expect(page.locator('#selectedCharName')).toContainText('Макс');
  });

  test('Проверка игрового canvas', async ({ page }) => {
    await page.goto('/');
    
    // Проверяем что игровой canvas присутствует
    const gameCanvas = page.locator('#gameCanvas');
    await expect(gameCanvas).toBeVisible();
    
    // Проверяем размеры canvas
    await expect(gameCanvas).toHaveAttribute('width', '1200');
    await expect(gameCanvas).toHaveAttribute('height', '800');
    
    // Проверяем миникарту
    const minimap = page.locator('#minimap');
    await expect(minimap).toBeVisible();
  });

}); 