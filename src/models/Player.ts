import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema({
  discordId: { type: String, default: null },
  minecraftUsername: { type: String, required: true, unique: true },
  verificationCode: { type: String, default: null },
  codeExpiry: { type: Date, default: null },
  isVerified: { type: Boolean, default: false },
});

export const Player = mongoose.models.Player || mongoose.model('Player', playerSchema);
