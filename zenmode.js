// Zen Mode - Full Browser Experience
let stars = [];
let shootingStars = [];
let canvas, ctx;
let animationFrame;
let audioContext;
let masterGain;
let isMuted = false;

// Inspirational quotes
const quotes = [
  "Discipline is choosing between what you want now and what you want most.",
  "Action is the foundational key to all success.",
  "The work you do today builds the future you desire.",
  "You are capable of more than you know. Believe in yourself.",
  "Focus only on what you can control. Let go of the rest.",
  "This moment is all we truly have. Be fully present.",
  "Peace comes from accepting what is, not resisting what isn't.",
  "Know thyself. Regular introspection reveals your true path.",
  "Small daily improvements lead to stunning long-term results.",
  "Your thoughts shape your reality. Choose optimism.",
  "Hard work beats talent when talent doesn't work hard.",
  "The obstacle is the way. Embrace challenges as growth.",
  "Self-discipline is self-love. You deserve your own commitment.",
  "Start where you are. Use what you have. Do what you can.",
  "Inner peace begins when you choose not to let others control your emotions.",
  "Your potential is endless. Your dedication determines your success.",
  "The present moment is a gift. That's why it's called the present.",
  "Consistent action, no matter how small, creates unstoppable momentum.",
  "Believe you can and you're halfway there.",
  "Control your mind or it will control you. Choose peace."
];

let currentQuoteIndex = 0;

// Star class with twinkling and glow effects
class Star {
  constructor() {
    this.reset();
  }
  
  reset() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.size = Math.random() * 1.2 + 0.3;
    this.speed = Math.random() * 0.03 + 0.01;
    this.opacity = Math.random();
    this.fadeDirection = Math.random() > 0.5 ? 1 : -1;
    this.twinkleSpeed = Math.random() * 0.02 + 0.005;
  }
  
  // Update star opacity for twinkling effect
  update() {
    this.opacity += this.twinkleSpeed * this.fadeDirection;
    
    if (this.opacity >= 1) {
      this.opacity = 1;
      this.fadeDirection = -1;
    } else if (this.opacity <= 0.1) {
      this.opacity = 0.1;
      this.fadeDirection = 1;
    }
  }
  
  // Draw star with optional glow effect
  draw() {
    ctx.save();
    ctx.globalAlpha = this.opacity;
    
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    
    if (this.size > 0.8) {
      ctx.globalAlpha = this.opacity * 0.2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }
}

// Shooting star with animated trail effect
class ShootingStar {
  constructor() {
    this.reset();
  }
  
  reset() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height * 0.5;
    this.length = Math.random() * 80 + 40;
    this.speed = Math.random() * 8 + 6;
    this.opacity = 1;
    this.angle = Math.PI / 4 + (Math.random() - 0.5) * 0.5;
    this.tail = [];
  }
  
  // Update shooting star position and opacity
  update() {
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
    this.opacity -= 0.015;
    
    return this.opacity > 0 && this.x < canvas.width && this.y < canvas.height;
  }
  
  // Draw shooting star with gradient trail
  draw() {
    ctx.save();
    ctx.globalAlpha = this.opacity;
    
    const gradient = ctx.createLinearGradient(
      this.x,
      this.y,
      this.x - Math.cos(this.angle) * this.length,
      this.y - Math.sin(this.angle) * this.length
    );
    
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.5, 'rgba(200, 220, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(150, 180, 255, 0)');
    
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(
      this.x - Math.cos(this.angle) * this.length,
      this.y - Math.sin(this.angle) * this.length
    );
    ctx.stroke();
    
    ctx.restore();
  }
}

// Initialize canvas and setup resize listener
function initCanvas() {
  canvas = document.getElementById('zenCanvas');
  ctx = canvas.getContext('2d');
  resizeCanvas();
  
  window.addEventListener('resize', resizeCanvas);
}

// Resize canvas to window dimensions and recreate stars
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  if (stars.length === 0) {
    createStars();
  }
}

// Create star field based on screen size
function createStars() {
  stars = [];
  const numStars = Math.floor((canvas.width * canvas.height) / 1500);
  
  for (let i = 0; i < numStars; i++) {
    stars.push(new Star());
  }
}

// Main animation loop for stars and shooting stars
function animate() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  stars.forEach(star => {
    star.update();
    star.draw();
  });
  
  shootingStars = shootingStars.filter(star => {
    const alive = star.update();
    if (alive) star.draw();
    return alive;
  });
  
  if (Math.random() < 0.005 && shootingStars.length < 3) {
    shootingStars.push(new ShootingStar());
  }
  
  animationFrame = requestAnimationFrame(animate);
}

// Create layered ambient music with harmonics and effects
function createAmbientMusic() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  masterGain = audioContext.createGain();
  masterGain.gain.value = 0.5;
  masterGain.connect(audioContext.destination);
  
  const bass = createOscillatorLayer(65.41, 'sine', 0.15, masterGain);
  const mid1 = createOscillatorLayer(130.81, 'sine', 0.08, masterGain);
  const mid2 = createOscillatorLayer(164.81, 'sine', 0.06, masterGain);
  const high1 = createOscillatorLayer(523.25, 'sine', 0.04, masterGain);
  const high2 = createOscillatorLayer(659.25, 'sine', 0.03, masterGain);
  const detune1 = createOscillatorLayer(131.5, 'sine', 0.05, masterGain);
  const detune2 = createOscillatorLayer(165.5, 'sine', 0.04, masterGain);
  
  const lfo = audioContext.createOscillator();
  const lfoGain = audioContext.createGain();
  lfo.frequency.value = 0.1;
  lfoGain.gain.value = 0.08;
  lfo.connect(lfoGain);
  lfoGain.connect(masterGain.gain);
  lfo.start();
  
  const filter = audioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  filter.Q.value = 1;
  
  const filterLFO = audioContext.createOscillator();
  const filterLFOGain = audioContext.createGain();
  filterLFO.frequency.value = 0.05;
  filterLFOGain.gain.value = 200;
  filterLFO.connect(filterLFOGain);
  filterLFOGain.connect(filter.frequency);
  filterLFO.start();
  
  const delay = audioContext.createDelay();
  const delayGain = audioContext.createGain();
  const feedback = audioContext.createGain();
  delay.delayTime.value = 0.3;
  delayGain.gain.value = 0.3;
  feedback.gain.value = 0.4;
  masterGain.connect(delay);
  delay.connect(delayGain);
  delay.connect(feedback);
  feedback.connect(delay);
  delayGain.connect(audioContext.destination);
}

// Create individual oscillator with specified parameters
function createOscillatorLayer(frequency, type, volume, destination) {
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  
  osc.frequency.value = frequency;
  osc.type = type;
  gain.gain.value = volume;
  
  osc.connect(gain);
  gain.connect(destination);
  
  osc.start();
  
  return { oscillator: osc, gain: gain };
}

// Rotate through inspirational quotes with fade effect
function rotateQuote() {
  const quoteElement = document.getElementById('quoteText');
  quoteElement.style.opacity = '0';
  
  setTimeout(() => {
    currentQuoteIndex = (currentQuoteIndex + 1) % quotes.length;
    quoteElement.textContent = quotes[currentQuoteIndex];
    quoteElement.style.opacity = '0.5';
  }, 1500);
}

// Close zen mode tab
document.getElementById('exitBtn').addEventListener('click', () => {
  cleanup();
  window.close();
});

// Toggle audio mute state
document.getElementById('muteBtn').addEventListener('click', () => {
  isMuted = !isMuted;
  const muteIcon = document.getElementById('muteIcon');
  
  if (isMuted) {
    masterGain.gain.value = 0;
    muteIcon.textContent = '🔇';
  } else {
    const volume = document.getElementById('volumeSlider').value / 100;
    masterGain.gain.value = volume * 0.5;
    muteIcon.textContent = '🔊';
  }
});

// Adjust volume from slider
document.getElementById('volumeSlider').addEventListener('input', (e) => {
  if (!isMuted) {
    masterGain.gain.value = (e.target.value / 100) * 0.5;
  }
});

// Handle keyboard shortcuts for exit and fullscreen
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    cleanup();
    window.close();
  }
  
  if (e.key === 'f' || e.key === 'F' || e.key === 'F11') {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }
});

// Stop animation and close audio context
function cleanup() {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }
  if (audioContext) {
    audioContext.close();
  }
}

// Initialize zen mode on page load
window.addEventListener('load', () => {
  initCanvas();
  createStars();
  animate();
  createAmbientMusic();
  setInterval(rotateQuote, 15000);
  
  setTimeout(() => {
    document.documentElement.requestFullscreen().catch(() => {});
  }, 100);
});

window.addEventListener('beforeunload', cleanup);
