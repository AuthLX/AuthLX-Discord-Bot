import { Client, REST, Routes } from 'discord.js';
import { config } from '../config';
import { commands } from '../commands';

export const readyEvent = {
  name: 'ready',
  once: true,
  async execute(client: Client) {
    console.log(`🤖 Logged in as ${client.user?.tag}!`);

    const rest = new REST({ version: '10' }).setToken(config.discordToken);

    // ─── Always Register Commands Globally ────────────────────────────────────
    // Global registration ensures commands are available in ALL contexts:
    //   ✅ Server (guild) installs
    //   ✅ User installs (DMs, other servers, group chats)
    //
    // Discord PUT is idempotent — it only propagates if the command data changed.
    // No wipe, no duplicates, no uninstall required. Commands auto-sync on restart.
    //
    // NOTE: If DISCORD_GUILD_ID is set in .env, it is only used for health
    // reporting — NOT for command registration. Guild-scoped commands do NOT
    // appear in user-install contexts and would cause duplicates.
    try {
      const slashCommandsData = commands.map(cmd => cmd.data.toJSON());

      console.log(`⏳ Syncing ${slashCommandsData.length} slash commands globally (user-install + all guilds)...`);

      await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: slashCommandsData }
      );

      console.log(`✅ ${slashCommandsData.length} slash commands synced globally. Commands: ${slashCommandsData.map(c => `/${c.name}`).join(', ')}`);
    } catch (error) {
      console.error('❌ Failed to sync slash commands:', error);
    }

    // ─── Set Application Terms of Service & Privacy Policy URLs ───────────────
    // This patches the Discord Application object so the ToS and Privacy Policy
    // links appear in the Developer Portal and in the bot's OAuth2 authorization screen.
    try {
      await rest.patch(Routes.currentApplication(), {
        body: {
          terms_of_service_url: config.termsOfServiceUrl,
          privacy_policy_url:   config.privacyPolicyUrl
        }
      });
      console.log(`📋 ToS  → ${config.termsOfServiceUrl}`);
      console.log(`🔒 Privacy → ${config.privacyPolicyUrl}`);
    } catch (error) {
      console.error('⚠️  Failed to update ToS/Privacy on Discord Application:', error);
    }
  }
};
