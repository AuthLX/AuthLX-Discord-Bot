import fs from 'fs';
import path from 'path';

const DB_DIR = path.join(__dirname, '../../data');
const DB_FILE = path.join(DB_DIR, 'users.json');

interface UserDb {
  [discordId: string]: string; // Mapping of discord_id -> bot_secret
}

function initDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({}, null, 2), 'utf-8');
  }
}

function readDb(): UserDb {
  initDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading local JSON database:', error);
    return {};
  }
}

function writeDb(db: UserDb) {
  initDb();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing local JSON database:', error);
  }
}

export const db = {
  getUserSecret: (discordId: string): string | null => {
    const data = readDb();
    return data[discordId] || null;
  },

  setUserSecret: (discordId: string, secret: string): void => {
    const data = readDb();
    data[discordId] = secret;
    writeDb(data);
  },

  removeUserSecret: (discordId: string): boolean => {
    const data = readDb();
    if (data[discordId]) {
      delete data[discordId];
      writeDb(data);
      return true;
    }
    return false;
  }
};
