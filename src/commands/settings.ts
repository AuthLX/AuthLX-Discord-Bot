import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ApplicationIntegrationType, InteractionContextType } from 'discord.js';
import { ApiService } from '../services/api';
import { db } from '../utils/db';
import { EMOJIS } from '../utils/emojis';

export const settingsCommand = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('View and manage application settings, version, and integrity hashes.')
    .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current application settings and version.')
    )
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Toggle application security settings.')
        .addStringOption(o =>
          o.setName('status').setDescription('Enable or disable the application').setRequired(false)
            .addChoices({ name: 'Active (Enabled)', value: 'active' }, { name: 'Disabled', value: 'disabled' })
        )
        .addStringOption(o =>
          o.setName('hash_check').setDescription('Require valid integrity hash on login').setRequired(false)
            .addChoices({ name: 'Enable', value: 'yes' }, { name: 'Disable', value: 'no' })
        )
        .addStringOption(o =>
          o.setName('force_hwid').setDescription('Require Hardware ID lock').setRequired(false)
            .addChoices({ name: 'Enable', value: 'yes' }, { name: 'Disable', value: 'no' })
        )
        .addStringOption(o =>
          o.setName('block_leaked_passwords').setDescription('Block commonly leaked passwords').setRequired(false)
            .addChoices({ name: 'Enable', value: 'yes' }, { name: 'Disable', value: 'no' })
        )
        .addIntegerOption(o =>
          o.setName('min_username_length').setDescription('Minimum username character length (1–32)').setMinValue(1).setMaxValue(32).setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('version')
        .setDescription('Update the required application version string.')
        .addStringOption(o => o.setName('new_version').setDescription('New version string, e.g. 1.0.1').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('hash-add')
        .setDescription('Add an integrity hash for file verification.')
        .addStringOption(o => o.setName('hash').setDescription('SHA256 or MD5 hash value').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('hash-list')
        .setDescription('List all registered integrity hashes.')
    )
    .addSubcommand(sub =>
      sub.setName('hash-delete')
        .setDescription('Remove a specific hash by its ID.')
        .addStringOption(o => o.setName('hash_id').setDescription('Hash ID to remove (from /settings hash-list)').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('hash-reset')
        .setDescription('Remove ALL integrity hashes for this application. (Admin only)')
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
        ? `${EMOJIS.ERROR} You have no applications. Create one on the web dashboard first.`
        : `${EMOJIS.ERROR} No application selected. Use \`/app switch\` to set your active application.`;
      return interaction.reply({ content: msg, ephemeral: true });
    }

    try {
      // ─── VIEW ──────────────────────────────────────────────────────────────
      if (subcommand === 'view') {
        await interaction.deferReply({ ephemeral: true });

        const app = await api.getAppById(selectedAppId);
        const hashes = await api.getHashes(selectedAppId).catch(() => []);

        const yn = (v: any) => v ? `${EMOJIS.SUCCESS} Enabled` : `${EMOJIS.ERROR} Disabled`;
        const statusLabel = app?.status ? `${EMOJIS.ACTIVE} Active` : `${EMOJIS.INACTIVE} Disabled`;

        const embed = new EmbedBuilder()
          .setTitle(`${EMOJIS.SETTINGS} Settings — ${app?.name || appName}`)
          .setColor('#5865F2')
          .addFields(
            { name: `${EMOJIS.STATS} Status`, value: statusLabel, inline: true },
            { name: `${EMOJIS.TAG} Version`, value: `\`${app?.version || 'Not set'}\``, inline: true },
            { name: `${EMOJIS.LOCK} Force HWID`, value: yn(app?.force_hwid), inline: true },
            { name: `${EMOJIS.SHIELD} Hash Check`, value: yn(app?.hash_check), inline: true },
            { name: `${EMOJIS.LOCK} Block Leaked Passwords`, value: yn(app?.block_leaked_passwords), inline: true },
            { name: `${EMOJIS.LOCK} Token Validation`, value: yn(app?.token_validation), inline: true },
            { name: `${EMOJIS.USER} Min Username Length`, value: `${app?.min_username_length || 1} chars`, inline: true },
            { name: `${EMOJIS.LOCK} HWID Method`, value: app?.hwid_method || 'windows_user', inline: true },
            { name: `${EMOJIS.SHIELD} Integrity Hashes`, value: `${hashes.length} registered`, inline: true }
          )
          .setFooter({ text: `App ID: ${selectedAppId}` })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // ─── SET ───────────────────────────────────────────────────────────────
      if (subcommand === 'set') {
        await interaction.deferReply({ ephemeral: true });

        const payload: any = {};
        const statusOpt = interaction.options.getString('status');
        const hashCheckOpt = interaction.options.getString('hash_check');
        const forceHwidOpt = interaction.options.getString('force_hwid');
        const blockLeakedOpt = interaction.options.getString('block_leaked_passwords');
        const minUsernameOpt = interaction.options.getInteger('min_username_length');

        if (statusOpt) payload.status = statusOpt === 'active' ? 1 : 0;
        if (hashCheckOpt) payload.hash_check = hashCheckOpt === 'yes' ? 1 : 0;
        if (forceHwidOpt) payload.force_hwid = forceHwidOpt === 'yes' ? 1 : 0;
        if (blockLeakedOpt) payload.block_leaked_passwords = blockLeakedOpt === 'yes' ? 1 : 0;
        if (minUsernameOpt !== null && minUsernameOpt !== undefined) payload.min_username_length = minUsernameOpt;

        if (Object.keys(payload).length === 0) {
          return interaction.editReply({ content: `${EMOJIS.INFO} No settings were specified. Nothing changed.` });
        }

        await api.updateAppSettings(selectedAppId, payload);

        const changed = Object.entries(payload).map(([k, v]) => {
          const labels: Record<string, string> = {
            status: `${EMOJIS.STATS} Status`, hash_check: '🔍 Hash Check',
            force_hwid: `${EMOJIS.LOCK} Force HWID`, block_leaked_passwords: '🚫 Block Leaked Passwords',
            min_username_length: '📏 Min Username Length'
          };
          let display = String(v);
          if (k === 'status') display = v === 1 ? 'Active' : 'Disabled';
          else if (k === 'min_username_length') display = `${v} chars`;
          else display = v === 1 ? 'Enabled' : 'Disabled';
          return `${labels[k] || k}: **${display}**`;
        }).join('\n');

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${EMOJIS.SETTINGS} Settings Updated — ${appName}`)
              .setColor('#22c55e')
              .setDescription(changed)
              .setTimestamp()
          ]
        });
      }

      // ─── VERSION ───────────────────────────────────────────────────────────
      if (subcommand === 'version') {
        await interaction.deferReply({ ephemeral: true });

        const newVersion = interaction.options.getString('new_version', true).trim();

        // Validate format: must be digits separated by dots e.g. 1.0.0, 2.1, 10.3.5
        if (!/^\d+(\.\d+)*$/.test(newVersion)) {
          return interaction.editReply({
            content: `${EMOJIS.ERROR} Invalid version format \`${newVersion}\`.\nMust be numbers separated by dots, e.g. \`1.0.0\` or \`2.1\`.`
          });
        }

        await api.updateAppSettings(selectedAppId, { version: newVersion });

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('🔢 Version Updated')
              .setColor('#22c55e')
              .addFields(
                { name: `${EMOJIS.TAG} App`, value: `\`${appName}\``, inline: true },
                { name: '🆕 New Version', value: `\`${newVersion}\``, inline: true }
              )
              .setFooter({ text: 'Users will be required to update to this version on next login.' })
              .setTimestamp()
          ]
        });
      }

      // ─── HASH-ADD ──────────────────────────────────────────────────────────
      if (subcommand === 'hash-add') {
        await interaction.deferReply({ ephemeral: true });

        const hashValue = interaction.options.getString('hash', true).trim();
        const result = await api.addHash(selectedAppId, hashValue);

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${EMOJIS.SUCCESS} Integrity Hash Added`)
              .setColor('#22c55e')
              .addFields(
                { name: '🔐 Hash', value: `\`${hashValue}\``, inline: false },
                { name: `${EMOJIS.TAG} App`, value: `\`${appName}\``, inline: true },
                { name: '🆔 Hash ID', value: `\`${result?.id || 'N/A'}\``, inline: true }
              )
              .setFooter({ text: 'Use /settings hash-list to see all registered hashes.' })
              .setTimestamp()
          ]
        });
      }

      // ─── HASH-LIST ─────────────────────────────────────────────────────────
      if (subcommand === 'hash-list') {
        await interaction.deferReply({ ephemeral: true });

        const hashes = await api.getHashes(selectedAppId);

        if (!hashes || hashes.length === 0) {
          return interaction.editReply({ content: `${EMOJIS.INFO} No integrity hashes registered for **${appName}**.` });
        }

        const embed = new EmbedBuilder()
          .setTitle(`${EMOJIS.SHIELD} Integrity Hashes — ${appName}`)
          .setColor('#5865F2')
          .setDescription(
            hashes.map((h: any, i: number) =>
              `**${i + 1}.** \`${h.hash_value || h.hash}\`\n› ID: \`${h.id}\``
            ).join('\n\n')
          )
          .setFooter({ text: `Total: ${hashes.length} hash(es) | Use ID with /settings hash-delete` })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // ─── HASH-DELETE ───────────────────────────────────────────────────────
      if (subcommand === 'hash-delete') {
        await interaction.deferReply({ ephemeral: true });

        const hashId = interaction.options.getString('hash_id', true).trim();
        await api.deleteHash(selectedAppId, hashId);

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${EMOJIS.TRASH} Hash Removed`)
              .setColor('#ef4444')
              .addFields(
                { name: '🆔 Hash ID', value: `\`${hashId}\``, inline: true },
                { name: `${EMOJIS.TAG} App`, value: `\`${appName}\``, inline: true }
              )
              .setTimestamp()
          ]
        });
      }

      // ─── HASH-RESET ────────────────────────────────────────────────────────
      if (subcommand === 'hash-reset') {
        await interaction.deferReply({ ephemeral: true });

        const hashes = await api.getHashes(selectedAppId);
        const count = hashes?.length || 0;

        await api.resetHashes(selectedAppId);

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${EMOJIS.TRASH} All Hashes Reset`)
              .setColor('#ef4444')
              .addFields(
                { name: `${EMOJIS.TAG} App`, value: `\`${appName}\``, inline: true },
                { name: `${EMOJIS.TRASH} Hashes Removed`, value: `${count}`, inline: true }
              )
              .setFooter({ text: 'All integrity hash checks disabled until new hashes are added.' })
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
