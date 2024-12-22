require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
    ],
});

const TOKEN = process.env.DISCORD_TOKEN;

// Event: Bot ready
client.on('ready', () => {
    console.log(`${client.user.tag} is online!`);

    // Set a witty presence
    client.user.setPresence({
        activities: [{ name: 'Trying to figure out if AFK is a lifestyle or a mistake 🤔' }],
        status: 'online'
    });
});

// Event: Message sent
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    console.log(`Message from ${message.author.tag}: ${message.content}`);
});

// Event: Voice state update
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (newState.channel) {
        console.log(`User joined channel: ${newState.channel.name}`);
    }
});

// Login the bot
client.login(TOKEN).catch(error => {
    console.error('Error logging in:', error);
});
