import mongoose from "mongoose";

export interface OtpDocument extends mongoose.Document {
  phone: string;
  otp: string;
  createdAt: Date;
}

const otpSchema = new mongoose.Schema<OtpDocument>({
  phone: {
    type: String,
    required: true,
    minlength: 10,
    maxlength: 10,
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
    default: Date.now(),
    expires: 60
  },
});

export const otpModel = mongoose.model<OtpDocument>("Otp", otpSchema);
