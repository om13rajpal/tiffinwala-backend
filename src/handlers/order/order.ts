import { Request, Response } from "express";
import orderModel from "../../models/order";
import userModel from "../../models/user";
import pointsModel from "../../models/points";
import { API_KEY, BASE_URL, BRANCH, CHANNEL } from "../../config/config";
import { generateToken } from "../../utils/generateToken";
import axios from "axios";

export async function newOrderHandler(req: Request, res: Response) {
  const {
    order,
    price,
    phone,
    paymentMethod,
    paymentStatus,
    orderMode,
    discount,
    delivery,
    couponCode,
    loyalty,
  } = req.body;

  console.log("Incoming order request:", req.body);

  try {
    // Save the order locally
    const orders = await orderModel.create({
      order,
      price,
      paymentMethod,
      paymentStatus,
      delivery,
      orderMode,
      discount,
      couponCode,
      loyalty,
    });

    const savedOrder = await orders.save();

    if (!savedOrder) {
      res.status(400).json({
        status: false,
        message: "Order not saved",
      });
      return;
    }

    // Calculate effective amount
    const effectiveAmount = price - discount;

    // Calculate loyalty points
    let earnedPoints = 0;
    const slabs = await pointsModel.find({});
    for (const slab of slabs) {
      if (effectiveAmount >= slab.lower && effectiveAmount <= slab.upper) {
        earnedPoints = slab.loyaltyPoints;
        break;
      }
    }

    // Update user’s loyalty points
    const user = await userModel.findOneAndUpdate(
      { phone },
      {
        $push: {
          orders: savedOrder._id,
        },
        $inc: {
          loyaltyPoints: earnedPoints - loyalty,
        },
      }
    );

    if (!user) {
      res.status(400).json({
        status: false,
        message: "User not found",
      });
      return;
    }

    // Build Rista item array
    const items = order.map((item: any) => ({
      shortName: item.shortName,
      skuCode: item.skuCode,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      itemTotalAmount: item.unitPrice * item.quantity,
      overridden: true,
      discounts: [],
      taxes: [],
      options: [],
      itemLog: [],
    }));

    const itemTotalAmount = items.reduce(
      (sum: any, i: any) => sum + i.itemTotalAmount,
      0
    );

    const charges = delivery
      ? [
          {
            name: "Delivery",
            type: "Absolute",
            rate: 0,
            saleAmount: delivery,
            amount: delivery,
            isDirectCharge: true,
            taxes: [],
          },
        ]
      : [];

    const payments = [
      {
        mode: paymentMethod,
        amount: effectiveAmount + (delivery || 0),
        reference: "",
        note: "",
      },
    ];

    // UPDATED: delivery mode set to SelfDelivery
    const salePayload = {
      branchCode: BRANCH,
      status: "Open",
      channel: CHANNEL,
      customer: {
        id: "",
        title: "",
        name: phone,
        email: "",
        phoneNumber: phone,
      },
      items,
      itemTotalAmount,
      directChargeAmount: delivery || 0,
      chargeAmount: delivery || 0,
      discountAmount: discount,
      taxAmountIncluded: 0,
      taxAmountExcluded: 0,
      billAmount: price,
      roundOffAmount: 0,
      billRoundedAmount: effectiveAmount + (delivery || 0),
      tipAmount: 0,
      totalAmount: effectiveAmount + (delivery || 0),
      charges,
      discounts: [],
      taxes: [],
      payments,
      balanceAmount: 0,
      delivery: {
        mode: "Delivery",
        name: phone,
        phoneNumber: phone,
        email: "",
      },
    };

    console.log("Sending payload to Rista:", salePayload);

    const token = generateToken();

    const response = await axios.post(`${BASE_URL}/sale`, salePayload, {
      headers: {
        "x-api-key": API_KEY,
        "x-api-token": token,
        "Content-Type": "application/json",
      },
    });

    console.log("Rista response:", response.data);

    if (response.status === 201) {
      res.status(201).json({
        status: true,
        message: "Sale created successfully",
        data: savedOrder,
        earnedPoints,
        ristaResponse: response.data,
      });
      return;
    } else {
      res.status(500).json({
        status: false,
        message: "Error creating sale",
        error: response.data,
      });
      return;
    }
  } catch (error: any) {
    console.error("Error creating sale:", error);
    if (error.response) {
      console.error("Rista error details:", error.response.data);
    }
    res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : error,
    });
    return;
  }
}

export async function getOrdersHandler(req: Request, res: Response) {
  const { phone } = req.params;

  try {
    const user = await userModel.findOne({ phone });

    if (!user) {
      res.status(400).json({
        status: false,
        message: "User not found",
      });
      return;
    }

    const orders = await orderModel.find({
      _id: {
        $in: user.orders,
      },
    });

    res.json({
      status: true,
      message: "Orders fetched successfully",
      data: orders,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
}
