import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ApplicationIntegrationType, InteractionContextType } from 'discord.js';
import { ApiService } from '../services/api';
import { db } from '../utils/db';
import { EMOJIS } from '../utils/emojis';

export const userCommand = {
  data: new SlashCommandBuilder()
    .setName('user')
    .setDescription('Manage application users.')
    .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View full details of a user by username or email.')
        .addStringOption(o => o.setName('query').setDescription('Username or email to search').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new user account.')
        .addStringOption(o => o.setName('username').setDescription('Username').setRequired(true))
        .addStringOption(o => o.setName('password').setDescription('Password').setRequired(true))
        .addStringOption(o =>
          o.setName('status').setDescription('Account status').setRequired(false)
            .addChoices({ name: 'Active', value: 'active' }, { name: 'Banned', value: 'banned' }, { name: 'Paused', value: 'paused' })
        )
        .addStringOption(o =>
          o.setName('level').setDescription('Subscription level').setRequired(false)
            .addChoices({ name: 'Level 1', value: '1' }, { name: 'Level 2', value: '2' }, { name: 'Level 3', value: '3' })
        )
        .addStringOption(o => o.setName('email').setDescription('Email address (optional)').setRequired(false))
        .addStringOption(o =>
          o.setName('duration').setDescription('Account duration').setRequired(false)
            .addChoices(
              { name: '1 Day', value: '1d' }, { name: '7 Days', value: '7d' },
              { name: '30 Days', value: '30d' }, { name: '90 Days', value: '90d' },
              { name: '180 Days', value: '180d' }, { name: '1 Year', value: '1y' },
              { name: 'Lifetime', value: 'lifetime' }
            )
        )
        .addStringOption(o => o.setName('notes').setDescription('Optional notes on the user').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('update')
        .setDescription('Update an existing user.')
        .addStringOption(o => o.setName('username').setDescription('Username to update').setRequired(true))
        .addStringOption(o => o.setName('new_password').setDescription('Set a new password').setRequired(false))
        .addStringOption(o => o.setName('new_email').setDescription('Set a new email').setRequired(false))
        .addStringOption(o =>
          o.setName('status').setDescription('Change account status').setRequired(false)
            .addChoices({ name: 'Active', value: 'active' }, { name: 'Banned', value: 'banned' }, { name: 'Paused', value: 'paused' })
        )
        .addStringOption(o =>
          o.setName('level').setDescription('Change subscription level').setRequired(false)
            .addChoices({ name: 'Level 1', value: '1' }, { name: 'Level 2', value: '2' }, { name: 'Level 3', value: '3' })
        )
        .addStringOption(o => o.setName('notes').setDescription('Update notes on the user').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('resethwid')
        .setDescription('Reset the Hardware ID lock for a user.')
        .addStringOption(o => o.setName('username').setDescription('Username to reset HWID for').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Permanently delete a user account.')
        .addStringOption(o => o.setName('username').setDescription('Username to delete').setRequired(true))
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
      // ─── VIEW ──────────────────────────────────────────────────────────────
      if (subcommand === 'view') {
        await interaction.deferReply({ ephemeral: true });

        const query = interaction.options.getString('query', true);
        const users = await api.getUsers(selectedAppId, query);

        if (!users || users.length === 0) {
          return interaction.editReply({ content: `${EMOJIS.INFO} No user matching \`${query}\` found in **${appName}**.` });
        }

        const u = users[0]; // show first match
        const expires = u.expiration_date
          ? new Date(u.expiration_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : 'Never';
        const created = u.created_at
          ? new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : 'Unknown';

        const statusIcon = (s: string) => {
          const sl = (s || '').toLowerCase();
          if (sl === 'banned') return `${EMOJIS.ERROR} Banned`;
          if (sl === 'paused') return `${EMOJIS.INACTIVE} Paused`;
          return `${EMOJIS.ACTIVE} Active`;
        };

        const embed = new EmbedBuilder()
          .setTitle(`${EMOJIS.USER} User Profile: ${u.username}`)
          .setColor(u.status?.toLowerCase() === 'banned' ? '#ef4444' : '#5865F2')
          .addFields(
            { name: `${EMOJIS.STATS} Status`, value: statusIcon(u.status), inline: true },
            { name: '🎯 Level', value: `Level ${u.subscription_level || 1}`, inline: true },
            { name: `${EMOJIS.EMAIL} Email`, value: u.email || 'None', inline: true },
            { name: `${EMOJIS.LOCK} HWID`, value: u.hwid ? `Locked \`${u.hwid.substring(0, 20)}...\`` : 'Not set / Unlocked', inline: false },
            { name: '📅 Expires', value: expires, inline: true },
            { name: '🗓️ Created', value: created, inline: true },
            { name: `${EMOJIS.TAG} Notes`, value: u.notes || '—', inline: false },
            { name: '🆔 User ID', value: `\`${u.id}\``, inline: false }
          )
          .setFooter({ text: `App: ${appName}` })
          .setTimestamp();

        if (users.length > 1) {
          embed.addFields({ name: `${EMOJIS.INFO} Multiple matches`, value: `Found ${users.length} users matching "${query}". Showing the first result.`, inline: false });
        }

        return interaction.editReply({ embeds: [embed] });
      }

      // ─── CREATE ────────────────────────────────────────────────────────────
      if (subcommand === 'create') {
        await interaction.deferReply({ ephemeral: true });

        const username = interaction.options.getString('username', true);
        const password = interaction.options.getString('password', true);
        const status = interaction.options.getString('status') || 'active';
        const level = interaction.options.getString('level') || '1';
        const email = interaction.options.getString('email') || undefined;
        const durationInput = interaction.options.getString('duration');
        const notes = interaction.options.getString('notes') || undefined;

        let expirationDate: string | undefined;
        if (durationInput) {
          const ms = parseDurationMs(durationInput);
          expirationDate = new Date(Date.now() + ms).toISOString();
        }

        const user = await api.createUser(selectedAppId, {
          username, password, email, status,
          subscription_level: level,
          expiration_date: expirationDate,
          notes
        });

        const expires = expirationDate
          ? new Date(expirationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : 'Never';

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${EMOJIS.SUCCESS} User Created Successfully`)
              .setColor('#22c55e')
              .addFields(
                { name: `${EMOJIS.USER} Username`, value: user.username || username, inline: true },
                { name: '🎯 Level', value: `Level ${level}`, inline: true },
                { name: `${EMOJIS.STATS} Status`, value: status.charAt(0).toUpperCase() + status.slice(1), inline: true },
                { name: `${EMOJIS.EMAIL} Email`, value: email || 'None', inline: true },
                { name: '📅 Expires', value: expires, inline: true },
                { name: `${EMOJIS.TAG} App`, value: `\`${appName}\``, inline: true }
              )
              .setTimestamp()
          ]
        });
      }

      // ─── UPDATE ────────────────────────────────────────────────────────────
      if (subcommand === 'update') {
        await interaction.deferReply({ ephemeral: true });

        const username = interaction.options.getString('username', true);
        const newPassword = interaction.options.getString('new_password');
        const newEmail = interaction.options.getString('new_email');
        const status = interaction.options.getString('status');
        const level = interaction.options.getString('level');
        const notes = interaction.options.getString('notes');

        const users = await api.getUsers(selectedAppId, username);
        const match = users.find((u: any) => u.username.toLowerCase() === username.toLowerCase());

        if (!match) {
          return interaction.editReply({ content: `${EMOJIS.ERROR} User \`${username}\` not found in **${appName}**.` });
        }

        const payload: any = {};
        if (newPassword) payload.password = newPassword;
        if (newEmail) payload.email = newEmail;
        if (status) payload.status = status;
        if (level) payload.subscription_level = level;
        if (notes) payload.notes = notes;

        if (Object.keys(payload).length === 0) {
          return interaction.editReply({ content: `${EMOJIS.INFO} No fields provided to update.` });
        }

        await api.updateUser(match.id, payload);

        const changedFields = Object.keys(payload).map(k => {
          const labels: Record<string, string> = {
            password: '🔑 Password', email: `${EMOJIS.EMAIL} Email`, status: `${EMOJIS.STATS} Status`,
            subscription_level: '🎯 Level', notes: `${EMOJIS.TAG} Notes`
          };
          return `${labels[k] || k}: \`${payload[k]}\``;
        }).join('\n');

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`✏️ User Updated: ${username}`)
              .setColor('#f59e0b')
              .setDescription(`**Changes applied:**\n${changedFields}`)
              .addFields({ name: `${EMOJIS.TAG} App`, value: `\`${appName}\``, inline: true })
              .setFooter({ text: status === 'banned' ? '⚠️ User banned — all active sessions have been killed.' : 'AuthLX Bot Integration' })
              .setTimestamp()
          ]
        });
      }

      // ─── RESETHWID ─────────────────────────────────────────────────────────
      if (subcommand === 'resethwid') {
        await interaction.deferReply({ ephemeral: true });

        const username = interaction.options.getString('username', true);
        const users = await api.getUsers(selectedAppId, username);
        const match = users.find((u: any) => u.username.toLowerCase() === username.toLowerCase());

        if (!match) {
          return interaction.editReply({ content: `${EMOJIS.ERROR} User \`${username}\` not found in **${appName}**.` });
        }

        await api.resetUserHwid(match.id);
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('🔓 HWID Reset')
              .setColor('#22c55e')
              .addFields(
                { name: `${EMOJIS.USER} User`, value: match.username, inline: true },
                { name: `${EMOJIS.TAG} App`, value: `\`${appName}\``, inline: true },
                { name: 'Result', value: 'Hardware ID lock cleared. User can log in from a new device.', inline: false }
              )
              .setTimestamp()
          ]
        });
      }

      // ─── DELETE ────────────────────────────────────────────────────────────
      if (subcommand === 'delete') {
        await interaction.deferReply({ ephemeral: true });

        const username = interaction.options.getString('username', true);
        const users = await api.getUsers(selectedAppId, username);
        const match = users.find((u: any) => u.username.toLowerCase() === username.toLowerCase());

        if (!match) {
          return interaction.editReply({ content: `${EMOJIS.ERROR} User \`${username}\` not found in **${appName}**.` });
        }

        await api.deleteUser(match.id);
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${EMOJIS.TRASH} User Deleted`)
              .setColor('#ef4444')
              .addFields(
                { name: `${EMOJIS.USER} Username`, value: match.username, inline: true },
                { name: `${EMOJIS.TAG} App`, value: `\`${appName}\``, inline: true },
                { name: 'Result', value: 'Account permanently deleted.', inline: false }
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

function parseDurationMs(input: string): number {
  if (input === 'lifetime') return 3153600000 * 1000;
  const m = input.match(/^(\d+)([dwmy])$/);
  if (!m) return 30 * 86400 * 1000;
  const v = parseInt(m[1]);
  switch (m[2]) {
    case 'd': return v * 86400 * 1000;
    case 'w': return v * 604800 * 1000;
    case 'm': return v * 2592000 * 1000;
    case 'y': return v * 31536000 * 1000;
    default: return 30 * 86400 * 1000;
  }
}
