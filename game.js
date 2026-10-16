/* SUPER MARTY BROS. — a Super Mario Bros 1-style demo starring Marty McFly
 * and Doc Brown (standing in for Mario & Luigi). They run the full length of
 * Tierra 1 A, then Tierra 1 B, which ends at a pipe — duck straight into it
 * and swim the underwater interlude (Mar 1 A/B/C), then pop out of a second
 * pipe into Tierra 2 A. From there they run through Tierra 2 B's staircase to
 * the flagpole, slide down, and finally reach the DeLorean, which takes off
 * in a flash once they hop in. Self-playing demo: nobody controls anyone, it
 * all runs on a loop. */

const TILE = 32;
const LEVEL_COLS = 112;
const LEVEL_ROWS = 14;
const GROUND_ROW = 12;
const GAPS = [[12, 13], [36, 37], [60, 61]]; // Tierra 1 A, Tierra 1 B, and Tierra 2 A each get one

// Tierra 1 B ends at the entrance pipe — walk INTO it instead of jumping over it.
// Tierra 2 A begins at the exit pipe, right where they pop back out.
const ENTRANCE_PIPE_COL = 48;
const EXIT_PIPE_COL = 55;
const ALL_PIPES = [{ col: ENTRANCE_PIPE_COL, height: 2 }, { col: EXIT_PIPE_COL, height: 2 }];

const BLOCKS = [
  // Tierra 1 A
  { col: 6, row: 8, type: 'Q' }, { col: 7, row: 8, type: 'B' }, { col: 8, row: 8, type: 'Q' },
  { col: 16, row: 8, type: 'Q' },
  // Tierra 1 B
  { col: 29, row: 9, type: 'B' }, { col: 30, row: 9, type: 'Q' }, { col: 31, row: 9, type: 'B' },
  { col: 41, row: 8, type: 'Q' }, { col: 42, row: 8, type: 'B' },
  // Tierra 2 A
  { col: 65, row: 9, type: 'B' }, { col: 66, row: 9, type: 'Q' }, { col: 67, row: 9, type: 'B' },
  // Tierra 2 B
  { col: 76, row: 8, type: 'Q' }, { col: 77, row: 8, type: 'B' },
];

// Toads patrol Tierra 1 A/B and Tierra 2 A/B — the final stretch after the
// flagpole, on the way to the DeLorean, stays clear of them.
const ENEMY_SPAWNS = [4, 10, 20, 27, 40, 63, 81].map((col) => ({ col }));

// Tierra 2 B: ascending stairs, a bush in the dip, then the flagpole to slide down.
const STAIR_UP_START = 72; // 4 steps up
const STAIR_DOWN_START = 76; // 4 steps down
const STAIR_TOP_ROW = GROUND_ROW - 4;
const STAIR_TOP_START = STAIR_UP_START + 3;
const STAIR_TOP_END = STAIR_DOWN_START + 1;
// The two raised blocks beside the pole are the only valid launch platform.
const FLAG_LAUNCH_PLATFORM_START = STAIR_DOWN_START;
const FLAG_LAUNCH_PLATFORM_END = STAIR_DOWN_START + 1;
const FLAGPOLE_COL = 84;

const GOAL_COL = 104; // the DeLorean, after the flagpole slide
const LEVEL_WIDTH_PX = LEVEL_COLS * TILE;

function isGapAt(col) { return GAPS.some(([s, e]) => col >= s && col <= e); }
function isOnFlagJumpBlock(entity) {
  const topY = STAIR_TOP_ROW * TILE - entity.h;
  return entity.onGround && entity.y <= topY + 6
    && entity.x + entity.w >= FLAG_LAUNCH_PLATFORM_START * TILE
    && entity.x <= (FLAG_LAUNCH_PLATFORM_END + 1) * TILE;
}

function buildLevel() {
  const grid = [];
  for (let r = 0; r < LEVEL_ROWS; r++) grid.push(new Array(LEVEL_COLS).fill('.'));
  for (let c = 0; c < LEVEL_COLS; c++) {
    if (!isGapAt(c)) {
      grid[GROUND_ROW][c] = 'G';
      grid[GROUND_ROW + 1][c] = 'G';
    }
  }
  for (const p of ALL_PIPES) {
    for (let h = 0; h < p.height; h++) {
      const r = GROUND_ROW - 1 - h;
      grid[r][p.col] = 'p';
      grid[r][p.col + 1] = 'p';
    }
  }
  for (let h = 0; h < 4; h++) { for (let r = GROUND_ROW - 1 - h; r < GROUND_ROW; r++) grid[r][STAIR_UP_START + h] = 'S'; }
  for (let h = 0; h < 4; h++) { const c = STAIR_DOWN_START + h; for (let r = GROUND_ROW - 1 - (3 - h); r < GROUND_ROW; r++) grid[r][c] = 'S'; }
  for (const b of BLOCKS) grid[b.row][b.col] = b.type;
  return grid;
}

let level = buildLevel();

function isSolidTile(ch) {
  return ch === 'G' || ch === 'B' || ch === 'Q' || ch === 'q' || ch === 'p' || ch === 'S';
}
function tileAt(col, row) {
  if (row < 0 || row >= LEVEL_ROWS || col < 0 || col >= LEVEL_COLS) return row >= LEVEL_ROWS ? 'G' : '.';
  return level[row][col];
}

// --- underwater interlude: its own tiny level, spanning Mar 1 A (entry pipe,
// coral), Mar 1 B (coral-block pillars) and Mar 1 C (the exit pipe, top right) ---
const UW_COLS = 40;
const UW_ROWS = 14;
const UW_FLOOR_ROW = 12;
const UW_COINS = [5, 9, 14, 19, 24, 29, 34].map((col, i) => ({ col, row: i % 2 === 0 ? 8 : 6 }));
let uwCoinsLeft = UW_COINS.map((c) => ({ ...c, taken: false }));

// ambient underwater decoration (purely visual, no collision — just dressing the scene)
const UW_CORALS = [3.2, 7.5, 11, 14.5, 18, 21.5, 25, 28.5, 32, 35.5].map((col) => ({ col }));
const UW_SEAWEED = Array.from({ length: 18 }, (_, i) => ({ col: 2 + i * 2 }));
const UW_MINES = [17, 23].map((col) => ({ col, row: 3 }));
// vertical coral-block pillars, like the ones in the Mar 1 B reference art — these
// are solid: swimmers dodge around/over them, never pass through
const UW_PILLARS = [{ col: 12, height: 5 }, { col: 20, height: 3 }, { col: 29, height: 4 }];
const UW_PILLAR_CLEARANCE = 16; // how far above a pillar's top a swimmer clears it by
const UW_PILLAR_LOOKAHEAD = 60; // starts rising this far before reaching a pillar

// the two ceiling pipes (entry on the left, exit on the right — see Mar 1 A / Mar 1 C)
const UW_ENTRY_X = 2 * TILE;
const UW_EXIT_X = (UW_COLS - 2) * TILE;
const UW_PIPE_MOUTH_Y = 5 * TILE - 8;
const UW_PIPE_SETTLE_DIST = 110; // how much swimming room it takes to settle in/out of a pipe's mouth

// hostile swimmers Marty & Doc kill with thrown fireballs
const UW_ENEMY_SPAWNS = [
  { type: 'pez1', col: 6, row: 5, speed: 24, range: 2.2 },
  { type: 'fantasma', col: 10, row: 8, speed: 14, range: 1.2 },
  { type: 'pez2', col: 15.5, row: 4, speed: 30, range: 2.6 },
  { type: 'pez1', col: 19, row: 9, speed: 22, range: 1.8 },
  { type: 'fantasma', col: 24, row: 6, speed: 12, range: 1.4 },
  { type: 'pez2', col: 28, row: 8, speed: 26, range: 2.2 },
  { type: 'pez1', col: 33, row: 5, speed: 24, range: 2 },
];
let uwEnemies = [];
let fireballs = [];
const fireCooldown = { marty: 0, doc: 0 };
let uwTime = 0;

// --- layered overworld scenery ---
const CLOUDS = Array.from({ length: 12 }, (_, i) => ({ x: 60 + i * 300, y: 40 + (i % 2) * 20 }));
const HILLS = Array.from({ length: 10 }, (_, i) => ({ x: 180 + i * 430, size: 0.8 + (i % 3) * 0.18 }));
const BUSHES = Array.from({ length: 16 }, (_, i) => ({ x: 90 + i * 245, size: 0.7 + (i % 2) * 0.22 }));

// --- entities ---
const CHARACTER_H = 30;
const RUN_Y = GROUND_ROW * TILE - CHARACTER_H;

function makeMarty() {
  return {
    x: 2 * TILE, y: RUN_Y,
    w: 22, h: CHARACTER_H,
    velX: 0, velY: 0,
    onGround: true,
    facingRight: true,
    animTimer: 0,
    state: 'running',
  };
}
function makeDoc() {
  return { x: 2 * TILE - 34, y: RUN_Y, w: 22, h: CHARACTER_H, onGround: true, facingRight: true, animTimer: 0, state: 'running' };
}
const ENEMY_W = 30, ENEMY_H = 30;

// true for any column that isn't solid ground (a gap, or a pipe) — Toads must
// never patrol out over one of these, or they'd look like they're floating
function isHazardCol(col) { return isGapAt(col) || ALL_PIPES.some((p) => col === p.col || col === p.col + 1); }
// a solid tile right at ground level (a staircase step, say) — Toads patrol flat
// ground only, so a wall like this stops them just like a gap or pipe would
function isWallCol(col) { return isSolidTile(tileAt(col, GROUND_ROW - 1)); }

function makeEnemy(spawn) {
  let rightEdge = spawn.col;
  while (!isHazardCol(rightEdge + 1) && !isWallCol(rightEdge + 1) && rightEdge - spawn.col < 3) rightEdge++;
  let leftEdge = spawn.col;
  while (!isHazardCol(leftEdge - 1) && !isWallCol(leftEdge - 1) && spawn.col - leftEdge < 3) leftEdge--;
  return {
    x: spawn.col * TILE, y: GROUND_ROW * TILE - ENEMY_H, w: ENEMY_W, h: ENEMY_H,
    velX: -50, minX: leftEdge * TILE, maxX: (rightEdge + 1) * TILE - ENEMY_W,
    alive: true, animTimer: 0, deadTimer: 0,
  };
}

let marty = makeMarty();
let doc = makeDoc();
let enemies = ENEMY_SPAWNS.map(makeEnemy);
let coinPops = [];

const TRAIL_DELAY = 16;
let martyTrail = [];

const RUN_SPEED = 210;
const GRAVITY = 2000;
const JUMP_VELOCITY = -740;
const GAP_JUMP_VELOCITY = -790;
const STOMP_BOUNCE = -420;
const MAX_FALL = 1100;
const LOOKAHEAD = 130;

let score = 0;
let coins = 0;
let timeLeft = 400;
let timeAccum = 0;
let cameraX = 0;
// title | playing | flagJump | flagpole | pipeIn | underwater | pipeOut |
// toCar | arriving | entering | departing | clear
let gameState = 'playing';
let flashAlpha = 0;
let carX = GOAL_COL * TILE;
let carDriveVelX = 0;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const VIEW_W = canvas.width;
const VIEW_H = canvas.height;

const scoreEl = document.getElementById('score');
const coinsEl = document.getElementById('coins');
const timeEl = document.getElementById('time');
const clearOverlay = document.getElementById('clearOverlay');
const martyBrosMusic = document.getElementById('martyBrosMusic');
const martyFlagRunSfx = document.getElementById('martyFlagRunSfx');
const martyPipeSfx = document.getElementById('martyPipeSfx');
const martyFireballSfx = document.getElementById('martyFireballSfx');

function playMartyClip(audio, volume = 0.55) {
  if (!audio) return;
  audio.currentTime = 0;
  audio.volume = volume;
  const playback = audio.play();
  if (playback && typeof playback.catch === 'function') playback.catch(() => {});
}

function playMartyFlagRunSfx() { playMartyClip(martyFlagRunSfx, 0.58); }
function playMartyPipeSfx() { playMartyClip(martyPipeSfx, 0.5); }
function playMartyFireballSfx() { playMartyClip(martyFireballSfx, 0.46); }

function startMartyBrosMusic() {
  if (!martyBrosMusic) return;
  martyBrosMusic.volume = 0.62;
  const playback = martyBrosMusic.play();
  if (playback && typeof playback.catch === 'function') playback.catch(() => {});
}

function stopMartyBrosMusic() {
  if (!martyBrosMusic) return;
  martyBrosMusic.pause();
  martyBrosMusic.currentTime = 0;
}

// Browsers may defer autoplay until the first interaction; resume the demo music then.
window.addEventListener('pointerdown', startMartyBrosMusic, { passive: true });
window.addEventListener('keydown', startMartyBrosMusic, { passive: true });
// Start the game music when autoplay is permitted; the interaction listeners above
// provide the browser-safe fallback when autoplay is blocked.
startMartyBrosMusic();

const deloreanImg = new Image();
deloreanImg.src = 'assets/delorean.png';

function loadSprite(name) {
  const img = new Image();
  img.src = `assets/${name}`;
  return img;
}
const SPRITES = {
  brick: loadSprite('tile-brick.png'),
  question: loadSprite('tile-question.png'),
  pipeCap: loadSprite('pipe-cap.png'),
  pipeBody: loadSprite('pipe-body.png'),
  cloud: loadSprite('nubes.png'),
  toad: loadSprite('toad.png'),
  staircase: loadSprite('staircase.png'),
  flagpole: loadSprite('flagpole.png'),
  coral: loadSprite('coral.png'),
  mine: loadSprite('mine.png'),
  seaweed: loadSprite('seaweed.png'),
  pez1: loadSprite('pez1.png'),
  pez2: loadSprite('pez2.png'),
  fantasma: loadSprite('fantasma.png'),
  marty: loadSprite('marty-sprite.png'),
  doc: loadSprite('doc-sprite.png'),
};
function ready(img) { return img.complete && img.naturalWidth; }

function updateHud() {
  scoreEl.textContent = String(score).padStart(6, '0');
  coinsEl.textContent = String(coins).padStart(2, '0');
  timeEl.textContent = String(Math.max(0, Math.ceil(timeLeft)));
}

function groundTopAt(px) {
  const col = Math.floor(px / TILE);
  for (let row = 0; row < LEVEL_ROWS; row++) if (isSolidTile(tileAt(col, row))) return row * TILE;
  return LEVEL_ROWS * TILE;
}

function popBlockAt(col, row) {
  const ch = tileAt(col, row);
  if (ch === 'Q') {
    level[row][col] = 'q';
    coinPops.push({ x: col * TILE + TILE / 2, y: row * TILE, timer: 0.5 });
    coins++; score += 200;
    SFX.coin(); updateHud();
  } else {
    SFX.bump();
  }
}

// --- physics for marty (overworld) ---
function updateMarty(dt) {
  marty.animTimer += dt;
  if (marty.state !== 'running') return;

  marty.velX = RUN_SPEED;
  marty.velY = Math.min(MAX_FALL, marty.velY + GRAVITY * dt);
  runMartyAI();

  let nextX = marty.x + marty.velX * dt;
  const feetRow = Math.floor((marty.y + marty.h - 1) / TILE);
  const headRow = Math.floor(marty.y / TILE);
  const frontCol = Math.floor((nextX + marty.w) / TILE);
  let blockedX = false;
  // The final showcase jump must pass over the stair faces. Treating those
  // blocks as a side wall traps Marty at the first step before he can land on
  // the top platform and reach the flag.
  const crossingFlagStairs = !marty.onGround
    && nextX >= (STAIR_UP_START - 1) * TILE
    && nextX <= (STAIR_TOP_END + 1) * TILE;
  if (!crossingFlagStairs) {
    for (let r = headRow; r <= feetRow; r++) if (isSolidTile(tileAt(frontCol, r))) { blockedX = true; break; }
  }
  if (!blockedX) marty.x = nextX; else marty.x = frontCol * TILE - marty.w - 0.01;

  let nextY = marty.y + marty.velY * dt;
  const leftCol = Math.floor((marty.x + 3) / TILE);
  const rightCol = Math.floor((marty.x + marty.w - 3) / TILE);

  if (marty.velY > 0) {
    const newFeetRow = Math.floor((nextY + marty.h) / TILE);
    let landed = false;
    for (let c = leftCol; c <= rightCol; c++) if (isSolidTile(tileAt(c, newFeetRow))) { landed = true; break; }
    if (landed) { marty.y = newFeetRow * TILE - marty.h; marty.velY = 0; marty.onGround = true; }
    else { marty.y = nextY; marty.onGround = false; }
  } else if (marty.velY < 0) {
    const newHeadRow = Math.floor(nextY / TILE);
    let bumped = false;
    for (let c = leftCol; c <= rightCol; c++) if (isSolidTile(tileAt(c, newHeadRow))) { popBlockAt(c, newHeadRow); bumped = true; }
    if (bumped) { marty.y = (newHeadRow + 1) * TILE; marty.velY = 0; } else marty.y = nextY;
    marty.onGround = false;
  }

  // The staircase top is a broad set-piece landing surface. During the
  // showcase jump, preserve the intended landing even if the sprite crosses
  // the step seam between two 32px columns in a single frame.
  const topPlatformLeft = STAIR_TOP_START * TILE;
  const topPlatformRight = (STAIR_TOP_END + 1) * TILE;
  const topPlatformY = STAIR_TOP_ROW * TILE - marty.h;
  if (marty.velY > 0 && marty.x + marty.w > topPlatformLeft && marty.x < topPlatformRight
      && marty.y < topPlatformY + 42 && nextY + marty.h >= STAIR_TOP_ROW * TILE) {
    marty.y = topPlatformY;
    marty.velY = 0;
    marty.onGround = true;
  }

  // safety net: they must never actually land inside a gap — the instant he'd sink
  // below ground level over one, hop him across to solid ground on the far side
  const centerCol = Math.floor((marty.x + marty.w / 2) / TILE);
  if (isGapAt(centerCol) && marty.y + marty.h > GROUND_ROW * TILE) {
    let clearCol = centerCol;
    while (isGapAt(clearCol)) clearCol++;
    marty.x = clearCol * TILE + 2;
    marty.y = RUN_Y;
    marty.velY = 0; marty.onGround = true;
  }

  if (marty.y > LEVEL_ROWS * TILE) { marty.x = Math.max(0, marty.x - TILE * 2); marty.y = RUN_Y; marty.velY = 0; marty.onGround = true; }
}

function runMartyAI() {
  if (!marty.onGround) return;
  const distanceToFlag = FLAGPOLE_COL * TILE - (marty.x + marty.w);
  // The flag set piece owns the final approach. Do not let a nearby enemy or the
  // last stair trigger a normal AI jump one frame before the cinematic leap.
  if (distanceToFlag > 0 && distanceToFlag <= FLAG_JUMP_TRIGGER + 16 && isOnFlagJumpBlock(marty)) return;
  let shouldJump = false;
  let jumpVel = JUMP_VELOCITY;
  // Jump close to the lip instead of scanning several whole tiles ahead. The old
  // launch point and oversized impulse made the first gap look like a physics bug.
  const frontX = marty.x + marty.w;
  // The flag set piece is reached from the top of the staircase. Give the
  // automatic demo one clean, committed leap onto that top platform instead
  // of letting the generic obstacle scanner bounce between individual steps.
  const stairLaunchX = (STAIR_UP_START - 1) * TILE;
  const topPlatformY = STAIR_TOP_ROW * TILE - marty.h;
  if (marty.x >= stairLaunchX && marty.x < STAIR_TOP_START * TILE
      && marty.y > topPlatformY + 8) {
    shouldJump = true;
    jumpVel = JUMP_VELOCITY;
  }
  for (const [gapStart] of GAPS) {
    const distanceToLip = gapStart * TILE - frontX;
    if (!shouldJump && distanceToLip >= -2 && distanceToLip <= 34) {
      shouldJump = true;
      jumpVel = GAP_JUMP_VELOCITY;
      break;
    }
  }
  if (!shouldJump) {
    const nearCol = Math.floor((marty.x + marty.w + 6) / TILE);
    // pipes are walked into deliberately, never jumped — everything else solid ahead (stairs) gets a jump-assist
    const isPipeCol = ALL_PIPES.some((p) => nearCol === p.col || nearCol === p.col + 1);
    if (!isPipeCol) {
      const footRow = Math.floor((marty.y + marty.h + 1) / TILE);
      for (let r = footRow - 1; r >= footRow - 3; r--) if (isSolidTile(tileAt(nearCol, r)) && !isGapAt(nearCol)) { shouldJump = true; break; }
    }
  }
  if (!shouldJump) {
    for (const e of enemies) { if (!e.alive) continue; if (e.x > marty.x && e.x - (marty.x + marty.w) < LOOKAHEAD * 0.8) { shouldJump = true; break; } }
  }
  if (shouldJump) { marty.velY = jumpVel; marty.onGround = false; SFX.jump(); }
}

function updateDoc(dt) {
  doc.animTimer += dt;
  martyTrail.push({ x: marty.x, y: marty.y, onGround: marty.onGround, facingRight: marty.facingRight });
  if (martyTrail.length > TRAIL_DELAY + 2) martyTrail.shift();
  if (doc.state !== 'running') return;
  // At the final staircase Doc does not mimic Marty's upward jump. He keeps
  // running on the brown ground into the waiting position for his own scene.
  const docWaitX = (STAIR_UP_START - 1) * TILE;
  if (marty.x >= (STAIR_UP_START - 2) * TILE && marty.x < FLAGPOLE_COL * TILE) {
    doc.x = Math.min(docWaitX, doc.x + RUN_SPEED * dt);
    doc.y = RUN_Y;
    doc.onGround = true;
    doc.facingRight = true;
    return;
  }
  const snap = martyTrail[0];
  if (!snap) return;
  doc.x = snap.x - 30; doc.y = snap.y; doc.onGround = snap.onGround; doc.facingRight = snap.facingRight;
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (!e.alive) { e.deadTimer -= dt; continue; }
    e.animTimer += dt;
    e.x += e.velX * dt;
    if (e.x < e.minX || e.x > e.maxX) e.velX *= -1;
    const overlapX = marty.x < e.x + e.w && marty.x + marty.w > e.x;
    const overlapY = marty.y < e.y + e.h && marty.y + marty.h > e.y;
    if (overlapX && overlapY && marty.state === 'running') {
      const martyWasAbove = (marty.y + marty.h - marty.velY * dt) <= e.y + e.h * 0.5;
      if (marty.velY > 0 && martyWasAbove) {
        e.alive = false; e.deadTimer = 0.4; marty.velY = STOMP_BOUNCE;
        score += 100; SFX.stomp(); updateHud();
      }
    }
  }
}

function updateCoinPops(dt) { for (const p of coinPops) p.timer -= dt; coinPops = coinPops.filter((p) => p.timer > 0); }

// Tierra 1 A ends here: walk straight into the entrance pipe instead of jumping it.
let hasEnteredPipe = false;
// fires a little before the pipe's tile edge — normal wall collision would otherwise
// pin Marty just short of it, since the pipe is solid ground for ordinary physics
const ENTRANCE_TRIGGER_X = ENTRANCE_PIPE_COL * TILE - 8;

function checkPipeEntrance() {
  if (hasEnteredPipe || gameState !== 'playing' || marty.state !== 'running') return;
  if (marty.x + marty.w >= ENTRANCE_TRIGGER_X) {
    hasEnteredPipe = true;
    gameState = 'pipeInMarty';
    martyDuckScale = 1;
    beginPipeEntry(marty, ENTRANCE_PIPE_COL);
  }
}

// Tierra 2 B's flagpole is a short set piece: both characters make a visible
// jump to the very top, settle on the pole, and only then slide down.
const FLAG_JUMP_TRIGGER = 76;
const FLAG_JUMP_DURATION = 0.72;
const FLAG_TOP_HOLD = 0.22;
const SLIDE_DURATION = 1.05;
const FLAG_DOC_PLATFORM_DURATION = 0.72;
const FLAG_DOC_POLE_DURATION = 0.72;
const FLAG_DOC_PLATFORM_HOLD = 0.18;
let flagpoleTimer = 0;
let flagPoleTopY = 0;
let flagGrabY = 0;
let flagJumpStart = null;
let flagVictoryPlayed = false;
let flagRunSfxPlayed = false;
let martySlideProgress = 0;

function checkGoalArrival() {
  if (gameState !== 'playing' || marty.state !== 'running' || !marty.onGround) return;
  // The jump must begin from the top stair, never from the ground below it.
  if (!isOnFlagJumpBlock(marty)) return;

  gameState = 'flagJump';
  flagpoleTimer = 0;
  flagVictoryPlayed = false;
  flagRunSfxPlayed = false;
  martySlideProgress = 0;
  flagPoleTopY = GROUND_ROW * TILE - TILE * 9.5;
  flagGrabY = flagPoleTopY + 12;
  // Marty is already on the raised blocks; Doc must visibly wait on the
  // ground below them until his own jump phase begins.
  // Anchor him to the solid brown floor just before the staircase, where he
  // remains visible while Marty is on the floating blocks.
  doc.x = (STAIR_UP_START - 1) * TILE;
  doc.y = RUN_Y;
  doc.onGround = true;
  doc.state = 'waiting';
  doc.animTimer = 0;
  flagJumpStart = {
    martyX: marty.x, martyY: marty.y,
    docX: doc.x, docY: doc.y,
  };
  marty.velX = 0; marty.velY = 0; marty.onGround = false;
  doc.velX = 0; doc.velY = 0; doc.onGround = true; doc.facingRight = true;
  SFX.jump();
}

function easeInOut(t) { return t * t * (3 - 2 * t); }
function lerp(a, b, t) { return a + (b - a) * t; }

function updateFlagJump(dt) {
  flagpoleTimer += dt;
  const martyT = Math.min(1, flagpoleTimer / FLAG_JUMP_DURATION);
  const poleX = FLAGPOLE_COL * TILE;
  const martyEase = easeInOut(martyT);

  marty.x = lerp(flagJumpStart.martyX, poleX + 7, martyEase);
  marty.y = lerp(flagJumpStart.martyY, flagGrabY, martyEase) - Math.sin(Math.PI * martyT) * 78;
  // Keep both characters facing the flag throughout the jump.
  marty.facingRight = true;

  doc.x = flagJumpStart.docX;
  doc.y = flagJumpStart.docY;
  doc.facingRight = true;
  doc.onGround = true;

  if (martyT >= 1) {
    marty.x = poleX + 7; marty.y = flagGrabY;
    flagJumpStart.docPlatformX = Math.max(FLAG_LAUNCH_PLATFORM_START * TILE + 2,
      Math.min((FLAG_LAUNCH_PLATFORM_END + 1) * TILE - doc.w - 2, marty.x - doc.w - 4));
    flagJumpStart.docPlatformY = STAIR_TOP_ROW * TILE - doc.h;
    gameState = 'flagDocWait';
    flagpoleTimer = 0;
  }
}

function updateFlagDocWait(dt) {
  flagpoleTimer += dt;
  const progress = Math.min(1, flagpoleTimer / SLIDE_DURATION);
  marty.y = lerp(flagGrabY, RUN_Y, easeInOut(progress));
  doc.x = flagJumpStart.docX; doc.y = RUN_Y;
  doc.onGround = true; doc.state = 'waiting'; doc.facingRight = true;
  if (progress >= 1) {
    marty.y = RUN_Y; marty.onGround = true;
    gameState = 'flagDocJump';
    flagpoleTimer = 0;
  }
}

function updateFlagDocJump(dt) {
  if (flagpoleTimer === 0) SFX.jump();
  flagpoleTimer += dt;
  const t = Math.min(1, flagpoleTimer / FLAG_DOC_PLATFORM_DURATION);
  const eased = easeInOut(t);
  doc.state = 'running'; doc.onGround = false; doc.facingRight = true;
  doc.x = lerp(flagJumpStart.docX, flagJumpStart.docPlatformX, eased);
  doc.y = lerp(RUN_Y, flagJumpStart.docPlatformY, eased) - Math.sin(Math.PI * t) * 76;
  if (t >= 1) {
    doc.x = flagJumpStart.docPlatformX; doc.y = flagJumpStart.docPlatformY;
    doc.onGround = true; doc.state = 'waiting';
    gameState = 'flagDocHold';
    flagpoleTimer = 0;
  }
}

function updateFlagDocHold(dt) {
  flagpoleTimer += dt;
  doc.x = flagJumpStart.docPlatformX; doc.y = flagJumpStart.docPlatformY;
  doc.onGround = true; doc.state = 'waiting';
  if (flagpoleTimer >= FLAG_DOC_PLATFORM_HOLD) {
    gameState = 'flagpole';
    flagpoleTimer = 0;
    SFX.jump();
  }
}

function updateFlagpole(dt) {
  flagpoleTimer += dt;
  const t = Math.min(1, flagpoleTimer / FLAG_DOC_POLE_DURATION);
  const eased = easeInOut(t);
  const poleX = FLAGPOLE_COL * TILE + 7;
  doc.state = 'running'; doc.onGround = false; doc.facingRight = true;
  doc.x = lerp(flagJumpStart.docPlatformX, poleX, eased);
  doc.y = lerp(flagJumpStart.docPlatformY, flagGrabY, eased) - Math.sin(Math.PI * t) * 70;
  if (t >= 1) {
    doc.x = poleX; doc.y = flagGrabY;
    gameState = 'flagSlide';
    flagpoleTimer = 0;
    SFX.flagpole();
  }
}

function updateFlagSlide(dt) {
  flagpoleTimer += dt;
  const t = Math.min(1, flagpoleTimer / SLIDE_DURATION);
  if (!flagRunSfxPlayed && flagpoleTimer >= Math.max(0, SLIDE_DURATION - 1)) {
    flagRunSfxPlayed = true;
    playMartyFlagRunSfx();
  }
  doc.x = FLAGPOLE_COL * TILE + 7;
  doc.y = lerp(flagGrabY, RUN_Y, easeInOut(t));
  doc.onGround = t >= 1;
  if (t >= 1) {
    marty.state = 'running'; doc.state = 'running';
    marty.onGround = true; doc.onGround = true;
    marty.facingRight = true; doc.facingRight = true;
    marty.velX = RUN_SPEED; doc.velX = RUN_SPEED;
    gameState = 'toCar';
    score += 500;
    if (!flagVictoryPlayed) {
      flagVictoryPlayed = true;
      stopMartyBrosMusic();
      SFX.fanfare();
    }
    updateHud();
  }
}

// --- pipe transitions: Mario-style hop, settle, sink/rise, and landing ---
const PIPE_HOP_DURATION = 0.5;
const PIPE_SINK_DURATION = 0.58;
const PIPE_RISE_DURATION = 0.62;
const PIPE_LAND_DURATION = 0.46;
const PIPE_TOP_Y = (GROUND_ROW - 2) * TILE; // the pipe's cap surface, 2 tiles tall
function pipeStandX(entity, pipeCol) { return (pipeCol + 1) * TILE - entity.w / 2; }
const PIPE_DUCK_STATES = new Set(['pipeInMarty', 'pipeInDoc', 'pipeOutMarty', 'pipeOutDoc']);
let pipeTimer = 0;
let pipePhase = 'hop';
let pipeMotion = null;
let martyDuckScale = 1;
let docDuckScale = 1;

function beginPipeEntry(entity, pipeCol) {
  pipePhase = 'hop';
  pipeTimer = 0;
  playMartyPipeSfx();
  SFX.pipeEnter();
  pipeMotion = {
    startX: entity.x,
    startY: entity.y,
    targetX: pipeStandX(entity, pipeCol),
    capY: PIPE_TOP_Y - entity.h,
  };
  entity.onGround = false;
}

function updatePipeEntry(entity, dt, setScale, onComplete) {
  pipeTimer += dt;
  if (pipePhase === 'hop') {
    const t = Math.min(1, pipeTimer / PIPE_HOP_DURATION);
    const eased = easeInOut(t);
    entity.x = lerp(pipeMotion.startX, pipeMotion.targetX, eased);
    entity.y = lerp(pipeMotion.startY, pipeMotion.capY, eased) - Math.sin(Math.PI * t) * 42;
    setScale(1);
    if (t >= 1) { pipePhase = 'sink'; pipeTimer = 0; entity.x = pipeMotion.targetX; entity.y = pipeMotion.capY; }
    return;
  }

  const t = Math.min(1, pipeTimer / PIPE_SINK_DURATION);
  const eased = easeInOut(t);
  setScale(Math.max(0.16, 1 - eased * 0.84));
  entity.y = pipeMotion.capY + eased * (entity.h + 28);
  if (t >= 1) onComplete();
}

function updatePipeInMarty(dt) {
  const queueX = pipeStandX(doc, ENTRANCE_PIPE_COL) - 42;
  if (doc.x < queueX) {
    doc.x = Math.min(queueX, doc.x + RUN_SPEED * dt);
    doc.y = RUN_Y;
    doc.onGround = true;
  }
  updatePipeEntry(marty, dt, (scale) => { martyDuckScale = scale; }, () => {
    marty.state = 'gone';
    gameState = 'pipeInDoc';
    docDuckScale = 1;
    beginPipeEntry(doc, ENTRANCE_PIPE_COL);
  });
}

function updatePipeInDoc(dt) {
  updatePipeEntry(doc, dt, (scale) => { docDuckScale = scale; }, () => {
    doc.state = 'gone';
    gameState = 'underwater';
    setupUnderwater();
  });
}

function setupUnderwater() {
  uwCoinsLeft = UW_COINS.map((c) => ({ ...c, taken: false }));
  uwEnemies = UW_ENEMY_SPAWNS.map((e) => ({ ...e, alive: true, deadTimer: 0, x: e.col * TILE, y: e.row * TILE, facingRight: true }));
  fireballs = [];
  fireCooldown.marty = 0; fireCooldown.doc = 0;
  // start right at the entry pipe's mouth, so they visibly swim out of it
  uwMarty.x = UW_ENTRY_X; uwMarty.y = UW_PIPE_MOUTH_Y;
  uwDoc.x = UW_ENTRY_X - 40; uwDoc.y = UW_PIPE_MOUTH_Y;
  uwCameraX = 0;
  uwTime = 0;
  uwBubbles = [];
  martyDuckScale = 1;
  docDuckScale = 1;
  marty.state = 'running';
  doc.state = 'running';
}

const uwMarty = { x: 0, y: 0 };
const uwDoc = { x: 0, y: 0 };
let uwCameraX = 0;
let uwBubbles = [];
const UW_SPEED = 150;

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

// squashes a swimmer down small right at a pipe's mouth and eases back to full size
// once clear of it — the same duck-in/duck-out squeeze used on land, played underwater
const UW_SQUASH_MIN = 0.35;
function uwSquashScale(x) {
  const intro = clamp01((x - UW_ENTRY_X) / UW_PIPE_SETTLE_DIST);
  const outro = clamp01((x - (UW_EXIT_X - UW_PIPE_SETTLE_DIST)) / UW_PIPE_SETTLE_DIST);
  const entrySquash = UW_SQUASH_MIN + (1 - UW_SQUASH_MIN) * intro;
  const exitSquash = 1 - (1 - UW_SQUASH_MIN) * outro;
  return Math.min(entrySquash, exitSquash);
}

// the swim path's target depth at a given x: the open-water sine wave, blended
// into the entry/exit pipes' mouths, and clamped above any pillar it nears
function uwTargetY(x) {
  let y = (UW_FLOOR_ROW - 3) * TILE + Math.sin(x / 50) * 26;

  const intro = clamp01((x - UW_ENTRY_X) / UW_PIPE_SETTLE_DIST);
  y = UW_PIPE_MOUTH_Y + (y - UW_PIPE_MOUTH_Y) * intro;

  const outro = clamp01((x - (UW_EXIT_X - UW_PIPE_SETTLE_DIST)) / UW_PIPE_SETTLE_DIST);
  y = y + (UW_PIPE_MOUTH_Y - y) * outro;

  // Guide the swim line through every coin so the automatic run does not
  // leave the alternating high/low underwater rows behind.
  for (const c of UW_COINS) {
    if (uwCoinsLeft.find((coin) => coin.col === c.col && coin.row === c.row)?.taken) continue;
    const coinX = c.col * TILE + TILE / 2;
    const dx = Math.abs(x - coinX);
    if (dx < 86) {
      const pull = 1 - dx / 86;
      y += (c.row * TILE + TILE / 2 - y) * pull * 0.85;
    }
  }

  for (const p of UW_PILLARS) {
    const left = p.col * TILE, right = (p.col + 1) * TILE;
    if (x + UW_PILLAR_LOOKAHEAD > left && x < right + 10) {
      const clearY = UW_FLOOR_ROW * TILE - p.height * TILE - UW_PILLAR_CLEARANCE;
      if (y > clearY) y = clearY;
    }
  }
  return y;
}

function collectUwCoin(c) {
  if (c.taken) return;
  c.taken = true;
  coins += 1;
  score += 200;
  SFX.coin();
  updateHud();
}

function uwTouchesCoin(swimmer, cx, cy) {
  // uwMarty/uwDoc coordinates are sprite centres. Match the forgiving pickup
  // radius used by the land coins so contact with any part of the character
  // reliably collects the underwater coin.
  return Math.abs(swimmer.x - cx) <= 24 && Math.abs(swimmer.y - cy) <= 28;
}

function updateUnderwater(dt) {
  uwTime += dt;
  uwMarty.x += UW_SPEED * dt;
  uwDoc.x = uwMarty.x - 40;
  const followRate = Math.min(1, dt * 6);
  uwMarty.y += (uwTargetY(uwMarty.x) - uwMarty.y) * followRate;
  uwDoc.y += (uwTargetY(uwDoc.x) - uwDoc.y) * followRate;

  for (const c of uwCoinsLeft) {
    if (c.taken) continue;
    const cx = c.col * TILE + TILE / 2, cy = c.row * TILE + TILE / 2;
    if (uwTouchesCoin(uwMarty, cx, cy) || uwTouchesCoin(uwDoc, cx, cy)) collectUwCoin(c);
  }

  for (const e of uwEnemies) {
    if (!e.alive) { e.deadTimer -= dt; continue; }
    const drift = Math.sin(uwTime * (e.speed / 40) + e.col) * e.range;
    e.x = (e.col + drift) * TILE;
    e.y = e.row * TILE + Math.sin(uwTime * 0.8 + e.col * 2) * 6;
    e.facingRight = Math.cos(uwTime * (e.speed / 40) + e.col) >= 0;
  }
  updateFireballs(dt);
  tryThrowFireball(uwMarty, 'marty');
  tryThrowFireball(uwDoc, 'doc');

  if (Math.random() < 0.3) uwBubbles.push({ x: uwMarty.x + (Math.random() - 0.5) * 20, y: uwMarty.y + 10, r: 2 + Math.random() * 3, timer: 1.2 });
  for (const b of uwBubbles) { b.timer -= dt; b.y -= 24 * dt; }
  uwBubbles = uwBubbles.filter((b) => b.timer > 0);

  const uwTargetCamera = Math.max(0, Math.min(uwMarty.x - VIEW_W / 3, UW_COLS * TILE - VIEW_W));
  uwCameraX += (uwTargetCamera - uwCameraX) * Math.min(1, dt * 8);

  if (uwMarty.x >= UW_EXIT_X) {
    // exiting is entry played in reverse: Doc went in last, so he climbs out first
    gameState = 'pipeOutDoc';
    docDuckScale = 0.1;
    doc.state = 'running';
    beginPipeExit(doc, EXIT_PIPE_COL, (EXIT_PIPE_COL + 2) * TILE + 8);
    marty.state = 'gone'; // Marty is still "underwater" until it's his turn to climb out
  }
}

// --- fireballs: Marty & Doc's underwater weapon against pez1/pez2/fantasma ---
const FIREBALL_SPEED = 260;
const FIREBALL_RANGE = 260;
const FIREBALL_COOLDOWN = 1.1;

function tryThrowFireball(swimmer, who) {
  if (fireCooldown[who] > 0) return;
  let target = null, bestDist = Infinity;
  for (const e of uwEnemies) {
    if (!e.alive) continue;
    const dx = e.x - swimmer.x;
    if (dx > 20 && dx < FIREBALL_RANGE && Math.abs(e.y - swimmer.y) < 90 && dx < bestDist) { target = e; bestDist = dx; }
  }
  if (!target) return;
  const dist = Math.max(1, Math.hypot(target.x - swimmer.x, target.y - swimmer.y));
  const travelT = dist / FIREBALL_SPEED;
  fireballs.push({
    x: swimmer.x, y: swimmer.y,
    vx: (target.x - swimmer.x) / travelT,
    vy: (target.y - swimmer.y) / travelT,
    timer: 1.2,
  });
  playMartyFireballSfx();
  SFX.fireball();
  fireCooldown[who] = FIREBALL_COOLDOWN;
}

function updateFireballs(dt) {
  fireCooldown.marty = Math.max(0, fireCooldown.marty - dt);
  fireCooldown.doc = Math.max(0, fireCooldown.doc - dt);

  for (const f of fireballs) { f.x += f.vx * dt; f.y += f.vy * dt; f.timer -= dt; }
  for (const f of fireballs) {
    if (f.timer <= 0) continue;
    for (const e of uwEnemies) {
      if (!e.alive) continue;
      if (Math.hypot(f.x - e.x, f.y - e.y) < 20) {
        e.alive = false; e.deadTimer = 0.4;
        score += 150; SFX.stomp(); updateHud();
        f.timer = 0;
      }
    }
  }
  fireballs = fireballs.filter((f) => f.timer > 0);
}

function beginPipeExit(entity, pipeCol, landingX) {
  pipePhase = 'rise';
  pipeTimer = 0;
  playMartyPipeSfx();
  SFX.pipeExit();
  pipeMotion = {
    startX: pipeStandX(entity, pipeCol),
    hiddenY: PIPE_TOP_Y - entity.h + entity.h + 28,
    capY: PIPE_TOP_Y - entity.h,
    landingX,
  };
  entity.x = pipeMotion.startX;
  entity.y = pipeMotion.hiddenY;
  entity.onGround = false;
}

function updatePipeExit(entity, dt, setScale, onComplete) {
  pipeTimer += dt;
  if (pipePhase === 'rise') {
    const t = Math.min(1, pipeTimer / PIPE_RISE_DURATION);
    const eased = easeInOut(t);
    setScale(0.16 + eased * 0.84);
    entity.y = lerp(pipeMotion.hiddenY, pipeMotion.capY, eased);
    if (t >= 1) {
      pipePhase = 'land';
      pipeTimer = 0;
      entity.y = pipeMotion.capY;
      setScale(1);
    }
    return;
  }

  const t = Math.min(1, pipeTimer / PIPE_LAND_DURATION);
  const eased = easeInOut(t);
  entity.x = lerp(pipeMotion.startX, pipeMotion.landingX, eased);
  entity.y = lerp(pipeMotion.capY, RUN_Y, eased) - Math.sin(Math.PI * t) * 30;
  setScale(1);
  if (t >= 1) {
    entity.x = pipeMotion.landingX;
    entity.y = RUN_Y;
    entity.onGround = true;
    onComplete();
  }
}

function updatePipeOutDoc(dt) {
  updatePipeExit(doc, dt, (scale) => { docDuckScale = scale; }, () => {
    docDuckScale = 1;
    gameState = 'pipeOutMarty';
    marty.state = 'running';
    martyDuckScale = 0.16;
    beginPipeExit(marty, EXIT_PIPE_COL, doc.x + 34);
  });
}

function updatePipeOutMarty(dt) {
  updatePipeExit(marty, dt, (scale) => { martyDuckScale = scale; }, () => {
    martyDuckScale = 1;
    doc.y = RUN_Y; doc.onGround = true;
    marty.onGround = true; marty.velY = 0;
    martyTrail = [];
    gameState = 'playing';
  });
}

// smoothly eases the camera toward its target instead of snapping, for a more fluid feel
function followCamera(targetX, dt) {
  const clamped = Math.max(0, Math.min(targetX, LEVEL_WIDTH_PX - VIEW_W));
  cameraX += (clamped - cameraX) * Math.min(1, dt * 8);
}

function updateToCar(dt) {
  marty.facingRight = true;
  doc.facingRight = true;
  marty.velX = RUN_SPEED;
  marty.x += marty.velX * dt;
  doc.x += marty.velX * dt;
  followCamera(marty.x - VIEW_W / 3, dt);
  if (marty.x + marty.w >= carX - 46) {
    gameState = 'arriving';
    marty.state = 'arriving'; doc.state = 'arriving';
  }
}

// --- goal cutscene: reach the DeLorean, both hop in, doors clunk shut, take off ---
const CAR_DOOR_X_OFFSET = 118; // lines up with where the gull-wing door actually sits in the art
const ENTER_DURATION = 0.7;
const CLOSE_DOORS_DURATION = 0.45;
const DEPART_DURATION = 1.9;
const FLASH_DURATION = 0.5;
const CLEAR_DURATION = 6;

let enterTimer = 0;
let closeDoorsTimer = 0;
let carShake = 0; // a brief settling bounce on the car as the doors clunk shut
let carTurnProgress = 0; // 0 = facing left as photographed, 1 = turned to face right for takeoff
let carLaunchAngle = 0; // nose tilts up as it accelerates away
let departTimer = 0;
let clearTimer = 0;
let crewScale = 1; // shrinks Marty AND Doc together as they climb into the DeLorean
let fireTrail = [];

function updateCutscene(dt) {
  if (gameState === 'arriving') {
    marty.velX = RUN_SPEED;
    marty.x += marty.velX * dt;
    doc.x += marty.velX * dt;
    marty.velY = Math.min(MAX_FALL, marty.velY + GRAVITY * dt);
    const nextY = marty.y + marty.velY * dt;
    const groundY = groundTopAt(marty.x + marty.w / 2) - marty.h;
    if (nextY >= groundY) { marty.y = groundY; marty.velY = 0; marty.onGround = true; } else marty.y = nextY;
    doc.y = marty.y;
    const doorX = carX + CAR_DOOR_X_OFFSET;
    if (marty.x + marty.w / 2 >= doorX) { gameState = 'entering'; enterTimer = ENTER_DURATION; crewScale = 1; }
  } else if (gameState === 'entering') {
    enterTimer -= dt;
    crewScale = Math.max(0, enterTimer / ENTER_DURATION);
    if (enterTimer <= 0) {
      marty.state = 'gone'; doc.state = 'gone';
      gameState = 'closingDoors'; closeDoorsTimer = CLOSE_DOORS_DURATION; carShake = 1;
      SFX.doorClose();
    }
  } else if (gameState === 'closingDoors') {
    closeDoorsTimer -= dt;
    carShake = Math.max(0, closeDoorsTimer / CLOSE_DOORS_DURATION);
    // it turns to face the direction it's about to launch in, right after the doors shut
    carTurnProgress = Math.min(1, 1 - closeDoorsTimer / CLOSE_DOORS_DURATION);
    if (closeDoorsTimer <= 0) {
      carShake = 0;
      carTurnProgress = 1;
      gameState = 'departing'; departTimer = DEPART_DURATION; carDriveVelX = 0; SFX.timeJump();
    }
  } else if (gameState === 'departing') {
    departTimer -= dt;
    carDriveVelX = Math.min(2600, carDriveVelX + 2600 * dt);
    carLaunchAngle = Math.min(0.35, (carDriveVelX / 2600) * 0.35); // nose tilts up as it accelerates off
    carX += carDriveVelX * dt;
    if (Math.random() < 0.6) fireTrail.push({ x: carX, y: GROUND_ROW * TILE - 4, timer: 0.35 });
    if (departTimer <= DEPART_DURATION - FLASH_DURATION) flashAlpha = Math.min(1, flashAlpha + dt / (FLASH_DURATION * 0.4));
    if (departTimer <= 0) {
      stopMartyBrosMusic();
      gameState = 'clear'; clearTimer = CLEAR_DURATION;
      document.getElementById('finalScore').textContent = score;
      clearOverlay.classList.remove('hidden');
    }
  } else if (gameState === 'clear') {
    clearTimer -= dt;
    flashAlpha = Math.max(0, flashAlpha - dt * 0.7);
    if (clearTimer <= 0) restartLevel();
  }
  for (const f of fireTrail) f.timer -= dt;
  fireTrail = fireTrail.filter((f) => f.timer > 0);
}

function restartLevel() {
  level = buildLevel();
  marty = makeMarty();
  doc = makeDoc();
  martyTrail = [];
  enemies = ENEMY_SPAWNS.map(makeEnemy);
  coinPops = [];
  fireTrail = [];
  score = 0; coins = 0; timeLeft = 400;
  carX = GOAL_COL * TILE; carDriveVelX = 0;
  flashAlpha = 0; cameraX = 0; crewScale = 1; martyDuckScale = 1; docDuckScale = 1;
  pipeTimer = 0; pipePhase = 'hop'; pipeMotion = null;
  flagpoleTimer = 0; flagJumpStart = null;
  flagVictoryPlayed = false;
  martySlideProgress = 0;
  carShake = 0; carTurnProgress = 0; carLaunchAngle = 0;
  hasEnteredPipe = false;
  gameState = 'playing';
  stopMartyBrosMusic();
  startMartyBrosMusic();
  clearOverlay.classList.add('hidden');
  updateHud();
}

// --- rendering: layered, pixel-art overworld background ---
function drawBackground() {
  // Reference sky color supplied for the game: keep the sky and the openings
  // in the floor on exactly the same blue so the gaps read as transparent.
  ctx.fillStyle = '#6097FE';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  for (const h of HILLS) {
    const x = h.x - cameraX * 0.32;
    if (x < -180 || x > VIEW_W + 180) continue;
    drawPixelHill(x, GROUND_ROW * TILE, h.size);
  }
  for (const b of BUSHES) {
    const x = b.x - cameraX * 0.72;
    if (x < -100 || x > VIEW_W + 100) continue;
    drawPixelBush(x, GROUND_ROW * TILE + 2, b.size);
  }
  for (const [i, c] of CLOUDS.entries()) {
    const x = c.x - cameraX * 0.46;
    if (x < -80 || x > VIEW_W + 80) continue;
    drawCloud(x, c.y + Math.sin(worldTime * 0.7 + c.x) * 2, i);
  }
}

function drawPixelHill(x, baseY, scale) {
  const w = 170 * scale, h = 92 * scale;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(baseY));
  ctx.fillStyle = '#43a83f';
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0); ctx.lineTo(-w * 0.28, -h * 0.62);
  ctx.lineTo(0, -h); ctx.lineTo(w * 0.28, -h * 0.62); ctx.lineTo(w / 2, 0);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#72d15d';
  ctx.fillRect(-w * 0.08, -h * 0.72, w * 0.12, h * 0.16);
  ctx.fillRect(w * 0.15, -h * 0.42, w * 0.1, h * 0.14);
  ctx.fillStyle = '#247c37';
  ctx.fillRect(-w * 0.24, -h * 0.34, w * 0.09, h * 0.12);
  ctx.restore();
}

function drawPixelBush(x, baseY, scale) {
  const unit = 22 * scale;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(baseY));
  ctx.fillStyle = '#1c8f38';
  ctx.fillRect(-unit * 1.7, -unit, unit * 3.4, unit);
  ctx.fillStyle = '#35bb46';
  ctx.fillRect(-unit * 1.35, -unit * 1.45, unit, unit * 1.45);
  ctx.fillRect(-unit * 0.45, -unit * 1.9, unit * 1.1, unit * 1.9);
  ctx.fillRect(unit * 0.55, -unit * 1.3, unit * 0.9, unit * 1.3);
  ctx.fillStyle = '#79df61';
  ctx.fillRect(-unit * 0.15, -unit * 1.65, unit * 0.28, unit * 0.25);
  ctx.restore();
}

function drawCloud(x, y, variant = 0) {
  const img = SPRITES.cloud;
  if (!ready(img)) return;
  // The supplied Delorean cloud sheet contains six separate pixel clouds.
  const sources = [
    [35, 78, 640, 410], [755, 150, 445, 350], [1250, 225, 255, 205],
    [28, 575, 470, 330], [550, 645, 310, 265], [895, 550, 615, 410],
  ];
  const [sx, sy, sw, sh] = sources[variant % sources.length];
  const widths = [132, 108, 76, 98, 84, 138];
  const w = widths[variant % widths.length];
  const h = w * (sh / sw);
  ctx.save();
  // A soft blue-grey underside gives the pixel cloud a little volume without
  // losing the crisp silhouette of the original sprite.
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#4d78ad';
  ctx.fillRect(x - w * 0.38, y + h * 0.12, w * 0.76, h * 0.18);
  ctx.globalAlpha = 0.92;
  ctx.drawImage(img, sx, sy, sw, sh, x - w / 2, y - h / 2, w, h);
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - w * 0.25, y - h * 0.2, w * 0.22, h * 0.08);
  ctx.restore();
}

function drawGapVisual(startCol, endCol) {
  const x = startCol * TILE - cameraX;
  const w = (endCol - startCol + 1) * TILE;
  const y = GROUND_ROW * TILE;
  if (x > VIEW_W || x + w < 0) return;

  // Gaps are open to the sky: use the same bright blue family as the
  // background so they read as transparent openings rather than black pits.
  ctx.fillStyle = '#6097FE';
  ctx.fillRect(x, y, w, VIEW_H - y);
}

function drawTiles() {
  const firstCol = Math.max(0, Math.floor(cameraX / TILE) - 1);
  const lastCol = Math.min(LEVEL_COLS - 1, Math.ceil((cameraX + VIEW_W) / TILE) + 1);
  for (let c = firstCol; c <= lastCol; c++) {
    for (let r = 0; r < LEVEL_ROWS; r++) {
      const ch = level[r][c];
      if (ch === '.' || ch === 'p' || ch === 'S') continue;
      const x = c * TILE - cameraX, y = r * TILE;
      if (ch === 'G') drawGroundTile(x, y);
      else if (ch === 'B') drawBrickTile(x, y);
      else if (ch === 'Q') drawQuestionTile(x, y);
      else if (ch === 'q') drawUsedTile(x, y);
    }
  }

  for (const p of ALL_PIPES) drawPipeStructure(p.col * TILE - cameraX, p.height);
  for (const [start, end] of GAPS) drawGapVisual(start, end);
  drawStaircaseArt();

  const fx = FLAGPOLE_COL * TILE - cameraX;
  if (fx > -60 && fx < VIEW_W + 60) drawFlagpole(fx);
}

function drawGroundTile(x, y) {
  const img = SPRITES.brick;
  if (ready(img)) {
    ctx.drawImage(img, x, y, TILE, TILE);
    ctx.fillStyle = 'rgba(255,226,119,.16)'; ctx.fillRect(x, y, TILE, 2);
    ctx.fillStyle = 'rgba(74,24,4,.2)'; ctx.fillRect(x, y + TILE - 3, TILE, 3);
  }
  else { ctx.fillStyle = '#c84c0c'; ctx.fillRect(x, y, TILE, TILE); }
}

function drawBrickTile(x, y) { drawGroundTile(x, y); }

function drawQuestionTile(x, y) {
  const img = SPRITES.question;
  if (ready(img)) {
    const pulse = 1 + Math.sin(worldTime * 5 + x * 0.05) * 0.035;
    ctx.save();
    ctx.translate(x + TILE / 2, y + TILE / 2);
    ctx.scale(pulse, pulse);
    ctx.drawImage(img, -TILE / 2, -TILE / 2, TILE, TILE);
    ctx.restore();
  }
  else { ctx.fillStyle = '#fcb45c'; ctx.fillRect(x, y, TILE, TILE); }
}

function drawUsedTile(x, y) {
  const img = SPRITES.brick;
  if (ready(img)) {
    ctx.save();
    ctx.drawImage(img, x, y, TILE, TILE);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(x, y, TILE, TILE);
    ctx.restore();
  } else { ctx.fillStyle = '#8a6a4a'; ctx.fillRect(x, y, TILE, TILE); }
}

// draws one full pipe (cap + repeated body) spanning `heightTiles`, 2 tiles wide
const PIPE_CAP_ELONGATION = 1.5; // stretches the cap art a bit taller, like a proper pipe rim

function drawPipeStructure(x, heightTiles, floorRow = GROUND_ROW) {
  if (x < -TILE * 2 || x > VIEW_W + TILE * 2) return;
  const w = TILE * 2;
  const topY = floorRow * TILE - heightTiles * TILE;
  const cap = SPRITES.pipeCap, body = SPRITES.pipeBody;
  if (!ready(cap) || !ready(body)) {
    ctx.fillStyle = '#3fd13f';
    ctx.fillRect(x, topY, w, heightTiles * TILE);
    return;
  }
  const capH = w * (cap.naturalHeight / cap.naturalWidth) * PIPE_CAP_ELONGATION;
  ctx.drawImage(cap, x, topY, w, capH);
  const bodyTop = topY + capH;
  const bodyH = heightTiles * TILE - capH + TILE * 0.5;
  ctx.drawImage(body, 0, 0, body.naturalWidth, body.naturalHeight, x, bodyTop, w, bodyH);
  const shine = ctx.createLinearGradient(x, 0, x + w, 0);
  shine.addColorStop(0, 'rgba(255,255,255,.08)');
  shine.addColorStop(0.28, 'rgba(255,255,255,.32)');
  shine.addColorStop(0.42, 'rgba(255,255,255,0)');
  shine.addColorStop(1, 'rgba(0,45,0,.18)');
  ctx.fillStyle = shine;
  ctx.fillRect(x + 4, topY + 5, w - 8, heightTiles * TILE - 5);
}

function drawPipeCapOverlay(x, heightTiles = 2, floorRow = GROUND_ROW) {
  const w = TILE * 2;
  const topY = floorRow * TILE - heightTiles * TILE;
  const cap = SPRITES.pipeCap;
  if (!ready(cap)) {
    ctx.fillStyle = '#42c936';
    ctx.fillRect(x, topY, w, TILE * 0.55);
    return;
  }
  const capH = w * (cap.naturalHeight / cap.naturalWidth) * PIPE_CAP_ELONGATION;
  ctx.drawImage(cap, x, topY, w, capH);
}

// the whole staircase + bush scene, drawn once as a single faithful image
function drawStaircaseArt() {
  const img = SPRITES.staircase;
  if (!ready(img)) return;
  const leftCol = STAIR_UP_START - 1;
  const rightCol = STAIR_DOWN_START + 5;
  const worldLeft = leftCol * TILE - cameraX;
  const worldRight = rightCol * TILE - cameraX;
  if (worldRight < -40 || worldLeft > VIEW_W + 40) return;
  const w = worldRight - worldLeft;
  const h = w * (img.naturalHeight / img.naturalWidth);
  const bottom = (GROUND_ROW + 2) * TILE;
  ctx.drawImage(img, worldLeft, bottom - h, w, h);
}

function drawFlagpole(x) {
  const baseY = GROUND_ROW * TILE;
  const img = SPRITES.flagpole;
  if (!ready(img)) return;
  const h = TILE * 9.5;
  const w = h * (img.naturalWidth / img.naturalHeight);
  ctx.drawImage(img, x + TILE * 0.4 - w / 2, baseY - h, w, h);
  const sparkle = 3 + Math.sin(worldTime * 7) * 1.5;
  ctx.fillStyle = 'rgba(255,244,150,.9)';
  ctx.fillRect(x + 10 - sparkle, baseY - h + 6, sparkle * 2, 2);
  ctx.fillRect(x + 9, baseY - h + 7 - sparkle, 2, sparkle * 2);
}

function drawCoinPops() {
  for (const p of coinPops) {
    const progress = 1 - p.timer / 0.5;
    const y = p.y - progress * 30;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - progress);
    ctx.fillStyle = '#fbd000';
    ctx.beginPath(); ctx.ellipse(p.x - cameraX, y, 6, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawCharacterShadow(entity) {
  if (entity.state === 'gone' || gameState === 'underwater') return;
  const col = Math.floor((entity.x + entity.w / 2) / TILE);
  let groundY = GROUND_ROW * TILE;
  const startRow = Math.max(0, Math.floor((entity.y + entity.h) / TILE));
  for (let row = startRow; row < LEVEL_ROWS; row++) {
    if (isSolidTile(tileAt(col, row))) { groundY = row * TILE; break; }
  }
  const height = Math.max(0, groundY - (entity.y + entity.h));
  const scale = Math.max(0.35, 1 - height / 180);
  ctx.save();
  ctx.globalAlpha = 0.2 * scale;
  ctx.fillStyle = '#102030';
  ctx.beginPath();
  ctx.ellipse(entity.x - cameraX + entity.w / 2, groundY - 2, 14 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// --- characters: drawn from the real Marty/Doc pixel-art sprites ---
function drawCharacterSprite(entity, img, duckScale) {
  if (entity.state === 'gone') return;
  const cx = entity.x - cameraX + entity.w / 2;
  const groundY = entity.y + entity.h;
  const running = entity.onGround && entity.state === 'running';
  const bob = running ? Math.abs(Math.sin(entity.animTimer * 9)) * -3 : 0;
  const dir = entity.facingRight ? 1 : -1;
  const enteringCar = duckScale === undefined && gameState === 'entering';
  // ducking into a pipe: squash vertically, sinking down. Getting into the
  // DeLorean: shrink evenly on both axes, like zooming out, until they vanish.
  const scaleY = duckScale !== undefined ? duckScale : (enteringCar ? crewScale : 1);
  const scaleX = enteringCar ? crewScale : 1;

  ctx.save();
  ctx.translate(cx, groundY + bob);
  ctx.scale(dir * scaleX, 1);
  ctx.scale(1, scaleY);
  if (ready(img)) {
    const h = TILE * 2, w = h * (img.naturalWidth / img.naturalHeight);
    ctx.drawImage(img, -w / 2, -h, w, h);
  } else {
    ctx.fillStyle = '#888'; ctx.fillRect(-11, -60, 22, 60);
  }
  ctx.restore();
}

const MARTY_DUCK_STATES = new Set(['pipeInMarty', 'pipeOutMarty']);
const DOC_DUCK_STATES = new Set(['pipeInDoc', 'pipeOutDoc']);
function drawMarty() { drawCharacterSprite(marty, SPRITES.marty, MARTY_DUCK_STATES.has(gameState) ? martyDuckScale : undefined); }
function drawDocRunning() { drawCharacterSprite(doc, SPRITES.doc, DOC_DUCK_STATES.has(gameState) ? docDuckScale : undefined); }

function drawLandEnemy(e) {
  if (!e.alive && e.deadTimer <= 0) return;
  const x = e.x - cameraX + e.w / 2;
  const squashed = !e.alive;
  const y = e.y + e.h;
  const img = SPRITES.toad;
  if (!ready(img)) return;
  ctx.save();
  ctx.translate(x, y);
  if (squashed) ctx.scale(1.15, 0.35);
  const w = e.w * 1.15, h = w * (img.naturalHeight / img.naturalWidth);
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.restore();
}

function drawFireTrail() {
  for (const f of fireTrail) {
    const a = f.timer / 0.35;
    ctx.save();
    ctx.globalAlpha = a * 0.7;
    ctx.fillStyle = a > 0.5 ? '#ffdd55' : '#ff6a1a';
    ctx.beginPath();
    ctx.ellipse(f.x - cameraX - 20 - Math.random() * 10, f.y, 10 * a + 4, 6 * a + 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawDelorean() {
  const x = carX - cameraX;
  if (x < -300 || x > VIEW_W + 300) return;
  const groundY = GROUND_ROW * TILE;
  const w = 260, h = w * 0.46;
  // a brief settling bounce as the doors clunk shut, since there's no separate closed-door art
  const shakeY = carShake > 0 ? Math.sin(carShake * Math.PI * 3) * carShake * 4 : 0;
  const cx = x - w * 0.15 + w / 2, cy = groundY - h + shakeY + h / 2;
  // it spins on the spot to face right (a flat side-view stand-in for turning in 3D),
  // then tilts its nose up as it accelerates off, like it's being launched
  const turnScaleX = Math.cos(carTurnProgress * Math.PI);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-carLaunchAngle);
  ctx.scale(turnScaleX, 1);
  if (deloreanImg.complete && deloreanImg.naturalWidth) ctx.drawImage(deloreanImg, -w / 2, -h / 2, w, h);
  else { ctx.fillStyle = '#aab0b8'; ctx.fillRect(-w / 2, -h / 2, w, h); }
  ctx.restore();
}

function drawFlash() {
  if (flashAlpha <= 0) return;
  ctx.save(); ctx.globalAlpha = flashAlpha; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); ctx.restore();
}

function drawScreenFinish() {
  const vignette = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.2, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.7);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(8,12,32,.22)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

// --- underwater interlude rendering ---
function drawUnderworldTiles() {
  for (let c = 0; c < UW_COLS + 1; c++) {
    const x = c * TILE - uwCameraX;
    if (x < -TILE || x > VIEW_W + TILE) continue;
    drawGroundTile(x, UW_FLOOR_ROW * TILE);
    drawGroundTile(x, (UW_FLOOR_ROW + 1) * TILE);
  }
  drawUwPillars();
  drawUwCeilingPipe(1 * TILE - uwCameraX, 5);
  drawUwCeilingPipe((UW_COLS - 3) * TILE - uwCameraX, 5);
}

// pipes hanging down from the water's surface, mouth facing into the depths
function drawUwCeilingPipe(x, heightTiles) {
  if (x < -TILE * 2 || x > VIEW_W + TILE * 2) return;
  const w = TILE * 2;
  const cap = SPRITES.pipeCap, body = SPRITES.pipeBody;
  if (!ready(cap) || !ready(body)) { ctx.fillStyle = '#3fd13f'; ctx.fillRect(x, 0, w, heightTiles * TILE); return; }
  const capH = w * (cap.naturalHeight / cap.naturalWidth) * PIPE_CAP_ELONGATION;
  const bodyH = heightTiles * TILE - capH + TILE * 0.5;
  ctx.drawImage(body, 0, 0, body.naturalWidth, body.naturalHeight, x, 0, w, bodyH);
  ctx.save();
  ctx.translate(x, bodyH + capH);
  ctx.scale(1, -1);
  ctx.drawImage(cap, 0, 0, w, capH);
  ctx.restore();
}

// vertical coral-block pillars rising from the floor, like Mar 1 B's obstacles
function drawUwPillars() {
  const img = SPRITES.seaweed;
  if (!ready(img)) return;
  const segH = TILE, segW = TILE;
  for (const p of UW_PILLARS) {
    const x = p.col * TILE - uwCameraX;
    if (x < -segW || x > VIEW_W + segW) continue;
    for (let h = 0; h < p.height; h++) {
      ctx.drawImage(img, x, UW_FLOOR_ROW * TILE - (h + 1) * segH, segW, segH);
    }
  }
}

function drawUwCorals() {
  const img = SPRITES.coral;
  if (!ready(img)) return;
  for (const c of UW_CORALS) {
    const x = c.col * TILE - uwCameraX;
    if (x < -60 || x > VIEW_W + 60) continue;
    const h = TILE * 2.4, w = h * (img.naturalWidth / img.naturalHeight);
    ctx.drawImage(img, x, (UW_FLOOR_ROW) * TILE - h, w, h);
  }
}

function drawUwSeaweed() {
  const img = SPRITES.seaweed;
  if (!ready(img)) return;
  for (const s of UW_SEAWEED) {
    const x = s.col * TILE - uwCameraX;
    if (x < -40 || x > VIEW_W + 40) continue;
    const h = TILE * 1.1, w = h * (img.naturalWidth / img.naturalHeight);
    const sway = Math.sin(Date.now() / 500 + s.col) * 3;
    ctx.save();
    ctx.translate(x + w / 2, UW_FLOOR_ROW * TILE);
    ctx.rotate(sway * 0.01);
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }
}

function drawUwMines() {
  const img = SPRITES.mine;
  if (!ready(img)) return;
  for (const m of UW_MINES) {
    const x = m.col * TILE - uwCameraX;
    if (x < -40 || x > VIEW_W + 40) continue;
    const y = m.row * TILE + Math.sin(Date.now() / 700 + m.col) * 8;
    const w = TILE * 0.9, h = w * (img.naturalHeight / img.naturalWidth);
    ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
  }
}

function drawUwEnemies() {
  for (const e of uwEnemies) {
    if (!e.alive && e.deadTimer <= 0) continue;
    const img = SPRITES[e.type];
    if (!ready(img)) continue;
    const x = e.x - uwCameraX, y = e.y;
    if (x < -50 || x > VIEW_W + 50) continue;
    const squashed = !e.alive;
    const w = TILE * 1.1, h = w * (img.naturalHeight / img.naturalWidth);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(e.facingRight ? 1 : -1, squashed ? 0.3 : 1);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

function drawFireballs() {
  for (const f of fireballs) {
    const x = f.x - uwCameraX, y = f.y;
    ctx.save();
    ctx.fillStyle = '#ffb400';
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff4c2';
    ctx.beginPath(); ctx.arc(x - 1.5, y - 1.5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawUnderwaterScene() {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#1a6fd6'); grad.addColorStop(1, '#053a7a');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  drawUnderworldTiles();
  drawUwCorals();
  drawUwMines();
  drawUwSeaweed();
  drawUwEnemies();
  drawFireballs();

  for (const c of uwCoinsLeft) {
    if (c.taken) continue;
    const x = c.col * TILE + TILE / 2 - uwCameraX, y = c.row * TILE + TILE / 2;
    const bob = Math.sin(Date.now() / 200 + c.col) * 3;
    ctx.fillStyle = '#fbd000';
    ctx.beginPath(); ctx.ellipse(x, y + bob, 7, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a86b00'; ctx.lineWidth = 1.5; ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255,255,255,.55)';
  for (const b of uwBubbles) {
    ctx.globalAlpha = Math.max(0, b.timer / 1.2);
    ctx.beginPath(); ctx.arc(b.x - uwCameraX, b.y, b.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  const savedCamera = cameraX;
  cameraX = uwCameraX;
  const savedMartyX = marty.x, savedMartyY = marty.y, savedDocX = doc.x, savedDocY = doc.y;
  marty.x = uwMarty.x - marty.w / 2; marty.y = uwMarty.y - marty.h / 2;
  doc.x = uwDoc.x - doc.w / 2; doc.y = uwDoc.y - doc.h / 2;
  drawCharacterSprite(doc, SPRITES.doc, uwSquashScale(uwDoc.x));
  drawCharacterSprite(marty, SPRITES.marty, uwSquashScale(uwMarty.x));
  marty.x = savedMartyX; marty.y = savedMartyY; doc.x = savedDocX; doc.y = savedDocY;
  cameraX = savedCamera;
}

function render() {
  if (gameState === 'underwater') { drawUnderwaterScene(); drawFlash(); return; }

  drawBackground();
  drawTiles();
  drawCoinPops();
  enemies.forEach(drawLandEnemy);
  drawFireTrail();
  // draw it whenever it's in view so it's seen waiting on the ground well before
  // they arrive, instead of popping in only once the arrival cutscene starts
  if (gameState !== 'title') drawDelorean();
  drawCharacterShadow(doc); drawCharacterShadow(marty);
  drawDocRunning(); drawMarty();
  // Redraw only the rim on top of the character. Redrawing the complete pipe used
  // to hide the whole hop and made the transition look like a teleport.
  if (PIPE_DUCK_STATES.has(gameState)) {
    const duckPipeCol = (gameState === 'pipeInMarty' || gameState === 'pipeInDoc') ? ENTRANCE_PIPE_COL : EXIT_PIPE_COL;
    // Put the actual pipe art above the characters during the transition. The
    // body naturally masks them as they sink/rise, so they appear to vanish
    // into and emerge from the pipe instead of being painted over by a block.
    drawPipeStructure(duckPipeCol * TILE - cameraX, 2);
  }
  drawScreenFinish();
  drawFlash();
}

// --- main loop ---
let lastTime = performance.now();
let worldTime = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  worldTime += dt;

  try {
    if (gameState === 'playing') {
      timeAccum += dt;
      if (timeAccum >= 0.4) { timeAccum = 0; timeLeft = Math.max(0, timeLeft - 1); updateHud(); }
      updateMarty(dt);
      updateDoc(dt);
      updateEnemies(dt);
      updateCoinPops(dt);
      followCamera(marty.x - VIEW_W / 3, dt);
      checkPipeEntrance();
      checkGoalArrival();
    } else if (gameState === 'flagJump') {
      updateFlagJump(dt);
    } else if (gameState === 'flagDocWait') {
      updateFlagDocWait(dt);
    } else if (gameState === 'flagDocJump') {
      updateFlagDocJump(dt);
    } else if (gameState === 'flagDocHold') {
      updateFlagDocHold(dt);
    } else if (gameState === 'flagpole') {
      updateFlagpole(dt);
    } else if (gameState === 'flagSlide') {
      updateFlagSlide(dt);
    } else if (gameState === 'pipeInMarty') {
      updatePipeInMarty(dt);
    } else if (gameState === 'pipeInDoc') {
      updatePipeInDoc(dt);
    } else if (gameState === 'underwater') {
      updateUnderwater(dt);
    } else if (gameState === 'pipeOutMarty') {
      updatePipeOutMarty(dt);
    } else if (gameState === 'pipeOutDoc') {
      updatePipeOutDoc(dt);
    } else if (gameState === 'toCar') {
      updateToCar(dt);
      updateCoinPops(dt);
    } else {
      updateCutscene(dt);
      updateCoinPops(dt);
    }
  } catch (err) {
    console.error('SUPER MARTY BROS update error (recovered):', err);
  }

  render();
  requestAnimationFrame(loop);
}

updateHud();
requestAnimationFrame(loop);
