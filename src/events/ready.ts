import { Client, REST, Routes } from 'discord.js';
import { config } from '../config';
import { commands } from '../commands';

export const readyEvent = {
  name: 'ready',
  once: true,
  async execute(client: Client) {
    console.log(`🤖 Logged in as ${client.user?.tag}! Initializing slash commands...`);

    const rest = new REST({ version: '10' }).setToken(config.discordToken);

    // ─── Register Slash Commands ───────────────────────────────────────────
    try {
      const slashCommandsData = commands.map(cmd => cmd.data.toJSON());

      if (config.guildId) {
        console.log(`⏳ Registering slash commands locally to guild ID: ${config.guildId}...`);
        await rest.put(
          Routes.applicationGuildCommands(config.clientId, config.guildId),
          { body: slashCommandsData }
        );
        console.log('✅ Local guild slash commands registered successfully!');
      } else {
        console.log('⏳ Registering slash commands globally across all guilds...');
        await rest.put(
          Routes.applicationCommands(config.clientId),
          { body: slashCommandsData }
        );
        console.log('✅ Global slash commands registered successfully!');
      }
    } catch (error) {
      console.error('❌ Failed to register slash commands:', error);
    }

    // ─── Set Application Terms of Service & Privacy Policy URLs ───────────
    // This patches the Discord Application object so the ToS and Privacy Policy
    // links appear in the Developer Portal and in the bot's OAuth2 authorization screen.
    try {
      await rest.patch(Routes.currentApplication(), {
        body: {
          terms_of_service_url: config.termsOfServiceUrl,
          privacy_policy_url:   config.privacyPolicyUrl
        }
      });
      console.log(`📋 Terms of Service URL set → ${config.termsOfServiceUrl}`);
      console.log(`🔒 Privacy Policy URL set   → ${config.privacyPolicyUrl}`);
    } catch (error) {
      console.error('⚠️  Failed to update ToS/Privacy Policy on Discord Application:', error);
    }
  }
};
