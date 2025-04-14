import mongoose, { Document, Schema } from "mongoose";

interface User extends Document {
  firstName: string;
  lastName: string;
  address: string;
  phone: string;
  joiningDate: Date;
  loyaltyPoints: number;
  orders: Schema.Types.ObjectId[];
}

const userSchema = new Schema<User>({
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  address: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  joiningDate: {
    type: Date,
    default: Date.now(),
  },
  loyaltyPoints: {
    type: Number,
    default: 0,
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
