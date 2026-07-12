import { Interaction } from 'discord.js';
import { commands } from '../commands';

export const interactionEvent = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction: Interaction) {
    // 1. Handle Slash Commands
    if (interaction.isChatInputCommand()) {
      const command = commands.find(cmd => cmd.data.name === interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`Error executing command ${interaction.commandName}:`, error);
        const errorMsg = 'There was an error while executing this command!';
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorMsg, ephemeral: true }).catch(() => {});
        } else {
          await interaction.reply({ content: errorMsg, ephemeral: true }).catch(() => {});
        }
      }
    }

    // 2. Handle Autocomplete
    if (interaction.isAutocomplete()) {
      const command = commands.find(cmd => cmd.data.name === interaction.commandName);
      if (!command || !('autocomplete' in command)) return;

      try {
        await (command as any).autocomplete(interaction);
      } catch (error) {
        console.error(`Autocomplete error for command ${interaction.commandName}:`, error);
      }
    }
  }
};
