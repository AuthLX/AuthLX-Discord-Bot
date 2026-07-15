import { Client, GuildMember } from 'discord.js';
import { config } from '../config';
import { ApiService } from './api';

const api = new ApiService({ discordId: 'bot-sync' });

/**
 * Checks if a given plan and expiration date represent an active paid subscription.
 */
function isSubscriptionActive(plan: string | null | undefined, expiresAtStr: string | null | undefined): boolean {
  if (!plan || plan === 'Free') return false;
  if (!expiresAtStr) return true; // Lifetime plan
  
  const expiresAt = new Date(expiresAtStr);
  return expiresAt > new Date();
}

/**
 * Syncs the Discord roles of a single member in the official guild.
 */
export async function syncUserRole(client: Client, discordId: string, planData?: { plan: string; plan_expires_at: string | null } | null) {
  const guildId = config.guildId;
  if (!guildId) {
    console.error('⚠️ [ROLE SYNC] Guild ID is not configured.');
    return;
  }

  const devRoleId = config.developerRoleId;
  const sellerRoleId = config.sellerRoleId;
  if (!devRoleId && !sellerRoleId) {
    console.warn('⚠️ [ROLE SYNC] Neither Developer nor Seller role IDs are configured.');
    return;
  }

  try {
    const guild = await client.guilds.fetch(guildId);
    if (!guild) {
      console.error(`❌ [ROLE SYNC] Guild not found for ID: ${guildId}`);
      return;
    }

    // 1. Fetch member in guild
    let member: GuildMember;
    try {
      member = await guild.members.fetch(discordId);
    } catch (err) {
      // User is not in the guild/server
      return;
    }

    // 2. If planData is not provided, fetch it from backend
    let userPlan = planData;
    if (userPlan === undefined) {
      userPlan = await api.getBotLinkedUser(discordId);
    }

    const hasActiveDeveloper = userPlan && userPlan.plan === 'Developer' && isSubscriptionActive(userPlan.plan, userPlan.plan_expires_at);
    const hasActiveSeller = userPlan && userPlan.plan === 'Seller' && isSubscriptionActive(userPlan.plan, userPlan.plan_expires_at);

    // 3. Sync Developer Role
    if (devRoleId) {
      const hasDevRole = member.roles.cache.has(devRoleId);
      if (hasActiveDeveloper && !hasDevRole) {
        await member.roles.add(devRoleId);
        console.log(`➕ [ROLE SYNC] Added Developer role to ${member.user.tag} (${discordId})`);
      } else if (!hasActiveDeveloper && hasDevRole) {
        await member.roles.remove(devRoleId);
        console.log(`➖ [ROLE SYNC] Removed Developer role from ${member.user.tag} (${discordId})`);
      }
    }

    // 4. Sync Seller Role
    if (sellerRoleId) {
      const hasSellerRole = member.roles.cache.has(sellerRoleId);
      if (hasActiveSeller && !hasSellerRole) {
        await member.roles.add(sellerRoleId);
        console.log(`➕ [ROLE SYNC] Added Seller role to ${member.user.tag} (${discordId})`);
      } else if (!hasActiveSeller && hasSellerRole) {
        await member.roles.remove(sellerRoleId);
        console.log(`➖ [ROLE SYNC] Removed Seller role from ${member.user.tag} (${discordId})`);
      }
    }

  } catch (error: any) {
    console.error(`❌ [ROLE SYNC] Failed to sync roles for user ${discordId}:`, error.message);
  }
}

/**
 * Reconciles roles for all members in the Discord server based on database records.
 */
export async function syncAllRoles(client: Client) {
  const guildId = config.guildId;
  if (!guildId) {
    console.error('⚠️ [ROLE SYNC] Guild ID is not configured.');
    return;
  }

  const devRoleId = config.developerRoleId;
  const sellerRoleId = config.sellerRoleId;
  if (!devRoleId && !sellerRoleId) {
    console.warn('⚠️ [ROLE SYNC] Neither Developer nor Seller role IDs are configured.');
    return;
  }

  console.log('🔄 [ROLE SYNC] Starting full roles reconciliation...');

  try {
    const guild = await client.guilds.fetch(guildId);
    if (!guild) {
      console.error(`❌ [ROLE SYNC] Guild not found for ID: ${guildId}`);
      return;
    }

    // 1. Fetch all linked users from the backend
    const linkedUsers = await api.getBotLinkedUsers();
    const linkedUsersMap = new Map(linkedUsers.map(u => [u.discord_id, u]));

    // 2. Fetch all members of the guild (needs GuildMembers intent)
    const members = await guild.members.fetch();

    console.log(`📊 [ROLE SYNC] Found ${members.size} server members and ${linkedUsers.length} linked dashboard users.`);

    for (const [memberId, member] of members) {
      const userPlan = linkedUsersMap.get(memberId) || null;

      const hasActiveDeveloper = userPlan && userPlan.plan === 'Developer' && isSubscriptionActive(userPlan.plan, userPlan.plan_expires_at);
      const hasActiveSeller = userPlan && userPlan.plan === 'Seller' && isSubscriptionActive(userPlan.plan, userPlan.plan_expires_at);

      // Reconcile Developer Role
      if (devRoleId) {
        const hasDevRole = member.roles.cache.has(devRoleId);
        if (hasActiveDeveloper && !hasDevRole) {
          await member.roles.add(devRoleId);
          console.log(`➕ [ROLE SYNC] Added Developer role to ${member.user.tag}`);
        } else if (!hasActiveDeveloper && hasDevRole) {
          await member.roles.remove(devRoleId);
          console.log(`➖ [ROLE SYNC] Removed Developer role from ${member.user.tag}`);
        }
      }

      // Reconcile Seller Role
      if (sellerRoleId) {
        const hasSellerRole = member.roles.cache.has(sellerRoleId);
        if (hasActiveSeller && !hasSellerRole) {
          await member.roles.add(sellerRoleId);
          console.log(`➕ [ROLE SYNC] Added Seller role to ${member.user.tag}`);
        } else if (!hasActiveSeller && hasSellerRole) {
          await member.roles.remove(sellerRoleId);
          console.log(`➖ [ROLE SYNC] Removed Seller role from ${member.user.tag}`);
        }
      }
    }

    console.log('✅ [ROLE SYNC] Full roles reconciliation completed.');
  } catch (error: any) {
    console.error('❌ [ROLE SYNC] Full reconciliation failed:', error.message);
  }
}

/**
 * Starts a recurring cron-like interval that runs full sync every 10 minutes.
 */
export function startPeriodicSync(client: Client) {
  // Sync every 10 minutes
  const intervalMs = 10 * 60 * 1000;
  setInterval(() => {
    syncAllRoles(client).catch(err => {
      console.error('❌ [ROLE SYNC] Periodic sync interval error:', err.message);
    });
  }, intervalMs);
  
  console.log('⏰ [ROLE SYNC] Scheduled periodic roles reconciliation to run every 10 minutes.');
}
