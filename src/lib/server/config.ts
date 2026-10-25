// Which integrations are configured. Values never leave the server; only booleans do.

export const config = {
  db: () => !!(process.env.DATABASE_URL || process.env.POSTGRES_URL),
  auth: () => !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_SECRET),
  apollo: () => !!process.env.APOLLO_API_KEY,
  lusha: () => !!process.env.LUSHA_API_KEY,
  anthropic: () => !!process.env.ANTHROPIC_API_KEY,
  cron: () => !!process.env.CRON_SECRET,
};

export const allowedDomain = () => (process.env.ALLOWED_EMAIL_DOMAIN || "hexamatics.com").toLowerCase();
export const adminEmails = () =>
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export function integrationStatus() {
  return {
    database: config.db(),
    auth: config.auth(),
    apollo: config.apollo(),
    lusha: config.lusha(),
    anthropic: config.anthropic(),
    cron: config.cron(),
    allowedDomain: allowedDomain(),
  };
}
export type IntegrationStatus = ReturnType<typeof integrationStatus>;
