import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ApplicationIntegrationType, InteractionContextType } from 'discord.js';
import { ApiService } from '../services/api';
import { db } from '../utils/db';
import { EMOJIS } from '../utils/emojis';

export const licenseCommand = {
  data: new SlashCommandBuilder()
    .setName('license')
    .setDescription('Manage product license keys.')
    .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .addSubcommand(sub =>
      sub.setName('generate')
        .setDescription('Generate new license keys for your active application.')
        .addIntegerOption(o => o.setName('amount').setDescription('Number of keys to generate (1-50) — default: 1').setMinValue(1).setMaxValue(50).setRequired(false))
        .addStringOption(o =>
          o.setName('duration').setDescription('Duration of the generated licenses — default: 30 Days').setRequired(false)
            .addChoices(
              { name: '1 Day', value: '1d' },
              { name: '3 Days', value: '3d' },
              { name: '7 Days', value: '7d' },
              { name: '30 Days', value: '30d' },
              { name: '90 Days', value: '90d' },
              { name: '180 Days', value: '180d' },
              { name: '1 Year', value: '1y' },
              { name: 'Lifetime', value: 'lifetime' }
            )
        )
        .addStringOption(o =>
          o.setName('level').setDescription('Subscription level for keys').setRequired(false)
            .addChoices({ name: 'Level 1', value: '1' }, { name: 'Level 2', value: '2' }, { name: 'Level 3', value: '3' })
        )
        .addStringOption(o => o.setName('mask').setDescription('Key format mask (e.g. XXXX-XXXX-XXXX-XXXX)').setRequired(false))
        .addStringOption(o => o.setName('note').setDescription('Memo or tag for these keys').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List licenses for your active application.')
        .addStringOption(o =>
          o.setName('filter').setDescription('Filter by status').setRequired(false)
            .addChoices(
              { name: 'All Licenses', value: 'all' },
              { name: 'Unused Only', value: 'unused' },
              { name: 'Used Only', value: 'used' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('ban')
        .setDescription('Ban a license key so it can no longer be used.')
        .addStringOption(o => o.setName('key').setDescription('The license key to ban (e.g. XXXX-XXXX-XXXX-XXXX)').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Permanently delete a license key.')
        .addStringOption(o => o.setName('key').setDescription('The license key to delete').setRequired(true))
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const discordId = interaction.user.id;
    const secret = db.getUserSecret(discordId) || undefined;
    const api = new ApiService({ discordId, secret });

    // Resolve selected app
    const profileRes = await api.getDiscordProfile().catch(() => null);
    const selectedAppId = profileRes?.profile?.selected_app_id;
    const appName = profileRes?.profile?.selected_app_name || selectedAppId;

    if (!selectedAppId) {
      const apps = await api.getApps().catch(() => []);
      const msg = (!apps || apps.length === 0)
        ? `${EMOJIS.ERROR} You have no applications on your AuthLX dashboard. Create one on the web dashboard first.`
        : `${EMOJIS.ERROR} No application selected. Use \`/app switch\` to set your active application.`;
      return interaction.reply({ content: msg, ephemeral: true });
    }

    try {
      // ─── GENERATE ─────────────────────────────────────────────────────────
      if (subcommand === 'generate') {
        await interaction.deferReply({ ephemeral: true });

        const amount = interaction.options.getInteger('amount') ?? 1;
        const durationInput = interaction.options.getString('duration') || '30d';
        const level = interaction.options.getString('level') || '1';
        const mask = interaction.options.getString('mask') || 'XXXX-XXXX-XXXX-XXXX';
        const note = interaction.options.getString('note') || 'Generated via Discord Bot';

        const durationSeconds = parseDuration(durationInput);
        const res = await api.generateLicenses({
          appId: selectedAppId, amount, mask,
          lowercaseLetters: false, capitalLetters: true,
          level, note, expiry: durationSeconds, duration: 1
        });

        const keys: string[] = res.keys || [];
        const keysText = keys.map(k => `\`${k}\``).join('\n');

        const embed = new EmbedBuilder()
          .setTitle(`${EMOJIS.LICENSE} Licenses Generated Successfully`)
          .setColor('#5865F2')
          .addFields(
            { name: `${EMOJIS.TAG} Application`, value: `\`${appName}\``, inline: true },
            { name: 'Amount', value: `${amount} key(s)`, inline: true },
            { name: 'Level', value: `Level ${level}`, inline: true },
            { name: 'Duration', value: getFriendlyDurationName(durationInput), inline: true }
          )
          .setDescription(`**Generated Keys:**\n${keysText.length > 3000 ? keysText.substring(0, 2900) + '\n*(truncated — additional keys saved to dashboard)*' : keysText}`)
          .setFooter({ text: 'AuthLX Bot • Copy keys above and share with your customers.' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // ─── LIST ──────────────────────────────────────────────────────────────
      if (subcommand === 'list') {
        await interaction.deferReply({ ephemeral: true });

        const filter = (interaction.options.getString('filter') || 'all') as 'all' | 'used' | 'unused';
        const licenses = await api.getLicenses(selectedAppId, filter);

        if (!licenses || licenses.length === 0) {
          return interaction.editReply({ content: `${EMOJIS.INFO} No ${filter === 'all' ? '' : filter + ' '}licenses found for **${appName}**.` });
        }

        // Show up to 10 per message (Discord embed limit)
        const display = licenses.slice(0, 10);
        const statusIcon = (s: string) => s === 'used' ? `${EMOJIS.INACTIVE} Used` : s === 'banned' ? `${EMOJIS.ERROR} Banned` : `${EMOJIS.ACTIVE} Unused`;

        const embed = new EmbedBuilder()
          .setTitle(`${EMOJIS.LICENSE} License List — ${appName}`)
          .setColor('#5865F2')
          .setDescription(
            display.map((lic: any, i: number) => {
              const durationStr = formatFriendlyDuration(lic.expiry_duration);
              const expires = lic.expiration_date
                ? new Date(lic.expiration_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'Never';
              const detailLine = lic.status === 'used' 
                ? `› Expires: ${expires} | Used By: \`${lic.used_by_username || 'N/A'}\``
                : `› Duration: **${durationStr}** | Note: ${lic.note || '—'}`;

              return `**${i + 1}.** \`${lic.key || lic.license_key || 'N/A'}\`\n` +
                `› Status: ${statusIcon(lic.status || 'unused')} | Level: ${lic.subscription_level || lic.level || 1}\n` +
                detailLine;
            }).join('\n\n')
          )
          .setFooter({ text: licenses.length > 10 ? `Showing 10 of ${licenses.length} — view all on dashboard` : 'AuthLX Bot Integration' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // ─── BAN ───────────────────────────────────────────────────────────────
      if (subcommand === 'ban') {
        await interaction.deferReply({ ephemeral: true });

        const key = interaction.options.getString('key', true).trim();
        const licenses = await api.getLicenses(selectedAppId);
        const match = licenses.find((l: any) => (l.key || l.license_key || '').toLowerCase() === key.toLowerCase());

        if (!match) {
          return interaction.editReply({ content: `${EMOJIS.ERROR} License key \`${key}\` not found in **${appName}**.` });
        }
        if (match.status === 'banned') {
          return interaction.editReply({ content: `${EMOJIS.INFO} License \`${key}\` is already banned.` });
        }

        await api.banLicense(match.id);
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${EMOJIS.ERROR} License Banned`)
              .setColor('#ef4444')
              .addFields(
                { name: 'Key', value: `\`${key}\``, inline: false },
                { name: 'Application', value: `\`${appName}\``, inline: true },
                { name: 'Action', value: 'Banned — cannot be used for login', inline: true }
              )
              .setTimestamp()
          ]
        });
      }

      // ─── DELETE ────────────────────────────────────────────────────────────
      if (subcommand === 'delete') {
        await interaction.deferReply({ ephemeral: true });

        const key = interaction.options.getString('key', true).trim();
        const licenses = await api.getLicenses(selectedAppId);
        const match = licenses.find((l: any) => (l.key || l.license_key || '').toLowerCase() === key.toLowerCase());

        if (!match) {
          return interaction.editReply({ content: `${EMOJIS.ERROR} License key \`${key}\` not found in **${appName}**.` });
        }

        await api.deleteLicense(match.id);
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${EMOJIS.TRASH} License Deleted`)
              .setColor('#ef4444')
              .addFields(
                { name: 'Key', value: `\`${key}\``, inline: false },
                { name: 'Application', value: `\`${appName}\``, inline: true },
                { name: 'Action', value: 'Permanently deleted', inline: true }
              )
              .setTimestamp()
          ]
        });
      }

    } catch (err: any) {
      const msg = err.message || 'An unexpected error occurred.';
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ content: `${EMOJIS.ERROR} **Error:** ${msg}` });
      }
      return interaction.reply({ content: `${EMOJIS.ERROR} **Error:** ${msg}`, ephemeral: true });
    }
  }
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseDuration(input: string): number {
  const clean = input.toLowerCase().trim();
  if (clean === 'lifetime') return 3153600000;
  const match = clean.match(/^(\d+)\s*([dwmy])$/);
  if (!match) throw new Error('Invalid duration. Use e.g. "1d", "7d", "30d", "1y", or "lifetime".');
  const value = parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
    case 'd': return value * 86400;
    case 'w': return value * 604800;
    case 'm': return value * 2592000;
    case 'y': return value * 31536000;
    default: throw new Error('Invalid duration unit.');
  }
}

function getFriendlyDurationName(input: string): string {
  const map: Record<string, string> = {
    '1d': '1 Day', '3d': '3 Days', '7d': '7 Days',
    '30d': '30 Days', '90d': '90 Days', '180d': '180 Days',
    '1y': '1 Year', 'lifetime': 'Lifetime'
  };
  return map[input] || input;
}

function formatFriendlyDuration(seconds: number): string {
  if (!seconds && seconds !== 0) return 'N/A';
  if (seconds >= 315360000) return 'Lifetime';
  if (seconds >= 31536000) return `${Math.floor(seconds / 31536000)} Year(s)`;
  if (seconds >= 2592000) return `${Math.floor(seconds / 2592000)} Month(s)`;
  if (seconds >= 604800) return `${Math.floor(seconds / 604800)} Week(s)`;
  if (seconds >= 86400) return `${Math.floor(seconds / 86400)} Day(s)`;
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)} Hour(s)`;
  if (seconds >= 60) return `${Math.floor(seconds / 60)} Minute(s)`;
  return `${seconds} Second(s)`;
}
