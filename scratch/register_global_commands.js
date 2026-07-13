/**
 * Script to register all slash commands globally for the Discord Bot
 * to restore user-install and global availability.
 * Run: node scratch/register_global_commands.js
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { REST, Routes } = require('discord.js');

// Since commands index.ts is TypeScript, we need to load ts-node to parse it,
// or we can just fetch the Command Builder JSON formats from the compiled commands.
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  console.error('❌ DISCORD_TOKEN and DISCORD_CLIENT_ID must be set in your .env file.');
  process.exit(1);
}

// Let's run a child process to call ts-node and export the JSON commands representation.
const { execSync } = require('child_process');

try {
  console.log('⏳ Parsing commands via ts-node...');
  const jsonOutput = execSync('npx ts-node -e "import { commands } from \'./src/commands\'; console.log(JSON.stringify(commands.map(cmd => cmd.data.toJSON())));"', { encoding: 'utf-8' });
  const slashCommandsData = JSON.parse(jsonOutput);

  const rest = new REST({ version: '10' }).setToken(token);

  (async () => {
    try {
      console.log('⏳ Registering slash commands globally for client ID:', clientId);
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: slashCommandsData }
      );
      console.log('✅ Global slash commands registered/reloaded successfully!');
    } catch (error) {
      console.error('❌ Failed to register global commands:', error);
    }
  })();
} catch (err) {
  console.error('Error generating commands JSON:', err.message);
}
