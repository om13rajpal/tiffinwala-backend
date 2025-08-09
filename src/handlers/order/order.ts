// src/controllers/order.ts
import { Request, Response } from "express";
import orderModel from "../../models/order";
import userModel from "../../models/user";
import pointsModel from "../../models/points";
import { API_KEY, BASE_URL, BRANCH, CHANNEL } from "../../config/config";
import { generateToken } from "../../utils/generateToken";
import axios from "axios";

const toNum = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

type RistaItem = {
  shortName: string;
  skuCode: string;
  quantity: number;
  unitPrice: number;
  itemTotalAmount: number;
  overridden: boolean;
  discounts: any[];
  taxes: any[];
  options: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    itemTotalAmount: number;
  }>;
  itemLog: any[];
  // internal helper, stripped before send
  _computedLineGrand?: number;
};

function buildItems(order: any[]): { items: RistaItem[]; itemBaseTotal: number; itemGrandTotal: number } {
  const items: RistaItem[] = (order || []).map((item: any) => {
    const qty = toNum(item.quantity, 0);
    const unit = toNum(item.unitPrice, 0);
    const baseAmount = unit * qty;
    const options = (item.options || []).map((o: any) => ({
      name: o.name,
      quantity: 1,
      unitPrice: toNum(o.price, 0),
      itemTotalAmount: toNum(o.price, 0),
    }));
    const optionTotal = options.reduce((s: any, o: any) => s + o.itemTotalAmount, 0);
    return {
      shortName: item.shortName,
      skuCode: item.skuCode,
      quantity: qty,
      unitPrice: unit,
      itemTotalAmount: baseAmount,
      overridden: true,
      discounts: [],
      taxes: [],
      options,
      itemLog: [],
      _computedLineGrand: baseAmount + optionTotal,
    };
  });

  const itemBaseTotal = items.reduce((s, i) => s + toNum(i.itemTotalAmount, 0), 0);
  const itemGrandTotal = items.reduce((s, i) => s + toNum(i._computedLineGrand, 0), 0);
  return { items, itemBaseTotal, itemGrandTotal };
}

function buildCharges(deliveryTotal: number, packagingTotal: number) {
  const charges: any[] = [];
  if (deliveryTotal > 0) {
    charges.push({
      name: "Delivery",
      type: "Absolute",
      rate: 0,
      saleAmount: deliveryTotal,
      amount: deliveryTotal,
      isDirectCharge: true,
      taxes: [],
    });
  }
  if (packagingTotal > 0) {
    charges.push({
      name: "Packaging",
      type: "Absolute",
      rate: 0,
      saleAmount: packagingTotal,
      amount: packagingTotal,
      isDirectCharge: true,
      taxes: [],
    });
  }
  return { charges, totalDirectCharges: deliveryTotal + packagingTotal };
}

/** Try posting to Rista; return {ok, data, error} */
async function postToRista(payload: any) {
  const token = generateToken();
  try {
    const resp = await axios.post(`${BASE_URL}/sale`, payload, {
      headers: {
        "x-api-key": API_KEY,
        "x-api-token": token,
        "Content-Type": "application/json",
      },
    });
    return { ok: resp.status === 201, data: resp.data, error: null as any };
  } catch (err: any) {
    return { ok: false, data: null as any, error: err?.response?.data || err?.message || err };
  }
}

/** Prorate a total discount across items based on itemGrandTotal */
function applyLineLevelProration(items: RistaItem[], totalDiscount: number) {
  const base = items.reduce((s, i) => s + toNum(i._computedLineGrand, 0), 0);
  if (base <= 0 || totalDiscount <= 0) return items;

  let remaining = totalDiscount;
  const n = items.length;

  return items.map((it, idx) => {
    const weight = toNum(it._computedLineGrand, 0) / base;
    // last line absorbs rounding residue
    const part = idx === n - 1 ? remaining : Math.round((totalDiscount * weight + Number.EPSILON) * 100) / 100;
    remaining = Math.max(0, Math.round((remaining - part + Number.EPSILON) * 100) / 100);

    const discountObj = {
      name: "Applied Discount",
      type: "Absolute",
      rate: part,          // many tenants require 'rate'
      amount: -part,       // negative for discounts
      saleAmount: part,
      isDirectDiscount: true,
      taxes: [],
    };
    return { ...it, discounts: [...it.discounts, discountObj] };
  });
}

export async function newOrderHandler(req: Request, res: Response) {
  const {
    order,
    price,                 // subtotal from app (items total incl. options)
    handling = 0,          // packaging total
    delivery = 0,          // delivery fee
    phone,
    paymentMethod,         // "cod"
    paymentStatus,         // "pending"
    orderMode,
    discount = 0,          // coupon discount (₹)
    loyalty = 0,           // loyalty discount (₹)
    couponCode,
  } = req.body;

  try {
    // Normalize
    const subtotalFromApp = toNum(price, 0);
    const packagingTotal  = Math.max(0, toNum(handling, 0));
    const deliveryTotal   = Math.max(0, toNum(delivery, 0));
    const couponDiscount  = Math.max(0, toNum(discount, 0));
    const loyaltyDiscount = Math.max(0, toNum(loyalty, 0));
    const totalDiscount   = couponDiscount + loyaltyDiscount;

    // Get user
    const user = await userModel.findOne({ phone });
    if (!user) {
      res.status(400).json({ status: false, message: "User not found" });
      return;
    }
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || phone;

    // Build items & choose subtotal mirror UI
    const { items: payloadItemsRaw, itemBaseTotal, itemGrandTotal } = buildItems(order || []);
    const subtotal = subtotalFromApp || itemGrandTotal || itemBaseTotal;

    // Final bill like UI
    const finalBill = Math.max(0, subtotal - totalDiscount + deliveryTotal + packagingTotal);

    // Save local order
    const localOrder = await orderModel.create({
      order,
      price: subtotal,
      handling: packagingTotal,
      delivery: deliveryTotal,
      paymentMethod,
      paymentStatus,
      orderMode,
      discount: couponDiscount,
      loyalty: loyaltyDiscount,
      couponCode,
      amountPayable: finalBill,
      customerName: fullName,
      phone,
    });
    const savedOrder = await localOrder.save();
    if (!savedOrder) {
      res.status(400).json({ status: false, message: "Order not saved" });
      return;
    }

    // Loyalty earning policy (award on subtotal - coupon)
    const effectiveAmount = Math.max(0, subtotal - couponDiscount);
    let earnedPoints = 0;
    const slabs = await pointsModel.find({});
    for (const slab of slabs) {
      if (effectiveAmount >= slab.lower && effectiveAmount <= slab.upper) {
        earnedPoints = slab.loyaltyPoints;
        break;
      }
    }
    await userModel.findOneAndUpdate(
      { phone },
      { $push: { orders: savedOrder._id }, $inc: { loyaltyPoints: earnedPoints } }
    );

    // Charges
    const { charges, totalDirectCharges } = buildCharges(deliveryTotal, packagingTotal);

    // Payments
    const payments = [{ mode: paymentMethod, amount: finalBill, reference: "", note: "" }];

    // ===== Attempt A: Sale-level discount with rate & negative amount =====
    const saleLevelDiscounts_A =
      totalDiscount > 0
        ? [
            {
              name: "Coupon + Loyalty",
              type: "Absolute",
              rate: totalDiscount,     // required in many tenants
              amount: -totalDiscount,  // negative for discount
              saleAmount: totalDiscount,
              isDirectDiscount: true,
              taxes: [],
            },
          ]
        : [];

    const salePayload_A = {
      branchCode: BRANCH,
      status: "Open",
      channel: CHANNEL,
      customer: { id: "", title: "", name: fullName, email: "", phoneNumber: phone },
      items: payloadItemsRaw.map(({ _computedLineGrand, ...rest }) => rest),
      itemTotalAmount: subtotal,
      directChargeAmount: totalDirectCharges,
      chargeAmount: totalDirectCharges,
      discountAmount: totalDiscount,
      taxAmountIncluded: 0,
      taxAmountExcluded: 0,
      billAmount: finalBill,
      roundOffAmount: 0,
      billRoundedAmount: finalBill,
      tipAmount: 0,
      totalAmount: finalBill,
      charges,
      discounts: saleLevelDiscounts_A,
      taxes: [],
      payments,
      balanceAmount: 0,
      delivery: {
        mode: String(orderMode || "").toLowerCase() === "pickup" ? "SelfDelivery" : "Delivery",
        name: fullName,
        phoneNumber: phone,
        email: "",
      },
    };

    console.log("Sending payload to Rista (A):", salePayload_A);
    let resp = await postToRista(salePayload_A);
    if (resp.ok) {
      res.status(201).json({
        status: true,
        message: "Sale created successfully",
        data: savedOrder,
        earnedPoints,
        ristaResponse: resp.data,
        summary: {
          subtotal,
          couponDiscount,
          loyaltyDiscount,
          delivery: deliveryTotal,
          packaging: packagingTotal,
          amountPayable: finalBill,
        },
      });
      return;
    }

    // ===== Attempt B: Sale-level discount but positive amount & rate 0 =====
    const saleLevelDiscounts_B =
      totalDiscount > 0
        ? [
            {
              name: "Coupon + Loyalty",
              type: "Absolute",
              rate: 0,
              amount: totalDiscount,   // positive
              saleAmount: totalDiscount,
              isDirectDiscount: true,
              taxes: [],
            },
          ]
        : [];

    const salePayload_B = {
      ...salePayload_A,
      discountAmount: totalDiscount,
      discounts: saleLevelDiscounts_B,
    };

    console.log("Rista rejected A:", resp.error);
    console.log("Retrying payload to Rista (B):", salePayload_B);
    resp = await postToRista(salePayload_B);
    if (resp.ok) {
      res.status(201).json({
        status: true,
        message: "Sale created successfully",
        data: savedOrder,
        earnedPoints,
        ristaResponse: resp.data,
        summary: {
          subtotal,
          couponDiscount,
          loyaltyDiscount,
          delivery: deliveryTotal,
          packaging: packagingTotal,
          amountPayable: finalBill,
        },
      });
      return;
    }

    // ===== Attempt C: Line-level prorated discounts; sale-level = 0 =====
    const proratedItems = applyLineLevelProration(payloadItemsRaw, totalDiscount);
    const salePayload_C = {
      ...salePayload_A,
      items: proratedItems.map(({ _computedLineGrand, ...rest }) => rest),
      discountAmount: 0,
      discounts: [],
    };

    console.log("Rista rejected B:", resp.error);
    console.log("Retrying payload to Rista (C - line-level):", salePayload_C);
    resp = await postToRista(salePayload_C);
    if (resp.ok) {
      res.status(201).json({
        status: true,
        message: "Sale created successfully (line-level discounts fallback)",
        data: savedOrder,
        earnedPoints,
        ristaResponse: resp.data,
        summary: {
          subtotal,
          couponDiscount,
          loyaltyDiscount,
          delivery: deliveryTotal,
          packaging: packagingTotal,
          amountPayable: finalBill,
        },
      });
      return;
    }

    // If all attempts failed:
    console.error("Rista rejected C:", resp.error);
    res.status(500).json({
      status: false,
      message: "Error creating sale",
      error: resp.error,
      attempts: {
        A: "Sale-level (rate + negative amount)",
        B: "Sale-level (rate=0 + positive amount)",
        C: "Line-level prorated, sale-level=0",
      },
    });
  } catch (error: any) {
    console.error("Error creating sale:", error?.response?.data || error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getOrdersHandler(req: Request, res: Response) {
  const { phone } = req.params;
  try {
    const user = await userModel.findOne({ phone });
    if (!user) {
      res.status(400).json({ status: false, message: "User not found" });
      return;
    }

    const orders = await orderModel.find({ _id: { $in: user.orders } });

    res.json({
      status: true,
      message: "Orders fetched successfully",
      customer: {
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        phone,
      },
      data: orders,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
}