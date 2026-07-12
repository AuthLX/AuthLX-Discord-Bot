import { SlashCommandBuilder, ChatInputCommandInteraction, ApplicationIntegrationType, InteractionContextType } from 'discord.js';
import { db } from '../utils/db';
import { ApiService } from '../services/api';

export const linkCommand = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Discord account with your AuthLX Dashboard bot access token.')
    .addStringOption(option =>
      option.setName('token')
        .setDescription('Your Bot Access Secret Token (found on your dashboard Profile page)')
        .setRequired(true)
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    const token = interaction.options.getString('token', true).trim();
    const discordId = interaction.user.id;
    const discordUsername = interaction.user.tag;

    try {
      const api = new ApiService({ discordId, secret: token });
      const res = await api.getDiscordProfile();

      if (!res || !res.linked || res.profile.discord_id !== discordId) {
        return interaction.editReply({
          content: '❌ **Error:** The provided secret token does not match your Discord account details. Please link your Discord account on the web dashboard first.'
        });
      }

      // Save token locally
      db.setUserSecret(discordId, token);

      return interaction.editReply({
        content: `✅ **Success!** Your Discord account (\`${discordUsername}\`) has been securely linked with your AuthLX developer profile.\n\nYou can now use other slash commands to manage your applications.`
      });
    } catch (err: any) {
      return interaction.editReply({
        content: `❌ **Error:** Failed to verify token. Make sure you have linked your Discord account under the dashboard Profile settings first.\n*(Details: ${err.message || err})*`
      });
    }
  }
};

export const unlinkCommand = {
  data: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink your Discord account and delete your dashboard bot secret token.')
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),

  async execute(interaction: ChatInputCommandInteraction) {
    const discordId = interaction.user.id;
    const removed = db.removeUserSecret(discordId);

    if (!removed) {
      return interaction.reply({
        content: 'ℹ️ Your Discord account was not linked to any AuthLX profile.',
        ephemeral: true
      });
    }

    return interaction.reply({
      content: '✅ **Success!** Your Discord account has been unlinked. The local secret token mapping has been deleted.',
      ephemeral: true
    });
  }
};
