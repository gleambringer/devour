const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Game Constants
const WORLD_SIZE = 3000;
const INITIAL_RADIUS = 20;
const FOOD_COUNT = 150;

let players = {};
let food = [];

// Helper: Generate random position
const randomPos = () => Math.floor(Math.random() * (WORLD_SIZE - 40)) + 20;

// Initialize Food
for (let i = 0; i < FOOD_COUNT; i++) {
    food.push({
        id: i,
        x: randomPos(),
        y: randomPos(),
        color: `hsl(${Math.random() * 360}, 70%, 60%)`
    });
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Send initial world info
    socket.emit('init', { worldSize: WORLD_SIZE, id: socket.id });

    socket.on('join', (data) => {
        players[socket.id] = {
            id: socket.id,
            x: randomPos(),
            y: randomPos(),
            radius: INITIAL_RADIUS,
            color: data.color || '#9d174d',
            name: data.name || 'Guest',
            score: 0,
            boosting: false
        };
    });

    socket.on('respawn', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = randomPos();
            players[socket.id].y = randomPos();
            players[socket.id].radius = INITIAL_RADIUS;
            players[socket.id].score = 0;
            players[socket.id].name = data.name || players[socket.id].name;
            players[socket.id].color = data.color || players[socket.id].color;
        } else {
            // If for some reason player object was deleted
            socket.emit('join', data);
        }
    });

    socket.on('move', (keys) => {
        const player = players[socket.id];
        if (!player) return;

        let speed = player.boosting && player.score > 5 ? 5 : 3;
        
        // Decay score if boosting
        if (player.boosting && player.score > 5) {
            player.score -= 0.05;
            player.radius = INITIAL_RADIUS + Math.sqrt(player.score) * 2;
        }

        if (keys.up) player.y -= speed;
        if (keys.down) player.y += speed;
        if (keys.left) player.x -= speed;
        if (keys.right) player.x += speed;

        player.boosting = keys.boost;

        // Boundary checks
        player.x = Math.max(player.radius, Math.min(WORLD_SIZE - player.radius, player.x));
        player.y = Math.max(player.radius, Math.min(WORLD_SIZE - player.radius, player.y));

        // Food collision
        food.forEach((dot, index) => {
            const dist = Math.hypot(player.x - dot.x, player.y - dot.y);
            if (dist < player.radius) {
                player.score += 1;
                player.radius = INITIAL_RADIUS + Math.sqrt(player.score) * 2;
                food[index] = {
                    id: index,
                    x: randomPos(),
                    y: randomPos(),
                    color: `hsl(${Math.random() * 360}, 70%, 60%)`
                };
            }
        });

        // Player collision (Eating others)
        for (let id in players) {
            if (id === socket.id) continue;
            const other = players[id];
            const dist = Math.hypot(player.x - other.x, player.y - other.y);
            
            if (dist < player.radius * 0.8 && player.radius > other.radius * 1.1) {
                player.score += other.score + 5;
                player.radius = INITIAL_RADIUS + Math.sqrt(player.score) * 2;
                io.to(id).emit('dead');
                delete players[id];
            }
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

// Game Loop
setInterval(() => {
    const leaderboard = Object.values(players)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(p => ({ name: p.name, score: Math.floor(p.score) }));

    io.emit('gameState', {
        players,
        food,
        leaderboard
    });
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
