import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ApplicationIntegrationType, InteractionContextType } from 'discord.js';
import { ApiService } from '../services/api';
import { db } from '../utils/db';

export const sessionCommand = {
  data: new SlashCommandBuilder()
    .setName('session')
    .setDescription('View and manage active user sessions for your application.')
    .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all active sessions for the current application.')
    )
    .addSubcommand(sub =>
      sub.setName('kill')
        .setDescription('Terminate a specific session by its ID.')
        .addStringOption(o => o.setName('session_id').setDescription('Session ID to terminate (from /session list)').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('killall')
        .setDescription('Terminate ALL active sessions for this application. (Admin only)')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
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
      // ─── LIST ──────────────────────────────────────────────────────────────
      if (subcommand === 'list') {
        await interaction.deferReply({ ephemeral: true });

        const sessions = await api.getSessions(selectedAppId);

        if (!sessions || sessions.length === 0) {
          return interaction.editReply({ content: `ℹ️ No active sessions found for **${appName}**.` });
        }

        const display = sessions.slice(0, 10);

        const embed = new EmbedBuilder()
          .setTitle(`🟢 Active Sessions — ${appName}`)
          .setColor('#5865F2')
          .setDescription(
            display.map((s: any, i: number) => {
              const started = s.created_at
                ? new Date(s.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'Unknown';
              return `**#${i + 1}** | 👤 **${s.username || s.user?.username || 'Unknown'}**\n` +
                `› IP: \`${s.ip_address || s.ip || '—'}\` | Device: \`${s.hwid ? s.hwid.substring(0, 12) + '...' : 'N/A'}\`\n` +
                `› Started: ${started}\n` +
                `› ID: \`${s.id}\``;
            }).join('\n\n')
          )
          .setFooter({ text: sessions.length > 10 ? `Showing 10 of ${sessions.length} sessions. Use session ID from above to kill one.` : `Total: ${sessions.length} session(s)` })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // ─── KILL ──────────────────────────────────────────────────────────────
      if (subcommand === 'kill') {
        await interaction.deferReply({ ephemeral: true });

        const sessionId = interaction.options.getString('session_id', true).trim();

        await api.deleteSession(sessionId);

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('⚡ Session Terminated')
              .setColor('#f59e0b')
              .addFields(
                { name: '🆔 Session ID', value: `\`${sessionId}\``, inline: false },
                { name: '🏷️ App', value: `\`${appName}\``, inline: true },
                { name: 'Sessions Killed', value: '1', inline: true }
              )
              .setFooter({ text: 'The user has been logged out.' })
              .setTimestamp()
          ]
        });
      }

      // ─── KILLALL ───────────────────────────────────────────────────────────
      if (subcommand === 'killall') {
        await interaction.deferReply({ ephemeral: true });

        const sessions = await api.getSessions(selectedAppId);

        if (!sessions || sessions.length === 0) {
          return interaction.editReply({ content: `ℹ️ No active sessions to kill for **${appName}**.` });
        }

        // Kill all sessions in parallel
        const results = await Promise.allSettled(
          sessions.map((s: any) => api.deleteSession(s.id))
        );

        const killed = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('⚡ All Sessions Terminated')
              .setColor('#ef4444')
              .addFields(
                { name: '🏷️ App', value: `\`${appName}\``, inline: true },
                { name: '✅ Sessions Killed', value: `${killed}`, inline: true },
                { name: failed > 0 ? '❌ Failed' : '📊 Total', value: failed > 0 ? `${failed}` : `${sessions.length}`, inline: true }
              )
              .setFooter({ text: 'All users have been logged out from this application.' })
              .setTimestamp()
          ]
        });
      }

    } catch (err: any) {
      const msg = err.message || 'An unexpected error occurred.';
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ content: `❌ **Error:** ${msg}` });
      }
      return interaction.reply({ content: `❌ **Error:** ${msg}`, ephemeral: true });
    }
  }
};
