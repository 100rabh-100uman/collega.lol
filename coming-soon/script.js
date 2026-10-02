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
  const contactBtn = document.getElementById('contact-btn');
  const yearSpan = document.getElementById('year');
  const progressBarChars = document.getElementById('progress-bar-chars');
  const progressPercent = document.getElementById('progress-percent');

  // Contact Form Modal Elements
  const contactModal = document.getElementById('contact-modal');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const contactForm = document.getElementById('contact-form');
  const contactName = document.getElementById('contact-name');
  const contactEmail = document.getElementById('contact-email');
  const contactMessage = document.getElementById('contact-message');
  const nameError = document.getElementById('name-error');
  const emailError = document.getElementById('email-error');
  const messageError = document.getElementById('message-error');
  const formErrorBanner = document.getElementById('form-error-banner');
  const formErrorText = document.getElementById('form-error-text');
  const formRetryBtn = document.getElementById('form-retry-btn');
  const submitBtn = document.getElementById('submit-btn');
  const submitSpinner = document.getElementById('submit-spinner');
  const submitBtnText = document.getElementById('submit-btn-text');
  const submitArrowIcon = document.getElementById('submit-arrow-icon');
  const modalSuccessState = document.getElementById('modal-success-state');
  const successDoneBtn = document.getElementById('success-done-btn');

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

    // Activate stable/final state background (desk.png / mob.png)
    document.body.classList.add('final-state');

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

    // Switch bottom-left element: remove "Something is cooking. Stay curious." and activate Contact CTA
    if (tapHint) {
      tapHint.classList.add('hidden');
    }
    if (contactBtn) {
      contactBtn.classList.remove('hidden');
    }
  }

  /**
   * Cooking Progress Animation (Battery Charging up to 10%)
   */
  function animateCookingProgress() {
    if (!progressBarChars || !progressPercent) return;
    
    let currentPct = 0;
    const targetPct = 10;

    // Start with 0% empty battery state
    progressBarChars.innerHTML = '<span class="empty-block">░░░░░░░░░░</span>';
    progressPercent.textContent = '0%';

    const interval = setInterval(() => {
      currentPct += 1;
      if (currentPct >= targetPct) {
        currentPct = targetPct;
        clearInterval(interval);
        // Active 10% charged block with continuous battery charging animation
        progressBarChars.innerHTML = '<span class="charging-block">█</span><span class="empty-block">░░░░░░░░░</span>';
        progressPercent.textContent = '10%';
        return;
      }

      progressPercent.textContent = currentPct + '%';
    }, 60);
  }

  /**
   * Restart / Replay Experience
   */
  function replayExperience() {
    clearTimeout(beatTimer);
    isSequenceFinished = false;
    currentBeatIndex = 0;

    // Reset background to intro state
    document.body.classList.remove('final-state');

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

    if (contactBtn) {
      contactBtn.classList.add('hidden');
    }
    if (tapHint) {
      tapHint.classList.remove('hidden');
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
    // Avoid double triggering if clicking interactive buttons or inside contact modal
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.contact-modal')) return;

    if (!isSequenceFinished) {
      advanceBeat();
    }
  });

  window.addEventListener('keydown', (e) => {
    // If contact modal is open, let Escape close it and prevent teaser events
    if (isModalOpen) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeContactModal();
      }
      return;
    }

    if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'Enter') {
      if (document.activeElement && (document.activeElement.tagName === 'BUTTON' || document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        return; // Allow button and input element default key handlers
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
     Contact Modal & Form Engine
     ========================================================================== */
  let isModalOpen = false;
  let previousActiveElement = null;

  function openContactModal() {
    if (!contactModal) return;
    isModalOpen = true;
    previousActiveElement = document.activeElement;

    // Reset error states
    clearValidationErrors();
    if (formErrorBanner) formErrorBanner.classList.add('hidden');

    // Show modal
    contactModal.classList.add('is-open');
    contactModal.setAttribute('aria-hidden', 'false');
    if (contactBtn) contactBtn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('modal-active');

    // Focus first input field after animation begins
    setTimeout(() => {
      if (contactName) {
        contactName.focus();
      }
    }, 80);
  }

  function closeContactModal() {
    if (!contactModal || !isModalOpen) return;
    isModalOpen = false;

    contactModal.classList.remove('is-open');
    contactModal.setAttribute('aria-hidden', 'true');
    if (contactBtn) contactBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('modal-active');

    // If success view was showing, reset form back to clean state
    if (modalSuccessState && !modalSuccessState.classList.contains('hidden')) {
      setTimeout(() => {
        modalSuccessState.classList.add('hidden');
        const subEl = modalSuccessState.querySelector('.success-subtitle');
        if (subEl) subEl.textContent = "Thanks for reaching out. We'll get back to you soon.";
        if (contactForm) {
          contactForm.classList.remove('hidden');
          contactForm.reset();
        }
      }, 300);
    }

    // Restore focus to button that opened modal
    if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
      previousActiveElement.focus();
    } else if (contactBtn) {
      contactBtn.focus();
    }
  }

  function clearValidationErrors() {
    [contactName, contactEmail, contactMessage].forEach(input => {
      if (input) {
        input.classList.remove('input-invalid');
        input.removeAttribute('aria-invalid');
      }
    });
    if (nameError) nameError.textContent = '';
    if (emailError) emailError.textContent = '';
    if (messageError) messageError.textContent = '';
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validateForm() {
    clearValidationErrors();
    let isValid = true;
    let firstInvalidField = null;

    // Validate Name
    const nameVal = contactName ? contactName.value.trim() : '';
    if (!nameVal) {
      isValid = false;
      contactName.classList.add('input-invalid');
      contactName.setAttribute('aria-invalid', 'true');
      if (nameError) nameError.textContent = 'Please enter your name.';
      if (!firstInvalidField) firstInvalidField = contactName;
    }

    // Validate Email
    const emailVal = contactEmail ? contactEmail.value.trim() : '';
    if (!emailVal) {
      isValid = false;
      contactEmail.classList.add('input-invalid');
      contactEmail.setAttribute('aria-invalid', 'true');
      if (emailError) emailError.textContent = 'Please enter your email address.';
      if (!firstInvalidField) firstInvalidField = contactEmail;
    } else if (!validateEmail(emailVal)) {
      isValid = false;
      contactEmail.classList.add('input-invalid');
      contactEmail.setAttribute('aria-invalid', 'true');
      if (emailError) emailError.textContent = 'Please enter a valid email address.';
      if (!firstInvalidField) firstInvalidField = contactEmail;
    }

    // Validate Question / Message
    const msgVal = contactMessage ? contactMessage.value.trim() : '';
    if (!msgVal) {
      isValid = false;
      contactMessage.classList.add('input-invalid');
      contactMessage.setAttribute('aria-invalid', 'true');
      if (messageError) messageError.textContent = 'Please enter your question or message.';
      if (!firstInvalidField) firstInvalidField = contactMessage;
    } else if (msgVal.length < 5) {
      isValid = false;
      contactMessage.classList.add('input-invalid');
      contactMessage.setAttribute('aria-invalid', 'true');
      if (messageError) messageError.textContent = 'Please enter at least 5 characters.';
      if (!firstInvalidField) firstInvalidField = contactMessage;
    }

    if (firstInvalidField) {
      firstInvalidField.focus();
    }

    return isValid;
  }

  function setSubmittingState(isSubmitting) {
    if (!submitBtn) return;
    submitBtn.disabled = isSubmitting;
    if (isSubmitting) {
      if (submitSpinner) submitSpinner.classList.remove('hidden');
      if (submitBtnText) submitBtnText.textContent = 'Sending...';
      if (submitArrowIcon) submitArrowIcon.classList.add('hidden');
    } else {
      if (submitSpinner) submitSpinner.classList.add('hidden');
      if (submitBtnText) submitBtnText.textContent = 'Send Message';
      if (submitArrowIcon) submitArrowIcon.classList.remove('hidden');
    }
  }

  function showSuccessState(customSubtitle) {
    if (contactForm) contactForm.classList.add('hidden');
    if (modalSuccessState) {
      modalSuccessState.classList.remove('hidden');
      const subEl = modalSuccessState.querySelector('.success-subtitle');
      if (subEl) {
        subEl.textContent = customSubtitle || "Thanks for reaching out. We'll get back to you soon.";
      }
    }
    announceToScreenReader("Message sent. Thanks for reaching out. We'll get back to you soon.");
    if (successDoneBtn) {
      successDoneBtn.focus();
    }
  }

  function showErrorState(msg) {
    if (formErrorBanner && formErrorText) {
      formErrorText.textContent = msg;
      formErrorBanner.classList.remove('hidden');
      if (formRetryBtn) {
        formRetryBtn.focus();
      }
    }
    announceToScreenReader('Error: ' + msg);
  }

  async function handleContactSubmit(e) {
    if (e) e.preventDefault();

    if (!validateForm()) return;

    const config = window.COLLEGA_CONFIG || {
      contactEmail: 'contact@collega.lol',
      contactEndpoint: 'https://formsubmit.co/ajax/contact@collega.lol',
      emailSubject: 'New Question from COLLEGA.LOL Teaser',
      simulateOnLocalFile: true,
      simulateSubmission: false
    };

    const name = contactName.value.trim();
    const email = contactEmail.value.trim();
    const message = contactMessage.value.trim();

    setSubmittingState(true);
    if (formErrorBanner) formErrorBanner.classList.add('hidden');

    try {
      const isFileProtocol = window.location.protocol === 'file:';
      const shouldSimulate = config.simulateSubmission || (config.simulateOnLocalFile && isFileProtocol);

      if (shouldSimulate) {
        // FormSubmit requires http/https origin and blocks file:// protocol.
        // Simulate a smooth delivery transition during local file preview.
        console.log('[COLLEGA.LOL] Local preview submission intercepted:', { name, email, message });
        await new Promise(resolve => setTimeout(resolve, 800));
        showSuccessState("Thanks for reaching out. We'll get back to you soon.");
      } else {
        const payload = {
          name: name,
          email: email,
          message: message,
          _replyto: email,
          _subject: config.emailSubject || 'New Question from COLLEGA.LOL Teaser',
          _template: 'table'
        };

        const response = await fetch(config.contactEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => null);

        // Check if FormSubmit sent the initial 1-time activation confirmation email
        if (data && data.message && (data.message.includes('Activation') || data.message.includes('Activate'))) {
          showSuccessState("Activation email sent to " + (config.contactEmail || "contact@collega.lol") + ". Please check your inbox and click 'Activate Form' once to enable live delivery!");
          return;
        }

        if (!response.ok || (data && (data.success === 'false' || data.success === false))) {
          throw new Error((data && data.message) || `Submission failed with status: ${response.status}`);
        }

        showSuccessState();
      }

    } catch (err) {
      console.error('[COLLEGA Contact] Submission error:', err);
      showErrorState(
        'Unable to send message right now. Please check your internet connection or email us directly at ' +
        (config.contactEmail || 'contact@collega.lol') + '.'
      );
    } finally {
      setSubmittingState(false);
    }
  }

  // Clear validation errors dynamically on input
  [contactName, contactEmail, contactMessage].forEach(field => {
    if (field) {
      field.addEventListener('input', () => {
        if (field.classList.contains('input-invalid')) {
          field.classList.remove('input-invalid');
          field.removeAttribute('aria-invalid');
          const errorId = field.id.replace('contact-', '') + '-error';
          const errEl = document.getElementById(errorId);
          if (errEl) errEl.textContent = '';
        }
        if (formErrorBanner && !formErrorBanner.classList.contains('hidden')) {
          formErrorBanner.classList.add('hidden');
        }
      });
    }
  });

  // Modal event listeners
  if (contactBtn) {
    contactBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openContactModal();
    });
  }

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeContactModal();
    });
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      e.stopPropagation();
      closeContactModal();
    });
  }

  if (successDoneBtn) {
    successDoneBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeContactModal();
    });
  }

  if (formRetryBtn) {
    formRetryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleContactSubmit();
    });
  }

  if (contactForm) {
    contactForm.addEventListener('submit', handleContactSubmit);
  }

  // Focus trapping inside modal
  if (contactModal) {
    contactModal.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const focusableElements = contactModal.querySelectorAll(
          'button:not([disabled]):not(.hidden), input:not([disabled]):not(.hidden), textarea:not([disabled]):not(.hidden), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    });
  }

  /* ==========================================================================
     Ambient Cursor Following White Glow & Wave Trail
     ========================================================================== */
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let targetX = mouseX;
  let targetY = mouseY;
  let isPointerMoving = false;

  // Luminous white cursor wave trail
  const cursorTrail = [];
  const maxTrailLength = 32;

  function handlePointerMove(clientX, clientY) {
    targetX = clientX;
    targetY = clientY;
    isPointerMoving = true;

    // Add position to white cursor wave trail
    cursorTrail.unshift({
      x: clientX,
      y: clientY,
      age: 0
    });
    if (cursorTrail.length > maxTrailLength) {
      cursorTrail.pop();
    }
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
     Lightweight Ambient Canvas: White cursor wave, stars & wandering line
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

    // Restrained particle count: 24 tiny soft white particles
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

    // Wandering luminous filament beacon in white
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

      // Render soft white particles
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
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx.fill();
      }

      // Render subtle drifting filament beacon in crisp white
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
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // Render interactive luminous white wave trailing the cursor
      if (cursorTrail.length > 1) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let i = 0; i < cursorTrail.length - 1; i++) {
          const pt = cursorTrail[i];
          const nextPt = cursorTrail[i + 1];
          pt.age += 1;

          const progress = 1 - (i / cursorTrail.length);
          const lifeAlpha = Math.max(0, 1 - (pt.age / 38));
          const alpha = progress * lifeAlpha;

          if (alpha <= 0.02) continue;

          // Wave lateral displacement
          const dx = nextPt.x - pt.x;
          const dy = nextPt.y - pt.y;
          const dist = Math.hypot(dx, dy);
          const nx = dist > 0 ? -dy / dist : 0;
          const ny = dist > 0 ? dx / dist : 0;

          // Undulating wave ripple
          const wave = Math.sin(Date.now() * 0.012 + i * 0.45) * (progress * 5);

          const x1 = pt.x + nx * wave;
          const y1 = pt.y + ny * wave;
          const x2 = nextPt.x + nx * wave;
          const y2 = nextPt.y + ny * wave;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);

          // Pure glowing white wave stroke
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
          ctx.lineWidth = Math.max(1.2, progress * 4);
          ctx.shadowColor = '#FFFFFF';
          ctx.shadowBlur = progress * 14;
          ctx.stroke();
        }
        ctx.restore();

        // Prune old trail points
        while (cursorTrail.length > 0 && cursorTrail[cursorTrail.length - 1].age > 38) {
          cursorTrail.pop();
        }
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
