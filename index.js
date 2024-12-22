require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
    ],
});

const TOKEN = process.env.DISCORD_TOKEN;
const AFK_ROLE_NAME = 'MIA';
const ON_LEAVE_CHANNEL_NAME = 'on-leave-notice';
const GAME_CATEGORIES = [
    'ECHOES OF INTERACTION',
    'THE VOICE OF EQUILIBRIUM',
    'THRONE & LIBERTY VOICE',
    'THRONE & LIBERTY',
    'APEX LEGENDS',
    'COUNTER-STRIKE',
    'ONCE HUMAN',
    'DOTA 2',
    'VALORANT',
    'LEAGUE OF LEGENDS',
    'PATH OF EXILE 2',
];


const INACTIVE_PERIOD = 7 * 24 * 60 * 60 * 1000; // 7 days of inactivity
const CHECK_INTERVAL = 1 * 60 * 60 * 1000; // check every 60min

// File to store last activity
const activityFile = './lastActivity.json';
let lastActivity = {};

// Load last activity data from file
if (fs.existsSync(activityFile)) {
    console.log('Loading last activity data...');
    lastActivity = JSON.parse(fs.readFileSync(activityFile, 'utf8'));
} else {
    console.warn('No last activity file found. Creating a new one...');
    saveActivity();
}

// Save activity data to file
function saveActivity() {
    try {
        fs.writeFileSync(activityFile, JSON.stringify(lastActivity, null, 2));
        console.log('Activity file updated successfully:', lastActivity);
    } catch (error) {
        console.error('Failed to save activity:', error);
    }
}

// Update user activity
function updateActivity(userId) {
    console.log(`Updating activity for user: ${userId}`);
    lastActivity[userId] = Date.now();
    saveActivity();
}

// Check if a channel is part of a game-specific category
function isInGameCategory(channel) {
    const isValid = channel.parent && GAME_CATEGORIES.includes(channel.parent.name);
    console.debug(`Checking channel: ${channel.name}, isValid: ${isValid}`);
    return isValid;
}

// Check inactivity and assign AFK role
async function checkInactivity() {
    console.log(`[${new Date().toLocaleString('sr-Latn-RS', { timeZoneName: 'short' })}] Checking for inactivity.`);
    const guild = client.guilds.cache.first();
    const afkRole = guild.roles.cache.find(role => role.name === AFK_ROLE_NAME);
    const leaveChannel = guild.channels.cache.find(
        channel => channel.name === ON_LEAVE_CHANNEL_NAME
    );

    if (!afkRole) {
        console.error('AFK role not found!');
        return;
    }

    for (const member of guild.members.cache.values()) {
        if (member.user.bot || member.roles.cache.has(afkRole.id)) continue;

        const lastSeen = lastActivity[member.id] || 0;

        // Check exemption in the on-leave-notice channel
        const exemption = leaveChannel
            ? await leaveChannel.messages.fetch({ limit: 100 })
            : null;
        const isExempt = exemption?.some(
            msg => msg.author.id === member.id && msg.content.includes('!onleave')
        );

        if (isExempt) continue;

        // Check inactivity
        if (Date.now() - lastSeen > INACTIVE_PERIOD) {
            await member.roles.add(afkRole);
            await member.send(
                'You have been marked as MIA due to 7 days of inactivity. \n'
                + 'Send a message in any game channel or join a voice channel to remove this role.'
            );
        }
    }
}

// Event: Bot ready
client.on('ready', () => {
    console.log(`${client.user.tag} is online!`);

    // Set a witty presence (status for discord)
    client.user.setPresence({
        activities: [{ name: 'Is AFK is a lifestyle or a mistake 🤔' }],
        status: 'online'
    });

    // Run the first check immediately
    checkInactivity();

    // Schedule periodic checks every 3 hours
    setInterval(checkInactivity, CHECK_INTERVAL);
});

// Event: Message sent
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (isInGameCategory(message.channel)) {
        updateActivity(message.author.id);

        // Remove MIA role if the user has it
        const guild = message.guild;
        const afkRole = guild.roles.cache.find(role => role.name === AFK_ROLE_NAME);
        if (afkRole && message.member.roles.cache.has(afkRole.id)) {
            await message.member.roles.remove(afkRole);
            await message.author.send('Welcome back! \n Your MIA status has been removed.');
            console.log(`Removed MIA role from ${message.author.tag}`);
        }
    }
});

// Event: Voice state update
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (newState.channel) {
        console.log(`User joined channel: ${newState.channel.name}`);
        if (isInGameCategory(newState.channel)) {
            updateActivity(newState.member.id);

            // Remove MIA role if the user has it
            const afkRole = newState.guild.roles.cache.find(role => role.name === AFK_ROLE_NAME);
            if (afkRole && newState.member.roles.cache.has(afkRole.id)) {
                await newState.member.roles.remove(afkRole);
                await newState.member.send('Welcome back! \n Your MIA status has been removed.');
                console.log(`Removed MIA role from ${newState.member.user.tag}`);
            }
        }
    }
});

// Login the bot
client.login(TOKEN).catch(error => {
    console.error('Error logging in:', error);
});
