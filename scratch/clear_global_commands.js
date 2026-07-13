/**
 * Script to clear all global slash commands for the Discord Bot
 * to prevent duplicates when local guild commands are used.
 * Run: node scratch/clear_global_commands.js
 */
require('dotenv').config();
const { REST, Routes } = require('discord.js');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  console.error('❌ DISCORD_TOKEN and DISCORD_CLIENT_ID must be set in your .env file.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('⏳ Clearing all global slash commands for bot client ID:', clientId);
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: [] }
    );
    console.log('✅ Global slash commands cleared successfully! (Any duplicates in Discord will disappear shortly)');
  } catch (error) {
    console.error('❌ Failed to clear global commands:', error);
  }
})();
