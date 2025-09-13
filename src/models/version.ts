import mongoose from "mongoose";

export interface VersionDocument extends mongoose.Document {
  version: string;

}

const versionSchema = new mongoose.Schema<VersionDocument>({
  version: {
    type: String,
    trim: true,
  },
});

export const versionModel = mongoose.model<VersionDocument>("Version", versionSchema);