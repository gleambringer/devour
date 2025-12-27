const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let worldSize = 2000;
let players = {};
let food = [];
let myId = null;
let isDead = false;

// Input tracking
const keys = {
    up: false,
    down: false,
    left: false,
    right: false
};

// UI Elements
const deathScreen = document.getElementById('deathScreen');
const respawnBtn = document.getElementById('respawnBtn');
const scoreEl = document.getElementById('scoreVal');

// Initialize game
socket.on('init', (data) => {
    worldSize = data.worldSize;
    food = data.food;
    players = data.players;
    myId = data.id;
    isDead = false;
    deathScreen.style.display = 'none';
});

socket.on('gameState', (data) => {
    players = data.players;
    food = data.food;
    
    if (myId && players[myId]) {
        scoreEl.textContent = Math.floor(players[myId].score);
    }
});

socket.on('dead', () => {
    isDead = true;
    deathScreen.style.display = 'flex';
});

// Controls
window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w') keys.up = true;
    if (e.key === 'ArrowDown' || e.key === 's') keys.down = true;
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w') keys.up = false;
    if (e.key === 'ArrowDown' || e.key === 's') keys.down = false;
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
});

respawnBtn.addEventListener('click', () => {
    socket.emit('respawn');
});

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const me = players[myId];
    if (!me && !isDead) return;

    // Camera logic: translate context so 'me' is in the center
    ctx.save();
    if (me) {
        ctx.translate(canvas.width / 2 - me.x, canvas.height / 2 - me.y);
    }

    // Draw World Border
    ctx.strokeStyle = 'rgba(157, 23, 77, 0.5)';
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, worldSize, worldSize);

    // Draw Food
    food.forEach(dot => {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
        ctx.fillStyle = dot.color;
        ctx.fill();
        ctx.closePath();
    });

    // Draw Players
    for (let id in players) {
        const p = players[id];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        
        // Glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = p.color;
        
        ctx.closePath();
        
        // Draw ID label
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'white';
        ctx.font = '12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(id === myId ? "You" : "Guest", p.x, p.y + p.radius + 15);
    }

    ctx.restore();

    // Send movement to server
    if (!isDead) {
        socket.emit('move', keys);
    }

    requestAnimationFrame(draw);
}

draw();
