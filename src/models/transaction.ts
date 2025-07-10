import { Document, model, Schema } from "mongoose";

export interface Transaction extends Document {
  senderId: Schema.Types.ObjectId;
  receiverId: Schema.Types.ObjectId;
  amount: number;
}

const transactionSchema = new Schema<Transaction>({
  senderId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  receiverId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "Merchant",
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
});

const transactionModel = model<Transaction>("Transaction", transactionSchema);
export default transactionModel;
