import mongoose, { Document, Schema } from "mongoose";

interface User extends Document {
  phone: string;
  joiningDate: Date;
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
});

const userModel = mongoose.model<User>("User", userSchema);
export default userModel;
