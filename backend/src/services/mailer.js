const nodemailer = require('nodemailer');
const { BREVO_API_KEY, MAIL_FROM, MAIL_MODE, SMTP } = require('../config');

const COPY = {
  register: {
    subject: 'Tu código para crear tu cuenta en Hallado',
    intro: 'Usá este código para crear tu cuenta en Hallado:',
  },
  reset: {
    subject: 'Tu código para recuperar tu contraseña de Hallado',
    intro: 'Usá este código para recuperar tu contraseña de Hallado:',
  },
};

// Pura: arma asunto y cuerpos. El código son 6 dígitos (los genera el servidor), por eso no hace falta escapar HTML.
function buildOtpEmail(code, purpose) {
  const { subject, intro } = COPY[purpose] || COPY.register;
  const footer = 'Vence en 10 minutos. Si no lo pediste, ignorá este mensaje: nadie puede usarlo sin tu email.';
  return {
    subject,
    textContent: `${intro} ${code}\n\n${footer}`,
    htmlContent:
      `<p>${intro}</p>` +
      `<p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p>` +
      `<p>${footer}</p>`,
  };
}

let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP.host,
      port: SMTP.port,
      secure: SMTP.secure,
      auth: { user: SMTP.user, pass: SMTP.pass },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 8000,
    });
  }
  return transporter;
}

function makeSmtpSender(transporter, from) {
  return async (to, { subject, textContent, htmlContent }) =>
    transporter.sendMail({ from: `"Hallado" <${from}>`, to, subject, text: textContent, html: htmlContent });
}

async function sendViaSmtp(to, content) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('SMTP timeout')), 7000);
  });
  try {
    await Promise.race([makeSmtpSender(getTransporter(), MAIL_FROM)(to, content), timeout]);
  } catch (err) {
    if (err && err.message === 'SMTP timeout') throw err;
    // Solo el código: message/response/command pueden traer datos de la cuenta.
    throw new Error('SMTP ' + ((err && (err.code || err.responseCode)) || 'error'));
  } finally {
    clearTimeout(timer);
  }
}

async function sendOtpEmail(to, code, purpose) {
  if (MAIL_MODE === 'console') {
    console.log('[MAIL DEV] código ' + purpose + ' para ' + to + ': ' + code);
    return;
  }
  const { subject, textContent, htmlContent } = buildOtpEmail(code, purpose);
  if (MAIL_MODE === 'smtp') {
    await sendViaSmtp(to, { subject, textContent, htmlContent });
    console.log('[MAIL] enviado a ' + to);
    return;
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Hallado', email: MAIL_FROM },
      to: [{ email: to }],
      subject,
      textContent,
      htmlContent,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error('Brevo ' + res.status);
  console.log('[MAIL] enviado a ' + to);
}

module.exports = { sendOtpEmail, buildOtpEmail, makeSmtpSender };
