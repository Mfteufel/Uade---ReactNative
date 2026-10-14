const { BREVO_API_KEY, MAIL_FROM, mailConfigured } = require('../config');

async function sendOtpEmail(to, code, purpose) {
  if (!mailConfigured) {
    console.log('[MAIL DEV] código ' + purpose + ' para ' + to + ': ' + code);
    return;
  }
  const textContent = `Tu código de Hallado es ${code}. Vence en 10 minutos. Si no lo pediste, ignorá este mensaje.`;
  const htmlContent =
    `<p>Tu código de Hallado es:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p>` +
    `<p>Vence en 10 minutos. Si no lo pediste, ignorá este mensaje.</p>`;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Hallado', email: MAIL_FROM },
      to: [{ email: to }],
      subject: 'Tu código de Hallado',
      textContent,
      htmlContent,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error('Brevo ' + res.status);
  console.log('[MAIL] enviado a ' + to);
}

module.exports = { sendOtpEmail };
