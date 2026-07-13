import { linkCommand, unlinkCommand } from './auth';
import { appCommand } from './app';
import { licenseCommand } from './license';
import { userCommand } from './user';
import { settingsCommand } from './settings';
import { teamCommand } from './team';
import { subscriptionCommand } from './subscription';
import { sessionCommand } from './session';
import { helpCommand } from './help';

export const commands = [
  linkCommand,
  unlinkCommand,
  appCommand,
  licenseCommand,
  userCommand,
  settingsCommand,
  teamCommand,
  subscriptionCommand,
  sessionCommand,
  helpCommand
];
