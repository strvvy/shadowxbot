const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const PREFIX = '!';

// levels.json file setup (for saving level data)
let levels = {};
if (fs.existsSync('levels.json')) {
    try {
        levels = JSON.parse(fs.readFileSync('levels.json', 'utf8'));
    } catch (e) {
        levels = {};
    }
}

function saveLevels() {
    fs.writeFileSync('levels.json', JSON.stringify(levels, null, 2));
}

// Banned Words List (Auto-Mod)
const BANNED_WORDS = ['gaali1', 'gaali2', 'bhenchod', 'madarchod', 'chutiya', 'gandu']; 

client.once('ready', () => {
    console.log(`${client.user.tag} is online with Auto-Mod, Levels, and Fun!`);
});

// Welcome System
client.on('guildMemberAdd', member => {
    const channel = member.guild.channels.cache.find(ch => ch.name === 'welcome' || ch.name === 'general');
    if (!channel) return;
    channel.send(`Welcome to the server, ${member}! 🎉`);
});

// Main Message Event
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // 1. 🛡️ AUTO-MOD SYSTEM
    // Block Discord Invites and Links (Except staff)
    if (!message.member.permissions.has('ManageMessages')) {
        const hasLink = /(https?:\/\/[^\s]+)/g.test(message.content);
        const hasInvite = /(discord\.gg\/[^\s]+)/g.test(message.content);
        
        if (hasLink || hasInvite) {
            await message.delete();
            return message.channel.send(`${message.author}, handles / links are not allowed here! ❌`).then(msg => setTimeout(() => msg.delete(), 3000));
        }

        // Block Bad Words
        const foundBadWord = BANNED_WORDS.some(word => message.content.toLowerCase().includes(word));
        if (foundBadWord) {
            await message.delete();
            return message.channel.send(`${message.author}, please do not use bad words! 🚫`).then(msg => setTimeout(() => msg.delete(), 3000));
        }
    }

    // 2. 📈 LEVELING SYSTEM
    const userId = message.author.id;
    if (!levels[userId]) {
        levels[userId] = { xp: 0, level: 1 };
    }

    // Give random XP between 5 and 15 per message
    const xpGained = Math.floor(Math.random() * 11) + 5;
    levels[userId].xp += xpGained;

    // Level up calculation (Next level = current_level * 100 XP)
    const xpNeeded = levels[userId].level * 100;
    if (levels[userId].xp >= xpNeeded) {
        levels[userId].level += 1;
        levels[userId].xp = 0;
        message.channel.send(`🎉 Level Up! ${message.author} reached **Level ${levels[userId].level}**!`);
    }
    saveLevels();

    // 3. COMMANDS HANDLING
    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Custom Help Menu
    if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('ShadowxBot Features')
            .setDescription('Here is your updated All-in-One menu:')
            .addFields(
                { name: '📈 Leveling', value: '`!rank` - Check your level and XP' },
                { name: '🛡️ Auto-Mod', value: 'Automatically deletes bad words and external links.' },
                { name: '🎮 Fun & Games', value: '`!meme` - Get a random meme\n`!8ball [question]` - Ask the magic ball\n`!roll` - Roll a dice' },
                { name: '⚙️ Moderation', value: '`!kick @user`, `!ban @user`, `!clear [number]`' }
            )
            .setColor('#00ffcc');
        return message.channel.send({ embeds: [helpEmbed] });
    }

    // Rank Command
    if (command === 'rank') {
        const userLevel = levels[userId].level;
        const userXp = levels[userId].xp;
        const nextXp = userLevel * 100;
        return message.reply(`📊 **Your Rank:**\nLevel: ${userLevel}\nXP: ${userXp}/${nextXp}`);
    }

    // Fun: 8Ball Command
    if (command === '8ball') {
        if (!args.length) return message.reply('Please ask a question!');
        const replies = ['Yes!', 'No.', 'Ask again later.', 'Definitely!', 'Never.', 'Most likely.'];
        const randomReply = replies[Math.floor(Math.random() * replies.length)];
        return message.reply(`🎱 ${randomReply}`);
    }

    // Fun: Roll Command
    if (command === 'roll') {
        const dice = Math.floor(Math.random() * 6) + 1;
        return message.reply(`🎲 You rolled a **${dice}**!`);
    }

    // Fun: Meme Command
    if (command === 'meme') {
        try {
            // Using a free safe meme API
            const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
            const res = await fetch('https://meme-api.com');
            const data = await res.json();
            
            const memeEmbed = new EmbedBuilder()
                .setTitle(data.title)
                .setURL(data.postLink)
                .setImage(data.url)
                .setColor('#ffcc00')
                .setFooter({ text: `Subreddit: r/${data.subreddit}` });
            
            return message.channel.send({ embeds: [memeEmbed] });
        } catch (err) {
            return message.reply('Could not fetch a meme right now, try again!');
        }
    }

    // Moderation: Clear Messages
    if (command === 'clear') {
        if (!message.member.permissions.has('ManageMessages')) return message.reply('No permissions!');
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) return message.reply('Provide a number between 1 and 100.');
        await message.channel.bulkDelete(amount + 1, true);
        return message.channel.send(`Deleted ${amount} messages.`).then(msg => setTimeout(() => msg.delete(), 3000));
    }
});

// Render Web Server Requirement
const app = express();
app.get('/', (req, res) => res.send('Bot is online!'));
app.listen(process.env.PORT || 3000);

client.login(process.env.TOKEN);
