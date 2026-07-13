import {
  SlashCommandBuilder, ChatInputCommandInteraction,
  AutocompleteInteraction, EmbedBuilder,
  ApplicationIntegrationType, InteractionContextType
} from 'discord.js';
import { db } from '../utils/db';
import { ApiService } from '../services/api';

export const appCommand = {
  data: new SlashCommandBuilder()
    .setName('app')
    .setDescription('Manage and switch between your AuthLX applications.')
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new application. (Requires App Management permission)')
        .addStringOption(o => o.setName('name').setDescription('Application name').setRequired(true))
        .addStringOption(o => o.setName('version').setDescription('Initial version string (e.g. 1.0.0) — defaults to 1.0.0').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('switch')
        .setDescription('Select the active application for all bot commands.')
        .addStringOption(option =>
          option.setName('application')
            .setDescription('Name of the application to switch to')
            .setAutocomplete(true)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all applications available to you.')
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('View statistics and overview of the currently active application.')
    )
    .addSubcommand(sub =>
      sub.setName('snapshot')
        .setDescription('Full real-time snapshot: stats, settings, your role, and permissions.')
    )
    .addSubcommand(sub =>
      sub.setName('pause')
        .setDescription('Pause (disable) the active application — users cannot login while paused.')
    )
    .addSubcommand(sub =>
      sub.setName('resume')
        .setDescription('Resume (enable) the active application — users can login again.')
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    const secret = db.getUserSecret(interaction.user.id) || undefined;
    let responded = false;
    try {
      const api = new ApiService({ discordId: interaction.user.id, secret });
      const apps = await api.getApps();
      const focusedValue = interaction.options.getFocused().toLowerCase();
      const filtered = apps
        .filter((app: any) => app.name.toLowerCase().includes(focusedValue))
        .slice(0, 25)
        .map((app: any) => ({ name: app.name, value: app.id }));
      responded = true;
      await interaction.respond(filtered);
    } catch (err) {
      if (!responded) {
        try {
          await interaction.respond([]);
        } catch {}
      }
    }
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const discordId = interaction.user.id;
    const secret = db.getUserSecret(discordId) || undefined;
    const api = new ApiService({ discordId, secret });

    try {
      // ─── CREATE ────────────────────────────────────────────────────────────
      if (subcommand === 'create') {
        await interaction.deferReply({ ephemeral: true });

        const name = interaction.options.getString('name', true).trim();
        const version = interaction.options.getString('version')?.trim() || '1.0.0';

        if (!/^\d+(\.\d+)*$/.test(version)) {
          return interaction.editReply({
            content: `❌ Invalid version format \`${version}\`. Must be numbers separated by dots, e.g. \`1.0.0\` or \`2.1\`.`
          });
        }

        const app = await api.createApp(name, version);

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('✅ Application Created')
              .setColor('#22c55e')
              .addFields(
                { name: '📱 App Name', value: `\`${app?.name || name}\``, inline: true },
                { name: '🔢 Version', value: `\`${app?.version || version}\``, inline: true },
                { name: '🆔 App ID', value: `\`${app?.id || 'Check dashboard'}\``, inline: false },
                { name: '🔑 API Key', value: app?.api_key ? `||\`${app.api_key}\`||` : '*(Check dashboard)*', inline: false }
              )
              .setFooter({ text: 'Use /app switch to activate this application.' })
              .setTimestamp()
          ]
        });
      }

      // ─── SWITCH ────────────────────────────────────────────────────────────
      if (subcommand === 'switch') {
        const appId = interaction.options.getString('application', true);
        await interaction.deferReply({ ephemeral: true });

        const res = await api.selectApp(appId);
        const appName = res.data?.selected_app_name || appId;

        // Fetch app details + stats + fresh profile (real-time permissions) in parallel
        const [details, stats, freshProfile] = await Promise.allSettled([
          api.getAppById(appId),
          api.getOverview(appId),
          api.getDiscordProfile()
        ]);

        const appData = details.status === 'fulfilled' ? details.value : null;
        const statsData = stats.status === 'fulfilled' ? stats.value : null;
        const botProfile = freshProfile.status === 'fulfilled' ? freshProfile.value?.profile : null;

        // membership comes from getAppById (user_apps row for this user+app)
        const membership = appData?.membership;
        const effectiveRole = membership?.role || 'admin';

        const statusLabel = appData?.status ? '🟢 Active' : '🔴 Disabled';
        const version = appData?.version ? `v${appData.version}` : '';

        // Build role-specific fields
        const roleDisplayFields = buildRoleFields(effectiveRole, membership, botProfile);

        const embed = new EmbedBuilder()
          .setTitle(`✅ Switched to: ${appName} ${version}`)
          .setColor('#22c55e')
          .addFields(
            { name: '📊 App Status', value: statusLabel, inline: true },
            { name: '🎭 Your Role', value: formatRole(effectiveRole), inline: true },
            { name: '👥 Users', value: `${statsData?.totalUsers ?? '—'}`, inline: true },
            { name: '🔑 Licenses', value: `${statsData?.totalLicenses ?? '—'}`, inline: true },
            { name: '💳 Subscriptions', value: `${statsData?.totalSubscriptions ?? '—'}`, inline: true },
            { name: '🟢 Sessions', value: `${statsData?.activeSessions ?? '—'}`, inline: true },
            ...roleDisplayFields
          )
          .setFooter({ text: 'All commands now execute under this application. Permissions enforced in real-time.' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // ─── LIST ──────────────────────────────────────────────────────────────
      if (subcommand === 'list') {
        await interaction.deferReply({ ephemeral: true });

        const [apps, profileRes] = await Promise.all([
          api.getApps(),
          api.getDiscordProfile().catch(() => null)
        ]);
        const selectedAppId = profileRes?.profile?.selected_app_id;

        if (!apps || apps.length === 0) {
          return interaction.editReply({
            content: '❌ You have no applications. Create one with `/app create` or on the web dashboard.'
          });
        }

        const embed = new EmbedBuilder()
          .setTitle('📱 Your Applications')
          .setColor('#5865F2')
          .setDescription(
            apps.map((app: any) => {
              const isSelected = app.id === selectedAppId;
              const statusDot = app.status ? '🟢' : '🔴';
              const role = app.membership?.role || 'admin';
              const roleLabel = formatRole(role);
              const version = app.version ? ` \`v${app.version}\`` : '';
              return `${isSelected ? '▶ ' : '   '}${statusDot} **${app.name}**${version} — ${roleLabel}\n› ID: \`${app.id}\``;
            }).join('\n\n')
          )
          .setFooter({ text: `Total: ${apps.length} app(s) | ▶ = currently selected | Use /app switch to change` })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // ─── STATUS ────────────────────────────────────────────────────────────
      if (subcommand === 'status') {
        await interaction.deferReply({ ephemeral: true });

        const profileRes = await api.getDiscordProfile();
        const selectedAppId = profileRes?.profile?.selected_app_id;

        if (!selectedAppId) {
          const apps = await api.getApps().catch(() => []);
          if (!apps || apps.length === 0) {
            return interaction.editReply({ content: '❌ You have no applications. Create one with `/app create`.' });
          }
          return interaction.editReply({ content: '❌ No application selected. Use `/app switch` to set your active application.' });
        }

        const [apps, stats] = await Promise.all([
          api.getApps(),
          api.getOverview(selectedAppId)
        ]);

        const activeApp = apps.find((app: any) => app.id === selectedAppId);
        const appName = activeApp?.name || 'Unknown Application';
        const statusLabel = activeApp?.status ? '🟢 Active' : '🔴 Disabled';
        const version = activeApp?.version ? `v${activeApp.version}` : 'N/A';

        const embed = new EmbedBuilder()
          .setTitle(`📊 Application Stats: ${appName}`)
          .setDescription(`Live overview for \`${selectedAppId}\`.`)
          .setColor('#5865F2')
          .addFields(
            { name: '📊 Status', value: statusLabel, inline: true },
            { name: '🔢 Version', value: `\`${version}\``, inline: true },
            { name: '🔑 Total Licenses', value: `${stats?.totalLicenses ?? 0}`, inline: true },
            { name: '✨ Unused Licenses', value: `${stats?.unusedLicenses ?? 0}`, inline: true },
            { name: '👥 Total Users', value: `${stats?.totalUsers ?? 0}`, inline: true },
            { name: '🟢 Active Sessions', value: `${stats?.activeSessions ?? 0}`, inline: true },
            { name: '🎟️ Active Tokens', value: `${stats?.totalTokens ?? 0}`, inline: true },
            { name: '💳 Subscriptions', value: `${stats?.totalSubscriptions ?? 0}`, inline: true },
            { name: '⚠️ Blacklisted', value: `${stats?.blacklistedHwids ?? stats?.blacklisted ?? 0}`, inline: true }
          )
          .setFooter({ text: 'AuthLX Bot Integration • Live data' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // ─── SNAPSHOT ──────────────────────────────────────────────────────────
      if (subcommand === 'snapshot') {
        await interaction.deferReply({ ephemeral: true });

        const profileRes = await api.getDiscordProfile();
        const selectedAppId = profileRes?.profile?.selected_app_id;
        const botProfile = profileRes?.profile;

        if (!selectedAppId) {
          return interaction.editReply({ content: '❌ No application selected. Use `/app switch` first.' });
        }

        // Fetch all data in parallel — no caching, all real-time
        const [appDetails, stats, hashesResult] = await Promise.allSettled([
          api.getAppById(selectedAppId),
          api.getOverview(selectedAppId),
          api.getHashes(selectedAppId).catch(() => [] as any[])
        ]);

        const app = appDetails.status === 'fulfilled' ? appDetails.value : null;
        const statsData = stats.status === 'fulfilled' ? stats.value : null;
        const hashes = hashesResult.status === 'fulfilled' ? (hashesResult.value || []) : [];
        const membership = app?.membership;
        const effectiveRole = membership?.role || 'admin';

        const yn = (v: any) => v ? '✅' : '❌';
        const statusLabel = app?.status ? '🟢 Active' : '🔴 Disabled';

        // Bot-level permissions (real-time from DB via getDiscordProfile)
        const botPerms = botProfile ? [
          botProfile.bot_can_view_overview ? '📊 Overview' : null,
          botProfile.bot_can_manage_apps ? '📱 Apps' : null,
          botProfile.bot_can_manage_licenses ? '🔑 Licenses' : null,
          botProfile.bot_can_manage_users ? '👥 Users' : null,
          botProfile.bot_can_manage_subscriptions ? '💳 Subscriptions' : null,
          botProfile.bot_can_manage_sessions ? '⚡ Sessions' : null,
          botProfile.bot_can_manage_settings ? '⚙️ Settings' : null,
          botProfile.bot_can_view_team ? '👁️ Team' : null
        ].filter(Boolean).join(' · ') || 'None' : '—';

        // Role-specific context
        const roleFields = buildRoleFields(effectiveRole, membership, botProfile);

        const embed = new EmbedBuilder()
          .setTitle(`📸 Snapshot — ${app?.name || selectedAppId}`)
          .setColor(app?.status ? '#5865F2' : '#ef4444')
          .addFields(
            // App Overview
            { name: '📊 Status', value: statusLabel, inline: true },
            { name: '🔢 Version', value: `\`${app?.version || 'N/A'}\``, inline: true },
            { name: '🎭 Your Role', value: formatRole(effectiveRole), inline: true },
            // Live Stats
            { name: '👥 Users', value: `${statsData?.totalUsers ?? 0}`, inline: true },
            { name: '🔑 Licenses', value: `${statsData?.totalLicenses ?? 0}`, inline: true },
            { name: '✨ Unused', value: `${statsData?.unusedLicenses ?? 0}`, inline: true },
            { name: '🟢 Sessions', value: `${statsData?.activeSessions ?? 0}`, inline: true },
            { name: '💳 Plans', value: `${statsData?.totalSubscriptions ?? 0}`, inline: true },
            { name: '🎟️ Tokens', value: `${statsData?.totalTokens ?? 0}`, inline: true },
            // Security Settings
            { name: '🔒 Force HWID', value: yn(app?.force_hwid), inline: true },
            { name: '🔍 Hash Check', value: yn(app?.hash_check), inline: true },
            { name: '🔐 Hashes', value: `${hashes.length} registered`, inline: true },
            { name: '🚫 Block Leaked PWD', value: yn(app?.block_leaked_passwords), inline: true },
            { name: '🌐 Block VPNs', value: yn(app?.block_vpns), inline: true },
            { name: '📏 Min Username', value: `${app?.min_username_length || 1} chars`, inline: true },
            // Bot Permissions (live from DB)
            { name: '🤖 Bot Permissions (Live)', value: botPerms, inline: false },
            // Role-specific
            ...roleFields
          )
          .setFooter({ text: `App ID: ${selectedAppId} | All data is live — no cache` })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // ─── PAUSE ─────────────────────────────────────────────────────────────
      if (subcommand === 'pause') {
        await interaction.deferReply({ ephemeral: true });

        const profileRes = await api.getDiscordProfile();
        const selectedAppId = profileRes?.profile?.selected_app_id;
        const appName = profileRes?.profile?.selected_app_name || selectedAppId;

        if (!selectedAppId) {
          return interaction.editReply({ content: '❌ No application selected. Use `/app switch` first.' });
        }

        // GET current state first
        const appData = await api.getAppById(selectedAppId);
        if (appData?.status === false || appData?.status === 0) {
          return interaction.editReply({ content: `ℹ️ **${appName}** is already paused (disabled).` });
        }

        await api.updateAppSettings(selectedAppId, { status: 0 });

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('⏸️ Application Paused')
              .setColor('#f59e0b')
              .addFields(
                { name: '📱 Application', value: `\`${appName}\``, inline: true },
                { name: '📊 New Status', value: '🔴 Disabled', inline: true }
              )
              .setDescription('All user logins are now blocked. Use `/app resume` to re-enable.')
              .setTimestamp()
          ]
        });
      }

      // ─── RESUME ────────────────────────────────────────────────────────────
      if (subcommand === 'resume') {
        await interaction.deferReply({ ephemeral: true });

        const profileRes = await api.getDiscordProfile();
        const selectedAppId = profileRes?.profile?.selected_app_id;
        const appName = profileRes?.profile?.selected_app_name || selectedAppId;

        if (!selectedAppId) {
          return interaction.editReply({ content: '❌ No application selected. Use `/app switch` first.' });
        }

        const appData = await api.getAppById(selectedAppId);
        if (appData?.status === true || appData?.status === 1) {
          return interaction.editReply({ content: `ℹ️ **${appName}** is already active (running).` });
        }

        await api.updateAppSettings(selectedAppId, { status: 1 });

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('▶️ Application Resumed')
              .setColor('#22c55e')
              .addFields(
                { name: '📱 Application', value: `\`${appName}\``, inline: true },
                { name: '📊 New Status', value: '🟢 Active', inline: true }
              )
              .setDescription('User logins are now enabled.')
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatRole(role: string): string {
  const map: Record<string, string> = {
    admin: '👑 Admin (Owner)',
    master_admin: '👑 Master Admin',
    manager: '🛡️ Manager',
    reseller: '🏪 Reseller'
  };
  return map[role?.toLowerCase()] || role;
}

/**
 * Returns embed fields tailored to the user's effective role in the current app.
 * These are fetched fresh from DB on every switch/snapshot — no caching.
 */
function buildRoleFields(role: string, membership: any, botProfile: any): { name: string; value: string; inline: boolean }[] {
  const fields: { name: string; value: string; inline: boolean }[] = [];

  if (!membership) return fields;

  const r = (role || '').toLowerCase();

  if (r === 'reseller') {
    const isUnlimited = !!membership.is_unlimited_reseller;
    if (isUnlimited) {
      fields.push({ name: '♾️ Reseller Type', value: 'Unlimited — No balance restrictions', inline: false });
    } else {
      // Show balance for each duration tier
      const balanceLines = [
        membership.balance_day ? `📅 Daily: **${membership.balance_day}** keys` : null,
        membership.balance_week ? `📅 Weekly: **${membership.balance_week}** keys` : null,
        membership.balance_month ? `📅 Monthly: **${membership.balance_month}** keys` : null,
        membership.balance_three_month ? `📅 3-Month: **${membership.balance_three_month}** keys` : null,
        membership.balance_six_month ? `📅 6-Month: **${membership.balance_six_month}** keys` : null,
        membership.balance_year ? `📅 Annual: **${membership.balance_year}** keys` : null,
        membership.balance_lifetime ? `📅 Lifetime: **${membership.balance_lifetime}** keys` : null,
      ].filter(Boolean);

      const balanceText = balanceLines.length > 0 ? balanceLines.join('\n') : 'No balance — contact admin';
      fields.push({ name: '💰 Your License Balance', value: balanceText, inline: false });

      // What resellers can do
      fields.push({
        name: '🔐 Your Permissions',
        value: '✅ View/Generate Licenses | ✅ View/Edit Users you created\n❌ Cannot create users manually | ❌ Cannot manage settings',
        inline: false
      });
    }

    // Show allowed license levels if set
    if (membership.allowed_license_levels) {
      fields.push({ name: '🎯 Allowed License Levels', value: `Level ${membership.allowed_license_levels}`, inline: true });
    }
  }

  if (r === 'manager') {
    // For managers, bot-level permissions are what controls access here since
    // requirePermission checks the permissions table fresh on every API call
    const perms = [
      botProfile?.bot_can_manage_licenses ? '✅ Licenses' : '❌ Licenses',
      botProfile?.bot_can_manage_users ? '✅ Users' : '❌ Users',
      botProfile?.bot_can_manage_subscriptions ? '✅ Subscriptions' : '❌ Subscriptions',
      botProfile?.bot_can_manage_sessions ? '✅ Sessions' : '❌ Sessions',
      botProfile?.bot_can_manage_settings ? '✅ Settings' : '❌ Settings',
      botProfile?.bot_can_view_team ? '✅ Team View' : '❌ Team View',
    ].join(' | ');

    fields.push({
      name: '🔐 Manager Permissions (Live)',
      value: perms || 'No specific permissions set',
      inline: false
    });
  }

  return fields;
}
