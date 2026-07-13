import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ApplicationIntegrationType, InteractionContextType } from 'discord.js';
import { ApiService } from '../services/api';
import { db } from '../utils/db';
import { EMOJIS } from '../utils/emojis';

export const subscriptionCommand = {
  data: new SlashCommandBuilder()
    .setName('subscription')
    .setDescription('Manage subscription plans for your active application.')
    .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all subscription plans for the active application.')
    )
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new subscription plan. (Admin only)')
        .addStringOption(o => o.setName('name').setDescription('Name of the subscription plan').setRequired(true))
        .addStringOption(o =>
          o.setName('level').setDescription('Authorization level — default: Level 1').setRequired(false)
            .addChoices({ name: 'Level 1', value: '1' }, { name: 'Level 2', value: '2' }, { name: 'Level 3', value: '3' })
        )
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete a subscription plan by name. (Admin only)')
        .addStringOption(o => o.setName('name').setDescription('Exact name of the plan to delete').setRequired(true))
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
      // ─── LIST ──────────────────────────────────────────────────────────────
      if (subcommand === 'list') {
        await interaction.deferReply({ ephemeral: true });

        const subs = await api.getSubscriptions(selectedAppId);

        if (!subs || subs.length === 0) {
          return interaction.editReply({ content: `${EMOJIS.INFO} No subscription plans found for **${appName}**.` });
        }

        const embed = new EmbedBuilder()
          .setTitle(`${EMOJIS.BALANCE} Subscription Plans — ${appName}`)
          .setColor('#5865F2')
          .setDescription(
            subs.map((s: any, i: number) =>
              `**${i + 1}.** \`${s.name || s.sub_name}\` — Level ${s.level || 1}`
            ).join('\n')
          )
          .setFooter({ text: `Total: ${subs.length} plan(s)` })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // ─── CREATE ────────────────────────────────────────────────────────────
      if (subcommand === 'create') {
        await interaction.deferReply({ ephemeral: true });

        const name = interaction.options.getString('name', true);
        const level = parseInt(interaction.options.getString('level') || '1');

        const sub = await api.createSubscription(selectedAppId, name, level);

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${EMOJIS.SUCCESS} Subscription Plan Created`)
              .setColor('#22c55e')
              .addFields(
                { name: `${EMOJIS.APP} Plan Name`, value: sub?.name || name, inline: true },
                { name: '🎯 Level', value: `Level ${level}`, inline: true },
                { name: `${EMOJIS.TAG} App`, value: `\`${appName}\``, inline: true }
              )
              .setTimestamp()
          ]
        });
      }

      // ─── DELETE ────────────────────────────────────────────────────────────
      if (subcommand === 'delete') {
        await interaction.deferReply({ ephemeral: true });

        const name = interaction.options.getString('name', true);
        const subs = await api.getSubscriptions(selectedAppId);
        const match = subs.find((s: any) =>
          (s.name || s.sub_name || '').toLowerCase() === name.toLowerCase()
        );

        if (!match) {
          return interaction.editReply({ content: `${EMOJIS.ERROR} Subscription plan \`${name}\` not found in **${appName}**.` });
        }

        await api.deleteSubscription(match.id);

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${EMOJIS.TRASH} Subscription Plan Deleted`)
              .setColor('#ef4444')
              .addFields(
                { name: `${EMOJIS.APP} Plan Name`, value: match.name || name, inline: true },
                { name: `${EMOJIS.TAG} App`, value: `\`${appName}\``, inline: true }
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
