# AuthLX Discord Bot Integration

The official, open-source Discord bot for managing the **AuthLX** platform. This bot allows developers, admins, resellers, and managers to manage applications, licenses, users, subscriptions, and active client sessions directly from their Discord guild.

---

## 🛠️ Discord Developer Portal Setup

To deploy and self-host this bot, follow these configuration steps in the [Discord Developer Portal](https://discord.com/developers/applications):

### 1. Create a New Application
1. Click **New Application** and give it a name (e.g., `AuthLX Manager`).
2. Go to the **General Information** tab and copy your **Application ID** (this is your `DISCORD_CLIENT_ID`).

### 2. Configure Bot User
1. Go to the **Bot** tab on the left sidebar.
2. Click **Add Bot**.
3. Under the bot name, copy the **Token** (this is your `DISCORD_TOKEN`). Keep this highly secure!
4. **Privileged Gateway Intents**: Enable **NONE** (this bot runs purely on slash commands and autocomplete interaction events, so it does not require message content or presence intents, maintaining low memory usage).

### 3. Generate Bot Invite Link
1. Go to the **OAuth2** tab, then select the **URL Generator** sub-menu.
2. Under **Scopes**, check:
   - `bot`
   - `applications.commands` (crucial for slash command registration)
3. Under **Bot Permissions**, check:
   - `Send Messages`
   - `Embed Links` (needed to render embed cards for user searches and stats)
4. Copy the generated URL at the bottom and open it in a browser to invite the bot to your Discord server.

---

## ⚙️ Local Configuration

1. Copy `example.env` to `.env`:
   ```bash
   cp example.env .env
   ```
2. Populate the parameters in `.env`:
   - `DISCORD_TOKEN`: Paste the bot token.
   - `DISCORD_CLIENT_ID`: Paste the application client ID.
   - `DISCORD_GUILD_ID`: (Optional) Paste the ID of your developer Discord server. This will register slash commands instantly to that specific server, bypassing the global 1-hour propagation delay.
   - `AUTH_API_URL`: Points to your hosted AuthLX developer backend API (`https://api.authlx.com/api/v1/dev` by default).

---

## 🚀 Running the Bot

### Installation
Install node dependencies using npm:
```bash
npm install
```

### Development Mode (Local Live Reloading)
Runs the bot using `ts-node` directly:
```bash
npm run dev
```

### Production Build & Execution
Compile the TypeScript code and start the compiled files:
```bash
npm run build
```
```bash
npm start
```

---

## 📚 Bot Slash Commands

### 🔒 Authentication (DMs / Ephemeral Responses)
Before executing app or user commands, you must link your Discord profile with your AuthLX account:
- `/link token:<your_dashboard_bot_secret>`: Maps your Discord ID to your dashboard secret token securely (ephemeral response hides token from chat logs).
- `/unlink`: Revokes access and deletes the local token association.

### 📊 Application Operations (`/app`)
- `/app create name:<str> [version:1.0.0]`: Creates a new application. (Requires App Management permission).
- `/app switch application:<select>`: Toggles the active application scope for your commands (has autocomplete support). Displays real-time role, balance, and permissions on switch.
- `/app status`: Shows real-time statistics (total users, active sessions, blacklists, licenses, subscriptions).
- `/app list`: Lists all applications available to you along with your role.
- `/app snapshot`: Displays a complete snapshot: settings, live stats, registered hashes, and bot permissions.
- `/app pause`: Pauses the active application (blocks user logins).
- `/app resume`: Resumes the active application (allows user logins).

### 🔑 License Management (`/license`)
- `/license generate [amount:1] [duration:30d] [level:1] [mask] [note]`: Generates product keys and prints them in chat.
- `/license list [filter:all/used/unused]`: Lists generated licenses for the active app.
- `/license ban key:<key>`: Bans a specific license key.
- `/license delete key:<key>`: Deletes a specific license key.

### 👤 Client User Management (`/user`)
- `/user view query:<username/email>`: Views full details of a user by username or email.
- `/user create username:<str> password:<str> [status:active/banned/paused] [level:1/2/3] [email] [duration:30d] [notes]`: Manually creates client accounts.
- `/user update username:<str> [new_password] [new_email] [status] [level] [notes]`: Updates user details.
- `/user resethwid username:<str>`: Resets user Hardware ID (HWID).
- `/user delete username:<str>`: Deletes client user account.

### 💳 Subscription Management (`/subscription`)
- `/subscription list`: Lists all subscription plans.
- `/subscription create name:<str> [level:1/2/3]`: Creates a new subscription plan (Admin only).
- `/subscription delete name:<str>`: Deletes a subscription plan by name (Admin only).

### 🟢 Session Management (`/session`)
- `/session list`: Lists all active client sessions (username, IP, device, ID).
- `/session kill session_id:<id>`: Terminates a specific active session.
- `/session killall`: Terminates all active sessions for the app.

### ⚙️ Application Settings (`/settings`)
- `/settings view`: Views current application settings and version.
- `/settings set [status] [hash_check] [force_hwid] [block_leaked_passwords] [min_username_length]`: Updates settings.
- `/settings version new_version:<str>`: Updates the required app version.
- `/settings hash-add hash:<str>`: Adds an integrity hash.
- `/settings hash-list`: Lists all registered integrity hashes.
- `/settings hash-delete hash_id:<id>`: Removes an integrity hash.
- `/settings hash-reset`: Removes all integrity hashes (Admin only).

### 👥 Team Inspection (`/team`)
- `/team view`: Read-only list displaying team members, roles, emails, and reseller balance limits.
