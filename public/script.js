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
    console.log("Connected to game world:", data.id);
    worldSize = data.worldSize;
    food = data.food;
    players = data.players;
    myId = data.id;
    isDead = false;
    if (deathScreen) deathScreen.style.display = 'none';
});

socket.on('gameState', (data) => {
    players = data.players;
    food = data.food;
    
    if (myId && players[myId] && scoreEl) {
        scoreEl.textContent = Math.floor(players[myId].score);
    }
});

socket.on('dead', () => {
    isDead = true;
    if (deathScreen) deathScreen.style.display = 'flex';
});

// Controls
const handleInput = (e, isDown) => {
    const key = e.key.toLowerCase();
    if (key === 'arrowup' || key === 'w') keys.up = isDown;
    if (key === 'arrowdown' || key === 's') keys.down = isDown;
    if (key === 'arrowleft' || key === 'a') keys.left = isDown;
    if (key === 'arrowright' || key === 'd') keys.right = isDown;
};

window.addEventListener('keydown', (e) => handleInput(e, true));
window.addEventListener('keyup', (e) => handleInput(e, false));

if (respawnBtn) {
    respawnBtn.addEventListener('click', () => {
        socket.emit('respawn');
    });
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

function draw() {
    // Clear with a solid background color
    ctx.fillStyle = '#0a050f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const me = players[myId];

    // If we are waiting for the server, show a loading message
    if (!myId || (!me && !isDead)) {
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText("Connecting to Devour...", canvas.width / 2, canvas.height / 2);
        requestAnimationFrame(draw);
        return;
    }

    ctx.save();
    
    // Camera follow logic
    if (me) {
        ctx.translate(canvas.width / 2 - me.x, canvas.height / 2 - me.y);
    }

    // Draw a grid so we can see movement
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= worldSize; i += 100) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, worldSize); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(worldSize, i); ctx.stroke();
    }

    // Draw World Border
    ctx.strokeStyle = '#9d174d';
    ctx.lineWidth = 10;
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
        
        // Only add glow to self or nearby players to save performance
        ctx.shadowBlur = 15;
        ctx.shadowColor = p.color;
        
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.closePath();
        
        // Draw Name/Status
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(id === myId ? "YOU" : "GUEST", p.x, p.y + p.radius + 20);
    }

    ctx.restore();

    // Send movement to server
    if (!isDead) {
        socket.emit('move', keys);
    }

    requestAnimationFrame(draw);
}

// Start loop
draw();
