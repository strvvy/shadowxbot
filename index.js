const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const mongoose = require('mongoose');
const express = require('express');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites
    ]
});

// Connect to MongoDB Cloud Database
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Successfully connected to MongoDB Atlas!'))
    .catch(err => console.error('Database connection error:', err));

// MongoDB Database Schemas
const LevelSchema = new mongoose.Schema({ userId: String, guildId: String, xp: Number, level: Number });
const Level = mongoose.model('Level', LevelSchema);

const InviteSchema = new mongoose.Schema({ guildId: String, code: String, inviterId: String, uses: Number });
const InviteModel = mongoose.model('Invite', InviteSchema);

const BANNED_WORDS = ['bhenchod', 'madarchod', 'chutiya', 'gandu'];
const guildInvites = new Map();

// 🚀 Register Global Slash Commands
const commands = [
    new SlashCommandBuilder().setName('help').setDescription('View professional bot commands'),
    new SlashCommandBuilder().setName('rank').setDescription('Check your server level (Arcane style)'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Show top active chatters'),
    new SlashCommandBuilder().setName('invites').setDescription('Check how many members you invited'),
    new SlashCommandBuilder().setName('setup-tickets').setDescription('Generate ticket panel button (Staff only)'),
    new SlashCommandBuilder().setName('setup-stats').setDescription('Create live server activeness counters (Staff only)'),
    new SlashCommandBuilder().setName('meme').setDescription('Get a random trending meme'),
    new SlashCommandBuilder().setName('clear')
        .setDescription('Clean chat clutter')
        .addIntegerOption(opt => opt.setName('amount').setDescription('Number of messages').setRequired(true))
].map(cmd => cmd.toJSON());

client.once('ready', async () => {
    console.log(`${client.user.tag} is loaded with Enterprise modules.`);

    // Deploy Slash Commands
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Application (/) commands registered globally.');
    } catch (e) { console.error(e); }

    // Cache invites for invite tracking module
    client.guilds.cache.forEach(async guild => {
        try {
            const firstInvites = await guild.invites.fetch();
            guildInvites.set(guild.id, new Map(firstInvites.map(invite => [invite.code, invite.uses])));
        } catch (err) { console.log(`Invite fetch skipped for ${guild.name}`); }
    });
});

// 📊 Invite Tracker Module
client.on('guildMemberAdd', async member => {
    const channel = member.guild.channels.cache.find(ch => ch.name === 'welcome' || ch.name === 'general');
    try {
        const cachedInvites = guildInvites.get(member.guild.id);
        const newInvites = await member.guild.invites.fetch();
        const usedInvite = newInvites.find(inv => cachedInvites.get(inv.code) < inv.uses);

        if (usedInvite && channel) {
            channel.send(`📥 **${member.user.tag}** joined the empire! Invited by **${usedInvite.inviter.tag}** (Code: \`${usedInvite.code}\`).`);
            let invData = await InviteModel.findOne({ guildId: member.guild.id, inviterId: usedInvite.inviter.id });
            if (!invData) invData = new InviteModel({ guildId: member.guild.id, inviterId: usedInvite.inviter.id, uses: 0 });
            invData.uses += 1;
            await invData.save();
        } else if (channel) {
            channel.send(`🎉 Welcome **${member}** to the server!`);
        }
        guildInvites.set(member.guild.id, new Map(newInvites.map(inv => [inv.code, inv.uses])));
    } catch (e) { if (channel) channel.send(`🎉 Welcome **${member}** to the server!`); }
});

// 🛡️ AutoMod & Arcane Leveling
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        if (/(https?:\/\/[^\s]+)/g.test(message.content) || /(discord\.gg\/[^\s]+)/g.test(message.content)) {
            await message.delete();
            return message.channel.send(`❌ ${message.author}, links are blocked for security.`).then(m => setTimeout(() => m.delete(), 3000));
        }
        if (BANNED_WORDS.some(w => message.content.toLowerCase().includes(w))) {
            await message.delete();
            return message.channel.send(`🚫 ${message.author}, watch your language!`).then(m => setTimeout(() => m.delete(), 3000));
        }
    }

    const userId = message.author.id;
    const guildId = message.guild.id;
    let userData = await Level.findOne({ userId, guildId });
    if (!userData) userData = new Level({ userId, guildId, xp: 0, level: 1 });

    userData.xp += 10;
    if (userData.xp >= userData.level * 100) {
        userData.level += 1;
        userData.xp = 0;
        message.channel.send(`📈 **Level Up!** ${message.author} reached **Level ${userData.level}**!`);
    }
    await userData.save();
});

// 🎛️ Interaction Handler (Slash Commands & Ticket Buttons)
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName, guildId, user } = interaction;

        if (commandName === 'help') {
            const embed = new EmbedBuilder()
                .setTitle('⚔️ ShadowxBot Professional Core')
                .setColor('#7289da')
                .addFields(
                    { name: '📊 Stats & Levels', value: '`/rank`, `/leaderboard`, `/invites`' },
                    { name: '🎫 Ticket Support', value: '`/setup-tickets` (Launches button panel)' },
                    { name: '🛡️ Moderation & AutoMod', value: '`/clear`, `/setup-stats` (Active status counters)' },
                    { name: '🎮 Gaming Fun', value: '`/meme`' }
                );
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'rank') {
            const data = await Level.findOne({ userId: user.id, guildId });
            const lvl = data ? data.level : 1;
            const xp = data ? data.xp : 0;
            return interaction.reply(`📊 **${user.username}'s Activity:**\nLevel: \`${lvl}\` | XP: \`${xp}/${lvl * 100}\``);
        }

        if (commandName === 'leaderboard') {
            const top = await Level.find({ guildId }).sort({ level: -1, xp: -1 }).limit(5);
            if (!top.length) return interaction.reply('No chat data recorded yet.');
            let lb = top.map((u, i) => `${i+1}. <@${u.userId}> - Level ${u.level}`).join('\n');
            return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏆 Active Members Leaderboard').setDescription(lb).setColor('#ffcc00')] });
        }

        if (commandName === 'invites') {
            const data = await InviteModel.findOne({ guildId, inviterId: user.id });
            const count = data ? data.uses : 0;
            return interaction.reply(`📥 You have invited **${count}** members to this server.`);
        }

        if (commandName === 'setup-tickets') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'Admin only!', ephemeral: true });
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('open_ticket').setLabel('🎫 Create Support Ticket').setStyle(ButtonStyle.Primary)
            );
            const embed = new EmbedBuilder().setTitle('Need Help?').setDescription('Click the button below to open a secure private support ticket.').setColor('#00ff00');
            await interaction.reply({ content: 'Panel created below.', ephemeral: true });
            return interaction.channel.send({ embeds: [embed], components: [row] });
        }

        if (commandName === 'setup-stats') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'Admin only!', ephemeral: true });
            const category = await interaction.guild.channels.create({ name: '📊 SERVER STATS', type: ChannelType.GuildCategory });
            await interaction.guild.channels.create({
                name: `Total Members: ${interaction.guild.memberCount}`,
                type: ChannelType.GuildVoice,
                parent: category.id,
                permissionOverwrites: [{ id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.Connect] }]
            });
            return interaction.reply('📊 Server Activeness Counters created at the top!');
        }

        if (commandName === 'meme') {
            await interaction.deferReply();
            try {
                const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
                const res = await fetch('https://meme-api.com');
                const data = await res.json();
                const embed = new EmbedBuilder().setTitle(data.title).setImage(data.url).setColor('#ffcc00');
                return interaction.editReply({ embeds: [embed] });
            } catch { return interaction.editReply('API delay, retry.'); }
        }

        if (commandName === 'clear') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return interaction.reply({ content: 'No permission', ephemeral: true });
            const amount = interaction.options.getInteger('amount');
            await interaction.channel.bulkDelete(amount, true);
