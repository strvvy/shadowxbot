const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const PREFIX = '!';

client.once('ready', () => {
    console.log(`${client.user.tag} is online and ready!`);
});

// Welcome Message System
client.on('guildMemberAdd', member => {
    const channel = member.guild.channels.cache.find(ch => ch.name === 'welcome' || ch.name === 'general');
    if (!channel) return;
    channel.send(`Welcome to the server, ${member}! 🎉`);
});

// Commands Handling
client.on('messageCreate', async message => {
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Help Command
    if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('Bot Commands List')
            .setDescription('Here are the available commands:')
            .addFields(
                { name: 'Utility', value: '`!help` - Shows this menu' },
                { name: 'Moderation', value: '`!kick @user`, `!ban @user`, `!clear [number]`' },
                { name: 'Music (Coming Soon)', value: '`!play`, `!skip`, `!stop`, `!queue` (Needs additional voice setup)' }
            )
            .setColor('#0099ff');
        return message.channel.send({ embeds: [helpEmbed] });
    }

    // Clear Messages Command
    if (command === 'clear') {
        if (!message.member.permissions.has('ManageMessages')) return message.reply('You do not have permission to use this command!');
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) return message.reply('Please provide a number between 1 and 100.');
        
        await message.channel.bulkDelete(amount + 1, true);
        return message.channel.send(`Deleted ${amount} messages.`).then(msg => setTimeout(() => msg.delete(), 3000));
    }

    // Kick Command
    if (command === 'kick') {
        if (!message.member.permissions.has('KickMembers')) return message.reply('You cannot use this.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('Please mention a valid member.');
        if (!member.kickable) return message.reply('I cannot kick this user.');
        
        await member.kick();
        return message.reply(`${member.user.tag} has been kicked.`);
    }

    // Ban Command
    if (command === 'ban') {
        if (!message.member.permissions.has('BanMembers')) return message.reply('You cannot use this.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('Please mention a valid member.');
        if (!member.bannable) return message.reply('I cannot ban this user.');
        
        await member.ban();
        return message.reply(`${member.user.tag} has been banned.`);
    }
});

// Render Web Server Requirement (To keep it alive)
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);

client.login(process.env.TOKEN);
