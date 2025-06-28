const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Статические файлы
app.use(express.static(path.join(__dirname, 'public')));

// Игровое состояние
const gameState = {
    rooms: new Map(),
    players: new Map()
};

// Конфигурация персонажей
const CHARACTERS = {
    sanya: {
        name: 'Саня',
        color: '#ff4757',
        ability: 'dash',
        abilityName: 'Рывок',
        abilityCooldown: 8000,
        speed: 7,
        description: 'Панк с ирокезом. Способность: быстрый рывок вперед'
    },
    leha: {
        name: 'Леха', 
        color: '#3742fa',
        ability: 'shield',
        abilityName: 'Щит',
        abilityCooldown: 12000,
        speed: 6,
        description: 'Бизнесмен в костюме. Способность: временная неуязвимость'
    },
    stepa: {
        name: 'Степа',
        color: '#00ff88',
        ability: 'teleport',
        abilityName: 'Телепорт',
        abilityCooldown: 15000,
        speed: 6.5,
        description: 'Парень с цепочкой. Способность: телепортация'
    },
    maks: {
        name: 'Макс',
        color: '#ffd700',
        ability: 'stomp',
        abilityName: 'Удар',
        abilityCooldown: 10000,
        speed: 5.5,
        description: 'Здоровый парень. Способность: оглушающий удар'
    }
};

// Конфигурация игры
const GAME_CONFIG = {
    WORLD_WIDTH: 1600,
    WORLD_HEIGHT: 1200,
    CELL_SIZE: 40,
    ROUND_TIME: 120, // 2 минуты
    MAX_ROUNDS: 5
};

class Room {
    constructor(id) {
        this.id = id;
        this.players = new Map();
        this.gameStarted = false;
        this.currentRound = 1;
        this.roundStartTime = 0;
        this.hunter = null;
        this.prey = null;
        this.scores = { hunter: 0, prey: 0 };
        this.maze = this.generateMaze();
        this.powerUps = [];
        this.lastPowerUpSpawn = 0;
    }

    generateMaze() {
        const width = Math.floor(GAME_CONFIG.WORLD_WIDTH / GAME_CONFIG.CELL_SIZE);
        const height = Math.floor(GAME_CONFIG.WORLD_HEIGHT / GAME_CONFIG.CELL_SIZE);
        const maze = Array(height).fill().map(() => Array(width).fill(1));
        
        // Простой алгоритм генерации лабиринта
        function carve(x, y) {
            maze[y][x] = 0;
            const directions = [[0,2],[2,0],[0,-2],[-2,0]].sort(() => Math.random() - 0.5);
            
            for (const [dx, dy] of directions) {
                const nx = x + dx, ny = y + dy;
                if (nx > 0 && nx < width-1 && ny > 0 && ny < height-1 && maze[ny][nx] === 1) {
                    maze[y + dy/2][x + dx/2] = 0;
                    carve(nx, ny);
                }
            }
        }
        
        carve(1, 1);
        return maze;
    }

    addPlayer(socket, playerData) {
        const player = {
            id: socket.id,
            socket: socket,
            character: playerData.character,
            name: playerData.name || CHARACTERS[playerData.character].name,
            x: 60,
            y: 60,
            angle: 0,
            speed: 0,
            health: 100,
            abilityReady: true,
            lastAbilityUse: 0,
            isAlive: true,
            effects: {
                invulnerable: false,
                stunned: false,
                invisible: false
            }
        };
        
        this.players.set(socket.id, player);
        
        // Автоматически назначаем роли
        if (this.players.size === 1) {
            this.hunter = socket.id;
            player.role = 'hunter';
            player.x = 60;
            player.y = 60;
        } else if (this.players.size === 2) {
            this.prey = socket.id;
            player.role = 'prey';
            player.x = GAME_CONFIG.WORLD_WIDTH - 100;
            player.y = GAME_CONFIG.WORLD_HEIGHT - 100;
        }
        
        return player;
    }

    removePlayer(socketId) {
        const player = this.players.get(socketId);
        if (player) {
            this.players.delete(socketId);
            
            if (this.hunter === socketId) {
                this.hunter = null;
            }
            if (this.prey === socketId) {
                this.prey = null;
            }
            
            // Если остался только один игрок, останавливаем игру
            if (this.players.size < 2 && this.gameStarted) {
                this.endGame('player_left');
            }
        }
    }

    startGame() {
        if (this.players.size >= 2 && !this.gameStarted) {
            this.gameStarted = true;
            this.currentRound = 1;
            this.roundStartTime = Date.now();
            this.spawnInitialPowerUps();
            
            this.broadcast('gameStarted', {
                round: this.currentRound,
                roundTime: GAME_CONFIG.ROUND_TIME,
                maze: this.maze,
                players: this.getPlayersData(),
                scores: this.scores
            });
        }
    }

    spawnInitialPowerUps() {
        this.powerUps = [];
        // Спавним несколько пауэр-апов в случайных местах
        for (let i = 0; i < 3; i++) {
            this.spawnPowerUp();
        }
    }

    spawnPowerUp() {
        const types = ['speed', 'health', 'ability_reset', 'ghost'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        let x, y;
        let attempts = 0;
        do {
            x = Math.random() * (GAME_CONFIG.WORLD_WIDTH - 100) + 50;
            y = Math.random() * (GAME_CONFIG.WORLD_HEIGHT - 100) + 50;
            attempts++;
        } while (this.isWall(x, y) && attempts < 50);
        
        this.powerUps.push({
            id: Date.now() + Math.random(),
            type: type,
            x: x,
            y: y,
            spawnTime: Date.now()
        });
    }

    isWall(x, y) {
        const cellX = Math.floor(x / GAME_CONFIG.CELL_SIZE);
        const cellY = Math.floor(y / GAME_CONFIG.CELL_SIZE);
        
        if (cellX < 0 || cellX >= this.maze[0].length || cellY < 0 || cellY >= this.maze.length) {
            return true;
        }
        
        return this.maze[cellY][cellX] === 1;
    }

    updateGame() {
        if (!this.gameStarted) return;
        
        const now = Date.now();
        const roundElapsed = now - this.roundStartTime;
        
        // Проверяем время раунда
        if (roundElapsed >= GAME_CONFIG.ROUND_TIME * 1000) {
            this.endRound('time_up');
            return;
        }
        
        // Спавним новые пауэр-апы
        if (now - this.lastPowerUpSpawn > 8000 && this.powerUps.length < 5) {
            this.spawnPowerUp();
            this.lastPowerUpSpawn = now;
        }
        
        // Удаляем старые пауэр-апы
        this.powerUps = this.powerUps.filter(powerUp => {
            return now - powerUp.spawnTime < 30000;
        });
        
        // Проверяем победные условия
        const hunterPlayer = this.players.get(this.hunter);
        const preyPlayer = this.players.get(this.prey);
        
        if (hunterPlayer && preyPlayer) {
            const distance = Math.sqrt(
                Math.pow(hunterPlayer.x - preyPlayer.x, 2) + 
                Math.pow(hunterPlayer.y - preyPlayer.y, 2)
            );
            
            if (distance < 50 && !preyPlayer.effects.invulnerable) {
                this.endRound('caught');
            }
        }
        
        // Отправляем обновления клиентам
        this.broadcast('gameUpdate', {
            players: this.getPlayersData(),
            powerUps: this.powerUps,
            timeLeft: Math.max(0, GAME_CONFIG.ROUND_TIME - Math.floor(roundElapsed / 1000))
        });
    }

    endRound(reason) {
        let winner = null;
        
        if (reason === 'caught') {
            winner = 'hunter';
            this.scores.hunter++;
        } else if (reason === 'time_up') {
            winner = 'prey';
            this.scores.prey++;
        }
        
        this.broadcast('roundEnded', {
            reason: reason,
            winner: winner,
            scores: this.scores,
            round: this.currentRound
        });
        
        if (this.currentRound >= GAME_CONFIG.MAX_ROUNDS || this.scores.hunter >= 3 || this.scores.prey >= 3) {
            this.endGame('completed');
        } else {
            // Готовимся к следующему раунду
            setTimeout(() => {
                this.nextRound();
            }, 5000);
        }
    }

    nextRound() {
        this.currentRound++;
        this.roundStartTime = Date.now();
        
        // Меняем роли
        const temp = this.hunter;
        this.hunter = this.prey;
        this.prey = temp;
        
        // Обновляем роли у игроков
        const hunterPlayer = this.players.get(this.hunter);
        const preyPlayer = this.players.get(this.prey);
        
        if (hunterPlayer) {
            hunterPlayer.role = 'hunter';
            hunterPlayer.x = 60;
            hunterPlayer.y = 60;
        }
        if (preyPlayer) {
            preyPlayer.role = 'prey';
            preyPlayer.x = GAME_CONFIG.WORLD_WIDTH - 100;
            preyPlayer.y = GAME_CONFIG.WORLD_HEIGHT - 100;
        }
        
        // Генерируем новый лабиринт
        this.maze = this.generateMaze();
        this.spawnInitialPowerUps();
        
        this.broadcast('roundStarted', {
            round: this.currentRound,
            maze: this.maze,
            players: this.getPlayersData(),
            scores: this.scores
        });
    }

    endGame(reason) {
        this.gameStarted = false;
        
        let finalWinner = null;
        if (this.scores.hunter > this.scores.prey) {
            finalWinner = 'hunter';
        } else if (this.scores.prey > this.scores.hunter) {
            finalWinner = 'prey';
        }
        
        this.broadcast('gameEnded', {
            reason: reason,
            winner: finalWinner,
            scores: this.scores
        });
    }

    getPlayersData() {
        const data = [];
        for (const [id, player] of this.players) {
            data.push({
                id: id,
                character: player.character,
                name: player.name,
                role: player.role,
                x: player.x,
                y: player.y,
                angle: player.angle,
                health: player.health,
                isAlive: player.isAlive,
                effects: player.effects,
                abilityReady: player.abilityReady
            });
        }
        return data;
    }

    broadcast(event, data) {
        for (const [id, player] of this.players) {
            player.socket.emit(event, data);
        }
    }
}

// Socket.IO обработчики
io.on('connection', (socket) => {
    console.log(`Игрок подключился: ${socket.id}`);
    
    socket.on('joinGame', (data) => {
        const { character, name } = data;
        
        if (!CHARACTERS[character]) {
            socket.emit('error', { message: 'Неверный персонаж' });
            return;
        }
        
        // Находим или создаем комнату
        let room = null;
        for (const [roomId, r] of gameState.rooms) {
            if (r.players.size < 2 && !r.gameStarted) {
                room = r;
                break;
            }
        }
        
        if (!room) {
            const roomId = `room_${Date.now()}`;
            room = new Room(roomId);
            gameState.rooms.set(roomId, room);
        }
        
        const player = room.addPlayer(socket, { character, name });
        gameState.players.set(socket.id, { room: room.id, player });
        
        socket.join(room.id);
        
        socket.emit('joinedGame', {
            roomId: room.id,
            playerId: socket.id,
            character: character,
            role: player.role,
            players: room.getPlayersData(),
            maze: room.maze
        });
        
        // Если комната полная, запускаем игру
        if (room.players.size === 2) {
            setTimeout(() => {
                room.startGame();
            }, 3000);
        }
        
        room.broadcast('playerJoined', {
            players: room.getPlayersData()
        });
    });
    
    socket.on('playerMove', (data) => {
        const playerData = gameState.players.get(socket.id);
        if (!playerData) return;
        
        const room = gameState.rooms.get(playerData.room);
        if (!room || !room.gameStarted) return;
        
        const player = room.players.get(socket.id);
        if (!player || !player.isAlive) return;
        
        // Обновляем позицию игрока с проверкой коллизий
        const newX = Math.max(20, Math.min(GAME_CONFIG.WORLD_WIDTH - 20, data.x));
        const newY = Math.max(20, Math.min(GAME_CONFIG.WORLD_HEIGHT - 20, data.y));
        
        if (!room.isWall(newX, newY)) {
            player.x = newX;
            player.y = newY;
            player.angle = data.angle || 0;
            player.speed = data.speed || 0;
        }
    });
    
    socket.on('useAbility', () => {
        const playerData = gameState.players.get(socket.id);
        if (!playerData) return;
        
        const room = gameState.rooms.get(playerData.room);
        if (!room || !room.gameStarted) return;
        
        const player = room.players.get(socket.id);
        if (!player || !player.isAlive || !player.abilityReady) return;
        
        const character = CHARACTERS[player.character];
        const now = Date.now();
        
        if (now - player.lastAbilityUse < character.abilityCooldown) return;
        
        player.abilityReady = false;
        player.lastAbilityUse = now;
        
        // Применяем способность
        switch (character.ability) {
            case 'dash':
                // Рывок Сани
                const dashDistance = 150;
                const dashX = player.x + Math.cos(player.angle) * dashDistance;
                const dashY = player.y + Math.sin(player.angle) * dashDistance;
                
                if (!room.isWall(dashX, dashY)) {
                    player.x = Math.max(20, Math.min(GAME_CONFIG.WORLD_WIDTH - 20, dashX));
                    player.y = Math.max(20, Math.min(GAME_CONFIG.WORLD_HEIGHT - 20, dashY));
                }
                break;
                
            case 'shield':
                // Щит Лехи
                player.effects.invulnerable = true;
                setTimeout(() => {
                    player.effects.invulnerable = false;
                }, 3000);
                break;
                
            case 'teleport':
                // Телепорт Степы
                let teleX, teleY;
                let attempts = 0;
                do {
                    teleX = Math.random() * (GAME_CONFIG.WORLD_WIDTH - 100) + 50;
                    teleY = Math.random() * (GAME_CONFIG.WORLD_HEIGHT - 100) + 50;
                    attempts++;
                } while (room.isWall(teleX, teleY) && attempts < 50);
                
                player.x = teleX;
                player.y = teleY;
                break;
                
            case 'stomp':
                // Удар Макса
                const otherPlayers = Array.from(room.players.values()).filter(p => p.id !== player.id);
                for (const otherPlayer of otherPlayers) {
                    const distance = Math.sqrt(
                        Math.pow(player.x - otherPlayer.x, 2) + 
                        Math.pow(player.y - otherPlayer.y, 2)
                    );
                    
                    if (distance < 120) {
                        otherPlayer.effects.stunned = true;
                        setTimeout(() => {
                            otherPlayer.effects.stunned = false;
                        }, 2000);
                    }
                }
                break;
        }
        
        setTimeout(() => {
            player.abilityReady = true;
        }, character.abilityCooldown);
        
        room.broadcast('abilityUsed', {
            playerId: socket.id,
            ability: character.ability,
            x: player.x,
            y: player.y
        });
    });
    
    socket.on('collectPowerUp', (data) => {
        const playerData = gameState.players.get(socket.id);
        if (!playerData) return;
        
        const room = gameState.rooms.get(playerData.room);
        if (!room || !room.gameStarted) return;
        
        const powerUpIndex = room.powerUps.findIndex(p => p.id === data.powerUpId);
        if (powerUpIndex === -1) return;
        
        const powerUp = room.powerUps[powerUpIndex];
        const player = room.players.get(socket.id);
        
        // Применяем эффект пауэр-апа
        switch (powerUp.type) {
            case 'speed':
                // Временное увеличение скорости
                break;
            case 'health':
                player.health = Math.min(100, player.health + 30);
                break;
            case 'ability_reset':
                player.abilityReady = true;
                player.lastAbilityUse = 0;
                break;
            case 'ghost':
                player.effects.invisible = true;
                setTimeout(() => {
                    player.effects.invisible = false;
                }, 5000);
                break;
        }
        
        // Удаляем пауэр-ап
        room.powerUps.splice(powerUpIndex, 1);
        
        room.broadcast('powerUpCollected', {
            powerUpId: data.powerUpId,
            playerId: socket.id,
            type: powerUp.type
        });
    });
    
    socket.on('disconnect', () => {
        console.log(`Игрок отключился: ${socket.id}`);
        
        const playerData = gameState.players.get(socket.id);
        if (playerData) {
            const room = gameState.rooms.get(playerData.room);
            if (room) {
                room.removePlayer(socket.id);
                
                room.broadcast('playerLeft', {
                    playerId: socket.id,
                    players: room.getPlayersData()
                });
                
                // Удаляем пустые комнаты
                if (room.players.size === 0) {
                    gameState.rooms.delete(playerData.room);
                }
            }
            gameState.players.delete(socket.id);
        }
    });
});

// Игровой цикл
setInterval(() => {
    for (const [roomId, room] of gameState.rooms) {
        room.updateGame();
    }
}, 16); // 60 FPS

// Эндпоинт для статистики
app.get('/stats', (req, res) => {
    res.json({
        totalRooms: gameState.rooms.size,
        totalPlayers: gameState.players.size,
        activeGames: Array.from(gameState.rooms.values()).filter(r => r.gameStarted).length
    });
});

server.listen(PORT, () => {
    console.log(`🎮 Игровой сервер запущен на порту ${PORT}`);
    console.log(`📊 Статистика доступна на /stats`);
}); 