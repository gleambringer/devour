const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let worldSize = 3000;
let players = {};
let food = [];
let leaderboard = [];
let myId = null;
let isDead = false;
let gameStarted = false;

// Input tracking
const keys = { up: false, down: false, left: false, right: false, boost: false };

// UI Elements
const menuScreen = document.getElementById('menuScreen');
const deathScreen = document.getElementById('deathScreen');
const leaderboardEl = document.getElementById('leaderboardList');
const scoreVal = document.getElementById('scoreVal');
const playerNameInput = document.getElementById('playerName');
const colorOptions = document.querySelectorAll('.color-opt');

let selectedColor = '#9d174d';

// Color selection logic
colorOptions.forEach(opt => {
    opt.addEventListener('click', () => {
        colorOptions.forEach(o => o.style.border = 'none');
        opt.style.border = '3px solid white';
        selectedColor = opt.dataset.color;
    });
});

function startGame() {
    const name = playerNameInput.value.trim() || "Guest";
    socket.emit(gameStarted ? 'respawn' : 'join', { name, color: selectedColor });
    menuScreen.style.display = 'none';
    deathScreen.style.display = 'none';
    gameStarted = true;
    isDead = false;
}

const startBtn = document.getElementById('startBtn');
const respawnBtn = document.getElementById('respawnBtn');

if (startBtn) startBtn.addEventListener('click', startGame);
if (respawnBtn) respawnBtn.addEventListener('click', startGame);

socket.on('init', (data) => {
    worldSize = data.worldSize;
    myId = data.id;
});

socket.on('gameState', (data) => {
    players = data.players;
    food = data.food;
    leaderboard = data.leaderboard;
    
    // Update Leaderboard UI
    if (leaderboardEl && leaderboard) {
        leaderboardEl.innerHTML = leaderboard.map((p, i) => 
            `<div class="flex justify-between gap-4 text-sm ${i === 0 ? 'text-yellow-400 font-bold' : 'text-white/80'}">
                <span>${i+1}. ${p.name}</span>
                <span>${p.score}</span>
            </div>`
        ).join('');
    }

    if (myId && players[myId]) {
        scoreVal.textContent = Math.floor(players[myId].score);
    }
});

socket.on('dead', () => {
    isDead = true;
    deathScreen.style.display = 'flex';
});

// Controls
const handleInput = (e, isDown) => {
    const key = e.key.toLowerCase();
    if (key === 'arrowup' || key === 'w') keys.up = isDown;
    if (key === 'arrowdown' || key === 's') keys.down = isDown;
    if (key === 'arrowleft' || key === 'a') keys.left = isDown;
    if (key === 'arrowright' || key === 'd') keys.right = isDown;
    if (e.code === 'Space') keys.boost = isDown;
};

window.addEventListener('keydown', (e) => handleInput(e, true));
window.addEventListener('keyup', (e) => handleInput(e, false));

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function draw() {
    ctx.fillStyle = '#0a050f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const me = players[myId];
    if (!gameStarted || (isDead && !me)) {
        requestAnimationFrame(draw);
        return;
    }

    ctx.save();
    if (me) {
        ctx.translate(canvas.width / 2 - me.x, canvas.height / 2 - me.y);
    }

    // Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= worldSize; i += 100) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, worldSize); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(worldSize, i); ctx.stroke();
    }

    // World Border
    ctx.strokeStyle = '#9d174d';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, worldSize, worldSize);

    // Render Food
    food.forEach(dot => {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = dot.color;
        ctx.fill();
        ctx.closePath();
    });

    // Render Players
    for (let id in players) {
        const p = players[id];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        
        if (p.boosting) {
            ctx.shadowBlur = 30;
            ctx.shadowColor = p.color;
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 4;
            ctx.stroke();
        } else {
            ctx.shadowBlur = 15;
            ctx.shadowColor = p.color;
        }
        
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.closePath();
        
        // Name Tag Rendering
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px Inter';
        ctx.textAlign = 'center';
        // Position name inside if big enough, otherwise above
        const nameY = p.radius > 30 ? p.y + 5 : p.y + p.radius + 20;
        ctx.fillText(p.name, p.x, nameY);
    }

    ctx.restore();

    // Send movement to server if alive
    if (!isDead) {
        socket.emit('move', keys);
    }

    requestAnimationFrame(draw);
}

// Start game loop
draw();
