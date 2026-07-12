import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ApplicationIntegrationType, InteractionContextType } from 'discord.js';
import { ApiService } from '../services/api';
import { db } from '../utils/db';

export const teamCommand = {
  data: new SlashCommandBuilder()
    .setName('team')
    .setDescription('View your team members and their roles.')
    .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('Display all team members with their roles and permissions.')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const discordId = interaction.user.id;
    const secret = db.getUserSecret(discordId) || undefined;
    const api = new ApiService({ discordId, secret });

    const profileRes = await api.getDiscordProfile().catch(() => null);
    const selectedAppId = profileRes?.profile?.selected_app_id;
    const appName = profileRes?.profile?.selected_app_name || selectedAppId;

    if (!selectedAppId) {
      const apps = await api.getApps().catch(() => []);
      const msg = (!apps || apps.length === 0)
        ? '❌ You have no applications. Create one on the web dashboard first.'
        : '❌ No application selected. Use `/app switch` to set your active application.';
      return interaction.reply({ content: msg, ephemeral: true });
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      const team = await api.getTeamMembers(selectedAppId);

      // team is an array from backend, or null/empty
      const members: any[] = Array.isArray(team) ? team : [];

      if (members.length === 0) {
        return interaction.editReply({
          content: `ℹ️ No team members registered for **${appName}**.\nYou can invite team members from the web dashboard.`
        });
      }

      const roleIcon = (role: string) => {
        const r = (role || '').toLowerCase();
        if (r === 'admin' || r === 'master_admin') return '👑';
        if (r === 'manager') return '🛡️';
        if (r === 'reseller') return '🏪';
        return '👤';
      };

      const formatBalance = (m: any) => {
        const parts = [];
        if (m.balance_day) parts.push(`${m.balance_day}×Day`);
        if (m.balance_week) parts.push(`${m.balance_week}×Week`);
        if (m.balance_month) parts.push(`${m.balance_month}×Month`);
        if (m.balance_year) parts.push(`${m.balance_year}×Year`);
        if (m.balance_lifetime) parts.push(`${m.balance_lifetime}×Lifetime`);
        return parts.length > 0 ? parts.join(' | ') : 'No balance';
      };

      const embed = new EmbedBuilder()
        .setTitle(`👥 Team — ${appName}`)
        .setColor('#5865F2')
        .setDescription(
          members.map((m: any) => {
            const icon = roleIcon(m.role);
            const roleLabel = (m.role || 'Member').charAt(0).toUpperCase() + (m.role || 'Member').slice(1);
            const emailLine = m.email ? `📧 ${m.email}` : '';
            const balanceLine = m.role?.toLowerCase() === 'reseller' ? `💰 Balance: ${formatBalance(m)}` : '';
            const unlimitedLabel = m.is_unlimited_reseller ? ' ♾️ Unlimited' : '';
            const permLines = m.role?.toLowerCase() === 'reseller' ? unlimitedLabel : '';

            return [
              `${icon} **${m.username || m.display_name || m.email || m.id}** — ${roleLabel}${permLines}`,
              emailLine,
              balanceLine,
              m.is_owner ? '*(App Owner)*' : ''
            ].filter(Boolean).join('\n');
          }).join('\n\n')
        )
        .setFooter({ text: `Total: ${members.length} member(s) | View-Only via Discord Bot` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });

    } catch (err: any) {
      const msg = err.message || 'An unexpected error occurred.';
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ content: `❌ **Error:** ${msg}` });
      }
      return interaction.reply({ content: `❌ **Error:** ${msg}`, ephemeral: true });
    }
  }
};
