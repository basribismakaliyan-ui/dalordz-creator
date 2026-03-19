import { fetch as undiciFetch, ProxyAgent, Agent } from 'undici';
import { faker } from '@faker-js/faker';
import { randomChromeProfile } from './chrome-profiles.js';
import { CookieJar, generateUUID, generatePassword, randomBirthdate, randomDelay, makeTraceHeaders } from './helpers.js';
import { createTempEmail, createTempEmailFromGenerator, getVerificationCodeFromGenerator, addBlacklistDomain } from './email-generator.js';
import { getIMAPVerificationCode } from './imap.js';

const BASE_URL = 'https://chatgpt.com';
const AUTH_URL = 'https://auth.openai.com';

export class RegistrationClient {
  constructor(config = {}) {
    this.proxy = config.proxy || '';
    this.deviceId = generateUUID();
    this.cookieJar = new CookieJar();
    const profile = randomChromeProfile();
    this.ua = profile.ua;
    this.secChUa = profile.secChUa;
    this.fullVersion = profile.fullVersion;
    this.log = config.onLog || (() => {});

    this.dispatcher = this.proxy
      ? new ProxyAgent(this.proxy)
      : new Agent();

    this.cookieJar.addCookie('chatgpt.com', 'oai-did', this.deviceId);
  }

  getDefaultHeaders() {
    return {
      'User-Agent': this.ua,
      'Accept-Language': 'en-US,en;q=0.9',
      'sec-ch-ua': this.secChUa,
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
    };
  }

  async request(url, options = {}) {
    let currentUrl = url;
    let method = options.method || 'GET';
    let body = options.body;

    for (let redirectCount = 0; redirectCount < 15; redirectCount++) {
      const cookieStr = this.cookieJar.getCookieString(currentUrl);
      const headers = { ...this.getDefaultHeaders(), ...options.headers };
      if (cookieStr) headers['cookie'] = cookieStr;

      const resp = await undiciFetch(currentUrl, {
        method,
        headers,
        body,
        redirect: 'manual',
        dispatcher: this.dispatcher,
      });

      const setCookies = resp.headers.getSetCookie?.() || [];
      this.cookieJar.setCookiesFromHeaders(setCookies, currentUrl);

      if (resp.status >= 300 && resp.status < 400) {
        const location = resp.headers.get('location');
        if (location) {
          currentUrl = new URL(location, currentUrl).href;
          method = 'GET';
          body = undefined;
          try { await resp.text(); } catch (_) {}
          continue;
        }
      }

      resp.finalUrl = currentUrl;
      return resp;
    }
    throw new Error('Too many redirects');
  }

  async visitHomepage() {
    for (let retry = 0; retry < 3; retry++) {
      const resp = await this.request(BASE_URL + '/', {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Upgrade-Insecure-Requests': '1',
        },
      });
      this.log(`Visit Homepage (Try ${retry + 1})`, resp.status);
      const text = await resp.text();
      if (resp.status === 200 || resp.status === 302 || resp.status === 307) return;
      await randomDelay(1, 2);
    }
    throw new Error('Failed to visit homepage after 3 retries');
  }

  async getCSRF() {
    const resp = await this.request(BASE_URL + '/api/auth/csrf', {
      headers: { 'Accept': 'application/json', 'Referer': BASE_URL + '/' },
    });
    const text = await resp.text();
    const data = JSON.parse(text);
    this.log('Get CSRF', resp.status);
    if (!data.csrfToken) throw new Error('CSRF token not found');
    return data.csrfToken;
  }

  async signin(email, csrf) {
    const params = new URLSearchParams({
      prompt: 'login',
      'ext-oai-did': this.deviceId,
      auth_session_logging_id: generateUUID(),
      screen_hint: 'login_or_signup',
      login_hint: email,
    });

    const formData = new URLSearchParams({
      callbackUrl: BASE_URL + '/',
      csrfToken: csrf,
      json: 'true',
    });

    const resp = await this.request(BASE_URL + '/api/auth/signin/openai?' + params.toString(), {
      method: 'POST',
      body: formData.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Referer': BASE_URL + '/',
        'Origin': BASE_URL,
      },
    });

    const text = await resp.text();
    const data = JSON.parse(text);
    this.log('Signin', resp.status);
    if (!data.url) throw new Error('Authorize URL not found');
    return data.url;
  }

  async authorize(authURL) {
    const resp = await this.request(authURL, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': BASE_URL + '/',
        'Upgrade-Insecure-Requests': '1',
      },
    });
    await resp.text();
    this.log('Authorize', resp.status);
    return resp.finalUrl;
  }

  async register(email, password) {
    const payload = JSON.stringify({ username: email, password });
    const traceHeaders = makeTraceHeaders();

    const resp = await this.request(AUTH_URL + '/api/accounts/user/register', {
      method: 'POST',
      body: payload,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Referer': AUTH_URL + '/create-account/password',
        'Origin': AUTH_URL,
        ...traceHeaders,
      },
    });
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    this.log('Register', resp.status);
    return { status: resp.status, data };
  }

  async sendOTP() {
    try {
      const resp = await this.request(AUTH_URL + '/api/accounts/email-otp/send', {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer': AUTH_URL + '/create-account/password',
          'Upgrade-Insecure-Requests': '1',
        },
      });
      const text = await resp.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { text }; }
      this.log('Send OTP', resp.status);
      return { status: resp.status, data };
    } catch (e) {
      this.log(`Send OTP error (non-fatal): ${e.message}`, null);
      return { status: 0, data: {} };
    }
  }

  async validateOTP(code) {
    const payload = JSON.stringify({ code });
    const traceHeaders = makeTraceHeaders();

    const resp = await this.request(AUTH_URL + '/api/accounts/email-otp/validate', {
      method: 'POST',
      body: payload,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Referer': AUTH_URL + '/email-verification',
        'Origin': AUTH_URL,
        ...traceHeaders,
      },
    });
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    this.log(`Validate OTP [${code}]`, resp.status);
    return { status: resp.status, data };
  }

  async createAccount(name, birthdate) {
    const payload = JSON.stringify({ name, birthdate });
    const traceHeaders = makeTraceHeaders();

    const resp = await this.request(AUTH_URL + '/api/accounts/create_account', {
      method: 'POST',
      body: payload,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Referer': AUTH_URL + '/about-you',
        'Origin': AUTH_URL,
        ...traceHeaders,
      },
    });
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    this.log('Create Account', resp.status);
    return { status: resp.status, data };
  }

  async callback(cbURL) {
    if (!cbURL) throw new Error('Empty callback URL');
    const resp = await this.request(cbURL, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Upgrade-Insecure-Requests': '1',
      },
    });
    await resp.text();
    this.log('Callback', resp.status);
    return { status: resp.status, data: { final_url: resp.finalUrl } };
  }

  async runRegister(emailAddr, password, name, birthdate, imapEmail, imapPass) {
    this.log('Starting registration flow...', null);

    await this.visitHomepage();
    await randomDelay(0.3, 0.8);

    const csrf = await this.getCSRF();
    await randomDelay(0.2, 0.5);

    const authURLResult = await this.signin(emailAddr, csrf);
    await randomDelay(0.3, 0.8);

    const finalURL = await this.authorize(authURLResult);
    await randomDelay(0.3, 0.8);

    const urlObj = new URL(finalURL);
    const finalPath = urlObj.pathname;

    let needOTP = false;

    if (finalPath.includes('create-account/password')) {
      await randomDelay(0.5, 1.0);
      const reg = await this.register(emailAddr, password);
      if (reg.status !== 200) throw new Error(`Register failed (${reg.status}): ${JSON.stringify(reg.data)}`);
      await randomDelay(0.3, 0.8);
      await this.sendOTP();
      needOTP = true;
    } else if (finalPath.includes('email-verification') || finalPath.includes('email-otp')) {
      this.log('Jump to OTP verification stage', null);
      needOTP = true;
    } else if (finalPath.includes('about-you')) {
      this.log('Jump to fill information stage', null);
      await randomDelay(0.5, 1.0);
      const acc = await this.createAccount(name, birthdate);
      if (acc.status !== 200) throw new Error(`Create account failed (${acc.status})`);
      await randomDelay(0.3, 0.5);
      const cbURL = acc.data.continue_url || acc.data.url || acc.data.redirect_url || '';
      await this.callback(cbURL);
      return;
    } else if (finalPath.includes('callback') || finalURL.includes('chatgpt.com')) {
      this.log('Account registration completed', null);
      return;
    } else {
      this.log(`Unknown path: ${finalURL}`, null);
      await this.register(emailAddr, password);
      await this.sendOTP();
      needOTP = true;
    }

    if (needOTP) {
      let otpCode;
      if (imapEmail && imapPass) {
        this.log('Waiting for IMAP verification code...', null);
        otpCode = await getIMAPVerificationCode(emailAddr, imapEmail, imapPass, 20, 3000);
      } else {
        this.log('Waiting for Generator.email verification code...', null);
        otpCode = await getVerificationCodeFromGenerator(emailAddr, 20, 3000);
      }

      await randomDelay(0.3, 0.8);
      let result = await this.validateOTP(otpCode);

      if (result.status !== 200) {
        this.log('OTP failed, retrying...', null);
        await this.sendOTP();
        await randomDelay(1.0, 2.0);
        if (imapEmail && imapPass) {
          otpCode = await getIMAPVerificationCode(emailAddr, imapEmail, imapPass, 10, 3000);
        } else {
          otpCode = await getVerificationCodeFromGenerator(emailAddr, 10, 3000);
        }
        await randomDelay(0.3, 0.8);
        result = await this.validateOTP(otpCode);
        if (result.status !== 200) throw new Error(`OTP validation failed after retry (${result.status})`);
      }
    }

    await randomDelay(0.5, 1.5);
    const accResult = await this.createAccount(name, birthdate);
    if (accResult.status !== 200) throw new Error(`Create account failed (${accResult.status})`);

    await randomDelay(0.2, 0.5);
    const cbURL = accResult.data.continue_url || accResult.data.url || accResult.data.redirect_url || '';
    await this.callback(cbURL);
  }
}

export async function registerOneAccount(config, onLog) {
  const client = new RegistrationClient({
    proxy: config.proxy,
    onLog: (msg, status) => {
      const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
      const statusStr = status !== null ? ` | ${status}` : '';
      onLog(`[${ts}] ${msg}${statusStr}`);
    },
  });

  let emailAddr;
  if (config.domain) {
    emailAddr = createTempEmail(config.domain);
  } else {
    emailAddr = await createTempEmailFromGenerator();
  }

  const password = config.defaultPassword || generatePassword(14);
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const birthdate = randomBirthdate();

  onLog(`[${new Date().toLocaleTimeString('en-US', { hour12: false })}] Email: ${emailAddr}`);

  await client.runRegister(emailAddr, password, `${firstName} ${lastName}`, birthdate, config.imapEmail, config.imapPassword);

  return { email: emailAddr, password };
}
