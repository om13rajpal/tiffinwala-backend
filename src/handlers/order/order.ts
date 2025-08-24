// src/controllers/order.ts
import { Request, Response } from "express";
import orderModel from "../../models/order";
import userModel from "../../models/user";
import pointsModel from "../../models/points";
import { API_KEY, BASE_URL, BRANCH, CHANNEL } from "../../config/config";
import { generateToken } from "../../utils/generateToken";
import axios from "axios";
import { sendCoins } from "../../utils/otp";

/** ---------- helpers & types ---------- */

const toNum = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

type RistaCharge = {
  name: string;
  type: "Absolute" | "Percentage";
  rate: number;
  saleAmount: number;
  amount: number;
  isDirectCharge?: boolean;
  taxes: any[];
};

type RistaItem = {
  shortName: string;
  skuCode: string;
  quantity: number;
  unitPrice: number;
  itemTotalAmount: number; // line base (qty * unit)
  overridden: boolean;
  discounts: any[];
  taxes: any[];
  options: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    itemTotalAmount: number; // per-option line
  }>;
  itemLog: any[];
  // internal helper only; stripped before send
  _computedLineGrand?: number; // base + options
};

type DeliveryMode = "Delivery" | "TakeAway" | "DineIn";

type RistaSalePayload = {
  branchCode: string;
  status: "Open" | "Closed" | string;
  channel: string;
  customer: {
    id?: string;
    title?: string;
    name?: string;
    email?: string;
    phoneNumber?: string;
  };
  items: RistaItem[];
  itemTotalAmount: number; // items+options sum
  directChargeAmount: number;
  chargeAmount: number;
  discountAmount: number;
  taxAmountIncluded: number;
  taxAmountExcluded: number;
  billAmount: number;
  roundOffAmount: number;
  billRoundedAmount: number;
  tipAmount: number;
  totalAmount: number;
  charges: RistaCharge[];
  discounts: any[];
  taxes: any[];
  payments: { mode: string; amount: number; reference?: string; note?: string }[];
  balanceAmount: number;
  delivery?: {
    mode: DeliveryMode;
    name?: string;
    address?: string | string[];
    phoneNumber?: string;
    email?: string;
  };
};

/** Build item lines from app order */
function buildItems(order: any[]): {
  items: RistaItem[];
  itemBaseTotal: number;  // sum of (qty*unit)
  itemGrandTotal: number; // sum of (qty*unit + options)
} {
  const items: RistaItem[] = (order || []).map((item: any) => {
    const qty = toNum(item.quantity, 0);
    const unit = toNum(item.unitPrice, 0);
    const baseAmount = unit * qty;

    const options = (item.options || []).map((o: any) => {
      const p = toNum(o.price, 0);
      return {
        name: o.name,
        quantity: 1,
        unitPrice: p,
        itemTotalAmount: p,
      };
    });

    const optionTotal = options.reduce((s: number, o: any) => s + toNum(o.itemTotalAmount, 0), 0);

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

/** Build charges */
function buildCharges(deliveryTotal: number, packagingTotal: number) {
  const charges: RistaCharge[] = [];
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

/** Normalize delivery.mode, address, and recompute header totals */
function normalizeRistaPayload(payload: Partial<RistaSalePayload>): RistaSalePayload {
  const out: any = { ...payload };

  // --- delivery.mode normalization ---
  const rawMode = String(out?.delivery?.mode || "").toLowerCase();
  let mode: DeliveryMode = "Delivery";
  if (["takeaway", "pickup", "selfpickup"].includes(rawMode)) mode = "TakeAway";
  else if (["dinein", "dine-in", "dine_in"].includes(rawMode)) mode = "DineIn";
  // everything else (including "selfdelivery") -> Delivery
  out.delivery = out.delivery || {};
  out.delivery.mode = mode;

  // --- flatten address ---
  const addr = out.delivery.address;
  if (Array.isArray(addr)) {
    out.delivery.address = addr.filter(Boolean).join(", ");
  } else if (addr == null) {
    out.delivery.address = "";
  }

  // --- recompute item subtotal from lines + options ---
  const lineSum = (out.items || []).reduce(
    (s: number, it: any) => s + Number(it.itemTotalAmount || 0),
    0
  );
  const optionsSum = (out.items || []).reduce(
    (s: number, it: any) =>
      s +
      (Array.isArray(it.options)
        ? it.options.reduce((ss: number, o: any) => ss + Number(o.itemTotalAmount || 0), 0)
        : 0),
    0
  );
  const itemsSubtotal = lineSum + optionsSum;

  const chargesTotal = (out.charges || []).reduce(
    (s: number, c: any) => s + Number(c.amount || 0),
    0
  );

  const saleLevelDiscount = Number(out.discountAmount || 0);
  const taxExcluded = Number(out.taxAmountExcluded || 0);
  const tip = Number(out.tipAmount || 0);

  out.itemTotalAmount = itemsSubtotal;
  out.directChargeAmount = chargesTotal;
  out.chargeAmount = chargesTotal;

  const bill = itemsSubtotal + chargesTotal - saleLevelDiscount + taxExcluded;
  out.billAmount = bill;
  out.roundOffAmount = Number(out.roundOffAmount || 0); // keep 0 unless you round
  out.billRoundedAmount = bill; // match bill if no rounding
  out.totalAmount = bill + tip;

  // sync payments & balance
  const payTotal = (out.payments || []).reduce(
    (s: number, p: any) => s + Number(p.amount || 0),
    0
  );
  out.balanceAmount = Number((out.totalAmount || 0) - payTotal);

  // ensure required numeric fields exist
  out.taxAmountIncluded = Number(out.taxAmountIncluded || 0);
  out.taxAmountExcluded = Number(out.taxAmountExcluded || 0);

  return out as RistaSalePayload;
}

/** Try posting to Rista; return {ok, data, error} */
async function postToRista(payload: RistaSalePayload) {
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
    return {
      ok: false,
      data: null as any,
      error: err?.response?.data || err?.message || err,
    };
  }
}

/** Prorate a total discount across items based on _computedLineGrand */
function applyLineLevelProration(items: RistaItem[], totalDiscount: number) {
  const base = items.reduce((s, i) => s + toNum(i._computedLineGrand, 0), 0);
  if (base <= 0 || totalDiscount <= 0) return items;

  let remaining = totalDiscount;
  const n = items.length;

  return items.map((it, idx) => {
    const weight = toNum(it._computedLineGrand, 0) / base;
    const part =
      idx === n - 1
        ? remaining
        : Math.round((totalDiscount * weight + Number.EPSILON) * 100) / 100;
    remaining = Math.max(
      0,
      Math.round((remaining - part + Number.EPSILON) * 100) / 100
    );

    const discountObj = {
      name: "Applied Discount",
      type: "Absolute",
      rate: part,        // many tenants expect 'rate'
      amount: -part,     // negative for discount
      saleAmount: part,
      isDirectDiscount: true,
      taxes: [],
    };
    return { ...it, discounts: [...it.discounts, discountObj] };
  });
}

/** ---------- controllers ---------- */

export async function newOrderHandler(req: Request, res: Response) {
  const {
    order,                 // array of lines ({shortName, skuCode, quantity, unitPrice, options[]})
    price,                 // client subtotal (items incl. options)
    handling = 0,          // packaging total
    delivery = 0,          // delivery fee
    phone,
    paymentMethod,         // e.g. "cod"
    paymentStatus,         // e.g. "pending"
    orderMode,             // client mode (unused here; we normalize anyway)
    discount = 0,          // coupon discount (₹)
    loyalty = 0,           // loyalty discount (₹)
    couponCode,
  } = req.body;

  try {
    const packagingTotal = Math.max(0, toNum(handling, 0));
    const deliveryTotal = Math.max(0, toNum(delivery, 0));
    const couponDiscount = Math.max(0, toNum(discount, 0));
    const loyaltyDiscount = Math.max(0, toNum(loyalty, 0));
    const totalDiscount = couponDiscount + loyaltyDiscount;

    // user lookup
    const user = await userModel.findOne({ phone });
    if (!user) {
      res.status(400).json({ status: false, message: "User not found" });
      return;
    }
    const fullName =
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || String(phone || "");

    // items
    const { items: payloadItemsRaw, itemBaseTotal, itemGrandTotal } = buildItems(order || []);

    // prefer computed subtotal if client 'price' disagrees
    const subtotalFromApp = toNum(price, 0);
    const computedSubtotal = itemGrandTotal || itemBaseTotal;
    const subtotal =
      Math.abs(subtotalFromApp - computedSubtotal) < 0.01 ? subtotalFromApp : computedSubtotal;

    // final bill (UI logic)
    const finalBill = Math.max(0, subtotal - totalDiscount + deliveryTotal + packagingTotal);

    // persist local order
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

    // loyalty earn (on subtotal - coupon)
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

    // charges & payments
    const { charges, totalDirectCharges } = buildCharges(deliveryTotal, packagingTotal);
    const payments = [{ mode: paymentMethod, amount: finalBill, reference: "", note: "" }];

    /** ---- Attempt A: Sale-level discount with rate + negative amount ---- */
    const saleLevelDiscounts_A =
      totalDiscount > 0
        ? [
            {
              name: "Coupon + Loyalty",
              type: "Absolute",
              rate: totalDiscount,
              amount: -totalDiscount,
              saleAmount: totalDiscount,
              isDirectDiscount: true,
              taxes: [],
            },
          ]
        : [];

    const salePayload_A: Partial<RistaSalePayload> = {
      branchCode: BRANCH,
      status: "Open",
      channel: CHANNEL,
      customer: {
        id: "",
        title: "",
        name: fullName,
        email: "",
        phoneNumber: phone,
      },
      items: payloadItemsRaw.map(({ _computedLineGrand, ...rest }) => rest),
      itemTotalAmount: subtotal, // will be recomputed in normalizer anyway
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
        mode: "Delivery", // normalized again for safety
        name: fullName,
        address: user.address || "",
        phoneNumber: phone,
        email: "",
      },
    };

    const normA = normalizeRistaPayload(salePayload_A);
    console.log("Sending payload to Rista (A):", normA);
    let resp = await postToRista(normA);
    if (resp.ok) {
      const sendResponse: any = await sendCoins(phone, earnedPoints.toString());
      if (!sendResponse) {
        res.status(500).json({ status: false, message: "Internal Server Error" });
        return;
      }
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

    /** ---- Attempt B: Sale-level discount with positive amount & rate 0 ---- */
    const saleLevelDiscounts_B =
      totalDiscount > 0
        ? [
            {
              name: "Coupon + Loyalty",
              type: "Absolute",
              rate: 0,
              amount: totalDiscount, // positive (some tenants model 'discounts' differently)
              saleAmount: totalDiscount,
              isDirectDiscount: true,
              taxes: [],
            },
          ]
        : [];

    const salePayload_B: Partial<RistaSalePayload> = {
      ...salePayload_A,
      discountAmount: totalDiscount,
      discounts: saleLevelDiscounts_B,
    };

    console.log("Rista rejected A:", resp.error);
    const normB = normalizeRistaPayload(salePayload_B);
    console.log("Retrying payload to Rista (B):", normB);
    resp = await postToRista(normB);
    if (resp.ok) {
      const sendResponse: any = await sendCoins(phone, earnedPoints.toString());
      if (!sendResponse) {
        res.status(500).json({ status: false, message: "Internal Server Error" });
        return;
      }
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

    /** ---- Attempt C: Line-level prorated discounts; sale-level = 0 ---- */
    const proratedItems = applyLineLevelProration(payloadItemsRaw, totalDiscount);
    const salePayload_C: Partial<RistaSalePayload> = {
      ...salePayload_A,
      items: proratedItems.map(({ _computedLineGrand, ...rest }) => rest),
      discountAmount: 0,
      discounts: [],
    };

    console.log("Rista rejected B:", resp.error);
    const normC = normalizeRistaPayload(salePayload_C);
    console.log("Retrying payload to Rista (C - line-level):", normC);
    resp = await postToRista(normC);
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

    // All attempts failed
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