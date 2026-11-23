/* ===========================================================
   filmae — vintage booth
   Camera capture, film filters, strip generation, gallery
   =========================================================== */

// ---------- DOM refs ----------
const video         = document.getElementById('video');
const overlayCanvas = document.getElementById('overlayCanvas');
const countdownEl   = document.getElementById('countdown');
const shotCounter   = document.getElementById('shotCounter');
const flashEl       = document.getElementById('flash');
const shotThumbs    = document.getElementById('shotThumbs');
const presetsEl     = document.getElementById('presets');
const timerBtn      = document.getElementById('timerBtn');
const timerLabel    = document.getElementById('timerLabel');
const shutterBtn    = document.getElementById('shutterBtn');
const flipBtn       = document.getElementById('flipBtn');
const soundToggle   = document.getElementById('soundToggle');
const captionToggle = document.getElementById('captionToggle');
const captionInput  = document.getElementById('captionInput');

const cameraScreen     = document.getElementById('cameraScreen');
const processingScreen = document.getElementById('processingScreen');
const previewScreen    = document.getElementById('previewScreen');
const galleryScreen    = document.getElementById('galleryScreen');
const galleryBtn       = document.getElementById('galleryBtn');
const closeGallery     = document.getElementById('closeGallery');
const galleryGrid      = document.getElementById('galleryGrid');
const emptyMsg         = document.getElementById('emptyMsg');

const stripCanvas   = document.getElementById('stripCanvas');
const stripWrap     = document.getElementById('stripWrap');
const stickerLayer  = document.getElementById('stickerLayer');
const previewPresets= document.querySelector('.preview-presets');
const stickerTray   = document.querySelector('.sticker-tray');
const clearStickers = document.getElementById('clearStickers');

const retakeBtn     = document.getElementById('retakeBtn');
const saveBtn       = document.getElementById('saveBtn');
const downloadBtn   = document.getElementById('downloadBtn');
const shareBtn      = document.getElementById('shareBtn');
const toastEl       = document.getElementById('toast');
const shutterAudio  = document.getElementById('shutterAudio');

// ---------- state ----------
const state = {
  preset: 'warm',
  strip: 'cream',           // strip paper style key (see STRIPS)
  timer: 3,                 // 3, 5, 10
  shots: [],                // captured raw frames as ImageData (4 total)
  busy: false,
  stream: null,
  facingMode: 'user',
  stripBlob: null,
  stickers: [],             // {emoji, x, y} (px relative to strip)
};

const TIMER_OPTIONS = [3, 5, 10];

// ---------- utility: toast ----------
function toast(msg, dur = 2200) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove('show'), dur);
}

// ---------- screen transitions ----------
function showScreen(name) {
  [cameraScreen, processingScreen, previewScreen, galleryScreen].forEach(s => {
    s.classList.remove('active');
    s.setAttribute('aria-hidden', 'true');
  });
  const target = { camera: cameraScreen, processing: processingScreen,
                   preview: previewScreen, gallery: galleryScreen }[name];
  target.classList.add('active');
  target.setAttribute('aria-hidden', 'false');
}

// ===========================================================
//  CAMERA
// ===========================================================
async function startCamera() {
  try {
    if (state.stream) {
      state.stream.getTracks().forEach(t => t.stop());
    }
    const constraints = {
      audio: false,
      video: {
        facingMode: state.facingMode,
        width:  { ideal: 1280 },
        height: { ideal: 1280 },
      }
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    state.stream = stream;
    video.srcObject = stream;
    // mirror only for front-facing
    document.querySelector('.viewfinder')
      .classList.toggle('no-mirror', state.facingMode !== 'user');
    await video.play();
  } catch (err) {
    console.error('Camera error:', err);
    toast('camera unavailable — check permissions');
  }
}

flipBtn.addEventListener('click', async () => {
  state.facingMode = state.facingMode === 'user' ? 'environment' : 'user';
  await startCamera();
});

// ===========================================================
//  PRESETS — film looks defined as canvas filter strings + extras
// ===========================================================
const PRESETS = {
  warm: {
    label: 'Warm Film',
    filter: 'sepia(0.18) saturate(1.05) contrast(0.92) brightness(1.05) hue-rotate(-6deg)',
    tint: 'rgba(255, 200, 140, 0.10)',
    fade: 'rgba(255, 240, 220, 0.08)',
    leak: true,
  },
  pink: {
    label: 'Soft Pink',
    filter: 'saturate(1.0) contrast(0.9) brightness(1.08) hue-rotate(-10deg)',
    tint: 'rgba(255, 180, 200, 0.18)',
    fade: 'rgba(255, 230, 235, 0.12)',
    leak: true,
  },
  cool: {
    label: 'Cool Fade',
    filter: 'saturate(0.85) contrast(0.9) brightness(1.04) hue-rotate(8deg)',
    tint: 'rgba(160, 180, 220, 0.14)',
    fade: 'rgba(220, 230, 240, 0.10)',
    leak: false,
  },
  washed: {
    label: 'Washed Memory',
    filter: 'saturate(0.78) contrast(0.82) brightness(1.12)',
    tint: 'rgba(255, 230, 210, 0.16)',
    fade: 'rgba(255, 245, 230, 0.18)',
    leak: false,
  },
  bw: {
    label: 'B&W',
    filter: 'grayscale(1) contrast(0.95) brightness(1.05)',
    tint: 'rgba(255, 250, 240, 0.06)',
    fade: 'rgba(245, 245, 245, 0.08)',
    leak: false,
  },
  golden: {
    label: 'Golden Hour',
    filter: 'sepia(0.28) saturate(1.25) contrast(0.95) brightness(1.06)',
    tint: 'rgba(255, 185, 90, 0.14)',
    fade: 'rgba(255, 235, 200, 0.08)',
    leak: true,
  },
  lavender: {
    label: 'Lavender',
    filter: 'saturate(0.88) contrast(0.9) brightness(1.08)',
    tint: 'rgba(185, 160, 240, 0.18)',
    fade: 'rgba(240, 230, 255, 0.12)',
    leak: true,
  },
  mint: {
    label: 'Mint Soda',
    filter: 'saturate(0.92) contrast(0.9) brightness(1.07) hue-rotate(4deg)',
    tint: 'rgba(140, 225, 195, 0.15)',
    fade: 'rgba(230, 250, 240, 0.12)',
    leak: false,
  },
  cinema: {
    label: 'Cinema',
    filter: 'contrast(1.08) saturate(1.12) brightness(1.02)',
    tint: 'rgba(20, 130, 150, 0.12)',
    fade: 'rgba(230, 240, 240, 0.04)',
    blend: { color: 'rgba(255, 140, 60, 0.28)', op: 'soft-light' },
    leak: false,
  },
  sepia: {
    label: 'Old Sepia',
    filter: 'sepia(0.85) contrast(0.88) brightness(1.06)',
    tint: 'rgba(200, 150, 100, 0.10)',
    fade: 'rgba(255, 240, 215, 0.14)',
    grain: 0.1,
    leak: false,
  },
  noir: {
    label: 'Noir',
    filter: 'grayscale(1) contrast(1.35) brightness(0.96)',
    tint: 'rgba(0, 0, 0, 0)',
    fade: 'rgba(0, 0, 0, 0)',
    grain: 0.1,
    leak: false,
  }
};

// ===========================================================
//  STRIP STYLES — paper colors + patterns
//  paper: [top, bottom] gradient · pattern: optional overlay
//  ink: date text · accent: caption + brand · frame: photo border
// ===========================================================
const STRIPS = {
  cream:   { label: 'Cream',      paper: ['#fdf6ee', '#fbeee0'], ink: '#7a6166', accent: '#b56a78', frame: '#fff' },
  blush:   { label: 'Blush',      paper: ['#fbe1e6', '#f6cdd6'], ink: '#7a4f59', accent: '#b0566b', frame: '#fff' },
  butter:  { label: 'Butter',     paper: ['#fdf3c8', '#f9e6a6'], ink: '#7a6a3f', accent: '#b4892f', frame: '#fff' },
  sage:    { label: 'Sage',       paper: ['#e2ecdc', '#cfdfc6'], ink: '#4f6149', accent: '#5f7d55', frame: '#fff' },
  sky:     { label: 'Sky',        paper: ['#e0ecf8', '#c9dcf1'], ink: '#4b5f78', accent: '#5a7fae', frame: '#fff' },
  lilac:   { label: 'Lilac',      paper: ['#ece2f8', '#dccdf2'], ink: '#5f4f78', accent: '#8a6bb8', frame: '#fff' },
  black:   { label: 'Classic Black', paper: ['#222023', '#141214'], ink: '#cfc4c7', accent: '#f1b8c4', frame: '#f4efe9' },
  gingham: { label: 'Pink Gingham', paper: ['#fff7f8', '#fff3f5'], pattern: 'gingham', patternColor: 'rgba(240, 150, 170, 0.32)', ink: '#7a4f59', accent: '#b0566b', frame: '#fff' },
  dots:    { label: 'Polka Dots', paper: ['#fbe1e6', '#f8d6de'], pattern: 'dots', patternColor: 'rgba(255, 255, 255, 0.85)', ink: '#7a4f59', accent: '#b0566b', frame: '#fff' },
  stripes: { label: 'Candy Stripes', paper: ['#fffaf6', '#fff6f0'], pattern: 'stripes', patternColor: 'rgba(245, 170, 185, 0.45)', ink: '#7a4f59', accent: '#b0566b', frame: '#fff' },
  hearts:  { label: 'Hearts',     paper: ['#fdeaee', '#fbdbe2'], pattern: 'hearts', patternColor: 'rgba(220, 110, 135, 0.38)', ink: '#7a4f59', accent: '#b0566b', frame: '#fff' },
  stars:   { label: 'Starry Night', paper: ['#2b2f4f', '#1b1e36'], pattern: 'stars', patternColor: 'rgba(255, 236, 170, 0.75)', ink: '#c9cbe6', accent: '#ffe7a3', frame: '#f6f3ea' },
  checker: { label: 'Butter Check', paper: ['#fffbe8', '#fff7da'], pattern: 'checker', patternColor: 'rgba(240, 205, 110, 0.45)', ink: '#7a6a3f', accent: '#b4892f', frame: '#fff' },
};

// paint paper + pattern into any canvas area (used by strip + swatches)
function drawStripPaper(ctx, w, h, style, scale = 1) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, style.paper[0]);
  g.addColorStop(1, style.paper[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (!style.pattern) return;

  ctx.save();
  ctx.fillStyle = style.patternColor;
  const u = 28 * scale; // pattern unit size
  switch (style.pattern) {
    case 'gingham':
      for (let x = 0; x < w; x += u * 2) ctx.fillRect(x, 0, u, h);
      for (let y = 0; y < h; y += u * 2) ctx.fillRect(0, y, w, u);
      break;
    case 'checker':
      for (let y = 0, r = 0; y < h; y += u * 1.4, r++)
        for (let x = (r % 2) * u * 1.4; x < w; x += u * 2.8) ctx.fillRect(x, y, u * 1.4, u * 1.4);
      break;
    case 'stripes':
      for (let x = 0; x < w; x += u * 1.6) ctx.fillRect(x, 0, u * 0.8, h);
      break;
    case 'dots':
      for (let y = u * 0.6, r = 0; y < h + u; y += u * 1.3, r++)
        for (let x = (r % 2 ? u * 0.65 : 0) + u * 0.3; x < w + u; x += u * 1.3) {
          ctx.beginPath(); ctx.arc(x, y, u * 0.24, 0, Math.PI * 2); ctx.fill();
        }
      break;
    case 'hearts':
      for (let y = u, r = 0; y < h + u; y += u * 2, r++)
        for (let x = (r % 2 ? u : 0) + u * 0.5; x < w + u; x += u * 2) drawHeart(ctx, x, y, u * 0.55);
      break;
    case 'stars':
      for (let i = 0; i < Math.ceil((w * h) / (u * u * 3)); i++) {
        const x = rng(i * 3.1 + 1) * w, y = rng(i * 7.7 + 2) * h;
        const r = (rng(i * 1.3 + 5) * 0.35 + 0.15) * u;
        drawSparkle(ctx, x, y, r);
      }
      break;
  }
  ctx.restore();
}

function drawHeart(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 1.1, y - s * 0.4, x - s * 0.4, y - s * 1.0, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.4, y - s * 1.0, x + s * 1.1, y - s * 0.4, x, y + s * 0.35);
  ctx.fill();
}

function drawSparkle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

// build the strip style swatch row on the preview screen
const stripStylesEl = document.getElementById('stripStyles');
function buildStripSwatches() {
  Object.entries(STRIPS).forEach(([key, style]) => {
    const c = document.createElement('canvas');
    c.width = c.height = 72;
    drawStripPaper(c.getContext('2d'), 72, 72, style, 0.6);
    const btn = document.createElement('button');
    btn.className = 'swatch' + (key === state.strip ? ' active' : '');
    btn.dataset.strip = key;
    btn.title = style.label;
    btn.setAttribute('aria-label', style.label + ' strip');
    btn.style.backgroundImage = `url(${c.toDataURL()})`;
    stripStylesEl.appendChild(btn);
  });
}
buildStripSwatches();

stripStylesEl.addEventListener('click', e => {
  const btn = e.target.closest('.swatch');
  if (!btn) return;
  state.strip = btn.dataset.strip;
  stripStylesEl.querySelectorAll('.swatch').forEach(b => b.classList.toggle('active', b === btn));
  if (previewScreen.classList.contains('active')) renderStrip();
});

// preset chip handling (camera + preview)
function bindPresetButtons(container) {
  container.addEventListener('click', e => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    state.preset = btn.dataset.preset;
    // sync the other preset row
    document.querySelectorAll('.chip').forEach(c => {
      c.classList.toggle('active', c.dataset.preset === state.preset);
    });
    // re-render strip if on preview
    if (previewScreen.classList.contains('active')) renderStrip();
  });
}
bindPresetButtons(presetsEl);
bindPresetButtons(previewPresets);

// timer cycle
timerBtn.addEventListener('click', () => {
  const idx = TIMER_OPTIONS.indexOf(state.timer);
  state.timer = TIMER_OPTIONS[(idx + 1) % TIMER_OPTIONS.length];
  timerLabel.textContent = state.timer + 's';
});

// ===========================================================
//  SHUTTER SOUND  — synth'd via WebAudio so no asset needed
// ===========================================================
let audioCtx = null;
function playShutter() {
  if (!soundToggle.checked) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    // click: short noise burst + low thump
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.06, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buf;
    const ng = audioCtx.createGain();
    ng.gain.value = 0.35;
    noise.connect(ng).connect(audioCtx.destination);
    noise.start(t);

    const osc = audioCtx.createOscillator();
    const og = audioCtx.createGain();
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.08);
    og.gain.setValueAtTime(0.25, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.connect(og).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
  } catch {}
}

// ===========================================================
//  CAPTURE FLOW  — 4 photos with countdown
// ===========================================================
shutterBtn.addEventListener('click', startCaptureSequence);

async function startCaptureSequence() {
  if (state.busy) return;
  state.busy = true;
  shutterBtn.classList.add('busy');
  state.shots = [];
  shotThumbs.innerHTML = '';

  for (let i = 0; i < 4; i++) {
    shotCounter.textContent = `${i + 1} / 4`;
    await runCountdown(state.timer);
    captureFrame();
    await sleep(1500); // 1.5s breath between shots
  }

  shutterBtn.classList.remove('busy');
  state.busy = false;
  shotCounter.textContent = '1 / 4';

  // process and show preview
  showScreen('processing');
  await sleep(700); // tiny delay so loader reads as "developing"
  await renderStrip();
  showScreen('preview');
}

function runCountdown(seconds) {
  return new Promise(resolve => {
    let n = seconds;
    function tick() {
      if (n <= 0) {
        countdownEl.textContent = '';
        countdownEl.classList.remove('show');
        return resolve();
      }
      countdownEl.textContent = n;
      countdownEl.classList.remove('show');
      // re-trigger animation
      void countdownEl.offsetWidth;
      countdownEl.classList.add('show');
      n--;
      setTimeout(tick, 1000);
    }
    tick();
  });
}

function captureFrame() {
  // flash
  flashEl.classList.remove('fire');
  void flashEl.offsetWidth;
  flashEl.classList.add('fire');
  playShutter();

  // capture from video into a hidden canvas at a square crop
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return;
  const size = Math.min(w, h);
  const sx = (w - size) / 2;
  const sy = (h - size) / 2;

  const c = document.createElement('canvas');
  c.width  = 600;
  c.height = 600;
  const ctx = c.getContext('2d');

  // mirror if front camera (so strip matches what the user saw)
  if (state.facingMode === 'user') {
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, sx, sy, size, size, 0, 0, c.width, c.height);

  state.shots.push(c);

  // mini thumb
  const thumb = document.createElement('img');
  thumb.src = c.toDataURL('image/jpeg', 0.6);
  shotThumbs.appendChild(thumb);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ===========================================================
//  STRIP RENDERING  — combines 4 photos + applies filters
// ===========================================================
async function renderStrip() {
  if (state.shots.length < 4) return;

  // strip dimensions (portrait)
  const photoW = 600;
  const photoH = 600;
  const padX   = 36;            // side border
  const gap    = 16;            // gap between photos
  const padTop = 36;
  const padBot = 110;           // larger bottom for caption / branding
  const stripW = photoW + padX * 2;
  const stripH = padTop + photoH * 4 + gap * 3 + padBot;

  stripCanvas.width  = stripW;
  stripCanvas.height = stripH;
  const ctx = stripCanvas.getContext('2d');

  // paper background — chosen strip color / pattern
  const strip = STRIPS[state.strip] || STRIPS.cream;
  drawStripPaper(ctx, stripW, stripH, strip);

  // soft paper texture noise
  drawPaperNoise(ctx, stripW, stripH, 0.04);

  const preset = PRESETS[state.preset];

  // draw each photo through filter
  for (let i = 0; i < 4; i++) {
    const x = padX;
    const y = padTop + i * (photoH + gap);

    // film border (slight inner shadow ring)
    ctx.fillStyle = strip.frame;
    ctx.fillRect(x - 4, y - 4, photoW + 8, photoH + 8);

    // apply filter via canvas filter property
    ctx.save();
    ctx.filter = preset.filter;
    ctx.drawImage(state.shots[i], x, y, photoW, photoH);
    ctx.restore();

    // overlay tint (warm/pink/cool color cast)
    ctx.save();
    ctx.fillStyle = preset.tint;
    ctx.fillRect(x, y, photoW, photoH);

    // fade (lifted blacks)
    ctx.fillStyle = preset.fade;
    ctx.fillRect(x, y, photoW, photoH);

    // optional extra color grade (e.g. cinema orange highlights)
    if (preset.blend) {
      ctx.globalCompositeOperation = preset.blend.op;
      ctx.fillStyle = preset.blend.color;
      ctx.fillRect(x, y, photoW, photoH);
    }
    ctx.restore();

    // film grain on each frame
    drawGrain(ctx, x, y, photoW, photoH, preset.grain ?? 0.07);

    // very slight blur softness via second pass — done with shadow trick
    drawSoftness(ctx, x, y, photoW, photoH);

    // dust/scratches (subtle)
    drawDust(ctx, x, y, photoW, photoH, i);

    // light leak (top-left corner of first photo, bottom-right of last)
    if (preset.leak && (i === 0 || i === 3)) {
      drawLightLeak(ctx, x, y, photoW, photoH, i === 0 ? 'tl' : 'br', state.preset);
    }

    // vignette
    drawVignette(ctx, x, y, photoW, photoH);
  }

  // bottom caption / branding
  drawStripFooter(ctx, stripW, stripH, padBot, strip);

  // export blob for share/download
  await new Promise(res => stripCanvas.toBlob(b => { state.stripBlob = b; res(); }, 'image/png'));

  // re-paint stickers on top (HTML overlay)
  paintStickerLayer();
}

// ---------- film grain ----------
function drawGrain(ctx, x, y, w, h, intensity = 0.08) {
  const img = ctx.getImageData(x, y, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 255 * intensity;
    d[i]     = clamp(d[i]     + n);
    d[i + 1] = clamp(d[i + 1] + n);
    d[i + 2] = clamp(d[i + 2] + n);
  }
  ctx.putImageData(img, x, y);
}

function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

// ---------- soft paper noise (background) ----------
function drawPaperNoise(ctx, w, h, intensity) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 255 * intensity;
    d[i]     = clamp(d[i]     + n);
    d[i + 1] = clamp(d[i + 1] + n);
    d[i + 2] = clamp(d[i + 2] + n);
  }
  ctx.putImageData(img, 0, 0);
}

// ---------- subtle softness via blurred copy at low alpha ----------
function drawSoftness(ctx, x, y, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.filter = 'blur(2.5px)';
  ctx.drawImage(stripCanvas, x, y, w, h, x, y, w, h);
  ctx.restore();
}

// ---------- dust + scratches ----------
function drawDust(ctx, x, y, w, h, seed) {
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#fff';
  // dust specks
  const specks = 14 + Math.floor(rng(seed) * 10);
  for (let i = 0; i < specks; i++) {
    const px = x + rng(seed * 31 + i) * w;
    const py = y + rng(seed * 17 + i * 7) * h;
    const r = rng(seed + i) * 1.4 + 0.3;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // scratches
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 0.8;
  const scratches = 2 + Math.floor(rng(seed + 99) * 2);
  for (let i = 0; i < scratches; i++) {
    const sx = x + rng(seed + i * 13) * w;
    const sy = y + rng(seed + i * 23) * h;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (rng(seed + i) - 0.5) * 30, sy + rng(seed + i * 5) * h * 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

// deterministic-ish random
function rng(seed) {
  const s = Math.sin(seed * 9301 + 49297) * 233280;
  return s - Math.floor(s);
}

// ---------- light leak ----------
function drawLightLeak(ctx, x, y, w, h, corner, presetKey) {
  const colors = {
    warm:   ['rgba(255,180,80,0.45)',  'rgba(255,120,60,0)'],
    pink:   ['rgba(255,150,180,0.45)', 'rgba(255,180,200,0)'],
    cool:   ['rgba(160,200,255,0.30)', 'rgba(180,210,240,0)'],
    washed: ['rgba(255,230,180,0.35)', 'rgba(255,240,220,0)'],
    bw:     ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)'],
    golden: ['rgba(255,170,60,0.50)',  'rgba(255,140,40,0)'],
    lavender:['rgba(200,160,255,0.40)', 'rgba(220,190,255,0)'],
  }[presetKey] || ['rgba(255,200,150,0.35)', 'rgba(255,200,150,0)'];

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  let cx, cy;
  if (corner === 'tl') { cx = x;       cy = y; }
  else                 { cx = x + w;   cy = y + h; }
  const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, w * 0.8);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(1, colors[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// ---------- vignette ----------
function drawVignette(ctx, x, y, w, h) {
  ctx.save();
  const grad = ctx.createRadialGradient(
    x + w / 2, y + h / 2, w * 0.35,
    x + w / 2, y + h / 2, w * 0.75
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(40,20,30,0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// ---------- footer (caption + brand + date) ----------
function drawStripFooter(ctx, stripW, stripH, padBot, strip) {
  const baseY = stripH - padBot + 20;

  // caption
  if (captionToggle.checked && captionInput.value.trim()) {
    ctx.fillStyle = strip.accent;
    ctx.font = '700 38px "Caveat", cursive';
    ctx.textAlign = 'center';
    ctx.fillText(captionInput.value.trim(), stripW / 2, baseY + 12);
  }

  // date stamp
  const d = new Date();
  const dateStr = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  ctx.fillStyle = strip.ink;
  ctx.font = '600 18px "Quicksand", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(dateStr, stripW / 2, baseY + 50);

  // brand
  ctx.fillStyle = strip.accent;
  ctx.globalAlpha = 0.8;
  ctx.font = '700 22px "Caveat", cursive';
  ctx.fillText('✦ filmae', stripW / 2, baseY + 78);
  ctx.globalAlpha = 1;
}

// ===========================================================
//  STICKERS — overlay layer with drag support
// ===========================================================
stickerTray.addEventListener('click', e => {
  const btn = e.target.closest('.sticker-btn');
  if (!btn || btn.id === 'clearStickers') return;
  const emoji = btn.dataset.sticker;
  // place near center (relative coords 0–1)
  state.stickers.push({
    emoji,
    x: 0.5 + (Math.random() - 0.5) * 0.2,
    y: 0.4 + (Math.random() - 0.5) * 0.2,
  });
  paintStickerLayer();
});

clearStickers.addEventListener('click', () => {
  state.stickers = [];
  paintStickerLayer();
});

function paintStickerLayer() {
  stickerLayer.innerHTML = '';
  const rect = stripCanvas.getBoundingClientRect();
  state.stickers.forEach((s, idx) => {
    const el = document.createElement('div');
    el.className = 'sticker';
    el.textContent = s.emoji;
    el.style.left = (s.x * 100) + '%';
    el.style.top  = (s.y * 100) + '%';
    el.style.transform = 'translate(-50%, -50%)';
    enableDrag(el, idx);
    stickerLayer.appendChild(el);
  });
}

function enableDrag(el, idx) {
  let startX, startY, origX, origY;
  const onDown = e => {
    e.preventDefault();
    el.classList.add('dragging');
    const pt = pointFromEvent(e);
    startX = pt.x; startY = pt.y;
    origX = state.stickers[idx].x;
    origY = state.stickers[idx].y;
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp, { once: true });
  };
  const onMove = e => {
    const pt = pointFromEvent(e);
    const rect = stripCanvas.getBoundingClientRect();
    const dx = (pt.x - startX) / rect.width;
    const dy = (pt.y - startY) / rect.height;
    state.stickers[idx].x = Math.max(0.05, Math.min(0.95, origX + dx));
    state.stickers[idx].y = Math.max(0.03, Math.min(0.97, origY + dy));
    el.style.left = (state.stickers[idx].x * 100) + '%';
    el.style.top  = (state.stickers[idx].y * 100) + '%';
  };
  const onUp = () => {
    el.classList.remove('dragging');
    document.removeEventListener('pointermove', onMove);
  };
  el.addEventListener('pointerdown', onDown);
}

function pointFromEvent(e) {
  return { x: e.clientX, y: e.clientY };
}

// Bake stickers into a final canvas before export/save
function bakeFinalCanvas() {
  const w = stripCanvas.width;
  const h = stripCanvas.height;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const ctx = out.getContext('2d');
  ctx.drawImage(stripCanvas, 0, 0);
  // draw stickers
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  state.stickers.forEach(s => {
    ctx.font = '900 64px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.fillText(s.emoji, s.x * w, s.y * h);
  });
  return out;
}

// ===========================================================
//  ACTIONS: retake / download / share / save
// ===========================================================
retakeBtn.addEventListener('click', () => {
  state.shots = [];
  state.stickers = [];
  paintStickerLayer();
  shotThumbs.innerHTML = '';
  showScreen('camera');
});

downloadBtn.addEventListener('click', async () => {
  const out = bakeFinalCanvas();
  out.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `filmae-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('saved to downloads ✦');
  }, 'image/png');
});

shareBtn.addEventListener('click', async () => {
  const out = bakeFinalCanvas();
  out.toBlob(async blob => {
    const file = new File([blob], `filmae-${Date.now()}.png`, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'filmae — vintage booth',
          text: 'a memory from filmae ✦',
        });
      } catch {/* user cancelled */}
    } else {
      // fallback: open in a new tab
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      toast('share unavailable — opened image instead');
    }
  }, 'image/png');
});

saveBtn.addEventListener('click', async () => {
  const out = bakeFinalCanvas();
  out.toBlob(async blob => {
    await saveStripToDB(blob);
    toast('added to your gallery ♥');
  }, 'image/png');
});

// ===========================================================
//  GALLERY  — IndexedDB
// ===========================================================
const DB_NAME = 'filmae-db';
const DB_STORE = 'strips';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function saveStripToDB(blob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).add({ blob, ts: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadAllStrips() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => b.ts - a.ts));
    req.onerror = () => reject(req.error);
  });
}

async function deleteStrip(id) {
  const db = await openDB();
  return new Promise(resolve => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(id);
    tx.oncomplete = () => resolve();
  });
}

galleryBtn.addEventListener('click', async () => {
  showScreen('gallery');
  await renderGallery();
});

closeGallery.addEventListener('click', () => showScreen('camera'));

async function renderGallery() {
  const items = await loadAllStrips();
  galleryGrid.innerHTML = '';
  if (!items.length) {
    emptyMsg.classList.add('show');
    return;
  }
  emptyMsg.classList.remove('show');
  items.forEach(item => {
    const url = URL.createObjectURL(item.blob);
    const wrap = document.createElement('div');
    wrap.className = 'gallery-item';
    wrap.innerHTML = `
      <img src="${url}" alt="filmae strip" />
      <button class="del" aria-label="Delete">×</button>
    `;
    wrap.querySelector('img').addEventListener('click', () => {
      // open full-size in a new tab
      window.open(url, '_blank');
    });
    wrap.querySelector('.del').addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteStrip(item.id);
      await renderGallery();
    });
    galleryGrid.appendChild(wrap);
  });
}

// ===========================================================
//  PWA — service worker registration
// ===========================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  });
}

// ===========================================================
//  INIT
// ===========================================================
(async function init() {
  showScreen('camera');
  await startCamera();
})();
