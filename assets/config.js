/* HRMO demo settings.
 *
 * feedback.endpoint  where the feedback form posts to. Leave empty to keep feedback in the
 *                    tester's browser only (they can still copy it or send it from their own mail app).
 *                    Works with form-to-email services that accept a JSON POST, for example
 *                    Formspree:  https://formspree.io/f/<form id>
 *                    Web3Forms:  https://api.web3forms.com/submit  (also set accessKey)
 * feedback.accessKey only for services that need a public access key in the request.
 *
 * feedback.email     address that "Send by e-mail" opens a message to, from the tester's own mail app.
 */
window.HRMO_CONFIG = {
  feedback: {
    email: 'mahassira@outlook.com',
    endpoint: '',
    accessKey: ''
  }
};
