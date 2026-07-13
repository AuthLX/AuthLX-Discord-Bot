import dotenv from 'dotenv';
import path from 'path';

// Load env variables
dotenv.config();

export interface Config {
  discordToken: string;
  clientId: string;
  apiUrl: string;
  guildId?: string; // Optional: for fast testing in a specific guild
  healthUrl?: string; // Optional: public health check URL
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

export const config: Config = {
  discordToken,
  clientId,
  apiUrl,
  guildId,
  healthUrl
};
