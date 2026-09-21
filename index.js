const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { DisTube } = require('distube');
const fs = require('fs');
const express = require('express');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const PREFIX = '!';

// DisTube Music Client Setup
client.distube = new DisTube(client, {
    leaveOnStop: false,
    emitNewSongOnly: true,
    emitAddSongWhenCreatingQueue: false,
    emitAddListWhenCreatingQueue: false
});

// Levels Database Setup
let levels = {};
if (fs.existsSync('levels.json')) {
    try { levels = JSON.parse(fs.readFileSync('levels.json', 'utf8')); } catch (e) { levels = {}; }
}
function saveLevels() { fs.writeFileSync('levels.json', JSON.stringify(levels, null, 2)); }

const BANNED_WORDS = ['gaali1', 'gaali2', 'bhenchod', 'madarchod', 'chutiya']; 

client.once('ready', () => {
    console.log(`${client.user.tag} is online with GUI Music like Luna!`);
});

// Welcome System
client.on('guildMemberAdd', member => {
    const channel = member.guild.channels.cache.find(ch => ch.name === 'welcome' || ch.name === 'general');
    if (!channel) return;
    channel.send(`Welcome to the server, ${member}! 🎉`);
});

// GUI Music Event (Creates buttons when a song starts)
client.distube.on('playSong', (queue, song) => {
    const embed = new EmbedBuilder()
        .setTitle(`🎶 Now Playing: ${song.name}`)
        .setURL(song.url)
        .setDescription(`**Duration:** ${song.formattedDuration}\n**Requested By:** ${song.user}`)
        .setThumbnail(song.thumbnail)
        .setColor('#ff00aa');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('pause_resume').setLabel('⏸️ Pause/Resume').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('skip').setLabel('⏭️ Skip').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('loop').setLabel('🔁 Loop').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('stop').setLabel('⏹️ Stop').setStyle(ButtonStyle.Danger)
    );

    queue.textChannel.send({ embeds: [embed], components: [row] });
});

// Handle GUI Button Clicks
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    const queue = client.distube.getQueue(interaction.guildId);
    if (!queue) return interaction.reply({ content: '❌ No music playing right now!', ephemeral: true });

    await interaction.deferUpdate();

    if (interaction.customId === 'pause_resume') {
        if (queue.paused) {
            queue.resume();
            interaction.channel.send('▶️ Music Resumed!');
        } else {
            queue.pause();
            interaction.channel.send('⏸️ Music Paused!');
        }
    } else if (interaction.customId === 'skip') {
        try {
            await queue.skip();
            interaction.channel.send('⏭️ Song Skipped!');
        } catch {
            interaction.channel.send('❌ No next song in queue!');
        }
    } else if (interaction.customId === 'loop') {
        const mode = queue.repeatMode === 1 ? 0 : 1; // Toggle repeat current song
        queue.setRepeatMode(mode);
        interaction.channel.send(mode === 1 ? '🔁 Loop Activated for current song!' : '➡️ Loop Deactivated!');
    } else if (interaction.customId === 'stop') {
        queue.stop();
        interaction.channel.send('⏹️ Music Stopped and cleared!');
    }
});

// Main Message Handling (Commands + AutoMod + Levels)
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // Auto-Mod
    if (!message.member.permissions.has('ManageMessages')) {
        if (/(https?:\/\/[^\s]+)/g.test(message.content) || /(discord\.gg\/[^\s]+)/g.test(message.content)) {
            await message.delete();
            return message.channel.send(`${message.author}, links not allowed! ❌`).then(m => setTimeout(() => m.delete(), 3000));
        }
        if (BANNED_WORDS.some(w => message.content.toLowerCase().includes(w))) {
            await message.delete();
            return message.channel.send(`${message.author}, don't use bad words! 🚫`).then(m => setTimeout(() => m.delete(), 3000));
        }
    }

    // Leveling
    const userId = message.author.id;
    if (!levels[userId]) levels[userId] = { xp: 0, level: 1 };
    levels[userId].xp += Math.floor(Math.random() * 11) + 5;
    if (levels[userId].xp >= levels[userId].level * 100) {
        levels[userId].level += 1;
        levels[userId].xp = 0;
        message.channel.send(`🎉 Level Up! ${message.author} reached **Level ${levels[userId].level}**!`);
    }
    saveLevels();

    // Command Parser
    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Help
    if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('ShadowxBot Premium Menu')
            .setColor('#ff00aa')
            .addFields(
                { name: '🎵 GUI Music', value: '`!play [song name/link]` - Play music with control buttons\n`!loop` - Loop current song manually' },
                { name: '📊 Stats', value: '`!rank` - Check level' },
                { name: '🛡️ Moderation', value: '`!clear [1-100]`, `!kick`, `!ban` (AutoMod is active)' },
                { name: '🎮 Fun', value: '`!meme`, `!roll`, `!8ball`' }
            );
        return message.channel.send({ embeds: [helpEmbed] });
    }

    // Music Commands
    if (command === 'play') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('❌ You need to join a voice channel first!');
        const query = args.join(' ');
        if (!query) return message.reply('❌ Please provide a song name or link!');

        try {
            await client.distube.play(voiceChannel, query, {
                textChannel: message.channel,
                member: message.member,
                message
            });
        } catch (err) {
            console.error(err);
            message.reply('❌ Error playing the song. Make sure I have permission to join your voice channel!');
        }
    }

    if (command === 'loop') {
        const queue = client.distube.getQueue(message.guildId);
        if (!queue) return message.reply('❌ No music playing!');
        const mode = queue.repeatMode === 1 ? 0 : 1;
        queue.setRepeatMode(mode);
        return message.reply(mode === 1 ? '🔁 Loop ON!' : '➡️ Loop OFF!');
    }

    // Rank & Fun
    if (command === 'rank') return message.reply(`📊 Level: ${levels[userId].level} | XP: ${levels[userId].xp}/${levels[userId].level * 100}`);
    if (command === 'roll') return message.reply(`🎲 Rolled a **${Math.floor(Math.random() * 6) + 1}**!`);
    if (command === '8ball') return message.reply(`🎱 ${['Yes!', 'No.', 'Ask again.', 'Never.'].sort(() => 0.5 - Math.random())[0]}`);
    if (command === 'meme') {
        try {
            const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
            const res = await fetch('https://meme-api.com');
            const data = await res.json();
            const embed = new EmbedBuilder().setTitle(data.title).setImage(data.url).setColor('#ffcc00');
            return message.channel.send({ embeds: [embed] });
        } catch { return message.reply('Meme api error!'); }
    }
    if (command === 'clear') {
        if (!message.member.permissions.has('ManageMessages')) return;
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) return message.reply('Enter 1-100');
        await message.channel.bulkDelete(amount + 1, true);
    }
});

// Render Keep-Alive
const app = express();
app.get('/', (req, res) => res.send('Bot Online!'));
app.listen(process.env.PORT || 3000);

client.login(process.env.TOKEN);
