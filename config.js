window.COLLEGA_CONFIG = Object.freeze({
  contactEmail: 'contact@collega.lol',
  contactEndpoint: 'https://formsubmit.co/ajax/contact@collega.lol',
  emailSubject: 'New Question from COLLEGA.LOL Teaser',
  /* FormSubmit requires http/https origin headers. Local file:/// execution triggers CORS blocks,
     so simulation ensures seamless offline testing during development. */
  simulateOnLocalFile: true,
  simulateSubmission: false
});
