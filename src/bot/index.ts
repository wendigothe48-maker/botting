import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionsBitField, TextChannel } from 'discord.js';
import { Player } from '../models/Player';
import { Guild } from '../models/Guild';
import { Config } from '../models/Config';
import { PreApproval } from '../models/PreApproval';
import { broadcastToPlugin } from '../ws';

const OWNER_ID = '1319539205885526018';
const SERVER_ID = '1477359416562028670';
const VC_CATEGORY_ID = '1477359418801914070';
const TEXT_CATEGORY_ID = '1477360211965775893';

export const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers]
});

const commands = [
  new SlashCommandBuilder().setName('verification').setDescription('Setup verification').addSubcommand(sub => sub.setName('set').setDescription('Set verification channel')),
  new SlashCommandBuilder().setName('set').setDescription('Setup channels').addSubcommand(sub => sub.setName('guildcreate').setDescription('Set guild create channel')).addSubcommand(sub => sub.setName('guildlogs').setDescription('Set guild logs channel')),
  new SlashCommandBuilder().setName('invite').setDescription('Invite a user to your guild').addUserOption(opt => opt.setName('user').setDescription('User to invite').setRequired(true)),
  new SlashCommandBuilder().setName('join').setDescription('Join a guild').addStringOption(opt => opt.setName('guildname').setDescription('Name of the guild').setRequired(true)),
];

export async function initBot() {
  client.on('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
    try {
      await rest.put(Routes.applicationCommands(client.user!.id), { body: commands });
      console.log('Successfully registered application commands.');
    } catch (error) {
      console.error(error);
    }
    updateGuildLogs();
  });

  client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'verification' && interaction.options.getSubcommand() === 'set') {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'Owner only', ephemeral: true });
        
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('start_verify').setLabel('Verify').setStyle(ButtonStyle.Primary)
        );
        await interaction.channel?.send({ content: 'Type Your Verification Code', components: [row] });
        await interaction.reply({ content: 'Verification channel set.', ephemeral: true });
      }

      if (interaction.commandName === 'set' && interaction.options.getSubcommand() === 'guildcreate') {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'Owner only', ephemeral: true });
        
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('start_guild_create').setLabel('Create').setStyle(ButtonStyle.Success)
        );
        await interaction.channel?.send({ content: 'Create your guild and other stuff', components: [row] });
        await interaction.reply({ content: 'Guild create channel set.', ephemeral: true });
      }

      if (interaction.commandName === 'set' && interaction.options.getSubcommand() === 'guildlogs') {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'Owner only', ephemeral: true });
        
        await Config.findOneAndUpdate({ key: 'guildlogs_channel' }, { value: interaction.channelId }, { upsert: true });
        await interaction.reply({ content: 'Guild logs channel set.', ephemeral: true });
        updateGuildLogs();
      }
      
      if (interaction.commandName === 'invite') {
        const targetUser = interaction.options.getUser('user');
        if (!targetUser) return interaction.reply({ content: 'User not found.', ephemeral: true });

        const inviterPlayer = await Player.findOne({ discordId: interaction.user.id });
        if (!inviterPlayer || !inviterPlayer.isVerified) return interaction.reply({ content: 'You must be verified.', ephemeral: true });
        
        const guild = await Guild.findOne({ members: interaction.user.id });
        if (!guild) return interaction.reply({ content: 'You are not in a guild.', ephemeral: true });
        
        const inviteePlayer = await Player.findOne({ discordId: targetUser.id });
        if (!inviteePlayer || !inviteePlayer.isVerified) return interaction.reply({ content: 'Target user is not verified.', ephemeral: true });

        // Check if pre-approved
        const preApproval = await PreApproval.findOne({ minecraftUsername: inviteePlayer.minecraftUsername, guildName: guild.name });
        if (preApproval && preApproval.expiry > new Date()) {
          // Auto join
          if (!guild.members.includes(inviteePlayer.discordId)) {
            guild.members.push(inviteePlayer.discordId);
            await guild.save();
            
            // Add to channels
            try {
              const textChannel = client.channels.cache.get(guild.textChannelId) as TextChannel;
              if (textChannel) {
                await textChannel.permissionOverwrites.edit(inviteePlayer.discordId, { ViewChannel: true, SendMessages: true });
              }
              const vcChannel = client.channels.cache.get(guild.voiceChannelId) as TextChannel;
              if (vcChannel) {
                await vcChannel.permissionOverwrites.edit(inviteePlayer.discordId, { ViewChannel: true, Connect: true });
              }
            } catch (e) {
              console.error('Failed to update permissions', e);
            }

            broadcastToPlugin({ type: 'JOIN_SUCCESS', username: inviteePlayer.minecraftUsername, guildName: guild.name });
            await PreApproval.deleteOne({ _id: preApproval._id });
            updateGuildLogs();
            return interaction.reply({ content: `${targetUser.username} has been added to the guild automatically due to pre-approval.`, ephemeral: true });
          }
        }

        // Send invite button
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`join_guild_${guild.name}`).setLabel(`Join ${guild.name}`).setStyle(ButtonStyle.Success)
        );
        await interaction.reply({ content: `Invite sent to ${targetUser.username}.`, ephemeral: true });
        try {
          await targetUser.send({ content: `You have been invited to join the guild **${guild.name}** by ${interaction.user.username}.`, components: [row] });
        } catch (e) {
          await interaction.followUp({ content: `Failed to DM ${targetUser.username}. They might have DMs disabled.`, ephemeral: true });
        }
      }
      
      if (interaction.commandName === 'join') {
        const guildName = interaction.options.getString('guildname');
        const player = await Player.findOne({ discordId: interaction.user.id });
        if (!player || !player.isVerified) return interaction.reply({ content: 'You must be verified.', ephemeral: true });

        const existingGuild = await Guild.findOne({ members: interaction.user.id });
        if (existingGuild) return interaction.reply({ content: 'You are already in a guild.', ephemeral: true });

        const guild = await Guild.findOne({ name: guildName });
        if (!guild) return interaction.reply({ content: 'Guild not found.', ephemeral: true });

        // Pre-approve for 6 hours
        await PreApproval.findOneAndUpdate(
          { minecraftUsername: player.minecraftUsername, guildName: guild.name },
          { expiry: new Date(Date.now() + 6 * 60 * 60 * 1000) },
          { upsert: true }
        );

        broadcastToPlugin({ type: 'PRE_APPROVED', username: player.minecraftUsername, guildName: guild.name });
        await interaction.reply({ content: `You have requested to join **${guild.name}**. If the owner invites you within 6 hours, you will join automatically.`, ephemeral: true });
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'start_verify') {
        const modal = new ModalBuilder().setCustomId('verify_code_modal').setTitle('Verification');
        const codeInput = new TextInputBuilder().setCustomId('code_input').setLabel('Enter your 6-digit code').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(codeInput));
        await interaction.showModal(modal);
      }

      if (interaction.customId.startsWith('verify_name_btn_')) {
        const code = interaction.customId.split('_')[3];
        const modal = new ModalBuilder().setCustomId(`verify_name_modal_${code}`).setTitle('Minecraft Username');
        const nameInput = new TextInputBuilder().setCustomId('name_input').setLabel('Type Your Minecraft username').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput));
        await interaction.showModal(modal);
      }

      if (interaction.customId === 'start_guild_create') {
        const player = await Player.findOne({ discordId: interaction.user.id });
        if (!player || !player.isVerified) return interaction.reply({ content: 'You must be verified to create a guild.', ephemeral: true });
        
        const existingGuild = await Guild.findOne({ members: interaction.user.id });
        if (existingGuild) return interaction.reply({ content: 'You are already in a guild.', ephemeral: true });

        const modal = new ModalBuilder().setCustomId('create_guild_modal').setTitle('Create Guild');
        const nameInput = new TextInputBuilder().setCustomId('guild_name_input').setLabel('Guild Name').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput));
        await interaction.showModal(modal);
      }

      if (interaction.customId.startsWith('join_guild_')) {
        const guildName = interaction.customId.replace('join_guild_', '');
        const player = await Player.findOne({ discordId: interaction.user.id });
        if (!player || !player.isVerified) return interaction.reply({ content: 'You must be verified.', ephemeral: true });

        const existingGuild = await Guild.findOne({ members: interaction.user.id });
        if (existingGuild) return interaction.reply({ content: 'You are already in a guild.', ephemeral: true });

        const guild = await Guild.findOne({ name: guildName });
        if (!guild) return interaction.reply({ content: 'Guild not found.', ephemeral: true });

        guild.members.push(interaction.user.id);
        await guild.save();

        try {
          const textChannel = client.channels.cache.get(guild.textChannelId) as TextChannel;
          if (textChannel) {
            await textChannel.permissionOverwrites.edit(interaction.user.id, { ViewChannel: true, SendMessages: true });
          }
          const vcChannel = client.channels.cache.get(guild.voiceChannelId) as TextChannel;
          if (vcChannel) {
            await vcChannel.permissionOverwrites.edit(interaction.user.id, { ViewChannel: true, Connect: true });
          }
        } catch (e) {
          console.error('Failed to update permissions', e);
        }

        broadcastToPlugin({ type: 'JOIN_SUCCESS', username: player.minecraftUsername, guildName: guild.name });
        updateGuildLogs();
        await interaction.reply({ content: `You have successfully joined **${guild.name}**!`, ephemeral: true });
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'verify_code_modal') {
        const code = interaction.fields.getTextInputValue('code_input').toUpperCase();
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`verify_name_btn_${code}`).setLabel('Verify Name').setStyle(ButtonStyle.Success)
        );
        await interaction.reply({ content: 'Code received. Now verify your name.', components: [row], ephemeral: true });
      }

      if (interaction.customId.startsWith('verify_name_modal_')) {
        const code = interaction.customId.split('_')[3];
        const mcName = interaction.fields.getTextInputValue('name_input');
        
        const player = await Player.findOne({ minecraftUsername: mcName, verificationCode: code });
        if (player && player.codeExpiry && player.codeExpiry > new Date()) {
          player.discordId = interaction.user.id;
          player.isVerified = true;
          await player.save();
          
          try {
            const member = await interaction.guild?.members.fetch(interaction.user.id);
            if (member) {
              const newNick = `${interaction.user.username}(${mcName})`.substring(0, 32);
              await member.setNickname(newNick);
            }
          } catch (e) {
            console.error('Failed to set nickname', e);
          }

          broadcastToPlugin({ type: 'VERIFIED', username: mcName });
          await interaction.reply({ content: 'Successfully verified!', ephemeral: true });
        } else {
          await interaction.reply({ content: 'Invalid or expired code, or wrong username.', ephemeral: true });
        }
      }

      if (interaction.customId === 'create_guild_modal') {
        const guildName = interaction.fields.getTextInputValue('guild_name_input');
        
        const existing = await Guild.findOne({ name: guildName });
        if (existing) return interaction.reply({ content: 'Guild name already taken.', ephemeral: true });

        await interaction.deferReply({ ephemeral: true });

        try {
          const discordGuild = interaction.guild!;
          
          // Create VC
          const vc = await discordGuild.channels.create({
            name: `${guildName}-vc`,
            type: ChannelType.GuildVoice,
            parent: VC_CATEGORY_ID,
            permissionOverwrites: [
              { id: discordGuild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
              { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect] }
            ]
          });

          // Create Text
          const text = await discordGuild.channels.create({
            name: `${guildName}`,
            type: ChannelType.GuildText,
            parent: TEXT_CATEGORY_ID,
            permissionOverwrites: [
              { id: discordGuild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
              { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
          });

          const newGuild = new Guild({
            name: guildName,
            ownerId: interaction.user.id,
            members: [interaction.user.id],
            textChannelId: text.id,
            voiceChannelId: vc.id
          });
          await newGuild.save();

          const player = await Player.findOne({ discordId: interaction.user.id });
          if (player) {
            broadcastToPlugin({ type: 'GUILD_CREATED', username: player.minecraftUsername, guildName });
          }

          updateGuildLogs();
          await interaction.editReply({ content: `Guild ${guildName} created successfully!` });
        } catch (e) {
          console.error(e);
          await interaction.editReply({ content: 'Error creating guild channels. Check bot permissions.' });
        }
      }
    }
  });

  client.login(process.env.DISCORD_TOKEN);
}

async function updateGuildLogs() {
  const config = await Config.findOne({ key: 'guildlogs_channel' });
  if (!config) return;
  
  const channel = client.channels.cache.get(config.value) as TextChannel;
  if (!channel) return;

  const guilds = await Guild.find();
  let msg = '**Guild Logs**\n\n';
  
  for (const g of guilds) {
    msg += `**${g.name}**:\n`;
    for (const memberId of g.members) {
      const player = await Player.findOne({ discordId: memberId });
      msg += `- ${player ? player.minecraftUsername : 'Unknown'}\n`;
    }
    msg += '\n';
  }

  try {
    const messages = await channel.messages.fetch({ limit: 10 });
    const existingMsg = messages.find(m => m.author.id === client.user?.id && m.content.includes('**Guild Logs**'));
    
    if (existingMsg) {
      await existingMsg.edit(msg);
    } else {
      await channel.send(msg);
    }
  } catch (e) {
    console.error('Failed to update guild logs', e);
  }
}
