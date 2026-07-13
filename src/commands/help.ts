import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ApplicationIntegrationType, InteractionContextType } from 'discord.js';
import { EMOJIS } from '../utils/emojis';

export const helpCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display the guide and list of all available slash commands for AuthLX.')
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),

  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle(`${EMOJIS.SHIELD} AuthLX Developer Command Guide`)
      .setDescription(
        `Welcome to the AuthLX Developer Integration Bot. Use the commands below to manage your applications, licenses, users, and settings directly from Discord.`
      )
      .setColor('#5865F2')
      .addFields(
        {
          name: `${EMOJIS.LOCK} 1. Getting Started & Account linking`,
          value: 
            `\`\`\`\n` +
            `/link [token]    - Link your Discord account to your developer profile\n` +
            `/unlink          - Unlink and delete your developer profile token\n` +
            `\`\`\``,
          inline: false
        },
        {
          name: `${EMOJIS.APP} 2. Application Management`,
          value: 
            `\`\`\`\n` +
            `/app create      - Create a new application\n` +
            `/app switch      - Set your active application for this session\n` +
            `/app list        - List all applications available to you\n` +
            `/app status      - Show stats/overview of active application\n` +
            `/app snapshot    - Show full settings & permissions snapshot\n` +
            `/app pause       - Stop user logins (disable application)\n` +
            `/app resume      - Allow user logins (enable application)\n` +
            `\`\`\``,
          inline: false
        },
        {
          name: `${EMOJIS.LICENSE} 3. License Key Management`,
          value: 
            `\`\`\`\n` +
            `/license generate - Generate new license keys\n` +
            `/license list    - Show paginated list of licenses\n` +
            `/license ban     - Block/ban a specific license key\n` +
            `/license delete  - Permanently delete a license key\n` +
            `\`\`\``,
          inline: false
        },
        {
          name: `${EMOJIS.USER} 4. Client User Management`,
          value: 
            `\`\`\`\n` +
            `/user create     - Create a client user manually\n` +
            `/user view       - View a user's details, stats & status\n` +
            `/user update     - Change password, levels or status\n` +
            `/user resethwid  - Reset a user's HWID lock (respects cooldown)\n` +
            `/user delete     - Delete a user permanently\n` +
            `\`\`\``,
          inline: false
        },
        {
          name: `${EMOJIS.SESSIONS} 5. Sessions & Subscriptions`,
          value: 
            `\`\`\`\n` +
            `/session list    - List active login sessions\n` +
            `/session kill    - Kill a specific user's active session\n` +
            `/session killall - Close all active sessions in the application\n` +
            `/subscription list   - View subscription plans\n` +
            `/subscription create - Add a new subscription plan\n` +
            `/subscription delete - Delete a subscription plan\n` +
            `\`\`\``,
          inline: false
        },
        {
          name: `${EMOJIS.SETTINGS} 6. Configuration & Team`,
          value: 
            `\`\`\`\n` +
            `/settings view   - Display active security settings\n` +
            `/settings update - Change settings (VPN, HWID, Anti-Tamper)\n` +
            `/team view       - View developers, managers, and resellers\n` +
            `\`\`\``,
          inline: false
        }
      )
      .setFooter({ text: 'AuthLX Bot Guide | All commands are permission-enforced in real-time.' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
