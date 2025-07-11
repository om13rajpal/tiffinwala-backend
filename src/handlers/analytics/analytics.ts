import { Request, Response } from "express";
import orderModel from "../../models/order";

export async function getAnalyticsOverview(req: Request, res: Response) {
  try {
    const totalOrders = await orderModel.countDocuments();

    const totalRevenueAgg = await orderModel.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$price" },
        },
      },
    ]);

    const totalRevenue =
      totalRevenueAgg.length > 0 ? totalRevenueAgg[0].totalRevenue : 0;

    res.json({
      status: true,
      totalOrders,
      totalRevenue,
    });
    return;
  } catch (error) {
    console.error("Error fetching analytics overview", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
    });
    return;
  }
}

export async function getOrdersPerDay(req: Request, res: Response) {
  try {
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const orders = await orderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: last7Days },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
          revenue: { $sum: "$price" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    res.json({
      status: true,
      data: orders,
    });
    return;
  } catch (error) {
    console.error("Error fetching orders per day", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
    });
    return;
  }
}

import { PipelineStage } from "mongoose";

const pipeline: PipelineStage[] = [
  { $unwind: "$order" },
  {
    $group: {
      _id: "$order.shortName",
      totalQuantity: { $sum: "$order.quantity" },
      totalRevenue: {
        $sum: {
          $multiply: ["$order.unitPrice", "$order.quantity"],
        },
      },
    },
  },
  { $sort: { totalQuantity: -1 } },
  { $limit: 5 },
];

export async function getTopItems(req: Request, res: Response) {
  try {
    const pipeline: PipelineStage[] = [
      { $unwind: "$order" },
      {
        $group: {
          _id: "$order.shortName",
          totalQuantity: { $sum: "$order.quantity" },
          totalRevenue: {
            $sum: {
              $multiply: ["$order.unitPrice", "$order.quantity"],
            },
          },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
    ];

    const items = await orderModel.aggregate(pipeline);

    res.json({
      status: true,
      items,
    });
    return;
  } catch (error) {
    console.error("Error fetching top items", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
    });
    return;
  }
}
