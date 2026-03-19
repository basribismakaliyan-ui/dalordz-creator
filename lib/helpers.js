import { randomBytes } from 'crypto';

export function generateUUID() {
  return crypto.randomUUID();
}

export function randStr(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export function generatePassword(length = 14) {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%^&*';
  const all = upper + lower + digits + special;

  let password = '';
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  password += special[Math.floor(Math.random() * special.length)];

  for (let i = 4; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  return password.split('').sort(() => Math.random() - 0.5).join('');
}

export function randomBirthdate() {
  const year = 1985 + Math.floor(Math.random() * 15);
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function randomDelay(low, high) {
  const delay = low + Math.random() * (high - low);
  return new Promise(resolve => setTimeout(resolve, delay * 1000));
}

export function makeTraceHeaders() {
  const traceId = randomBytes(16).toString('hex');
  const spanId = randomBytes(8).toString('hex');
  return {
    'x-datadog-trace-id': traceId,
    'x-datadog-parent-id': spanId,
    'x-datadog-sampling-priority': '1',
    'x-datadog-origin': 'rum',
  };
}

export class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  setCookiesFromHeaders(setCookieHeaders, requestUrl) {
    if (!setCookieHeaders || setCookieHeaders.length === 0) return;
    for (const header of setCookieHeaders) {
      this._parseCookie(header, requestUrl);
    }
  }

  _parseCookie(setCookieStr, requestUrl) {
    const parts = setCookieStr.split(';');
    const [nameValue] = parts;
    const eqIdx = nameValue.indexOf('=');
    if (eqIdx === -1) return;

    const name = nameValue.substring(0, eqIdx).trim();
    const value = nameValue.substring(eqIdx + 1).trim();

    let domain = new URL(requestUrl).hostname;
    let path = '/';

    for (const attr of parts.slice(1)) {
      const [key, val] = attr.split('=');
      const k = key.trim().toLowerCase();
      if (k === 'domain' && val) domain = val.trim().replace(/^\./, '');
      if (k === 'path' && val) path = val.trim();
    }

    if (!this.cookies.has(domain)) this.cookies.set(domain, new Map());
    this.cookies.get(domain).set(name, { value, path, domain });
  }

  getCookieString(requestUrl) {
    const hostname = new URL(requestUrl).hostname;
    const pathname = new URL(requestUrl).pathname;
    const pairs = [];

    for (const [domain, cookies] of this.cookies) {
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        for (const [name, cookie] of cookies) {
          if (pathname.startsWith(cookie.path)) {
            pairs.push(`${name}=${cookie.value}`);
          }
        }
      }
    }
    return pairs.join('; ');
  }

  addCookie(domain, name, value, path = '/') {
    if (!this.cookies.has(domain)) this.cookies.set(domain, new Map());
    this.cookies.get(domain).set(name, { value, path, domain });
  }
}
