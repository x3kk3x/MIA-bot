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

const INACTIVE_PERIOD = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const CHECK_INTERVAL = 1 * 60 * 60 * 1000; // 1 hour interval

// File to store last activity
const activityFile = './lastActivity.json';
let lastActivity = {};

if (fs.existsSync(activityFile)) {
    console.log('Loading last activity data...');
    lastActivity = JSON.parse(fs.readFileSync(activityFile, 'utf8'));
} else {
    console.warn('No last activity file found. Creating a new one...');
    saveActivity();
}

function saveActivity() {
    try {
        fs.writeFileSync(activityFile, JSON.stringify(lastActivity, null, 2));
        console.log('Activity file updated successfully:', lastActivity);
    } catch (error) {
        console.error('Failed to save activity:', error);
    }
}

function updateActivity(userId) {
    console.log(`Updating activity for user: ${userId}`);
    lastActivity[userId] = Date.now();
    saveActivity();
}

function isInGameCategory(channel) {
    if (!channel.parent) return false;
    const isValid = channel.parent.type === 'GUILD_CATEGORY';
    console.debug(`Channel: ${channel.name}, Category: ${channel.parent.name}, Valid: ${isValid}`);
    return isValid;
}

async function checkInactivity() {
    console.log(`[${new Date().toLocaleString()}] Checking for inactivity.`);
    const guild = client.guilds.cache.first();
    if (!guild) {
        console.error('No guild found!');
        return;
    }

    const afkRole = guild.roles.cache.find(role => role.name === AFK_ROLE_NAME);
    const leaveChannel = guild.channels.cache.find(channel => channel.name === ON_LEAVE_CHANNEL_NAME);

    if (!afkRole) {
        console.error('AFK role not found!');
        return;
    }

    for (const member of guild.members.cache.values()) {
        if (member.user.bot || member.roles.cache.has(afkRole.id)) continue;

        const lastSeen = lastActivity[member.id] || 0;
        const exemption = leaveChannel
            ? await leaveChannel.messages.fetch({ limit: 100 }).catch(error => {
                console.error('Failed to fetch leave channel messages:', error);
            })
            : null;

        const isExempt = exemption?.some(
            msg => msg.author.id === member.id && msg.content.includes('!onleave')
        );

        if (isExempt) continue;

        if (Date.now() - lastSeen > INACTIVE_PERIOD) {
            try {
                await member.roles.add(afkRole);
                await member.send(
                    'You have been marked as MIA due to 7 days of inactivity. \nSend a message in any game channel or join a voice channel to remove this role.'
                );
                console.log(`Assigned MIA role to ${member.user.tag}`);
            } catch (error) {
                console.error('Failed to assign MIA role:', error);
            }
        }
    }
}

client.on('ready', () => {
    console.log(`${client.user.tag} is online!`);

    client.user.setPresence({
        activities: [{ name: 'Is AFK is a lifestyle or a mistake 🤔' }],
        status: 'online'
    });

    checkInactivity();
    setInterval(checkInactivity, CHECK_INTERVAL);
});

client.on('messageCreate', async message => {
    if (message.content === '!mia-stats') {
        const guild = message.guild;
        if (!guild) {
            message.channel.send('This command can only be used in a server.');
            return;
        }

        const afkRole = guild.roles.cache.find(role => role.name === AFK_ROLE_NAME);
        if (!afkRole) {
            message.channel.send('AFK role not found. Please ensure the role exists and try again.');
            return;
        }

        const miaMembers = guild.members.cache.filter(member => member.roles.cache.has(afkRole.id));

        message.channel.send(
            `**MIA Statistics:**\nTotal members with MIA role: ${miaMembers.size}\n` +
            (miaMembers.size > 0 ? `Members: ${miaMembers.map(m => m.user.tag).join(', ')}` : 'No members are currently marked as MIA.')
        );
    }

    if (isInGameCategory(message.channel)) {
        updateActivity(message.author.id);

        const afkRole = message.guild.roles.cache.find(role => role.name === AFK_ROLE_NAME);
        if (afkRole && message.member.roles.cache.has(afkRole.id)) {
            try {
                await message.member.roles.remove(afkRole);
                await message.author.send('Welcome back! Your MIA status has been removed.');
                console.log(`Removed MIA role from ${message.author.tag}`);
            } catch (error) {
                console.error('Failed to remove MIA role:', error);
            }
        }
    }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    if (newState.channel) {
        console.log(`User joined channel: ${newState.channel.name} (Category: ${newState.channel.parent?.name || 'None'})`);
        if (isInGameCategory(newState.channel)) {
            updateActivity(newState.member.id);

            const afkRole = newState.guild.roles.cache.find(role => role.name === AFK_ROLE_NAME);
            if (afkRole && newState.member.roles.cache.has(afkRole.id)) {
                try {
                    await newState.member.roles.remove(afkRole);
                    await newState.member.send('Welcome back! Your MIA status has been removed.');
                    console.log(`Removed MIA role from ${newState.member.user.tag}`);
                } catch (error) {
                    console.error('Failed to remove MIA role on voice state update:', error);
                }
            }
        }
    }
});

client.login(TOKEN).catch(error => {
    console.error('Error logging in:', error);
});
