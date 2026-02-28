import mongoose from 'mongoose';

const preApprovalSchema = new mongoose.Schema({
  minecraftUsername: { type: String, required: true },
  guildName: { type: String, required: true },
  expiry: { type: Date, required: true },
});

export const PreApproval = mongoose.models.PreApproval || mongoose.model('PreApproval', preApprovalSchema);
