const CHROME_PROFILES = [
  { major: 131, full: '131.0.6778.85', secChUa: '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"' },
  { major: 130, full: '130.0.6723.116', secChUa: '"Google Chrome";v="130", "Chromium";v="130", "Not_A Brand";v="24"' },
  { major: 129, full: '129.0.6668.100', secChUa: '"Google Chrome";v="129", "Chromium";v="129", "Not_A Brand";v="24"' },
  { major: 128, full: '128.0.6613.137', secChUa: '"Google Chrome";v="128", "Chromium";v="128", "Not_A Brand";v="24"' },
  { major: 127, full: '127.0.6533.119', secChUa: '"Google Chrome";v="127", "Chromium";v="127", "Not_A Brand";v="24"' },
  { major: 126, full: '126.0.6478.126', secChUa: '"Google Chrome";v="126", "Chromium";v="126", "Not_A Brand";v="8"' },
  { major: 125, full: '125.0.6422.141', secChUa: '"Google Chrome";v="125", "Chromium";v="125", "Not_A Brand";v="24"' },
  { major: 124, full: '124.0.6367.201', secChUa: '"Google Chrome";v="124", "Chromium";v="124", "Not_A Brand";v="24"' },
];

export function randomChromeProfile() {
  const profile = CHROME_PROFILES[Math.floor(Math.random() * CHROME_PROFILES.length)];
  const ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${profile.full} Safari/537.36`;
  return {
    major: profile.major,
    fullVersion: profile.full,
    ua,
    secChUa: profile.secChUa,
  };
}
