import mongoose, { Document, Schema } from "mongoose";

interface OrderItem extends Document {
  itemName: string;
  price: number;
  quantity: number;
}

interface Order extends Document {
  order: OrderItem[];
  orderDate: Date;
  price: number;
}

const orderItemSchema = new Schema<OrderItem>(
  {
    itemName: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
  },
  {
    _id: false,
  }
);

const orderSchema = new Schema<Order>({
  order: [
    {
      type: orderItemSchema,
      required: true,
    },
  ],
  price: {
    type: Number,
    required: true,
  },
  orderDate: {
    type: Date,
    default: Date.now(),
  },
});

const orderModel = mongoose.model<Order>("Order", orderSchema);
export default orderModel;
