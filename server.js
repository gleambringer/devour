const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, 'public')));

// Game Constants
const WORLD_SIZE = 3000; // Increased world size
const INITIAL_RADIUS = 20;
const FOOD_COUNT = 300;
const MAX_RADIUS = 400;
const BASE_SPEED = 5;

// Game State
let players = {};
let food = [];

// Initialize Food
function spawnFood() {
    while (food.length < FOOD_COUNT) {
        food.push({
            id: Math.random().toString(36).substr(2, 9),
            x: Math.random() * WORLD_SIZE,
            y: Math.random() * WORLD_SIZE,
            color: `hsl(${Math.random() * 360}, 70%, 50%)`,
            size: 6
        });
    }
}
spawnFood();

function createPlayer(id, name, color) {
    return {
        id: id,
        name: name || "Unamed Cell",
        x: Math.random() * (WORLD_SIZE - 200) + 100,
        y: Math.random() * (WORLD_SIZE - 200) + 100,
        radius: INITIAL_RADIUS,
        color: color || `hsl(${Math.random() * 360}, 80%, 60%)`,
        score: 0,
        boosting: false
    };
}

io.on('connection', (socket) => {
    // Wait for "join" event instead of auto-creating on connection
    socket.on('join', (data) => {
        players[socket.id] = createPlayer(socket.id, data.name, data.color);
        
        socket.emit('init', {
            worldSize: WORLD_SIZE,
            food: food,
            players: players,
            id: socket.id
        });
    });

    socket.on('respawn', (data) => {
        if (!players[socket.id]) {
            players[socket.id] = createPlayer(socket.id, data.name, data.color);
            socket.emit('init', {
                worldSize: WORLD_SIZE,
                food: food,
                players: players,
                id: socket.id
            });
        }
    });

    socket.on('move', (data) => {
        const player = players[socket.id];
        if (!player) return;

        player.boosting = data.boost && player.radius > 25;

        // Calculate speed (larger = slower, boosting = faster)
        let speed = Math.max(1.5, BASE_SPEED - (player.radius / 60));
        if (player.boosting) {
            speed *= 1.8;
            player.radius -= 0.05; // Lose mass while boosting
        }

        if (data.up) player.y -= speed;
        if (data.down) player.y += speed;
        if (data.left) player.x -= speed;
        if (data.right) player.x += speed;

        // Bound to world
        player.x = Math.max(player.radius, Math.min(WORLD_SIZE - player.radius, player.x));
        player.y = Math.max(player.radius, Math.min(WORLD_SIZE - player.radius, player.y));

        // Food Collision
        food = food.filter(dot => {
            const dx = player.x - dot.x;
            const dy = player.y - dot.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < player.radius) {
                if (player.radius < MAX_RADIUS) {
                    player.radius += 0.4;
                    player.score += 1;
                }
                return false;
            }
            return true;
        });

        // Player Collision
        for (let otherId in players) {
            if (otherId === socket.id) continue;
            const other = players[otherId];
            const dx = player.x - other.x;
            const dy = player.y - other.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < player.radius && player.radius > other.radius * 1.15) {
                player.radius = Math.min(MAX_RADIUS, player.radius + (other.radius / 3));
                player.score += Math.floor(other.radius);
                io.to(otherId).emit('dead');
                delete players[otherId];
            }
        }

        if (food.length < FOOD_COUNT) spawnFood();
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerLeft', socket.id);
    });
});

setInterval(() => {
    // Generate Leaderboard
    const leaderboard = Object.values(players)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(p => ({ name: p.name, score: Math.floor(p.score) }));

    io.emit('gameState', {
        players: players,
        food: food,
        leaderboard: leaderboard
    });
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
