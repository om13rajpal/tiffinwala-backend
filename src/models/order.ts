import mongoose, { Document, Schema } from "mongoose";

interface OrderItem extends Document {
  shortName: string;
  skuCode: string;
  unitPrice: number;
  quantity: number;
}

interface Order extends Document {
  order: OrderItem[];
  orderDate: Date;
  price: number;
  delivery: number;
  paymentStatus: string;
  paymentMethod: string;
  orderMode: string;
  couponCode: string;
  discount?: number;
  loyalty: number;
}

const orderItemSchema = new Schema<OrderItem>(
  {
    shortName: {
      type: String,
      required: true,
    },
    skuCode: {
      type: String,
      required: true,
    },
    unitPrice: {
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
  paymentMethod: {
    type: String,
    required: true,
  },
  paymentStatus: {
    type: String,
    required: true,
    enum: ["pending", "completed", "failed"],
    default: "pending",
  },
  couponCode: String,
  delivery: {
    type: Number,
  },
  orderMode: {
    type: String,
    required: true,
    enum: ["delivery", "pickup"],
  },
  discount: {
    type: Number,
    default: 0,
  },
  loyalty: Number
});

const orderModel = mongoose.model<Order>("Order", orderSchema);
export default orderModel;
