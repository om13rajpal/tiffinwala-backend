import { Document, model, Schema } from "mongoose";

interface Coupon extends Document {
  code: string;
  discount: number;
  expiryDate: Date;
  minOrder: number;
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
    type: Number,
    required: true,
  },
  expiryDate: {
    type: Date,
    required: true,
  },
});

const couponModel = model<Coupon>("Coupon", couponSchema);
export default couponModel;
