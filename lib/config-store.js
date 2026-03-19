// In-memory config store with env var defaults
let adminConfig = {
  proxy: process.env.ADMIN_PROXY || '',
  email: process.env.ADMIN_EMAIL || '',
  appPassword: process.env.ADMIN_APP_PASSWORD || '',
  domain: process.env.ADMIN_DOMAIN || '',
  defaultPassword: process.env.ADMIN_DEFAULT_PASSWORD || '',
};

export function getAdminConfig() {
  return { ...adminConfig };
}

export function setAdminConfig(newConfig) {
  adminConfig = { ...adminConfig, ...newConfig };
  return { ...adminConfig };
}
