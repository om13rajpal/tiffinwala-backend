import mongoose, { Document, Schema } from "mongoose";

export interface Order extends Document {
  itemName: string;
  price: number;
  orderDate: Date;
  quantity: number;
}

const orderSchema = new Schema<Order>({
  itemName: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
  },
  orderDate: {
    type: Date,
    default: Date.now(),
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
  }
});

const orderModel = mongoose.model<Order>("Order", orderSchema);
export default orderModel;
