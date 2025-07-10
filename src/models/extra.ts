import { Document, model, Schema } from "mongoose";

export interface IExtra extends Document {
  merchantId: Schema.Types.ObjectId;
  isSettled: boolean;
  amount: number;
  settlementId: string;
}

const extraSchema = new Schema<IExtra>({
  merchantId: {
    type: Schema.Types.ObjectId,
    ref: "Merchant",
  },
  amount: {
    type: Number,
    default: 5,
  },
  isSettled: {
    type: Boolean,
    default: false,
  },
  settlementId: String,
});

const extraModel = model<IExtra>("ExtraCash", extraSchema);
export default extraModel;
