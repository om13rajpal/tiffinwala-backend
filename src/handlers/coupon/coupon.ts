import { Request, Response } from "express";
import couponModel from "../../models/coupon";

export async function addCouponHandler(req: Request, res: Response) {
  const { code, discount, expiryDate, minOrder, maxValue } = req.body;

  const coupon = await new couponModel({
    code,
    discount,
    expiryDate,
    minOrder,
    maxValue,
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
  const { code, currentCartPrice } = req.body;
  const coupon = await couponModel.findOne({ code });

  if (!coupon) {
    res.status(404).json({
      status: false,
      message: "Coupon not found",
    });
    return;
  }

  const currentDate = new Date();
  if (coupon.expiryDate < currentDate && currentCartPrice > coupon.minOrder) {
    res.status(400).json({
      status: false,
      message: "Cannot apply this coupon",
    });
    return;
  }

  res.json({
    status: true,
    message: "Coupon verified successfully",
    data: coupon,
  });
}

export async function deleteCouponHander(req: Request, res: Response) {
  const id = req.params.id;

  try {
    const coupon = await couponModel.findByIdAndDelete(id);
    if (!coupon) {
      res.status(404).json({
        status: false,
        message: "coupon not found",
      });
      return;
    }

    res.json({
      status: true,
      message: "coupon deleted successfully",
    });
  } catch (error) {
    console.error("error deleting coupon");
    res.status(500).json({
      status: false,
      message: "internal server error",
    });
  }
}
