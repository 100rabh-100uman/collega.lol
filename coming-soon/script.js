/**
 * COLLEGA.LOL — Temporary Teaser Experience Engine
 * Pure Vanilla JavaScript: High-performance, zero external dependencies.
 */

(function () {
  'use strict';

  // DOM Elements
  const stage = document.getElementById('teaser-stage');
  const cinematicBox = document.getElementById('cinematic-box');
  const wandererNode = document.getElementById('wanderer-node');
  const narrativeText = document.getElementById('narrative-text');
  const brandSection = document.getElementById('brand-reveal-section');
  const brandWordmark = document.getElementById('brand-wordmark');
  const ambientGlow = document.getElementById('ambient-glow');
  const ambientCanvas = document.getElementById('ambient-canvas');
  const srAnnouncements = document.getElementById('sr-announcements');
  const skipBtn = document.getElementById('skip-btn');
  const replayBtn = document.getElementById('replay-btn');
  const tapHint = document.getElementById('tap-hint');
  const yearSpan = document.getElementById('year');
  const progressBarChars = document.getElementById('progress-bar-chars');
  const progressPercent = document.getElementById('progress-percent');

  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // Story sequence definition
  // Each beat defines text, visual class, display duration, and post-fade pause
  const STORY_BEATS = [
    {
      type: 'ambient',
      duration: 1200 // Initial quiet darkness with glowing wanderer node
    },
    {
      text: 'Something is moving...',
      className: 'soft-intro',
      displayDuration: 1800,
      pauseAfter: 500
    },
    {
      text: 'NEED SOMETHING?',
      className: 'thought-inquiry',
      displayDuration: 2000,
      pauseAfter: 400
    },
    {
      text: "DON'T WANT TO WALK?",
      className: 'thought-inquiry',
      displayDuration: 2000,
      pauseAfter: 400
    },
    {
      text: 'WANT TO EARN?',
      className: 'thought-inquiry',
      displayDuration: 2000,
      pauseAfter: 400
    },
    {
      text: 'HAVE SOMETHING TO SELL?',
      className: 'thought-inquiry',
      displayDuration: 2000,
      pauseAfter: 600
    },
    {
      type: 'pause',
      duration: 800 // Dramatic pause before climax
    },
    {
      text: 'WHAT IF...',
      className: 'what-if',
      displayDuration: 2200,
      pauseAfter: 500
    },
    {
      text: 'YOU COULD JUST ASK SOMEONE?',
      className: 'centerpiece',
      displayDuration: 2800,
      pauseAfter: 700
    }
  ];

  // Engine state
  let currentBeatIndex = 0;
  let beatTimer = null;
  let isSequenceFinished = false;
  let isTransitioning = false;
  let isReducedMotion = false;

  // Check prefers-reduced-motion
  const mediaQueryReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  isReducedMotion = mediaQueryReducedMotion.matches;

  /**
   * Screen reader announcer
   */
  function announceToScreenReader(text) {
    if (srAnnouncements && text) {
      srAnnouncements.textContent = text;
    }
  }

  /**
   * Advance to the next story beat
   */
  function advanceBeat() {
    if (isSequenceFinished) return;

    clearTimeout(beatTimer);

    // If current beat has an active phrase element, trigger leave transition
    const currentPhrase = narrativeText.querySelector('.phrase-item.is-visible');
    if (currentPhrase) {
      currentPhrase.classList.remove('is-visible');
      currentPhrase.classList.add('is-leaving');
      setTimeout(() => {
        if (currentPhrase && currentPhrase.parentNode) {
          currentPhrase.remove();
        }
      }, 700);
    }

    currentBeatIndex++;

    if (currentBeatIndex >= STORY_BEATS.length) {
      triggerBrandReveal();
      return;
    }

    executeCurrentBeat();
  }

  /**
   * Execute whatever beat is at currentBeatIndex
   */
  function executeCurrentBeat() {
    if (isSequenceFinished) return;

    const beat = STORY_BEATS[currentBeatIndex];
    if (!beat) {
      triggerBrandReveal();
      return;
    }

    // Handle special non-text beats
    if (beat.type === 'ambient') {
      if (wandererNode) wandererNode.classList.add('active');
      beatTimer = setTimeout(() => {
        advanceBeat();
      }, beat.duration);
      return;
    }

    if (beat.type === 'pause') {
      if (wandererNode) wandererNode.classList.remove('active');
      beatTimer = setTimeout(() => {
        advanceBeat();
      }, beat.duration);
      return;
    }

    // Text Beat
    if (wandererNode) wandererNode.classList.remove('active');

    // Create phrase element
    const phraseEl = document.createElement('div');
    phraseEl.className = `phrase-item ${beat.className}`;
    phraseEl.textContent = beat.text;
    phraseEl.setAttribute('role', 'heading');
    phraseEl.setAttribute('aria-level', '2');
    narrativeText.appendChild(phraseEl);

    announceToScreenReader(beat.text);

    // Trigger enter animation on next micro-tick
    requestAnimationFrame(() => {
      phraseEl.classList.add('is-visible');
    });

    // Schedule fadeout & progression
    beatTimer = setTimeout(() => {
      phraseEl.classList.remove('is-visible');
      phraseEl.classList.add('is-leaving');

      setTimeout(() => {
        if (phraseEl && phraseEl.parentNode) {
          phraseEl.remove();
        }
      }, 700);

      beatTimer = setTimeout(() => {
        advanceBeat();
      }, beat.pauseAfter || 400);
    }, beat.displayDuration);
  }

  /**
   * Climax / Brand Reveal Transition
   */
  function triggerBrandReveal() {
    if (isSequenceFinished) return;
    isSequenceFinished = true;
    clearTimeout(beatTimer);

    // Announce final brand info
    announceToScreenReader('COLLEGA.LOL. Something new is coming to campus. Something is cooking. Stay curious.');

    // Transition out cinematic narrative box
    if (cinematicBox) {
      cinematicBox.classList.add('fade-away');
      setTimeout(() => {
        cinematicBox.style.display = 'none';
      }, 700);
    }

    // Reveal brand section with high-impact flourish
    if (brandSection) {
      brandSection.classList.remove('hidden');
      requestAnimationFrame(() => {
        brandSection.classList.add('revealed');
      });
    }

    // Animate progress bar slightly
    animateCookingProgress();

    // Toggle controls
    if (skipBtn) skipBtn.classList.add('hidden');
    if (replayBtn) replayBtn.classList.remove('hidden');

    if (tapHint) {
      const hintText = tapHint.querySelector('.tap-text');
      if (hintText) {
        hintText.textContent = "Something is cooking. Stay curious.";
      }
    }
  }

  /**
   * Cooking Progress Animation
   */
  function animateCookingProgress() {
    if (!progressBarChars || !progressPercent) return;
    
    let currentPct = 0;
    const targetPct = 72;
    const totalBlocks = 10;
    const activeBlocksTarget = 7; // 70%

    const interval = setInterval(() => {
      currentPct += 3;
      if (currentPct >= targetPct) {
        currentPct = targetPct;
        clearInterval(interval);
      }

      const activeBlocks = Math.floor((currentPct / 100) * totalBlocks);
      const filled = '█'.repeat(activeBlocks);
      const empty = '░'.repeat(totalBlocks - activeBlocks);

      progressBarChars.textContent = filled + empty;
      progressPercent.textContent = currentPct + '%';
    }, 45);
  }

  /**
   * Restart / Replay Experience
   */
  function replayExperience() {
    clearTimeout(beatTimer);
    isSequenceFinished = false;
    currentBeatIndex = 0;

    // Reset UI
    narrativeText.innerHTML = '';
    if (brandSection) {
      brandSection.classList.remove('revealed');
      brandSection.classList.add('hidden');
    }

    if (cinematicBox) {
      cinematicBox.style.display = 'flex';
      cinematicBox.classList.remove('fade-away');
    }

    if (skipBtn) skipBtn.classList.remove('hidden');
    if (replayBtn) replayBtn.classList.add('hidden');

    if (tapHint) {
      const hintText = tapHint.querySelector('.tap-text');
      if (hintText) {
        hintText.textContent = "Click anywhere or press Space to proceed";
      }
    }

    executeCurrentBeat();
  }

  /**
   * User Interactivity: Fast-forward / Click to advance
   */
  stage.addEventListener('click', (e) => {
    // Avoid double triggering if clicking interactive buttons
    if (e.target.closest('button') || e.target.closest('a')) return;

    if (!isSequenceFinished) {
      advanceBeat();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'Enter') {
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') {
        return; // Allow button's default key handler
      }
      e.preventDefault();
      if (!isSequenceFinished) {
        advanceBeat();
      } else if (e.code === 'Space') {
        // Subtle easter egg pulse on space after finish
        if (brandWordmark) {
          brandWordmark.style.transform = 'scale(1.04)';
          setTimeout(() => {
            brandWordmark.style.transform = '';
          }, 300);
        }
      }
    }
  });

  if (skipBtn) {
    skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerBrandReveal();
    });
  }

  if (replayBtn) {
    replayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      replayExperience();
    });
  }

  /* ==========================================================================
     Ambient Cursor Following Glow
     ========================================================================== */
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let targetX = mouseX;
  let targetY = mouseY;
  let isPointerMoving = false;

  function handlePointerMove(clientX, clientY) {
    targetX = clientX;
    targetY = clientY;
    isPointerMoving = true;
  }

  window.addEventListener('mousemove', (e) => {
    handlePointerMove(e.clientX, e.clientY);
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) {
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  // Smooth lerp loop for the ambient light
  function updateAmbientLight() {
    if (ambientGlow) {
      mouseX += (targetX - mouseX) * 0.1;
      mouseY += (targetY - mouseY) * 0.1;
      ambientGlow.style.left = `${mouseX}px`;
      ambientGlow.style.top = `${mouseY}px`;
    }
    requestAnimationFrame(updateAmbientLight);
  }
  requestAnimationFrame(updateAmbientLight);

  /* ==========================================================================
     Lightweight Ambient Canvas: Subtle drifting nodes & wandering light line
     ========================================================================== */
  function initAmbientCanvas() {
    if (!ambientCanvas) return;
    const ctx = ambientCanvas.getContext('2d');
    if (!ctx) return;

    let width = (ambientCanvas.width = window.innerWidth);
    let height = (ambientCanvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
      width = ambientCanvas.width = window.innerWidth;
      height = ambientCanvas.height = window.innerHeight;
    }, { passive: true });

    // Restrained particle count: 24 tiny soft particles
    const particleCount = 24;
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.5 + 0.5,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        alpha: Math.random() * 0.5 + 0.15,
        baseAlpha: Math.random() * 0.4 + 0.15,
        pulseSpeed: Math.random() * 0.02 + 0.005
      });
    }

    // Wandering luminous filament beacon
    const beacon = {
      x: width * 0.5,
      y: height * 0.5,
      targetX: width * 0.5,
      targetY: height * 0.5,
      trail: [],
      maxTrail: 16,
      timer: 0
    };

    let animationFrameId = null;

    function renderCanvas() {
      if (document.hidden) {
        animationFrameId = requestAnimationFrame(renderCanvas);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Render soft particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        p.alpha = p.baseAlpha + Math.sin(Date.now() * p.pulseSpeed) * 0.15;
        if (p.alpha < 0.05) p.alpha = 0.05;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(167, 139, 250, ${p.alpha})`;
        ctx.fill();
      }

      // Render subtle drifting filament
      beacon.timer++;
      if (beacon.timer % 120 === 0) {
        beacon.targetX = width * 0.2 + Math.random() * width * 0.6;
        beacon.targetY = height * 0.2 + Math.random() * height * 0.6;
      }

      beacon.x += (beacon.targetX - beacon.x) * 0.008;
      beacon.y += (beacon.targetY - beacon.y) * 0.008;

      beacon.trail.push({ x: beacon.x, y: beacon.y });
      if (beacon.trail.length > beacon.maxTrail) {
        beacon.trail.shift();
      }

      if (beacon.trail.length > 2) {
        ctx.beginPath();
        ctx.moveTo(beacon.trail[0].x, beacon.trail[0].y);
        for (let i = 1; i < beacon.trail.length; i++) {
          ctx.lineTo(beacon.trail[i].x, beacon.trail[i].y);
        }
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(renderCanvas);
    }

    renderCanvas();
  }

  // Handle visibility state change to pause CPU-heavy drawing if tab is in background
  document.addEventListener('visibilitychange', () => {
    // Canvas loop checks document.hidden automatically
  });

  /* ==========================================================================
     Start the cinematic journey
     ========================================================================== */
  window.addEventListener('DOMContentLoaded', () => {
    document.body.classList.remove('loading');
    initAmbientCanvas();

    if (isReducedMotion) {
      triggerBrandReveal();
    } else {
      executeCurrentBeat();
    }
  });

})();
