import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ApplicationIntegrationType, InteractionContextType } from 'discord.js';
import { EMOJIS } from '../utils/emojis';

export const termsCommand = {
  data: new SlashCommandBuilder()
    .setName('terms')
    .setDescription('View the official AuthLX Terms of Service.')
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),

  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle(`${EMOJIS.SHIELD} AuthLX Terms of Service`)
      .setDescription(
        `By using AuthLX and its services, you agree to our Terms of Service. You can read the full, official legal document online:\n\n` +
        `${EMOJIS.LINK} **Read online:** https://authlx.com/terms\n\n` +
        `*Please ensure your software products comply with our Acceptable Use policy.*`
      )
      .setColor('#5865F2')
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};

export const privacyCommand = {
  data: new SlashCommandBuilder()
    .setName('privacy')
    .setDescription('View the official AuthLX Privacy Policy.')
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),

  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle(`${EMOJIS.LOCK} AuthLX Privacy Policy`)
      .setDescription(
        `We value your privacy. Learn how we handle your developer credentials and application metadata:\n\n` +
        `${EMOJIS.LINK} **Read online:** https://authlx.com/privacy\n\n` +
        `*AuthLX does not sell personal data and uses secure industry standards to protect your application database.*`
      )
      .setColor('#5865F2')
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
