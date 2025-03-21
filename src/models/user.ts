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
    maxLength: 10,
    minLength: 10,
    trim: true,
  },
  joiningDate: {
    type: Date,
    default: Date.now(),
  },
});

export default mongoose.model<User>("User", userSchema);
