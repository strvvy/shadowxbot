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

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Successfully connected to MongoDB Atlas!'))
    .catch(err => console.error('Database connection error:', err));

const LevelModel = mongoose.model('Level', new mongoose.Schema({ userId: String, guildId: String, xp: Number, level: Number }));
const InviteModel = mongoose.model('Invite', new mongoose.Schema({ guildId: String, code: String, inviterId: String, uses: Number }));
const BANNED_WORDS = ['bhenchod', 'madarchod', 'chutiya', 'gandu'];
const guildInvites = new Map();

const commands = [
    new SlashCommandBuilder().setName('help').setDescription('View professional bot commands'),
    new SlashCommandBuilder().setName('rank').setDescription('Check your server level'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Show top active chatters'),
    new SlashCommandBuilder().setName('invites').setDescription('Check how many members you invited'),
    new SlashCommandBuilder().setName('setup-tickets').setDescription('Generate ticket button panel'),
    new SlashCommandBuilder().setName('setup-stats').setDescription('Create live server activeness counters'),
    new SlashCommandBuilder().setName('meme').setDescription('Get a random trending meme'),
    new SlashCommandBuilder().setName('clear').setDescription('Clean chat clutter').addIntegerOption(opt => opt.setName('amount').setDescription('Number of messages').setRequired(true))
].map(cmd => cmd.toJSON());

client.once('ready', async () => {
    console.log(`${client.user.tag} Enterprise System Online.`);
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Slash commands loaded globally.');
    } catch (e) { console.error(e); }
    client.guilds.cache.forEach(async guild => {
        try {
            const firstInvites = await guild.invites.fetch();
            guildInvites.set(guild.id, new Map(firstInvites.map(inv => [inv.code, inv.uses])));
        } catch (err) {}
    });
});

client.on('guildMemberAdd', async member => {
    const channel = member.guild.channels.cache.find(ch => ch.name === 'welcome' || ch.name === 'general');
    try {
        const cachedInvites = guildInvites.get(member.guild.id);
        const newInvites = await member.guild.invites.fetch();
        const usedInvite = newInvites.find(inv => cachedInvites.get(inv.code) < inv.uses);
        if (usedInvite && channel) {
            channel.send(`📥 **${member.user.tag}** joined! Invited by **${usedInvite.inviter.tag}** (Code: \`${usedInvite.code}\`).`);
            let invData = await InviteModel.findOne({ guildId: member.guild.id, inviterId: usedInvite.inviter.id });
            if (!invData) invData = new InviteModel({ guildId: member.guild.id, inviterId: usedInvite.inviter.id, uses: 0 });
            invData.uses += 1;
            await invData.save();
        } else if (channel) {
            channel.send(`🎉 Welcome **${member}** to the server!`);
        }
        guildInvites.set(member.guild.id, new Map(newInvites.map(inv => [inv.code, inv.uses])));
    } catch (e) {}
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        if (/(https?:\/\/[^\s]+)/g.test(message.content) || /(discord\.gg\/[^\s]+)/g.test(message.content)) {
            await message.delete();
            return message.channel.send(`❌ Links are blocked.`).then(m => setTimeout(() => m.delete(), 3000));
        }
        if (BANNED_WORDS.some(w => message.content.toLowerCase().includes(w))) {
            await message.delete();
            return message.channel.send(`🚫 Watch your language!`).then(m => setTimeout(() => m.delete(), 3000));
        }
    }
    const userId = message.author.id;
    const guildId = message.guild.id;
    let userData = await LevelModel.findOne({ userId, guildId });
    if (!userData) userData = new LevelModel({ userId, guildId, xp: 0, level: 1 });
    userData.xp += 10;
    if (userData.xp >= userData.level * 100) {
        userData.level += 1;
        userData.xp = 0;
        message.channel.send(`📈 **Level Up!** ${message.author} reached **Level ${userData.level}**!`);
    }
    await userData.save();
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName, guildId, user } = interaction;
        if (commandName === 'help') {
            const embed = new EmbedBuilder().setTitle('⚔️ ShadowxBot Core').setColor('#7289da')
                .addFields(
                    { name: '📊 Stats & Levels', value: '`/rank`, `/leaderboard`, `/invites`' },
                    { name: '🎫 Ticket Support', value: '`/setup-tickets`' },
                    { name: '🛡️ Moderation', value: '`/clear`, `/setup-stats`' },
                    { name: '🎮 Fun', value: '`/meme`' }
                );
            return interaction.reply({ embeds: [embed] });
        }
        if (commandName === 'rank') {
            const data = await LevelModel.findOne({ userId: user.id, guildId });
            const lvl = data ? data.level : 1;
            return interaction.reply(`📊 Level: \`${lvl}\` | XP: \`${data ? data.xp : 0}/${lvl * 100}\``);
        }
        if (commandName === 'leaderboard') {
            const top = await LevelModel.find({ guildId }).sort({ level: -1, xp: -1 }).limit(5);
            if (!top.length) return interaction.reply('No data yet.');
            let lb = top.map((u, i) => `${i+1}. <@${u.userId}> - Level ${u.level}`).join('\n');
            return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏆 Leaderboard').setDescription(lb)] });
        }
        if (commandName === 'invites') {
            const data = await InviteModel.findOne({ guildId, inviterId: user.id });
            return interaction.reply(`📥 You have invited **${data ? data.uses : 0}** members.`);
        }
        if (commandName === 'setup-tickets') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'Admin only!', ephemeral: true });
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('open_ticket').setLabel('🎫 Create Ticket').setStyle(ButtonStyle.Primary));
            const embed = new EmbedBuilder().setTitle('Support').setDescription('Click below to open a ticket.').setColor('#00ff00');
            await interaction.reply({ content: 'Panel created.', ephemeral: true });
            return interaction.channel.send({ embeds: [embed], components: [row] });
        }
        if (commandName === 'setup-stats') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'Admin only!', ephemeral: true });
            const cat = await interaction.guild.channels.create({ name: '📊 SERVER STATS', type: ChannelType.GuildCategory });
            await interaction.guild.channels.create({ name: `Total Members: ${interaction.guild.memberCount}`, type: ChannelType.GuildVoice, parent: cat.id, permissionOverwrites: [{ id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.Connect] }] });
            return interaction.reply('Counters created!');
        }
        if (commandName === 'meme') {
            await interaction.deferReply();
            try {
                const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
                const res = await fetch('https://meme-api.com');
                const data = await res.json();
                return interaction.editReply({ embeds: [new EmbedBuilder().setTitle(data.title).setImage(data.url)] });
            } catch { return interaction.editReply('API error.'); }
        }
        if (commandName === 'clear') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return interaction.reply({ content: 'No permission', ephemeral: true });
            const amount = interaction.options.getInteger('amount');
            await interaction.channel.bulkDelete(amount, true);
            return interaction.reply({ content: `Cleared ${amount} messages.`, ephemeral: true });
        }
    }
    if (interaction.isButton() && interaction.customId === 'open_ticket') {
        await interaction.deferReply({ ephemeral: true });
        const ticketChannel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });
        const closeRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close').setStyle(ButtonStyle.Danger));
        await ticketChannel.send({ content: `Welcome ${interaction.user}, staff will assist you shortly.`, components: [closeRow] });
        return interaction.editReply({ content: `Ticket created: ${ticketChannel}` });
    }
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
