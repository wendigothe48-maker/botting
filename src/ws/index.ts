import { WebSocket } from 'ws';
import { Player } from '../models/Player';
import { Guild } from '../models/Guild';
import { PreApproval } from '../models/PreApproval';

const clients = new Set<WebSocket>();

export function handleWsConnection(ws: WebSocket) {
  clients.add(ws);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'PLAYER_JOIN') {
        const username = data.username;
        // Generate 6 char code
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        await Player.findOneAndUpdate(
          { minecraftUsername: username },
          { 
            verificationCode: code, 
            codeExpiry: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
          },
          { upsert: true, new: true }
        );
        
        ws.send(JSON.stringify({
          type: 'CODE_GENERATED',
          username,
          code
        }));
      }
      
      if (data.type === 'GET_CODE') {
        const player = await Player.findOne({ minecraftUsername: data.username });
        if (player && player.verificationCode && player.codeExpiry && player.codeExpiry > new Date()) {
          ws.send(JSON.stringify({
            type: 'CODE_GENERATED',
            username: data.username,
            code: player.verificationCode
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'ERROR',
            username: data.username,
            message: 'No valid code found. Please rejoin to generate a new one.'
          }));
        }
      }

      if (data.type === 'INVITE') {
        const inviterPlayer = await Player.findOne({ minecraftUsername: data.inviter });
        if (inviterPlayer && inviterPlayer.isVerified) {
          const guild = await Guild.findOne({ members: inviterPlayer.discordId });
          if (guild) {
            // Check if invitee has pre-approved
            const preApproval = await PreApproval.findOne({ minecraftUsername: data.invitee, guildName: guild.name });
            if (preApproval && preApproval.expiry > new Date()) {
              // Auto join
              const inviteePlayer = await Player.findOne({ minecraftUsername: data.invitee });
              if (inviteePlayer && inviteePlayer.isVerified) {
                if (!guild.members.includes(inviteePlayer.discordId)) {
                  guild.members.push(inviteePlayer.discordId);
                  await guild.save();
                  
                  ws.send(JSON.stringify({
                    type: 'JOIN_SUCCESS',
                    username: data.invitee,
                    guildName: guild.name
                  }));
                  
                  // Delete pre-approval
                  await PreApproval.deleteOne({ _id: preApproval._id });
                }
              } else {
                 ws.send(JSON.stringify({
                    type: 'ERROR',
                    username: data.inviter,
                    message: `Player ${data.invitee} is not verified on Discord.`
                 }));
              }
            } else {
              // Send invite to invitee
              ws.send(JSON.stringify({
                type: 'INVITE_RECEIVED',
                invitee: data.invitee,
                guildName: guild.name
              }));
            }
          }
        }
      }

      if (data.type === 'JOIN') {
        const inviteePlayer = await Player.findOne({ minecraftUsername: data.username });
        if (inviteePlayer && inviteePlayer.isVerified) {
          // Check if they are already in a guild
          const existingGuild = await Guild.findOne({ members: inviteePlayer.discordId });
          if (existingGuild) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              username: data.username,
              message: 'You are already in a guild.'
            }));
            return;
          }

          const guild = await Guild.findOne({ name: data.guildName });
          if (guild) {
            // Pre-approve for 6 hours
            await PreApproval.findOneAndUpdate(
              { minecraftUsername: data.username, guildName: data.guildName },
              { expiry: new Date(Date.now() + 6 * 60 * 60 * 1000) },
              { upsert: true }
            );
            ws.send(JSON.stringify({
              type: 'PRE_APPROVED',
              username: data.username,
              guildName: data.guildName
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'ERROR',
              username: data.username,
              message: 'Guild not found.'
            }));
          }
        } else {
          ws.send(JSON.stringify({
            type: 'ERROR',
            username: data.username,
            message: 'You must be verified on Discord to join a guild.'
          }));
        }
      }

    } catch (e) {
      console.error('WS Error:', e);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
}

export function broadcastToPlugin(data: any) {
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  }
}
