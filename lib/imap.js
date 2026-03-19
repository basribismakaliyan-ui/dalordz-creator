import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

const codeRegex = /\b\d{6}\b/g;

function extractCode(text) {
  if (!text) return null;
  const matches = text.match(codeRegex);
  if (matches) {
    for (const m of matches) {
      if (m !== '177010') return m;
    }
  }
  return null;
}

async function fetchCodeOnce(targetEmail, imapUser, imapPass) {
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: imapUser, pass: imapPass },
    logger: false,
    tls: { rejectUnauthorized: true },
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      const messages = await client.search({ unseen: true, to: targetEmail });

      if (!messages || messages.length === 0) {
        return null;
      }

      for (const uid of messages) {
        const msg = await client.fetchOne(uid, { source: true });
        if (!msg || !msg.source) continue;

        const parsed = await simpleParser(msg.source);
        const textBody = parsed.text || '';
        const htmlBody = parsed.html || '';

        let code = extractCode(textBody);
        if (!code) code = extractCode(htmlBody);

        if (code) {
          await client.messageFlagsAdd(uid, ['\\Seen']);
          return code;
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (e) {
    try { await client.logout(); } catch (_) {}
    throw e;
  }

  return null;
}

export async function getIMAPVerificationCode(targetEmail, imapUser, imapPass, maxRetries = 20, delayMs = 3000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const code = await fetchCodeOnce(targetEmail, imapUser, imapPass);
      if (code) return code;
    } catch (e) {
      // retry
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  throw new Error(`Failed to get IMAP verification code after ${maxRetries} retries`);
}
