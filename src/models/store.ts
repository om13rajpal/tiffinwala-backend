import { Document, model, Schema } from "mongoose";
import { boolean, date } from "zod";

interface StoreStatus extends Document {
  active: boolean;
  updatedAt: Date;
}

const storeSchema = new Schema<StoreStatus>({
  active: {
    type: Boolean,
    default: false
  },
  updatedAt: {
    type: Date,
    default: Date.now(),
  },
});

const storeModel = model<StoreStatus>("StoreStatus", storeSchema)
export default storeModel
