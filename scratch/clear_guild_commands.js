/**
 * Script to clear all guild-specific slash commands for the Discord Bot
 * to prevent duplicates when global commands (with user-install support) are active.
 * Run: node scratch/clear_guild_commands.js [optional_guild_id]
 */
require('dotenv').config();
const { REST, Routes } = require('discord.js');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
// Use guild ID from command line argument, or fall back to .env (even if commented out, we check the default parsed or fallback)
const guildId = process.argv[2] || process.env.DISCORD_GUILD_ID || '1517287632386785332';

if (!token || !clientId) {
  console.error('❌ DISCORD_TOKEN and DISCORD_CLIENT_ID must be set in your .env file.');
  process.exit(1);
}

if (!guildId) {
  console.error('❌ Guild ID must be provided as an argument or set in .env.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log(`⏳ Clearing all guild-specific commands for guild ID: ${guildId}...`);
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: [] }
    );
    console.log('✅ Guild-specific slash commands cleared successfully!');
    console.log('💡 Any duplicate commands on this server will disappear instantly.');
  } catch (error) {
    console.error('❌ Failed to clear guild commands:', error);
  }
})();
