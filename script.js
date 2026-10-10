// =====================================================
//  BLACK HOLE EXPLORER  —  2D Space Gravity Simulator
//  Developed by FAIZAN
// =====================================================

const canvas = document.getElementById('space');
const ctx = canvas.getContext('2d');

let W, H;
function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// ---------- CAMERA ----------
const camera = {
  x: 0, y: 0,
  zoom: 1,
  targetZoom: 1,
};

// ---------- INPUT ----------
let isDragging = false;
let lastMouse = { x: 0, y: 0 };
let showLabels = true;
let showOrbits = true;
let paused = false;

canvas.addEventListener('mousedown', e => {
  isDragging = true;
  lastMouse = { x: e.clientX, y: e.clientY };
  canvas.classList.add('dragging');
});
canvas.addEventListener('mousemove', e => {
  if (isDragging) {
    camera.x -= (e.clientX - lastMouse.x) / camera.zoom;
    camera.y -= (e.clientY - lastMouse.y) / camera.zoom;
    lastMouse = { x: e.clientX, y: e.clientY };
  }
});
canvas.addEventListener('mouseup', () => { isDragging = false; canvas.classList.remove('dragging'); });
canvas.addEventListener('mouseleave', () => { isDragging = false; canvas.classList.remove('dragging'); });

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.15 : 0.87;
  camera.targetZoom = Math.max(0.15, Math.min(8, camera.targetZoom * factor));
}, { passive: false });

// Touch
let touchStart = null, touchStartDist = 0, touchStartZoom = 1;
canvas.addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    isDragging = true;
    lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  } else if (e.touches.length === 2) {
    isDragging = false;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    touchStartDist = Math.hypot(dx, dy);
    touchStartZoom = camera.targetZoom;
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (e.touches.length === 1 && isDragging) {
    camera.x -= (e.touches[0].clientX - lastMouse.x) / camera.zoom;
    camera.y -= (e.touches[0].clientY - lastMouse.y) / camera.zoom;
    lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  } else if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    const ratio = dist / touchStartDist;
    camera.targetZoom = Math.max(0.15, Math.min(8, touchStartZoom * ratio));
  }
}, { passive: false });

canvas.addEventListener('touchend', () => { isDragging = false; });

// ---------- STARS BACKGROUND ----------
const bgStars = [];
for (let i = 0; i < 400; i++) {
  bgStars.push({
    x: (Math.random() - 0.5) * 6000,
    y: (Math.random() - 0.5) * 6000,
    r: Math.random() * 1.5 + 0.2,
    a: Math.random() * 0.7 + 0.2,
    tw: Math.random() * Math.PI * 2,
  });
}

// ---------- BLACK HOLE ----------
const blackHole = {
  x: 0, y: 0,
  mass: 22000,
  radius: 42,       // visual core radius
  horizon: 55,      // event horizon
  diskRadius: 140,
  pulse: 0,
};

// ---------- PLANETS ----------
const planetData = [
  { name: 'Mercury', color: '#b1a89c', size: 6,  orbit: 480,  speed: 0.0055, mass: 40 },
  { name: 'Venus',   color: '#e8b96b', size: 9,  orbit: 620,  speed: 0.0042, mass: 80 },
  { name: 'Earth',   color: '#3d8ee0', size: 10, orbit: 780,  speed: 0.0034, mass: 100, moon: true },
  { name: 'Mars',    color: '#c1440e', size: 8,  orbit: 940,  speed: 0.0028, mass: 70 },
  { name: 'Jupiter', color: '#d9a066', size: 22, orbit: 1220, speed: 0.0018, mass: 400 },
  { name: 'Saturn',  color: '#e6c88f', size: 19, orbit: 1500, speed: 0.0014, mass: 320, ring: true },
  { name: 'Uranus',  color: '#8fd8e0', size: 14, orbit: 1780, speed: 0.0011, mass: 200 },
  { name: 'Neptune', color: '#4a6ddb', size: 13, orbit: 2040, speed: 0.0009, mass: 190 },
  { name: 'Pluto',   color: '#c4b8a8', size: 5,  orbit: 2280, speed: 0.0007, mass: 20 },
  { name: 'Kepler-X',color: '#ff7ad9', size: 16, orbit: 2520, speed: 0.0006, mass: 240 },
  { name: 'Nova-9',  color: '#7dffb0', size: 11, orbit: 2740, speed: 0.0005, mass: 130 },
  { name: 'Zeta-7',  color: '#ff9c6b', size: 15, orbit: 2980, speed: 0.0004, mass: 220 },
];

const planets = planetData.map(p => ({
  ...p,
  angle: Math.random() * Math.PI * 2,
  x: 0, y: 0,
  trail: [],
  glow: 0,
}));

// Update planet positions each frame (kinematic orbit)
function updatePlanets(dt) {
  planets.forEach(p => {
    p.angle += p.speed * dt * 60;
    // gravity from black hole increases when near? For simplicity keep circular
    p.x = blackHole.x + Math.cos(p.angle) * p.orbit;
    p.y = blackHole.y + Math.sin(p.angle) * p.orbit;

    // trail
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 40) p.trail.shift();
  });
}

// ---------- DROPPED OBJECTS ----------
const objects = []; // {type, x, y, vx, vy, r, color, name}

const objectTypes = {
  astronaut: { r: 9,  color: '#ffffff', emoji: '👨‍🚀', name: 'Astronaut' },
  rocket:    { r: 12, color: '#ff6b6b', emoji: '🚀', name: 'Rocket' },
  asteroid:  { r: 7,  color: '#a0a0a0', emoji: '☄️', name: 'Asteroid' },
  planet:    { r: 14, color: '#6bb6ff', emoji: '🪐', name: 'Mini Planet' },
  star:      { r: 16, color: '#ffd166', emoji: '⭐', name: 'Star' },
  satellite: { r: 8,  color: '#c8c8c8', emoji: '🛰️', name: 'Satellite' },
};

document.querySelectorAll('.spawn-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.type;
    spawnObject(type);
  });
});

function spawnObject(type) {
  const t = objectTypes[type];
  // spawn slightly off black hole, at random angle
  const angle = Math.random() * Math.PI * 2;
  const dist = 400 + Math.random() * 300;
  const x = blackHole.x + Math.cos(angle) * dist;
  const y = blackHole.y + Math.sin(angle) * dist;
  // give small tangential velocity so it starts falling in spirals
  const vx = -Math.sin(angle) * 0.6 + (Math.random() - 0.5) * 0.3;
  const vy =  Math.cos(angle) * 0.6 + (Math.random() - 0.5) * 0.3;

  objects.push({
    type, x, y, vx, vy,
    r: t.r, color: t.color, emoji: t.emoji, name: t.name,
    consumed: false,
    trail: [],
    stretch: 1,
    rotation: 0,
    rotSpeed: (Math.random() - 0.5) * 0.15,
  });
}

// ---------- PHYSICS ----------
const G = 0.35;

function updateObjects(dt) {
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    if (o.consumed) continue;

    const dx = blackHole.x - o.x;
    const dy = blackHole.y - o.y;
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq) || 1;

    // gravity acceleration
    const force = (G * blackHole.mass) / (distSq + 200);
    const ax = (dx / dist) * force;
    const ay = (dy / dist) * force;

    o.vx += ax * dt * 60;
    o.vy += ay * dt * 60;

    // speed limit
    const sp = Math.hypot(o.vx, o.vy);
    if (sp > 25) { o.vx = (o.vx / sp) * 25; o.vy = (o.vy / sp) * 25; }

    o.x += o.vx * dt * 60;
    o.y += o.vy * dt * 60;

    o.rotation += o.rotSpeed;

    // spaghettification: stretched near black hole
    const prox = Math.max(0, 1 - dist / 220);
    o.stretch = 1 + prox * 4;

    // trail
    o.trail.push({ x: o.x, y: o.y });
    if (o.trail.length > 30) o.trail.shift();

    // consumed by event horizon
    if (dist < blackHole.horizon * 0.9) {
      o.consumed = true;
      // flash
      objects.splice(i, 1);
    }
  }
}

// ---------- RENDER HELPERS ----------
function worldToScreen(x, y) {
  return {
    x: (x - camera.x) * camera.zoom + W / 2,
    y: (y - camera.y) * camera.zoom + H / 2,
  };
}

// ---------- RENDER ----------
let lastT = performance.now();

function render(now) {
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;

  // zoom easing
  camera.zoom += (camera.targetZoom - camera.zoom) * 0.12;

  if (!paused) {
    updatePlanets(dt);
    updateObjects(dt);
    blackHole.pulse += dt * 2;
  }

  // clear
  ctx.fillStyle = '#000308';
  ctx.fillRect(0, 0, W, H);

  // ---- BACKGROUND STARS ----
  ctx.save();
  bgStars.forEach(s => {
    const p = worldToScreen(s.x, s.y);
    if (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) return;
    s.tw += 0.02;
    const alpha = s.a * (0.6 + 0.4 * Math.sin(s.tw));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, s.r * Math.min(camera.zoom, 2), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.restore();

  // ---- NEBULA GLOW (background) ----
  const c = worldToScreen(blackHole.x, blackHole.y);
  const neb = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 800 * camera.zoom);
  neb.addColorStop(0, 'rgba(80, 30, 160, 0.15)');
  neb.addColorStop(0.5, 'rgba(30, 10, 80, 0.08)');
  neb.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = neb;
  ctx.fillRect(0, 0, W, H);

  // ---- ORBITS ----
  if (showOrbits) {
    ctx.strokeStyle = 'rgba(120, 100, 200, 0.18)';
    ctx.lineWidth = 1;
    planets.forEach(p => {
      const cc = worldToScreen(blackHole.x, blackHole.y);
      ctx.beginPath();
      ctx.arc(cc.x, cc.y, p.orbit * camera.zoom, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  // ---- ACCRETION DISK ----
  drawAccretionDisk(c.x, c.y);

  // ---- PLANETS + TRAILS ----
  planets.forEach(p => {
    const pos = worldToScreen(p.x, p.y);

    // trail
    if (p.trail.length > 1) {
      ctx.beginPath();
      p.trail.forEach((t, idx) => {
        const tp = worldToScreen(t.x, t.y);
        if (idx === 0) ctx.moveTo(tp.x, tp.y);
        else ctx.lineTo(tp.x, tp.y);
      });
      ctx.strokeStyle = p.color + '55';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    const r = p.size * camera.zoom;

    // glow
    const g = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r * 3.5);
    g.addColorStop(0, p.color + 'cc');
    g.addColorStop(0.4, p.color + '33');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r * 3.5, 0, Math.PI * 2);
    ctx.fill();

    // body
    const bodyGrad = ctx.createRadialGradient(
      pos.x - r * 0.3, pos.y - r * 0.3, 0,
      pos.x, pos.y, r
    );
    bodyGrad.addColorStop(0, lighten(p.color, 40));
    bodyGrad.addColorStop(1, p.color);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fill();

    // saturn ring
    if (p.ring) {
      ctx.strokeStyle = '#e6c88faa';
      ctx.lineWidth = Math.max(2, r * 0.25);
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y, r * 1.8, r * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // moon for earth
    if (p.moon) {
      const moonAngle = p.angle * 8;
      const mx = pos.x + Math.cos(moonAngle) * r * 2.6;
      const my = pos.y + Math.sin(moonAngle) * r * 2.6;
      ctx.fillStyle = '#dddddd';
      ctx.beginPath();
      ctx.arc(mx, my, Math.max(2, r * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }

    // label
    if (showLabels && camera.zoom > 0.35) {
      ctx.fillStyle = '#ffffffcc';
      ctx.font = `${Math.max(11, 12 * camera.zoom)}px Rajdhani, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(p.name, pos.x, pos.y - r - 8);
    }
  });

  // ---- BLACK HOLE ----
  drawBlackHole(c.x, c.y);

  // ---- DROPPED OBJECTS ----
  objects.forEach(o => {
    const pos = worldToScreen(o.x, o.y);
    const r = o.r * camera.zoom;

    // trail
    if (o.trail.length > 1) {
      ctx.beginPath();
      o.trail.forEach((t, idx) => {
        const tp = worldToScreen(t.x, t.y);
        if (idx === 0) ctx.moveTo(tp.x, tp.y);
        else ctx.lineTo(tp.x, tp.y);
      });
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // glow
    const g = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r * 2.8);
    g.addColorStop(0, o.color + 'cc');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r * 2.8, 0, Math.PI * 2);
    ctx.fill();

    // spaghettified body
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(o.rotation);
    const stretch = Math.min(o.stretch, 4);
    ctx.scale(stretch, 1 / Math.sqrt(stretch));
    ctx.fillStyle = o.color;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // emoji
    ctx.font = `${Math.max(10, 14 * camera.zoom)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(o.emoji, pos.x, pos.y);
    ctx.textBaseline = 'alphabetic';

    if (showLabels && camera.zoom > 0.5) {
      ctx.fillStyle = '#ffffffcc';
      ctx.font = `${Math.max(10, 11 * camera.zoom)}px Rajdhani, sans-serif`;
      ctx.fillText(o.name, pos.x, pos.y + r + 14);
    }
  });

  requestAnimationFrame(render);
}

function drawAccretionDisk(cx, cy) {
  const baseR = blackHole.diskRadius * camera.zoom;
  const pulse = 1 + Math.sin(blackHole.pulse) * 0.04;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, 0.35); // elliptical tilt

  const g = ctx.createRadialGradient(0, 0, baseR * 0.4, 0, 0, baseR * pulse);
  g.addColorStop(0.0, 'rgba(255, 220, 150, 0.0)');
  g.addColorStop(0.15, 'rgba(255, 200, 120, 0.55)');
  g.addColorStop(0.35, 'rgba(255, 130, 60, 0.55)');
  g.addColorStop(0.6, 'rgba(200, 60, 140, 0.35)');
  g.addColorStop(0.85, 'rgba(80, 30, 160, 0.18)');
  g.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, baseR * pulse, 0, Math.PI * 2);
  ctx.fill();

  // inner bright ring
  ctx.strokeStyle = 'rgba(255, 220, 160, 0.7)';
  ctx.lineWidth = Math.max(1, 2 * camera.zoom);
  ctx.beginPath();
  ctx.arc(0, 0, baseR * 0.35, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawBlackHole(cx, cy) {
  const horizon = blackHole.horizon * camera.zoom;
  const core = blackHole.radius * camera.zoom;

  // gravitational lensing ring (outer glow)
  const lensGrad = ctx.createRadialGradient(cx, cy, core, cx, cy, horizon * 2.5);
  lensGrad.addColorStop(0, 'rgba(0,0,0,1)');
  lensGrad.addColorStop(0.5, 'rgba(80,40,180,0.35)');
  lensGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = lensGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, horizon * 2.5, 0, Math.PI * 2);
  ctx.fill();

  // photon sphere glow ring
  ctx.strokeStyle = 'rgba(255, 200, 120, 0.85)';
  ctx.lineWidth = Math.max(1.5, 3 * camera.zoom);
  ctx.beginPath();
  ctx.arc(cx, cy, horizon * 1.08, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(180, 100, 255, 0.6)';
  ctx.lineWidth = Math.max(1, 2 * camera.zoom);
  ctx.beginPath();
  ctx.arc(cx, cy, horizon * 1.25, 0, Math.PI * 2);
  ctx.stroke();

  // event horizon (pure black)
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(cx, cy, horizon, 0, Math.PI * 2);
  ctx.fill();

  // inner singularity shimmer
  const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, core * 1.4);
  coreGrad.addColorStop(0, 'rgba(30, 0, 60, 1)');
  coreGrad.addColorStop(0.7, 'rgba(0, 0, 0, 1)');
  coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, core * 1.4, 0, Math.PI * 2);
  ctx.fill();

  // label
  if (showLabels && camera.zoom > 0.35) {
    ctx.fillStyle = '#ffcc88';
    ctx.font = `${Math.max(12, 14 * camera.zoom)}px Orbitron, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('SAGITTARIUS-X', cx, cy - horizon - 12);
  }
}

// color helper
function lighten(hex, amt) {
  const num = parseInt(hex.replace('#',''), 16);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0x00FF) + amt;
  let b = (num & 0x0000FF) + amt;
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return `rgb(${r}, ${g}, ${b})`;
}

// ---------- UI BUTTONS ----------
document.getElementById('btnZoomIn').onclick  = () => camera.targetZoom = Math.min(8, camera.targetZoom * 1.3);
document.getElementById('btnZoomOut').onclick = () => camera.targetZoom = Math.max(0.15, camera.targetZoom / 1.3);
document.getElementById('btnReset').onclick = () => {
  camera.x = 0; camera.y = 0;
  camera.targetZoom = 1;
  objects.length = 0;
};
document.getElementById('btnPause').onclick = e => {
  paused = !paused;
  e.target.textContent = paused ? '▶' : '⏸';
};
document.getElementById('btnToggleLabels').onclick = e => {
  showLabels = !showLabels;
  e.target.style.opacity = showLabels ? 1 : 0.5;
};
document.getElementById('btnToggleOrbits').onclick = e => {
  showOrbits = !showOrbits;
  e.target.style.opacity = showOrbits ? 1 : 0.5;
};
document.getElementById('btnInfo').onclick = () => {
  document.getElementById('infoPanel').classList.remove('hidden');
};
document.getElementById('closeInfo').onclick = () => {
  document.getElementById('infoPanel').classList.add('hidden');
};

// click on object to inspect
canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const w = screenToWorld(sx, sy);

  // check objects first
  for (const o of objects) {
    if (Math.hypot(o.x - w.x, o.y - w.y) < o.r + 8) {
      showInspector(o.name, `Type: ${o.type}\nVelocity: ${Math.hypot(o.vx, o.vy).toFixed(2)}\nDistance to BH: ${Math.hypot(o.x - blackHole.x, o.y - blackHole.y).toFixed(0)} units\nStatus: ${o.stretch > 1.5 ? 'Spaghettifying!' : 'In free fall'}`);
      return;
    }
  }
  // check planets
  for (const p of planets) {
    if (Math.hypot(p.x - w.x, p.y - w.y) < p.size + 6) {
      showInspector(p.name, `Mass: ${p.mass} units\nOrbit radius: ${p.orbit}\nSpeed: ${p.speed}\nType: Exoplanet / Planet`);
      return;
    }
  }
  // black hole
  if (Math.hypot(blackHole.x - w.x, blackHole.y - w.y) < blackHole.horizon + 10) {
    showInspector('SAGITTARIUS-X', `Type: Supermassive Black Hole\nMass: ${blackHole.mass} units\nEvent Horizon: ${blackHole.horizon}\nStatus: Feeding / Dormant`);
    return;
  }
  hideInspector();
});

function screenToWorld(sx, sy) {
  return {
    x: (sx - W / 2) / camera.zoom + camera.x,
    y: (sy - H / 2) / camera.zoom + camera.y,
  };
}

function showInspector(name, info) {
  const el = document.getElementById('inspector');
  document.getElementById('inspectName').textContent = name;
  document.getElementById('inspectInfo').innerHTML = info.replace(/\n/g, '<br>');
  el.classList.remove('hidden');
}
function hideInspector() {
  document.getElementById('inspector').classList.add('hidden');
}

// ---------- LOADER ----------
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('loader').classList.add('hide');
  }, 800);
});

// ---------- START ----------
requestAnimationFrame(render);