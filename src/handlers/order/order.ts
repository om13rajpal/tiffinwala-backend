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

    console.log("Order subtotal:", price);
    console.log("Coupon discount:", discount);
    console.log("Loyalty discount:", loyalty);

    if (!savedOrder) {
      res.status(400).json({
        status: false,
        message: "Order not saved",
      });
      return;
    }

    // Calculate how many loyalty points to award
    const effectiveAmount = price - discount;

    let earnedPoints = 0;

    // Fetch loyalty slabs from DB
    const slabs = await pointsModel.find({});

    for (const slab of slabs) {
      if (
        effectiveAmount >= slab.lower &&
        effectiveAmount <= slab.upper
      ) {
        earnedPoints = slab.loyaltyPoints;
        break;
      }
    }

    console.log(`Effective order amount: ₹${effectiveAmount}`);
    console.log(`Earned loyalty points: ${earnedPoints}`);

    // Update user:
    // - subtract loyalty points used
    // - add earned loyalty points
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

    // Your original commented-out sale logic preserved below
    // const body = {
    //   branchCode: BRANCH,
    //   channel: CHANNEL,
    //   items: order,
    // };
    // const token = generateToken();
    // try {
    //   const response = await axios.post(`${BASE_URL}/sale`, body, {
    //     headers: {
    //       "x-api-key": API_KEY,
    //       "x-api-token": token,
    //       "Content-Type": "application/json",
    //     },
    //   });
    //
    //   if (response.status === 201) {
    res.status(201).json({
      status: true,
      message: "Sale created successfully",
      data: savedOrder,
      earnedPoints,
    });
    //     return;
    //   } else {
    //     res.status(500).json({
    //       status: false,
    //       message: "Internal Server Error",
    //       error: response.data,
    //     });
    //     return;
    //   }
    // } catch (error) {
    //   console.error("Error creating sale:", error);
    //   res.status(500).json({
    //     status: false,
    //     message: "Internal Server Error",
    //     error: error,
    //   });
    //   return;
    // }

  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
    });
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
