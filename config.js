/**
 * COLLEGA.LOL — Contact & Service Configuration
 * ==============================================
 * Centralized, isolated configuration for external services.
 * Compatible with static site hosting (Vercel, Cloudflare Pages, GitHub Pages, Netlify).
 */

window.COLLEGA_CONFIG = {
  // Official COLLEGA work email destination
  contactEmail: 'contact@collega.lol',

  // Form submission endpoint.
  // By default, uses FormSubmit.co's free AJAX gateway which routes directly to contact@collega.lol
  // with reply-to automatically configured to the sender's email.
  contactEndpoint: 'https://formsubmit.co/ajax/contact@collega.lol',

  // Email subject line for incoming questions
  emailSubject: 'New Question from COLLEGA.LOL Teaser',

  // Enables seamless simulated success when index.html is opened directly as a local file (file:///),
  // avoiding browser file-protocol CORS blocks.
  simulateOnLocalFile: true,

  // Force simulation even on web servers for offline UI testing
  simulateSubmission: false
};
