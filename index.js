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

// Levels Database Setup
let levels = {};
if (fs.existsSync('levels.json')) {
    try { levels = JSON.parse(fs.readFileSync('levels.json', 'utf8')); } catch (e) { levels = {}; }
}
function saveLevels() { fs.writeFileSync('levels.json', JSON.stringify(levels, null, 2)); }

const BANNED_WORDS = ['gaali1', 'gaali2', 'bhenchod', 'madarchod', 'chutiya', 'gandu']; 

client.once('ready', () => {
    console.log(`${client.user.tag} is online with Auto-Mod, Levels, and Fun (No Music)`);
});

// Welcome System
client.on('guildMemberAdd', member => {
    const channel = member.guild.channels.cache.find(ch => ch.name === 'welcome' || ch.name === 'general');
    if (!channel) return;
    channel.send(`Welcome to the server, ${member}! 🎉`);
});

// Message Event (AutoMod, Leveling, Commands)
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // 1. 🛡️ AUTO-MOD
    if (!message.member.permissions.has('ManageMessages')) {
        if (/(https?:\/\/[^\s]+)/g.test(message.content) || /(discord\.gg\/[^\s]+)/g.test(message.content)) {
            await message.delete();
            return message.channel.send(`${message.author}, links are not allowed here! ❌`).then(m => setTimeout(() => m.delete(), 3000));
        }
        if (BANNED_WORDS.some(w => message.content.toLowerCase().includes(w))) {
            await message.delete();
            return message.channel.send(`${message.author}, please do not use bad words! 🚫`).then(m => setTimeout(() => m.delete(), 3000));
        }
    }

    // 2. 📈 LEVELING
    const userId = message.author.id;
    if (!levels[userId]) levels[userId] = { xp: 0, level: 1 };
    levels[userId].xp += Math.floor(Math.random() * 11) + 5;
    if (levels[userId].xp >= levels[userId].level * 100) {
        levels[userId].level += 1;
        levels[userId].xp = 0;
        message.channel.send(`🎉 Level Up! ${message.author} reached **Level ${levels[userId].level}**!`);
    }
    saveLevels();

    // Command Checker
    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Help
    if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('ShadowxBot Menu')
            .setColor('#00ffcc')
            .addFields(
                { name: '📈 Leveling', value: '`!rank` - Check your active server level' },
                { name: '🛡️ Auto-Mod', value: 'Deletes curse words and outside links automatically.' },
                { name: '🎮 Fun & Games', value: '`!meme` - Random meme\n`!8ball [ask]` - Ask the 8ball\n`!roll` - Roll a dice' },
                { name: '⚙️ Moderation', value: '`!clear [number]`, `!kick @user`, `!ban @user`' }
            );
        return message.channel.send({ embeds: [helpEmbed] });
    }

    // Rank
    if (command === 'rank') return message.reply(`📊 Level: ${levels[userId].level} | XP: ${levels[userId].xp}/${levels[userId].level * 100}`);

    // Fun
    if (command === 'roll') return message.reply(`🎲 You rolled a **${Math.floor(Math.random() * 6) + 1}**!`);
    if (command === '8ball') return message.reply(`🎱 8Ball Says: ${['Yes!', 'No.', 'Maybe.', 'Never.'].sort(() => 0.5 - Math.random())[0]}`);
    if (command === 'meme') {
        try {
            const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
            const res = await fetch('https://meme-api.com');
            const data = await res.json();
            const embed = new EmbedBuilder().setTitle(data.title).setImage(data.url).setColor('#ffcc00');
            return message.channel.send({ embeds: [embed] });
        } catch { return message.reply('Meme service busy, try again!'); }
    }

    // Mod Commands
    if (command === 'clear') {
        if (!message.member.permissions.has('ManageMessages')) return;
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) return message.reply('Enter between 1-100');
        await message.channel.bulkDelete(amount + 1, true);
    }
});

// Express Server
const app = express();
app.get('/', (req, res) => res.send('Bot System Online'));
app.listen(process.env.PORT || 3000);

client.login(process.env.TOKEN);
