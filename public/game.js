// Игровые константы
const CHARACTERS = {
    sanya: { name: 'Саня', color: '#ff4757', ability: 'dash' },
    leha: { name: 'Леха', color: '#3742fa', ability: 'shield' },
    stepa: { name: 'Степа', color: '#00ff88', ability: 'teleport' },
    maks: { name: 'Макс', color: '#ffd700', ability: 'stomp' }
};

// Глобальные переменные
let socket = null;
let gameState = {
    currentScreen: 'loading',
    selectedCharacter: null,
    playerName: '',
    players: [],
    maze: [],
    powerUps: [],
    scores: { hunter: 0, prey: 0 },
    currentRound: 1,
    timeLeft: 120,
    isGameStarted: false
};

let gameCanvas, gameCtx, minimapCanvas, minimapCtx;
let camera = { x: 0, y: 0 };
let keys = {};
let localPlayer = null;

// Инициализация
document.addEventListener('DOMContentLoaded', initializeGame);

function initializeGame() {
    gameCanvas = document.getElementById('gameCanvas');
    gameCtx = gameCanvas.getContext('2d');
    minimapCanvas = document.getElementById('minimap');
    minimapCtx = minimapCanvas.getContext('2d');
    
    connectToServer();
    setupEventListeners();
    setupCharacterSelection();
    drawCharacterPreviews();
    requestAnimationFrame(gameLoop);
}

function connectToServer() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Подключение к серверу успешно');
        showScreen('characterScreen');
    });
    
    socket.on('joinedGame', (data) => {
        gameState.players = data.players;
        gameState.maze = data.maze;
        updateSelectedCharacterDisplay();
        showScreen('waitingScreen');
    });
    
    socket.on('gameStarted', (data) => {
        gameState.isGameStarted = true;
        gameState.players = data.players;
        gameState.maze = data.maze;
        gameState.scores = data.scores;
        localPlayer = gameState.players.find(p => p.id === socket.id);
        showScreen('gameScreen');
        updateGameUI();
    });
    
    socket.on('gameUpdate', (data) => {
        gameState.players = data.players;
        gameState.powerUps = data.powerUps;
        gameState.timeLeft = data.timeLeft;
        localPlayer = gameState.players.find(p => p.id === socket.id);
        updateGameUI();
    });
    
    socket.on('gameEnded', (data) => {
        showResultScreen(data.winner, data.scores);
    });
}

function setupEventListeners() {
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        if (e.code === 'Space' && gameState.isGameStarted) {
            e.preventDefault();
            socket.emit('useAbility');
        }
    });
    
    document.addEventListener('keyup', (e) => {
        keys[e.code] = false;
    });
    
    document.getElementById('joinGameBtn').addEventListener('click', joinGame);
    document.getElementById('playerName').addEventListener('input', (e) => {
        gameState.playerName = e.target.value.trim();
        updateJoinButton();
    });
}

function setupCharacterSelection() {
    document.querySelectorAll('.character-card').forEach(card => {
        card.addEventListener('click', () => {
            selectCharacter(card.dataset.character);
        });
    });
}

function selectCharacter(character) {
    gameState.selectedCharacter = character;
    document.querySelectorAll('.character-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelector(`[data-character="${character}"]`).classList.add('selected');
    updateJoinButton();
}

function updateJoinButton() {
    const joinBtn = document.getElementById('joinGameBtn');
    joinBtn.disabled = !(gameState.selectedCharacter && gameState.playerName.length > 0);
}

function joinGame() {
    if (!gameState.selectedCharacter || !gameState.playerName) return;
    socket.emit('joinGame', {
        character: gameState.selectedCharacter,
        name: gameState.playerName
    });
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
    gameState.currentScreen = screenId;
}

function drawCharacterPreviews() {
    document.querySelectorAll('.character-canvas').forEach(canvas => {
        const ctx = canvas.getContext('2d');
        const character = canvas.dataset.character;
        if (character) {
            drawCharacter(ctx, character, canvas.width / 2, canvas.height / 2, 0, 1);
        }
    });
}

function drawCharacter(ctx, characterType, x, y, angle, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    
    switch (characterType) {
        case 'sanya': drawSanya(ctx); break;
        case 'leha': drawLeha(ctx); break;
        case 'stepa': drawStepa(ctx); break;
        case 'maks': drawMaks(ctx); break;
    }
    ctx.restore();
}

function drawSanya(ctx) {
    ctx.fillStyle = '#1e3799';
    ctx.fillRect(-18, -12, 36, 40);
    ctx.fillStyle = '#feca57';
    ctx.fillRect(-15, -30, 30, 25);
    ctx.fillStyle = '#2c2c54';
    ctx.fillRect(-4, -42, 8, 18);
    ctx.fillStyle = '#000';
    ctx.fillRect(-10, -25, 4, 4);
    ctx.fillRect(6, -25, 4, 4);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-6, -18, 12, 3);
}

function drawLeha(ctx) {
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(-15, -10, 30, 38);
    ctx.fillStyle = '#ecf0f1';
    ctx.fillRect(-12, -8, 24, 30);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-3, -8, 6, 25);
    ctx.fillStyle = '#feca57';
    ctx.fillRect(-12, -27, 24, 22);
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(-12, -30, 24, 10);
}

function drawStepa(ctx) {
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(-16, -10, 32, 38);
    ctx.fillStyle = '#feca57';
    ctx.fillRect(-12, -25, 24, 20);
    ctx.fillStyle = '#8b4513';
    ctx.beginPath();
    ctx.arc(-8, -28, 6, 0, Math.PI * 2);
    ctx.arc(4, -29, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(-8, -20, 3, 3);
    ctx.fillRect(5, -20, 3, 3);
}

function drawMaks(ctx) {
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(-19, -10, 38, 38);
    ctx.fillStyle = '#feca57';
    ctx.fillRect(-15, -25, 30, 20);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(-15, -30, 30, 8);
    ctx.fillStyle = '#87ceeb';
    ctx.fillRect(-10, -18, 4, 4);
    ctx.fillRect(6, -18, 4, 4);
}

function updateSelectedCharacterDisplay() {
    const canvas = document.getElementById('selectedCharCanvas');
    const name = document.getElementById('selectedCharName');
    if (canvas && gameState.selectedCharacter) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawCharacter(ctx, gameState.selectedCharacter, canvas.width/2, canvas.height/2, 0, 0.8);
        name.textContent = CHARACTERS[gameState.selectedCharacter].name;
    }
}

function updateGameUI() {
    const timer = document.getElementById('gameTimer');
    const minutes = Math.floor(gameState.timeLeft / 60);
    const seconds = gameState.timeLeft % 60;
    timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    document.getElementById('hunterScore').textContent = gameState.scores.hunter;
    document.getElementById('preyScore').textContent = gameState.scores.prey;
    
    const hunter = gameState.players.find(p => p.role === 'hunter');
    const prey = gameState.players.find(p => p.role === 'prey');
    
    if (hunter) {
        document.getElementById('hunterName').textContent = hunter.name;
        updatePlayerAvatar('hunterAvatar', hunter.character);
    }
    if (prey) {
        document.getElementById('preyName').textContent = prey.name;
        updatePlayerAvatar('preyAvatar', prey.character);
    }
}

function updatePlayerAvatar(canvasId, character) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCharacter(ctx, character, canvas.width/2, canvas.height/2, 0, 0.6);
}

function handleMovement() {
    if (!localPlayer || !gameState.isGameStarted) return;
    
    let dx = 0, dy = 0;
    const speed = 5;
    
    if (keys['KeyW']) dy -= speed;
    if (keys['KeyS']) dy += speed;
    if (keys['KeyA']) dx -= speed;
    if (keys['KeyD']) dx += speed;
    
    if (dx !== 0 || dy !== 0) {
        socket.emit('playerMove', {
            x: localPlayer.x + dx,
            y: localPlayer.y + dy,
            angle: Math.atan2(dy, dx),
            speed: Math.sqrt(dx * dx + dy * dy)
        });
    }
}

function render() {
    if (gameState.currentScreen !== 'gameScreen' || !gameState.isGameStarted) return;
    
    gameCtx.fillStyle = '#0f0f23';
    gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    
    if (localPlayer) {
        camera.x = localPlayer.x - gameCanvas.width / 2;
        camera.y = localPlayer.y - gameCanvas.height / 2;
    }
    
    drawMaze();
    drawPowerUps();
    drawPlayers();
    drawMinimap();
}

function drawMaze() {
    if (!gameState.maze.length) return;
    
    gameCtx.fillStyle = '#2c3e50';
    for (let y = 0; y < gameState.maze.length; y++) {
        for (let x = 0; x < gameState.maze[y].length; x++) {
            if (gameState.maze[y][x] === 1) {
                const drawX = x * 40 - camera.x;
                const drawY = y * 40 - camera.y;
                if (drawX > -40 && drawX < gameCanvas.width && drawY > -40 && drawY < gameCanvas.height) {
                    gameCtx.fillRect(drawX, drawY, 40, 40);
                }
            }
        }
    }
}

function drawPowerUps() {
    gameState.powerUps.forEach(powerUp => {
        const drawX = powerUp.x - camera.x;
        const drawY = powerUp.y - camera.y;
        if (drawX > -50 && drawX < gameCanvas.width + 50 && drawY > -50 && drawY < gameCanvas.height + 50) {
            gameCtx.fillStyle = '#00ff88';
            gameCtx.beginPath();
            gameCtx.arc(drawX, drawY, 15, 0, Math.PI * 2);
            gameCtx.fill();
        }
    });
}

function drawPlayers() {
    gameState.players.forEach(player => {
        const drawX = player.x - camera.x;
        const drawY = player.y - camera.y;
        if (drawX > -100 && drawX < gameCanvas.width + 100 && drawY > -100 && drawY < gameCanvas.height + 100) {
            drawCharacter(gameCtx, player.character, drawX, drawY, player.angle || 0);
            
            gameCtx.fillStyle = player.role === 'hunter' ? '#ff4757' : '#3742fa';
            gameCtx.font = '12px Arial';
            gameCtx.textAlign = 'center';
            gameCtx.fillText(player.role === 'hunter' ? 'ОХОТНИК' : 'ДОБЫЧА', drawX, drawY - 60);
            
            gameCtx.fillStyle = '#fff';
            gameCtx.font = '10px Arial';
            gameCtx.fillText(player.name, drawX, drawY - 45);
        }
    });
}

function drawMinimap() {
    if (!minimapCtx || !gameState.maze.length) return;
    
    minimapCtx.fillStyle = '#000';
    minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    
    const scaleX = minimapCanvas.width / 1600;
    const scaleY = minimapCanvas.height / 1200;
    
    minimapCtx.fillStyle = '#444';
    for (let y = 0; y < gameState.maze.length; y++) {
        for (let x = 0; x < gameState.maze[y].length; x++) {
            if (gameState.maze[y][x] === 1) {
                minimapCtx.fillRect(x * 40 * scaleX, y * 40 * scaleY, 40 * scaleX, 40 * scaleY);
            }
        }
    }
    
    gameState.players.forEach(player => {
        minimapCtx.fillStyle = CHARACTERS[player.character].color;
        minimapCtx.beginPath();
        minimapCtx.arc(player.x * scaleX, player.y * scaleY, 3, 0, Math.PI * 2);
        minimapCtx.fill();
    });
}

function showResultScreen(winner, scores) {
    document.getElementById('finalHunterScore').textContent = scores.hunter;
    document.getElementById('finalPreyScore').textContent = scores.prey;
    
    const resultTitle = document.getElementById('resultTitle');
    if (winner === 'hunter') {
        resultTitle.textContent = 'ПОБЕДА ОХОТНИКА!';
    } else if (winner === 'prey') {
        resultTitle.textContent = 'ПОБЕДА ДОБЫЧИ!';
    } else {
        resultTitle.textContent = 'НИЧЬЯ!';
    }
    
    showScreen('resultScreen');
}

function gameLoop() {
    handleMovement();
    render();
    requestAnimationFrame(gameLoop);
}
