import mongoose, { Document, model, Schema } from "mongoose";
import { any } from "zod";

interface Coupon extends Document {
  code: string;
  discount: number | string;
  expiryDate: Date;
  enabled: boolean;
  minOrder: number;
  maxValue?: number;
}

const couponSchema = new Schema<Coupon>({
  code: {
    type: String,
    required: true,
    unique: true,
  },
  minOrder: {
    type: Number,
    required: true,
  },
  discount: {
    type: mongoose.Schema.Types.Mixed,
    validate: {
      validator: (v: unknown) => typeof v === "string" || typeof v === "number",
      message: "Value must be a string or number",
    },
    required: true,
  },
  enabled: {
    type: Boolean,
    default: true,
  },
  expiryDate: {
    type: Date,
    required: true,
  },
  maxValue: {
    type: Number,
  },
});

const couponModel = model<Coupon>("Coupon", couponSchema);
export default couponModel;
