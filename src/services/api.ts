import axios from 'axios';
import { config } from '../config';

export interface ApiClientOptions {
  discordId: string;
  secret?: string;
}

export class ApiService {
  private client;

  constructor(options: ApiClientOptions) {
    this.client = axios.create({
      baseURL: config.apiUrl,
      headers: {
        'x-discord-id': options.discordId,
        'x-discord-secret': options.secret || '',
        'x-bot-token': config.discordToken || '',
        'Content-Type': 'application/json'
      }
    });
  }

  // Handle standard axios errors and return clean string
  private handleError(error: any): string {
    if (error.response && error.response.data) {
      const data = error.response.data;
      // Zod validation errors: { message: 'Validation Error', errors: [{message: '...'}] }
      if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
        const issues = data.errors.map((e: any) => {
          const field = e.path?.join('.') || e.field;
          return field ? `${field}: ${e.message}` : e.message;
        }).join(', ');
        return `Validation Error — ${issues}`;
      }
      return data.message || data.error || 'Request failed';
    }
    return error.message || 'Unknown network error';
  }

  // ===================== DISCORD PROFILE =====================
  async getDiscordProfile() {
    try {
      const res = await this.client.get('/auth/discord/profile');
      return res.data.data;
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  // ===================== APPLICATIONS =====================
  async getApps() {
    try {
      const res = await this.client.get('/apps');
      return res.data.data.apps;
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  async getAppById(appId: string) {
    try {
      const res = await this.client.get(`/apps/${appId}`);
      return res.data.data.app;
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  async createApp(name: string, version: string) {
    try {
      const res = await this.client.post('/apps', { name, version });
      return res.data.data.app;
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  async selectApp(appId: string) {
    try {
      const res = await this.client.post('/auth/discord/select-app', { appId });
      return res.data;
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  // ===================== OVERVIEW =====================
  async getOverview(appId: string) {
    try {
      const res = await this.client.get(`/overview?appId=${appId}`);
      return res.data.data;
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  // ===================== LICENSES =====================
  async getLicenses(appId: string, filter?: 'all' | 'used' | 'unused') {
    try {
      let url = `/licenses?appId=${appId}`;
      if (filter && filter !== 'all') url += `&status=${filter}`;
      const res = await this.client.get(url);
      return res.data.data.licenses as any[];
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  async generateLicenses(data: {
    appId: string;
    amount: number;
    mask: string;
    lowercaseLetters: boolean;
    capitalLetters: boolean;
    level: string;
    note: string;
    expiry: number;
    duration: number;
  }) {
    try {
      const res = await this.client.post('/licenses/generate', {
        app_id: data.appId,
        amount: data.amount,
        mask: data.mask,
        lowercaseLetters: data.lowercaseLetters,
        capitalLetters: data.capitalLetters,
        level: data.level,
        note: data.note,
        expiry: data.expiry,
        duration: data.duration
      });
      return res.data.data;
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  async deleteLicense(licenseId: string) {
    try {
      const res = await this.client.delete(`/licenses/${licenseId}`);
      return res.data;
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  async banLicense(licenseId: string) {
    try {
      const res = await this.client.put(`/licenses/${licenseId}`, { status: 'banned' });
      return res.data;
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  // ===================== SUBSCRIPTIONS =====================
  async getSubscriptions(appId: string) {
    try {
      const res = await this.client.get(`/subscriptions?appId=${appId}`);
      return res.data.data.subscriptions as any[];
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  async createSubscription(appId: string, name: string, level: number) {
    try {
      const res = await this.client.post('/subscriptions', { appId, subname: name, level });
      return res.data.data.subscription;
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  async deleteSubscription(subId: string) {
    try {
      const res = await this.client.delete(`/subscriptions/${subId}`);
      return res.data;
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  // ===================== USERS =====================
  async getUsers(appId: string, search?: string) {
    try {
      const url = search
        ? `/users?appId=${appId}&search=${encodeURIComponent(search)}`
        : `/users?appId=${appId}`;
      const res = await this.client.get(url);
      return res.data.data.users as any[];
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  async createUser(appId: string, data: any) {
    try {
      const res = await this.client.post('/users', { appId, ...data });
      return res.data.data;
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  async updateUser(userId: string, data: any) {
    try {
      const res = await this.client.put(`/users/${userId}`, data);
      return res.data.data;
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  async deleteUser(userId: string) {
    try {
      const res = await this.client.delete(`/users/${userId}`);
      return res.data;
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  async resetUserHwid(userId: string) {
    try {
      const res = await this.client.post(`/users/${userId}/reset-hwid`);
      return res.data;
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  // ===================== SESSIONS =====================
  async getSessions(appId: string) {
    try {
      const res = await this.client.get(`/sessions?appId=${appId}`);
      return res.data.data.sessions as any[];
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  async deleteSession(sessionId: string) {
    try {
      const res = await this.client.delete(`/sessions/${sessionId}`);
      return res.data;
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  // ===================== SETTINGS =====================
  async updateAppSettings(appId: string, settings: any) {
    try {
      const res = await this.client.put(`/apps/${appId}`, settings);
      return res.data;
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  async testWebhook(appId: string, webhookUrl?: string) {
    try {
      const res = await this.client.post(`/apps/${appId}/webhook/test`, { webhook_url: webhookUrl });
      return res.data;
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  // ===================== INTEGRITY HASHES =====================
  async getHashes(appId: string) {
    try {
      const res = await this.client.get(`/apps/${appId}/hashes`);
      return res.data.data as any[];
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  async addHash(appId: string, hashValue: string) {
    try {
      const res = await this.client.post(`/apps/${appId}/hashes`, { hash_value: hashValue });
      return res.data.data;
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  async deleteHash(appId: string, hashId: string) {
    try {
      const res = await this.client.delete(`/apps/${appId}/hashes/${hashId}`);
      return res.data;
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  async resetHashes(appId: string) {
    try {
      const res = await this.client.delete(`/apps/${appId}/hashes`);
      return res.data;
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  // ===================== TEAM =====================
  async getTeamMembers(appId: string) {
    try {
      const res = await this.client.get(`/team?appId=${appId}`);
      return res.data.data;
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  // ===================== BOT ROLE SYNC =====================
  async getBotLinkedUsers() {
    try {
      const res = await this.client.get('/bot/linked-users');
      return res.data.data as Array<{ discord_id: string; plan: string; plan_expires_at: string | null }>;
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }

  async getBotLinkedUser(discordId: string) {
    try {
      const res = await this.client.get(`/bot/linked-users/${discordId}`);
      return res.data.data as { discord_id: string; plan: string; plan_expires_at: string | null } | null;
    } catch (err) {
      throw new Error(this.handleError(err));
    }
  }
}
