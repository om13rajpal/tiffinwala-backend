import mongoose, { Document, Schema } from "mongoose";

interface User extends Document {
  firstName: string;
  lastName: string;
  address: string[];
  phone: string;
  joiningDate: Date;
  loyaltyPoints: number;
  seller: boolean;
  appliedForSeller: boolean;
  qr: string;
  balance: number;
  orders: Schema.Types.ObjectId[];
}

const userSchema = new Schema<User>({
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  balance: {
    type: Number,
    min: 0,
    default: 0,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  address: [
    {
      type: String,
    },
  ],
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  joiningDate: {
    type: Date,
    default: Date.now,
  },
  loyaltyPoints: {
    type: Number,
    default: 20,
  },
  seller: {
    type: Boolean,
    default: false,
  },
  appliedForSeller: {
    type: Boolean,
    default: false,
  },
  qr: {
    type: String,
    default: "",
  },
  orders: [
    {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: [],
    },
  ],
});

const userModel = mongoose.model<User>("User", userSchema);
export default userModel;
