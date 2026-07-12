import { Client, GatewayIntentBits } from 'discord.js';
import { config } from './config';
import { readyEvent } from './events/ready';
import { interactionEvent } from './events/interaction';

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds // Required for commands and autocomplete
  ]
});

// Bind event listeners
client.once(readyEvent.name, readyEvent.execute);
client.on(interactionEvent.name, interactionEvent.execute);

// Login to Discord
client.login(config.discordToken)
  .then(() => {
    console.log('🔌 Discord Bot connecting...');
  })
  .catch(err => {
    console.error('❌ Failed to log in to Discord. Check your DISCORD_TOKEN configuration.', err);
    process.exit(1);
  });
