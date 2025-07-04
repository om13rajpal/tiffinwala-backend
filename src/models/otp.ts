import mongoose from "mongoose";

export interface OtpDocument extends mongoose.Document {
  phone: string;
  otp: string;
  createdAt: Date;
  expiresAt: Date;
}

const otpSchema = new mongoose.Schema<OtpDocument>({
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  otp: {
    type: String,
    required: true,
    minlength: 6,
    maxlength: 6,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 5 * 60 * 1000),
  },
});

export const otpModel = mongoose.model<OtpDocument>("Otp", otpSchema);
