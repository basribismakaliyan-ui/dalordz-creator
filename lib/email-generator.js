import { faker } from '@faker-js/faker';
import * as cheerio from 'cheerio';
import { randStr } from './helpers.js';

const blacklistedDomains = new Set();

export function addBlacklistDomain(domain) {
  blacklistedDomains.add(domain);
}

export function createTempEmail(defaultDomain) {
  const firstName = faker.person.firstName().toLowerCase();
  const lastName = faker.person.lastName().toLowerCase();
  const random = randStr(5);
  const email = `${firstName}${lastName}${random}@${defaultDomain}`;
  return email;
}

export async function createTempEmailFromGenerator() {
  const defaultDomains = ['smartmail.de', 'enayu.com', 'crazymailing.com'];

  try {
    const resp = await fetch('https://generator.email/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (resp.ok) {
      const html = await resp.text();
      const $ = cheerio.load(html);
      $('.e7m.tt-suggestions div > p').each((i, el) => {
        const domain = $(el).text().trim();
        if (domain && !blacklistedDomains.has(domain)) {
          defaultDomains.push(domain);
        }
      });
    }
  } catch (e) {
    // Use fallback domains
  }

  const availableDomains = defaultDomains.filter(d => !blacklistedDomains.has(d));
  if (availableDomains.length === 0) throw new Error('All domains blacklisted');

  const domain = availableDomains[Math.floor(Math.random() * availableDomains.length)];
  const firstName = faker.person.firstName().toLowerCase();
  const lastName = faker.person.lastName().toLowerCase();
  return `${firstName}${lastName}${randStr(5)}@${domain}`;
}

export async function getVerificationCodeFromGenerator(email, maxRetries = 20, delayMs = 3000) {
  const [username, domain] = email.split('@');
  const codeRegex = /\b\d{6}\b/g;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const url = `https://generator.email/${domain}/${username}`;
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cookie': `surl=${domain}/${username}`,
        },
      });

      if (resp.ok) {
        const html = await resp.text();
        const $ = cheerio.load(html);
        let otp = '';

        $('#email-table > div.e7m.list-group-item.list-group-item-info > div.e7m.subj_div_45g45gg').each((i, el) => {
          const text = $(el).text();
          const matches = text.match(codeRegex);
          if (matches) {
            for (const m of matches) {
              if (m !== '177010') {
                otp = m;
                return false;
              }
            }
          }
        });

        if (otp) return otp;
      }
    } catch (e) {
      // continue retrying
    }

    await new Promise(r => setTimeout(r, delayMs));
  }

  throw new Error(`Failed to get verification code after ${maxRetries} retries`);
}
