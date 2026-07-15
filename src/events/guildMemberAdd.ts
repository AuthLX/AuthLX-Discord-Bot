import { GuildMember } from 'discord.js';
import { syncUserRole } from '../services/roleSyncService';

export const guildMemberAddEvent = {
  name: 'guildMemberAdd',
  once: false,
  async execute(member: GuildMember) {
    console.log(`👤 Member joined: ${member.user.tag} (${member.id}). Checking subscription roles...`);
    await syncUserRole(member.client, member.id);
  }
};
