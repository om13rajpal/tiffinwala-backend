import mongoose, { Schema, Document } from "mongoose";

export interface IMenuSnapshot extends Document {
  branch?: string | null;
  channel?: string | null;
  fetchedAt: Date;
  payload: any;
}

const MenuSnapshotSchema = new Schema<IMenuSnapshot>(
  {
    branch: { type: String, default: null },
    channel: { type: String, default: null },
    fetchedAt: { type: Date, default: Date.now },
    payload: { type: Schema.Types.Mixed, required: true },
  },
  { strict: false, timestamps: true }
);

export default mongoose.models.MenuSnapshot ??
  mongoose.model<IMenuSnapshot>("MenuSnapshot", MenuSnapshotSchema);