import nodemailer from 'nodemailer';

// Cache created Ethereal test accounts per smtp_user to avoid recreating
const transporterCache = new Map<string, nodemailer.Transporter>();

/**
 * Create (or reuse cached) nodemailer transporter for an Ethereal SMTP account.
 */
export function getTransporter(smtpUser: string, smtpPass: string): nodemailer.Transporter {
  if (transporterCache.has(smtpUser)) {
    return transporterCache.get(smtpUser)!;
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  transporterCache.set(smtpUser, transporter);
  return transporter;
}

/**
 * Create a new Ethereal test account and return its credentials.
 * Used when registering a new sender.
 */
export async function createEtherealAccount(): Promise<{
  email: string;
  name: string;
  smtp_user: string;
  smtp_pass: string;
}> {
  const testAccount = await nodemailer.createTestAccount();
  return {
    email: testAccount.user,
    name: `Sender <${testAccount.user}>`,
    smtp_user: testAccount.user,
    smtp_pass: testAccount.pass,
  };
}

/**
 * Send an email via Ethereal SMTP.
 * Returns the message ID and preview URL.
 */
export async function sendEmail(
  smtpUser: string,
  smtpPass: string,
  fromEmail: string,
  toEmail: string,
  subject: string,
  body: string
): Promise<{ messageId: string; previewUrl: string }> {
  const transporter = getTransporter(smtpUser, smtpPass);

  const info = await transporter.sendMail({
    from: fromEmail,
    to: toEmail,
    subject,
    text: body,
    html: `<p>${body.replace(/\n/g, '<br/>')}</p>`,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || '';
  console.log(`📧 Email sent to ${toEmail} | Preview: ${previewUrl}`);

  return {
    messageId: info.messageId,
    previewUrl,
  };
}
