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
const WORLD_SIZE = 2000;
const INITIAL_RADIUS = 20;
const FOOD_COUNT = 150;
const MAX_RADIUS = 400;

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
            size: 5
        });
    }
}
spawnFood();

function createPlayer(id) {
    return {
        id: id,
        x: Math.random() * (WORLD_SIZE - 100) + 50,
        y: Math.random() * (WORLD_SIZE - 100) + 50,
        radius: INITIAL_RADIUS,
        color: `hsl(${Math.random() * 360}, 80%, 60%)`,
        score: 0
    };
}

io.on('connection', (socket) => {
    console.log(`Player joined: ${socket.id}`);

    // Initial join
    players[socket.id] = createPlayer(socket.id);

    socket.emit('init', {
        worldSize: WORLD_SIZE,
        food: food,
        players: players,
        id: socket.id
    });

    // Handle Respawn Request
    socket.on('respawn', () => {
        if (!players[socket.id]) {
            players[socket.id] = createPlayer(socket.id);
            socket.emit('init', {
                worldSize: WORLD_SIZE,
                food: food,
                players: players,
                id: socket.id
            });
        }
    });

    // Handle Movement Inputs
    socket.on('move', (data) => {
        const player = players[socket.id];
        if (!player) return;

        // Calculate speed based on size (larger = slower)
        const speedBase = 5;
        const speed = Math.max(1.5, speedBase - (player.radius / 50));

        if (data.up) player.y -= speed;
        if (data.down) player.y += speed;
        if (data.left) player.x -= speed;
        if (data.right) player.x += speed;

        // Bound to world
        player.x = Math.max(player.radius, Math.min(WORLD_SIZE - player.radius, player.x));
        player.y = Math.max(player.radius, Math.min(WORLD_SIZE - player.radius, player.y));

        // Check Food Collision
        food = food.filter(dot => {
            const dx = player.x - dot.x;
            const dy = player.y - dot.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < player.radius) {
                if (player.radius < MAX_RADIUS) {
                    player.radius += 0.5;
                    player.score += 1;
                }
                return false;
            }
            return true;
        });

        // Check Player vs Player Collision
        for (let otherId in players) {
            if (otherId === socket.id) continue;
            const other = players[otherId];
            
            const dx = player.x - other.x;
            const dy = player.y - other.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // If one player is significantly larger and overlaps the smaller player's center
            if (distance < player.radius && player.radius > other.radius * 1.1) {
                // Player eats other
                player.radius = Math.min(MAX_RADIUS, player.radius + (other.radius / 4));
                player.score += Math.floor(other.radius);
                
                // Kill the other player
                io.to(otherId).emit('dead');
                delete players[otherId];
            }
        }

        // Refill food if needed
        if (food.length < FOOD_COUNT) spawnFood();
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerLeft', socket.id);
        console.log(`Player left: ${socket.id}`);
    });
});

// Broadcast game state 60 times per second
setInterval(() => {
    io.emit('gameState', {
        players: players,
        food: food
    });
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Devour server running on port ${PORT}`);
});
