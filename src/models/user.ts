import mongoose, { Document, Schema } from "mongoose";

interface User extends Document {
  phone: string;
  joiningDate: Date;
  loyaltyPoints: number;
  orders: Schema.Types.ObjectId[];
}

const userSchema = new Schema<User>({
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
