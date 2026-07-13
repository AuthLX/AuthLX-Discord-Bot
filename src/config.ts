import dotenv from 'dotenv';
import path from 'path';

// Load env variables
dotenv.config();

export interface Config {
  discordToken: string;
  clientId: string;
  apiUrl: string;
  guildId?: string;     // Optional: for fast testing in a specific guild
  healthUrl?: string;   // Optional: public health check URL
  termsOfServiceUrl: string;
  privacyPolicyUrl: string;
}

// Validate environment variables
const discordToken = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const apiUrl = process.env.AUTH_API_URL || 'http://localhost:3001/api/v1/dev';
const guildId = process.env.DISCORD_GUILD_ID;
const healthUrl = process.env.BOT_HEALTH_URL;

if (!discordToken) {
  console.error("❌ ERROR: DISCORD_TOKEN is missing in environment variables!");
  process.exit(1);
}

if (!clientId) {
  console.error("❌ ERROR: DISCORD_CLIENT_ID is missing in environment variables!");
  process.exit(1);
}

const cleanBaseUrl = (url: string | undefined): string | null => {
  if (!url) return null;
  // If the user provided the full health URL like http://host:port/health, strip /health from the end
  return url.endsWith('/health') ? url.substring(0, url.length - 7) : url;
};

const baseUrl = cleanBaseUrl(healthUrl);

export const config: Config = {
  discordToken,
  clientId,
  apiUrl,
  guildId,
  healthUrl,
  termsOfServiceUrl: baseUrl ? `${baseUrl}/terms` : 'https://authlx.com/terms',
  privacyPolicyUrl: baseUrl ? `${baseUrl}/privacy` : 'https://authlx.com/privacy'
};
