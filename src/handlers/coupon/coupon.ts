// src/controllers/coupon.ts
import { Request, Response } from "express";
import couponModel from "../../models/coupon";

const toBool = (v: any): boolean | null => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return null;
};

export async function updateCouponHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { code, discount, expiryDate, minOrder, maxValue, enabled } = req.body;

    const update: any = {};
    if (code !== undefined) update.code = code;
    if (discount !== undefined) update.discount = discount;
    if (expiryDate !== undefined) update.expiryDate = expiryDate;
    if (minOrder !== undefined) update.minOrder = minOrder;
    if (maxValue !== undefined) update.maxValue = maxValue;
    if (enabled !== undefined) update.enabled = enabled;

    const coupon = await couponModel.findByIdAndUpdate(id, update, { new: true });

    if (!coupon) {
      res.status(404).json({ status: false, message: "Coupon not found" });
      return;
    }

    res.json({
      status: true,
      message: "Coupon updated successfully",
      data: coupon,
    });
  } catch {
    res.status(500).json({ status: false, message: "Error updating coupon" });
  }
}

export async function addCouponHandler(req: Request, res: Response) {
  try {
    const { code, discount, expiryDate, minOrder, maxValue, enabled } = req.body;

    const coupon = await new couponModel({
      code,
      discount,
      expiryDate,
      minOrder,
      maxValue,
      enabled: typeof enabled === "boolean" ? enabled : true,
    }).save();

    res.json({
      status: true,
      message: "Coupon created successfully",
      data: coupon,
    });
  } catch {
    res.status(500).json({ status: false, message: "Error creating coupon" });
  }
}

export async function getCouponsHandler(req: Request, res: Response) {
  try {
    const { enabled } = req.query;
    const filter: any = {};
    const parsed = toBool(enabled);
    if (parsed !== null) filter.enabled = parsed;

    const coupons = await couponModel.find(filter).sort({ createdAt: -1 });

    res.json({
      status: true,
      message: "Coupons fetched successfully",
      data: coupons,
    });
  } catch {
    res.status(500).json({ status: false, message: "Internal server error" });
  }
}

export async function verifyCouponHandler(req: Request, res: Response) {
  try {
    const { code, price } = req.body;

    const coupon = await couponModel.findOne({ code });
    if (!coupon) {
      res.status(404).json({ status: false, message: "Coupon not found" });
      return;
    }

    const now = new Date();
    if (!coupon.enabled) {
      res.status(400).json({ status: false, message: "Coupon is disabled" });
      return;
    }
    if (coupon.expiryDate < now) {
      res.status(400).json({ status: false, message: "Coupon expired" });
      return;
    }
    if (typeof price !== "number" || price < coupon.minOrder) {
      res.status(400).json({
        status: false,
        message: "Order amount does not meet the minimum requirement",
      });
      return;
    }

    res.json({
      status: true,
      message: "Coupon verified successfully",
      data: coupon,
    });
  } catch {
    res.status(500).json({ status: false, message: "Internal server error" });
  }
}

export async function deleteCouponHander(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const coupon = await couponModel.findByIdAndDelete(id);
    if (!coupon) {
      res.status(404).json({ status: false, message: "Coupon not found" });
      return;
    }
    res.json({ status: true, message: "Coupon deleted successfully" });
  } catch {
    res.status(500).json({ status: false, message: "Internal server error" });
  }
}

/** NEW: Status checker (by code) — supports optional ?price= */
export async function getCouponStatusHandler(req: Request, res: Response) {
  try {
    const { code } = req.params;
    const price = Number(req.query.price);
    const coupon = await couponModel.findOne({ code });

    if (!coupon) {
      res.status(404).json({ status: false, message: "Coupon not found" });
      return;
    }

    const now = new Date();
    const enabled = !!coupon.enabled;
    const expired = coupon.expiryDate < now;
    const meetsMinOrder =
      Number.isFinite(price) ? price >= coupon.minOrder : null;

    const valid =
      enabled &&
      !expired &&
      (meetsMinOrder === null ? true : meetsMinOrder === true);

    res.json({
      status: true,
      message: "Coupon status",
      data: {
        code: coupon.code,
        enabled,
        expired,
        meetsMinOrder,
        minOrder: coupon.minOrder,
        expiryDate: coupon.expiryDate,
        valid,
      },
    });
  } catch {
    res.status(500).json({ status: false, message: "Internal server error" });
  }
}

/** Enable/Disable by ID with explicit boolean */
export async function setCouponEnabledByIdHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const parsed = toBool(req.body.enabled);
    if (parsed === null) {
      res
        .status(400)
        .json({ status: false, message: "enabled must be true or false" });
      return;
    }

    const updated = await couponModel.findByIdAndUpdate(
      id,
      { $set: { enabled: parsed } },
      { new: true }
    );

    if (!updated) {
      res.status(404).json({ status: false, message: "Coupon not found" });
      return;
    }

    res.json({
      status: true,
      message: `Coupon ${parsed ? "enabled" : "disabled"} successfully`,
      data: updated,
    });
  } catch {
    res.status(500).json({ status: false, message: "Internal server error" });
  }
}

/** Enable/Disable by CODE with explicit boolean */
export async function setCouponEnabledByCodeHandler(
  req: Request,
  res: Response
) {
  try {
    const { code } = req.params;
    const parsed = toBool(req.body.enabled);
    if (parsed === null) {
      res
        .status(400)
        .json({ status: false, message: "enabled must be true or false" });
      return;
    }

    const updated = await couponModel.findOneAndUpdate(
      { code },
      { $set: { enabled: parsed } },
      { new: true }
    );

    if (!updated) {
      res.status(404).json({ status: false, message: "Coupon not found" });
      return;
    }

    res.json({
      status: true,
      message: `Coupon ${parsed ? "enabled" : "disabled"} successfully`,
      data: updated,
    });
  } catch {
    res.status(500).json({ status: false, message: "Internal server error" });
  }
}

/** Toggle by ID (no body needed) */
export async function toggleCouponEnabledByIdHandler(
  req: Request,
  res: Response
) {
  try {
    const { id } = req.params;
    const coupon = await couponModel.findById(id);
    if (!coupon) {
      res.status(404).json({ status: false, message: "Coupon not found" });
      return;
    }

    coupon.enabled = !coupon.enabled;
    await coupon.save();

    res.json({
      status: true,
      message: `Coupon ${coupon.enabled ? "enabled" : "disabled"} successfully`,
      data: coupon,
    });
  } catch {
    res.status(500).json({ status: false, message: "Internal server error" });
  }
}