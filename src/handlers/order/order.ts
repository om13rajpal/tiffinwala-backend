import { Request, Response } from "express";
import orderModel from "../../models/order";
import userModel from "../../models/user";

export async function newOrderHandler(req: Request, res: Response) {
  const {
    order,
    price,
    phone,
    paymentMethod,
    paymentStatus,
    orderMode,
    discount,
  } = req.body;

  try {
    const orders = await orderModel.create({
      order,
      price,
      paymentMethod,
      paymentStatus,
      orderMode: orderMode,
      discount,
    });

    const savedOrder = await orders.save();

    if (!savedOrder) {
      res.status(400).json({
        status: false,
        message: "Order not saved",
      });
      return;
    }
    var loyaltyPoints = 0;
    if (price - discount >= 299) {
      loyaltyPoints = 10;
    }

    const user = await userModel.findOneAndUpdate(
      { phone },
      {
        $push: {
          orders: savedOrder._id,
        },
        $inc: {
          loyaltyPoints: loyaltyPoints,
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

    //   if (response.status === 201) {
    //     res.status(201).json({
    //       status: true,
    //       message: "Sale created successfully",
    //       data: response.data,
    //     });
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

    res.json({
      status: true,
      message: "Order created successfully",
      data: savedOrder,
    });
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
