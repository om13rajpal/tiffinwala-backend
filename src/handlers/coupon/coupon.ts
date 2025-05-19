import { Request, Response } from "express";
import couponModel from "../../models/coupon";

export async function addCouponHandler(req: Request, res: Response) {
  const { code, discount, expiryDate } = req.body;

  const coupon = await new couponModel({
    code,
    discount,
    expiryDate,
  }).save();

  if (!coupon) {
    res.status(500).json({
      status: false,
      message: "Error creating coupon",
    });
    return;
  }

  res.json({
    status: true,
    message: "Coupon created successfully",
    data: coupon,
  });
}

export async function getCouponsHandler(req: Request, res: Response) {
  const coupon = await couponModel.find({});

  res.json({
    status: true,
    message: "Coupons fetched successfully",
    data: coupon,
  });
}

export async function verifyCouponHandler(req: Request, res: Response) {
  const { code } = req.body;
  const coupon = await couponModel.findOne({ code });

  if (!coupon) {
    res.status(404).json({
      status: false,
      message: "Coupon not found",
    });
    return;
  }

  const currentDate = new Date();
  if (coupon.expiryDate < currentDate) {
    res.status(400).json({
      status: false,
      message: "Coupon expired",
    });
    return;
  }

  res.json({
    status: true,
    message: "Coupon verified successfully",
    data: coupon,
  });
}
