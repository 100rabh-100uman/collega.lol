(() => {
  'use strict';

  const STORY_BEATS = Object.freeze([
    { type: 'ambient', durationMs: 1200 },
    { text: 'Something is moving...', visualClass: 'soft-intro', displayDurationMs: 1800, pauseAfterMs: 500 },
    { text: 'NEED SOMETHING?', visualClass: 'thought-inquiry', displayDurationMs: 2000, pauseAfterMs: 400 },
    { text: "DON'T WANT TO WALK?", visualClass: 'thought-inquiry', displayDurationMs: 2000, pauseAfterMs: 400 },
    { text: 'WANT TO EARN?', visualClass: 'thought-inquiry', displayDurationMs: 2000, pauseAfterMs: 400 },
    { text: 'HAVE SOMETHING TO SELL?', visualClass: 'thought-inquiry', displayDurationMs: 2000, pauseAfterMs: 600 },
    { type: 'pause', durationMs: 800 },
    { text: 'WHAT IF...', visualClass: 'what-if', displayDurationMs: 2200, pauseAfterMs: 500 },
    { text: 'YOU COULD JUST ASK SOMEONE?', visualClass: 'centerpiece', displayDurationMs: 2800, pauseAfterMs: 700 }
  ]);

  const ScreenReader = {
    liveRegion: document.getElementById('sr-announcements'),
    announce(message) {
      if (this.liveRegion && message) {
        this.liveRegion.textContent = message;
      }
    }
  };

  class CookingIndicator {
    constructor() {
      this.progressBarChars = document.getElementById('progress-bar-chars');
      this.progressPercent = document.getElementById('progress-percent');
      this.animationTimer = null;
    }

    render(percent) {
      if (!this.progressBarChars || !this.progressPercent) return;
      this.progressPercent.textContent = `${percent}%`;

      if (percent >= 10) {
        this.progressBarChars.innerHTML = '<span class="charging-block">█</span><span class="empty-block">░░░░░░░░░</span>';
      } else {
        this.progressBarChars.innerHTML = '<span class="empty-block">░░░░░░░░░░</span>';
      }
    }

    animateTo(targetPercent = 10) {
      clearInterval(this.animationTimer);
      let currentPercent = 0;
      this.render(0);

      this.animationTimer = setInterval(() => {
        currentPercent += 1;
        this.render(currentPercent);

        if (currentPercent >= targetPercent) {
          clearInterval(this.animationTimer);
        }
      }, 60);
    }

    reset() {
      clearInterval(this.animationTimer);
      this.render(0);
    }
  }

  class NarrativePlayer {
    constructor(onComplete) {
      this.container = document.getElementById('narrative-text');
      this.wandererNode = document.getElementById('wanderer-node');
      this.onComplete = onComplete;
      this.currentBeatIndex = 0;
      this.beatTimer = null;
      this.isFinished = false;
    }

    start() {
      this.isFinished = false;
      this.currentBeatIndex = 0;
      this.container.innerHTML = '';
      this.executeBeat();
    }

    advance() {
      if (this.isFinished) return;
      clearTimeout(this.beatTimer);
      this.removeActivePhrase();
      this.currentBeatIndex += 1;

      if (this.currentBeatIndex >= STORY_BEATS.length) {
        this.finish();
        return;
      }

      this.executeBeat();
    }

    finish() {
      if (this.isFinished) return;
      this.isFinished = true;
      clearTimeout(this.beatTimer);
      this.removeActivePhrase();
      this.onComplete();
    }

    executeBeat() {
      if (this.isFinished) return;
      const beat = STORY_BEATS[this.currentBeatIndex];
      if (!beat) {
        this.finish();
        return;
      }

      if (beat.type === 'ambient') {
        this.setWandererActive(true);
        this.beatTimer = setTimeout(() => this.advance(), beat.durationMs);
        return;
      }

      if (beat.type === 'pause') {
        this.setWandererActive(false);
        this.beatTimer = setTimeout(() => this.advance(), beat.durationMs);
        return;
      }

      this.setWandererActive(false);
      const phraseElement = this.createPhraseElement(beat.text, beat.visualClass);
      this.container.appendChild(phraseElement);
      ScreenReader.announce(beat.text);

      /* Micro-tick delay allows the browser to compute initial zero-opacity styles before transition */
      requestAnimationFrame(() => {
        phraseElement.classList.add('is-visible');
      });

      this.beatTimer = setTimeout(() => {
        this.dismissPhrase(phraseElement);
        this.beatTimer = setTimeout(() => this.advance(), beat.pauseAfterMs || 400);
      }, beat.displayDurationMs);
    }

    createPhraseElement(text, visualClass) {
      const phrase = document.createElement('div');
      phrase.className = `phrase-item ${visualClass}`;
      phrase.textContent = text;
      phrase.setAttribute('role', 'heading');
      phrase.setAttribute('aria-level', '2');
      return phrase;
    }

    dismissPhrase(phraseElement) {
      if (!phraseElement) return;
      phraseElement.classList.remove('is-visible');
      phraseElement.classList.add('is-leaving');
      setTimeout(() => phraseElement.remove(), 700);
    }

    removeActivePhrase() {
      const active = this.container.querySelector('.phrase-item.is-visible');
      if (active) {
        this.dismissPhrase(active);
      }
    }

    setWandererActive(isActive) {
      if (!this.wandererNode) return;
      this.wandererNode.classList.toggle('active', isActive);
    }
  }

  class ContactModal {
    constructor() {
      this.modal = document.getElementById('contact-modal');
      this.backdrop = document.getElementById('modal-backdrop');
      this.closeBtn = document.getElementById('modal-close-btn');
      this.triggerBtn = document.getElementById('contact-btn');
      this.form = document.getElementById('contact-form');
      this.nameInput = document.getElementById('contact-name');
      this.emailInput = document.getElementById('contact-email');
      this.messageInput = document.getElementById('contact-message');
      this.nameError = document.getElementById('name-error');
      this.emailError = document.getElementById('email-error');
      this.messageError = document.getElementById('message-error');
      this.errorBanner = document.getElementById('form-error-banner');
      this.errorText = document.getElementById('form-error-text');
      this.retryBtn = document.getElementById('form-retry-btn');
      this.submitBtn = document.getElementById('submit-btn');
      this.submitSpinner = document.getElementById('submit-spinner');
      this.submitBtnText = document.getElementById('submit-btn-text');
      this.submitArrowIcon = document.getElementById('submit-arrow-icon');
      this.successView = document.getElementById('modal-success-state');
      this.successDoneBtn = document.getElementById('success-done-btn');

      this.isOpenState = false;
      this.focusedElementBeforeOpen = null;

      this.bindEvents();
    }

    bindEvents() {
      if (this.triggerBtn) {
        this.triggerBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.open();
        });
      }

      if (this.closeBtn) {
        this.closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.close();
        });
      }

      if (this.backdrop) {
        this.backdrop.addEventListener('click', (e) => {
          e.stopPropagation();
          this.close();
        });
      }

      if (this.successDoneBtn) {
        this.successDoneBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.close();
        });
      }

      if (this.retryBtn) {
        this.retryBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.submit();
        });
      }

      if (this.form) {
        this.form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.submit();
        });
      }

      [this.nameInput, this.emailInput, this.messageInput].forEach(field => {
        if (!field) return;
        field.addEventListener('input', () => this.clearFieldErrors(field));
      });

      if (this.modal) {
        this.modal.addEventListener('keydown', (e) => this.handleKeydown(e));
      }
    }

    open() {
      if (!this.modal) return;
      this.isOpenState = true;
      this.focusedElementBeforeOpen = document.activeElement;

      this.clearAllErrors();
      this.hideErrorBanner();

      this.modal.classList.add('is-open');
      this.modal.setAttribute('aria-hidden', 'false');
      if (this.triggerBtn) this.triggerBtn.setAttribute('aria-expanded', 'true');
      document.body.classList.add('modal-active');

      setTimeout(() => {
        if (this.nameInput) this.nameInput.focus();
      }, 80);
    }

    close() {
      if (!this.modal || !this.isOpenState) return;
      this.isOpenState = false;

      this.modal.classList.remove('is-open');
      this.modal.setAttribute('aria-hidden', 'true');
      if (this.triggerBtn) this.triggerBtn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('modal-active');

      if (this.successView && !this.successView.classList.contains('hidden')) {
        setTimeout(() => {
          this.successView.classList.add('hidden');
          const subtitle = this.successView.querySelector('.success-subtitle');
          if (subtitle) subtitle.textContent = "Thanks for reaching out. We'll get back to you soon.";
          if (this.form) {
            this.form.classList.remove('hidden');
            this.form.reset();
          }
        }, 300);
      }

      if (this.focusedElementBeforeOpen && typeof this.focusedElementBeforeOpen.focus === 'function') {
        this.focusedElementBeforeOpen.focus();
      }
    }

    isOpen() {
      return this.isOpenState;
    }

    handleKeydown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
        return;
      }

      if (e.key === 'Tab') {
        this.trapFocus(e);
      }
    }

    trapFocus(e) {
      const focusable = this.modal.querySelectorAll(
        'button:not([disabled]):not(.hidden), input:not([disabled]):not(.hidden), textarea:not([disabled]):not(.hidden), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }

    clearFieldErrors(field) {
      field.classList.remove('input-invalid');
      field.removeAttribute('aria-invalid');
      const errorMap = {
        'contact-name': this.nameError,
        'contact-email': this.emailError,
        'contact-message': this.messageError
      };
      const errorEl = errorMap[field.id];
      if (errorEl) errorEl.textContent = '';
      this.hideErrorBanner();
    }

    clearAllErrors() {
      [this.nameInput, this.emailInput, this.messageInput].forEach(field => {
        if (field) {
          field.classList.remove('input-invalid');
          field.removeAttribute('aria-invalid');
        }
      });
      if (this.nameError) this.nameError.textContent = '';
      if (this.emailError) this.emailError.textContent = '';
      if (this.messageError) this.messageError.textContent = '';
    }

    hideErrorBanner() {
      if (this.errorBanner) this.errorBanner.classList.add('hidden');
    }

    validateEmailFormat(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    validate() {
      this.clearAllErrors();
      let firstInvalid = null;

      const nameVal = this.nameInput ? this.nameInput.value.trim() : '';
      if (!nameVal) {
        this.markInvalid(this.nameInput, this.nameError, 'Please enter your name.');
        firstInvalid = firstInvalid || this.nameInput;
      }

      const emailVal = this.emailInput ? this.emailInput.value.trim() : '';
      if (!emailVal) {
        this.markInvalid(this.emailInput, this.emailError, 'Please enter your email address.');
        firstInvalid = firstInvalid || this.emailInput;
      } else if (!this.validateEmailFormat(emailVal)) {
        this.markInvalid(this.emailInput, this.emailError, 'Please enter a valid email address.');
        firstInvalid = firstInvalid || this.emailInput;
      }

      const msgVal = this.messageInput ? this.messageInput.value.trim() : '';
      if (!msgVal) {
        this.markInvalid(this.messageInput, this.messageError, 'Please enter your question or message.');
        firstInvalid = firstInvalid || this.messageInput;
      } else if (msgVal.length < 5) {
        this.markInvalid(this.messageInput, this.messageError, 'Please enter at least 5 characters.');
        firstInvalid = firstInvalid || this.messageInput;
      }

      if (firstInvalid) {
        firstInvalid.focus();
        return false;
      }

      return true;
    }

    markInvalid(input, errorElement, message) {
      if (!input) return;
      input.classList.add('input-invalid');
      input.setAttribute('aria-invalid', 'true');
      if (errorElement) errorElement.textContent = message;
    }

    setLoading(isLoading) {
      if (!this.submitBtn) return;
      this.submitBtn.disabled = isLoading;
      this.submitSpinner.classList.toggle('hidden', !isLoading);
      this.submitArrowIcon.classList.toggle('hidden', isLoading);
      this.submitBtnText.textContent = isLoading ? 'Sending...' : 'Send Message';
    }

    showSuccess(customSubtitle) {
      if (this.form) this.form.classList.add('hidden');
      if (this.successView) {
        this.successView.classList.remove('hidden');
        if (customSubtitle) {
          const subtitle = this.successView.querySelector('.success-subtitle');
          if (subtitle) subtitle.textContent = customSubtitle;
        }
      }
      ScreenReader.announce("Message sent. Thanks for reaching out. We'll get back to you soon.");
      if (this.successDoneBtn) this.successDoneBtn.focus();
    }

    showError(message) {
      if (this.errorBanner && this.errorText) {
        this.errorText.textContent = message;
        this.errorBanner.classList.remove('hidden');
        if (this.retryBtn) this.retryBtn.focus();
      }
      ScreenReader.announce(`Error: ${message}`);
    }

    async submit() {
      if (!this.validate()) return;

      const config = window.COLLEGA_CONFIG || {
        contactEmail: 'contact@collega.lol',
        contactEndpoint: 'https://formsubmit.co/ajax/contact@collega.lol',
        emailSubject: 'New Question from COLLEGA.LOL Teaser',
        simulateOnLocalFile: true,
        simulateSubmission: false
      };

      const payload = {
        name: this.nameInput.value.trim(),
        email: this.emailInput.value.trim(),
        message: this.messageInput.value.trim(),
        _replyto: this.emailInput.value.trim(),
        _subject: config.emailSubject || 'New Question from COLLEGA.LOL Teaser',
        _template: 'table'
      };

      this.setLoading(true);
      this.hideErrorBanner();

      try {
        const isFileProtocol = window.location.protocol === 'file:';
        const isSimulated = config.simulateSubmission || (config.simulateOnLocalFile && isFileProtocol);

        if (isSimulated) {
          /* Local file:/// testing sends no origin header, which causes FormSubmit to block the request.
             We simulate success locally so the interface can be validated without running a web server. */
          await new Promise(resolve => setTimeout(resolve, 800));
          this.showSuccess("Thanks for reaching out. We'll get back to you soon.");
        } else {
          const response = await fetch(config.contactEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          const data = await response.json().catch(() => null);

          /* FormSubmit sends a 1-time activation confirmation on the first inquiry received by a new mailbox. */
          if (data && data.message && (data.message.includes('Activation') || data.message.includes('Activate'))) {
            this.showSuccess(`Activation email sent to ${config.contactEmail}. Please confirm it once in your inbox to enable instant forwarding!`);
            return;
          }

          if (!response.ok || (data && data.success === 'false')) {
            throw new Error((data && data.message) || `Submission failed with status: ${response.status}`);
          }

          this.showSuccess();
        }
      } catch (err) {
        this.showError(`Unable to send message right now. Please check your internet connection or email us directly at ${config.contactEmail}.`);
      } finally {
        this.setLoading(false);
      }
    }
  }

  class AmbientVisuals {
    constructor() {
      this.glow = document.getElementById('ambient-glow');
      this.canvas = document.getElementById('ambient-canvas');
      this.targetX = window.innerWidth / 2;
      this.targetY = window.innerHeight / 2;
      this.currentX = this.targetX;
      this.currentY = this.targetY;
      this.cursorTrail = [];
      this.maxTrailLength = 32;
    }

    init() {
      this.bindPointerTracking();
      this.startAmbientGlowLoop();
      this.initCanvasSimulation();
    }

    bindPointerTracking() {
      const handleMove = (x, y) => {
        this.targetX = x;
        this.targetY = y;
        this.cursorTrail.unshift({ x, y, age: 0 });
        if (this.cursorTrail.length > this.maxTrailLength) {
          this.cursorTrail.pop();
        }
      };

      window.addEventListener('mousemove', (e) => handleMove(e.clientX, e.clientY), { passive: true });
      window.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches[0]) {
          handleMove(e.touches[0].clientX, e.touches[0].clientY);
        }
      }, { passive: true });
    }

    startAmbientGlowLoop() {
      const updateGlow = () => {
        if (this.glow) {
          this.currentX += (this.targetX - this.currentX) * 0.1;
          this.currentY += (this.targetY - this.currentY) * 0.1;
          this.glow.style.left = `${this.currentX}px`;
          this.glow.style.top = `${this.currentY}px`;
        }
        requestAnimationFrame(updateGlow);
      };
      requestAnimationFrame(updateGlow);
    }

    initCanvasSimulation() {
      if (!this.canvas) return;
      const ctx = this.canvas.getContext('2d');
      if (!ctx) return;

      let width = (this.canvas.width = window.innerWidth);
      let height = (this.canvas.height = window.innerHeight);

      window.addEventListener('resize', () => {
        width = this.canvas.width = window.innerWidth;
        height = this.canvas.height = window.innerHeight;
      }, { passive: true });

      const particles = Array.from({ length: 24 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.5 + 0.5,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        baseAlpha: Math.random() * 0.4 + 0.15,
        pulseSpeed: Math.random() * 0.02 + 0.005
      }));

      const beacon = {
        x: width * 0.5,
        y: height * 0.5,
        targetX: width * 0.5,
        targetY: height * 0.5,
        trail: [],
        maxTrail: 16,
        timer: 0
      };

      const render = () => {
        /* Prevents unnecessary GPU execution when the browser tab is hidden in the background */
        if (document.hidden) {
          requestAnimationFrame(render);
          return;
        }

        ctx.clearRect(0, 0, width, height);

        // Render ambient starfield particles
        particles.forEach(p => {
          p.x = (p.x + p.vx + width) % width;
          p.y = (p.y + p.vy + height) % height;
          const alpha = Math.max(0.05, p.baseAlpha + Math.sin(Date.now() * p.pulseSpeed) * 0.15);

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.fill();
        });

        // Update & render wandering filament beacon
        beacon.timer += 1;
        if (beacon.timer % 120 === 0) {
          beacon.targetX = width * 0.2 + Math.random() * width * 0.6;
          beacon.targetY = height * 0.2 + Math.random() * height * 0.6;
        }
        beacon.x += (beacon.targetX - beacon.x) * 0.008;
        beacon.y += (beacon.targetY - beacon.y) * 0.008;
        beacon.trail.push({ x: beacon.x, y: beacon.y });
        if (beacon.trail.length > beacon.maxTrail) beacon.trail.shift();

        if (beacon.trail.length > 2) {
          ctx.beginPath();
          ctx.moveTo(beacon.trail[0].x, beacon.trail[0].y);
          for (let i = 1; i < beacon.trail.length; i++) {
            ctx.lineTo(beacon.trail[i].x, beacon.trail[i].y);
          }
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        // Render radiant cursor wave ribbon
        if (this.cursorTrail.length > 1) {
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          for (let i = 0; i < this.cursorTrail.length - 1; i++) {
            const current = this.cursorTrail[i];
            const next = this.cursorTrail[i + 1];
            current.age += 1;

            const progress = 1 - (i / this.cursorTrail.length);
            const alpha = progress * Math.max(0, 1 - (current.age / 38));
            if (alpha <= 0.02) continue;

            /* Compute normal vectors along segment path to project sinusoidal wave ripples */
            const deltaX = next.x - current.x;
            const deltaY = next.y - current.y;
            const distance = Math.hypot(deltaX, deltaY);
            const normalX = distance > 0 ? -deltaY / distance : 0;
            const normalY = distance > 0 ? deltaX / distance : 0;
            const waveOffset = Math.sin(Date.now() * 0.012 + i * 0.45) * (progress * 5);

            ctx.beginPath();
            ctx.moveTo(current.x + normalX * waveOffset, current.y + normalY * waveOffset);
            ctx.lineTo(next.x + normalX * waveOffset, next.y + normalY * waveOffset);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
            ctx.lineWidth = Math.max(1.2, progress * 4);
            ctx.shadowColor = '#FFFFFF';
            ctx.shadowBlur = progress * 14;
            ctx.stroke();
          }

          ctx.restore();

          while (this.cursorTrail.length > 0 && this.cursorTrail[this.cursorTrail.length - 1].age > 38) {
            this.cursorTrail.pop();
          }
        }

        requestAnimationFrame(render);
      };

      requestAnimationFrame(render);
    }
  }

  class TeaserApp {
    constructor() {
      this.stage = document.getElementById('teaser-stage');
      this.cinematicBox = document.getElementById('cinematic-box');
      this.brandSection = document.getElementById('brand-reveal-section');
      this.brandWordmark = document.getElementById('brand-wordmark');
      this.skipBtn = document.getElementById('skip-btn');
      this.replayBtn = document.getElementById('replay-btn');
      this.tapHint = document.getElementById('tap-hint');
      this.contactBtn = document.getElementById('contact-btn');
      this.yearSpan = document.getElementById('year');

      this.isRevealed = false;
      this.cookingIndicator = new CookingIndicator();
      this.contactModal = new ContactModal();
      this.visuals = new AmbientVisuals();
      this.narrative = new NarrativePlayer(() => this.triggerBrandReveal());

      this.init();
    }

    init() {
      if (this.yearSpan) {
        this.yearSpan.textContent = new Date().getFullYear();
      }

      this.bindUserInteractions();
      this.visuals.init();

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) {
        this.triggerBrandReveal();
      } else {
        this.narrative.start();
      }
    }

    triggerBrandReveal() {
      if (this.isRevealed) return;
      this.isRevealed = true;

      document.body.classList.add('final-state');
      ScreenReader.announce('COLLEGA.LOL. Something new is coming to campus. Something is cooking. Stay curious.');

      if (this.cinematicBox) {
        this.cinematicBox.classList.add('fade-away');
        setTimeout(() => {
          this.cinematicBox.style.display = 'none';
        }, 700);
      }

      if (this.brandSection) {
        this.brandSection.classList.remove('hidden');
        requestAnimationFrame(() => this.brandSection.classList.add('revealed'));
      }

      this.cookingIndicator.animateTo(10);

      if (this.skipBtn) this.skipBtn.classList.add('hidden');
      if (this.replayBtn) this.replayBtn.classList.remove('hidden');

      if (this.tapHint) this.tapHint.classList.add('hidden');
      if (this.contactBtn) this.contactBtn.classList.remove('hidden');
    }

    replay() {
      this.isRevealed = false;
      document.body.classList.remove('final-state');

      if (this.brandSection) {
        this.brandSection.classList.remove('revealed');
        this.brandSection.classList.add('hidden');
      }

      if (this.cinematicBox) {
        this.cinematicBox.style.display = 'flex';
        this.cinematicBox.classList.remove('fade-away');
      }

      if (this.skipBtn) this.skipBtn.classList.remove('hidden');
      if (this.replayBtn) this.replayBtn.classList.add('hidden');

      if (this.contactBtn) this.contactBtn.classList.add('hidden');
      if (this.tapHint) this.tapHint.classList.remove('hidden');

      this.cookingIndicator.reset();
      this.narrative.start();
    }

    bindUserInteractions() {
      this.stage.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.contact-modal')) return;
        if (!this.isRevealed) {
          this.narrative.advance();
        }
      });

      window.addEventListener('keydown', (e) => {
        if (this.contactModal.isOpen()) return;

        if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'Enter') {
          const isInteractive = document.activeElement && (
            document.activeElement.tagName === 'BUTTON' ||
            document.activeElement.tagName === 'INPUT' ||
            document.activeElement.tagName === 'TEXTAREA'
          );
          if (isInteractive) return;

          e.preventDefault();
          if (!this.isRevealed) {
            this.narrative.advance();
          } else if (e.code === 'Space' && this.brandWordmark) {
            this.brandWordmark.style.transform = 'scale(1.04)';
            setTimeout(() => {
              this.brandWordmark.style.transform = '';
            }, 300);
          }
        }
      });

      if (this.skipBtn) {
        this.skipBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.narrative.finish();
        });
      }

      if (this.replayBtn) {
        this.replayBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.replay();
        });
      }
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    document.body.classList.remove('loading');
    new TeaserApp();
  });
})();
