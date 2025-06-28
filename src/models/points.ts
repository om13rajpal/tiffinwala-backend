import { Document, model, Schema } from "mongoose";

interface Points extends Document {
  lower: number;
  upper: number;
  loyaltyPoints: number;
}

const pointsSchema = new Schema<Points>({
  lower: {
    type: Number,
    required: true,
  },
  upper: {
    type: Number,
    required: true,
  },
  loyaltyPoints: {
    type: Number,
    required: true,
  },
});

const pointsModel = model<Points>("Points", pointsSchema);
export default pointsModel;
