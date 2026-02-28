import mongoose from 'mongoose';

const guildSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  ownerId: { type: String, required: true }, // Discord ID
  members: [{ type: String }], // Discord IDs
  textChannelId: { type: String, default: null },
  voiceChannelId: { type: String, default: null },
});

export const Guild = mongoose.models.Guild || mongoose.model('Guild', guildSchema);
