// controllers/order.ts
import axios from "axios";
import { Request, Response } from "express";

// ---- Config (adjust paths) ----
import { BASE_URL, API_KEY, BRANCH, CHANNEL } from "../../config/config";
import { generateToken } from "../../utils/generateToken";

// ---- Models (adjust paths) ----
import userModel from "../../models/user";
import orderModel from "../../models/order";
import pointsModel from "../../models/points";
import couponModel from "../../models/coupon"; // <— NEW
import { sendCoins } from "../../utils/otp";

// =====================
// Types (minimal subset)
// =====================
type DiscountType = "Absolute" | "Percentage";
type ItemNature = "Goods" | "Services";

export interface SaleItemTax {
  name: string;
  percentage: number;
  saleAmount?: number;
  amountIncluded?: number;
  amountExcluded?: number;
  amount?: number;
  gstLiability?: "AGGREGATOR" | "VENDOR" | "OTHERS";
}

export interface SaleItemOption {
  name: string;
  optionId?: string;
  skuCode: string;
  quantity: number;
  unitPrice: number;
  amount?: number; // REQUIRED for optionAmount calc
  taxes?: SaleItemTax[];
}

export interface SaleItemDiscount {
  name: string;
  type: DiscountType;
  rate: number;
  saleAmount?: number;
  amount: number; // negative for Sale
  loyaltyPoints?: number;
  coupon?: string;
  couponProvider?: string;
  campaignName?: string;
  reason?: string;
}

export interface SaleItem {
  shortName: string;
  longName?: string;
  variants?: string;
  skuCode: string;
  barCode?: string;
  itemNature?: ItemNature;
  quantity: number;
  unitPrice: number;      // BASE unit (excludes options) in the final payload
  overridden?: boolean;
  measuringUnit?: string;
  itemAmount?: number;    // qty * base unit
  optionAmount?: number;  // sum(options.amount)
  discountAmount?: number;
  itemTotalAmount?: number; // itemAmount + optionAmount + discountAmount
  taxAmountIncluded?: number;
  taxAmountExcluded?: number;
  note?: string;
  createdBy?: string;
  createdTime?: string;
  options?: SaleItemOption[];
  discounts?: SaleItemDiscount[];
  taxes?: SaleItemTax[];
  itemLog?: any[];
}

export interface SaleCharge {
  name: string;
  type: DiscountType;
  rate: number;
  saleAmount?: number;
  amount: number;
  isDirectCharge?: boolean;
  taxes?: SaleItemTax[];
}

export interface SalePayment {
  mode: string; // Cash | Online | etc.
  amount: number;
  reference?: string;
  note?: string;
  postedDate?: string;
}

export interface RistaSalePayload {
  branchCode: string;
  status: "Open" | "Closed";
  channel: string;
  sourceInfo?: {
    companyName?: string;
    invoiceNumber?: string;
    orderTransactionId?: string;
    invoiceDate?: string;
    callbackURL?: string;
    callbackHeaders?: Record<string, string>;
    source?: string;
    sourceOutletId?: string;
    outletId?: string;
    isEditable?: boolean;
    verifyCoupons?: boolean;
    isEcomOrder?: boolean;
  };
  delivery?: {
    title?: string;
    name?: string;
    email?: string;
    phoneNumber?: string;
    mode?: "Delivery" | "Pickup";
    address?: {
      label?: string;
      addressLine?: string;
      city?: string;
      state?: string;
      country?: string;
      zip?: string;
      landmark?: string;
      latitude?: number;
      longitude?: number;
    };
    advanceOrder?: boolean;
    deliveryDate?: string;
  };
  deliveryBy?: { name?: string; email?: string; phoneNumber?: string };
  label?: string;
  personCount?: number;
  customer?: {
    id?: string;
    title?: string;
    name?: string;
    email?: string;
    phoneNumber?: string;
  };
  items: SaleItem[];
  itemTotalAmount?: number;
  directChargeAmount?: number;
  chargeAmount?: number;
  discountAmount?: number;
  taxAmountIncluded?: number;
  taxAmountExcluded?: number;
  billAmount?: number;
  roundOffAmount?: number;
  billRoundedAmount?: number;
  tipAmount?: number;
  totalAmount?: number;
  note?: string;
  charges?: SaleCharge[];
  discounts?: SaleItemDiscount[];
  taxes?: SaleItemTax[];
  payments?: SalePayment[];
  balanceAmount?: number;
  tags?: string[];
  resourceInfo?: {
    resourceId?: string;
    resourceName?: string;
    groupSize?: number;
    isNonEditableTableOrder?: boolean;
  };
}

// =====================
// Utilities
// =====================
function toNum(v: any, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function isoNow(): string {
  return new Date().toISOString(); // always UTC ISO
}
function cleanPhone(p: any): string {
  return (p ?? "").toString().replace(/\s+/g, "").trim();
}
function nowUtcISO() { return new Date().toISOString(); }
function coerceTzOffsetMinutes(v: any): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function buildDeliveryAddress(
  input: any,
  fallbackLine = ""
  // @ts-ignore
): Required<RistaSalePayload["delivery"]>["address"] {
  if (typeof input === "string") {
    const parts = input.split(",").map((s) => s.trim());
    const addressParts = parts.filter(
      (part) => !/^name\s*:/i.test(part) && !/^phone\s*:/i.test(part)
    );
    const line = addressParts.join(", ") || fallbackLine;

    return {
      label: "Primary",
      addressLine: line,
      city: "",
      state: "",
      country: "India",
      zip: "",
      landmark: "",
      latitude: 0,
      longitude: 0,
    };
  }

  const addr = input || {};
  return {
    label: addr.label || "Primary",
    addressLine:
      addr.addressLine || addr.line || addr.street || addr.full || fallbackLine,
    city: addr.city || "",
    state: addr.state || "",
    country: addr.country || "India",
    zip: addr.zip || addr.pincode || "",
    landmark: addr.landmark || "",
    latitude: Number(addr.latitude ?? addr.lat ?? 0) || 0,
    longitude: Number(addr.longitude ?? addr.lng ?? 0) || 0,
  };
}

function resolveDeliveryMode(
  orderMode: string | undefined,
  deliveryTotal: number
): "Delivery" | "Pickup" {
  const m = (orderMode || "").toUpperCase();
  if (m === "DELIVERY") return "Delivery";
  if (m === "PICKUP" || m === "TAKEAWAY") return "Pickup";
  return deliveryTotal > 0 ? "Delivery" : "Pickup";
}

// =====================
// Smart builder (prevents double count of options)
// =====================
function buildItemsSmart(
  orderLines: any[],
  providedSubtotal: number | undefined
): {
  items: SaleItem[];
  itemTotalSum: number;
  chosenMode: "INCLUDE" | "EXCLUDE";
} {
  type Pre = {
    qty: number;
    unitRaw: number; // client unitPrice (unknown semantics)
    baseHint?: number; // from originalUnitPrice/baseUnitPrice if present
    optionSum: number; // sum(options.amount)
    line: any;
    options: SaleItemOption[];
  };

  const pre: Pre[] = (orderLines || []).map((l) => {
    const qty = Math.max(0, toNum(l.quantity ?? l.qty ?? 0, 0));
    const unitRaw = toNum(l.unitPrice ?? l.price ?? l.rate ?? l.value ?? 0, 0);
    const baseHint = (() => {
      const v =
        l.originalUnitPrice ??
        l.originalPrice ??
        l.baseUnitPrice ??
        l.unitBase;
      return v !== undefined ? toNum(v, 0) : undefined;
    })();

    const options: SaleItemOption[] = (l.options || []).map((op: any) => {
      const oq = toNum(op.quantity ?? op.qty ?? 1, 1);
      const ou = toNum(
        op.unitPrice ?? op.price ?? op.rate ?? op.value ?? op.amount ?? 0,
        0
      );
      const oAmount = round2(toNum(op.amount, oq * ou));
      return {
        name: op.name || op.shortName || "Option",
        optionId: op.optionId || "",
        skuCode: op.skuCode || "",
        quantity: oq,
        unitPrice: ou,
        amount: oAmount,
        taxes: [],
      };
    });

    const optionSum = round2(
      options.reduce((s, o) => s + toNum(o.amount, o.quantity * o.unitPrice), 0)
    );

    return { qty, unitRaw, baseHint, optionSum, line: l, options };
  });

  // Totals under both interpretations:
  const sumExclude = round2(
    pre.reduce((s, p) => {
      const base = p.baseHint ?? p.unitRaw;
      return s + p.qty * base + p.optionSum;
    }, 0)
  );
  const sumInclude = round2(
    pre.reduce((s, p) => s + p.qty * p.unitRaw, 0)
  );

  const subtotal = toNum(providedSubtotal, NaN);
  const distExclude = Number.isFinite(subtotal) ? Math.abs(sumExclude - subtotal) : 0;
  const distInclude = Number.isFinite(subtotal) ? Math.abs(sumInclude - subtotal) : 0;

  const chooseInclude = Number.isFinite(subtotal)
    ? distInclude <= distExclude
    : false; // if no subtotal, default to EXCLUDE to be conservative

  const chosenMode: "INCLUDE" | "EXCLUDE" = chooseInclude ? "INCLUDE" : "EXCLUDE";

  // Build final items with the chosen model
  let itemTotalSum = 0;
  const items: SaleItem[] = pre.map((p) => {
    let baseUnit: number;
    if (chosenMode === "EXCLUDE") {
      baseUnit = p.baseHint ?? p.unitRaw; // assume raw is base
    } else {
      // INCLUDE: raw already includes options -> back out base
      if (p.qty > 0) {
        const backOut = p.unitRaw - p.optionSum / p.qty;
        const hinted = p.baseHint ?? backOut;
        baseUnit = Math.max(0, round2(hinted));
      } else {
        baseUnit = p.baseHint ?? p.unitRaw; // qty 0 edge
      }
    }

    const itemAmount = round2(p.qty * baseUnit);
    const optionAmount = round2(p.optionSum);
    const discountAmount = 0;
    const itemTotalAmount =
      chosenMode === "EXCLUDE"
        ? round2(itemAmount + optionAmount) // base + options
        : round2(p.qty * p.unitRaw);        // equals original raw*qty

    itemTotalSum = round2(itemTotalSum + itemTotalAmount);

    return {
      shortName: p.line.shortName || p.line.name || "Item",
      longName: p.line.longName || "",
      variants: p.line.variants || "",
      skuCode: p.line.skuCode || "",
      barCode: p.line.barCode || "",
      itemNature: "Goods",
      quantity: p.qty,
      unitPrice: baseUnit,            // always base (excludes options)
      overridden: true,
      measuringUnit: p.line.measuringUnit || "Each",
      itemAmount,
      optionAmount,
      discountAmount,
      itemTotalAmount,
      taxAmountIncluded: 0,
      taxAmountExcluded: 0,
      note: p.line.note || "",
      options: p.options,
      discounts: [],
      taxes: [],
    };
  });

  return { items, itemTotalSum, chosenMode };
}

/**
 * Build charges for delivery & packaging.
 */
function buildCharges(
  delivery: number,
  packaging: number
): {
  charges: SaleCharge[];
  totalDirectCharges: number;
} {
  const charges: SaleCharge[] = [];
  let totalDirect = 0;

  if (packaging > 0) {
    charges.push({
      name: "Packaging",
      type: "Absolute",
      rate: packaging,
      amount: packaging,
      isDirectCharge: true,
      taxes: [],
    });
    totalDirect += packaging;
  }

  if (delivery > 0) {
    charges.push({
      name: "Delivery",
      type: "Absolute",
      rate: delivery,
      amount: delivery,
      isDirectCharge: true,
      taxes: [],
    });
    totalDirect += delivery;
  }

  return { charges, totalDirectCharges: totalDirect };
}

// =====================
// Coupon logic (generic)
// =====================

/**
 * Resolve/validate coupon and compute discount amount for a given subtotal.
 * Supports:
 *  - { percent: 10, maxValue: 20 }
 *  - { amount: 50 }
 *  - { discount: "10% off ..." }  // parsed
 *  - minOrder, expiryDate, enabled
 */
async function computeCouponDiscount(
  code: string | undefined,
  subtotal: number
): Promise<{ amount: number; reason?: string; couponDoc?: any }> {
  if (!code) return { amount: 0 };

  const coupon = await couponModel.findOne({ code: String(code).trim().toUpperCase() });
  if (!coupon) return { amount: 0, reason: "coupon_not_found" };

  if (coupon.enabled === false) return { amount: 0, reason: "coupon_disabled", couponDoc: coupon };

  const minOrder = toNum(coupon.minOrder, 0);
  if (subtotal < minOrder) return { amount: 0, reason: "min_order_not_met", couponDoc: coupon };

  const exp: Date | undefined = coupon.expiryDate ? new Date(coupon.expiryDate) : undefined;
  if (exp && isFinite(exp.getTime()) && exp.getTime() < Date.now()) {
    return { amount: 0, reason: "coupon_expired", couponDoc: coupon };
  }

  // Determine rate/amount
  // @ts-ignore
  let flatAmount = toNum(coupon.amount, 0);
  // @ts-ignore
  let percent = toNum(coupon.percent, NaN);
  if (!Number.isFinite(percent)) {
    // try parse from string like "10% off on your orders"
    if (typeof coupon.discount === "string") {
      const m = /(\d+(?:\.\d+)?)\s*%/i.exec(coupon.discount);
      if (m) percent = Number(m[1]);
    }
  }

  let calculated = 0;
  if (Number.isFinite(percent)) {
    calculated = round2(Math.max(0, subtotal * (Number(percent) / 100)));
    const cap = toNum(coupon.maxValue, Infinity);
    calculated = Math.min(calculated, cap);
  } else if (flatAmount > 0) {
    calculated = round2(flatAmount);
  }

  // never exceed subtotal
  calculated = Math.min(calculated, round2(subtotal));
  return { amount: calculated, couponDoc: coupon };
}

// =====================
// Normalizer + Posting
// =====================
function normalizeRistaPayload(p: Partial<RistaSalePayload>): RistaSalePayload {
  const out: any = { ...p };

  const prune = (obj: any) =>
    Object.fromEntries(
      Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null)
    );

  if (out.delivery?.address && typeof out.delivery.address !== "object") {
    // @ts-ignore
    out.delivery.address = buildDeliveryAddress(out.delivery.address, "");
  }
  if (out.delivery?.phoneNumber != null) {
    out.delivery.phoneNumber = cleanPhone(out.delivery.phoneNumber);
  }
  if (out.customer?.phoneNumber != null) {
    out.customer.phoneNumber = cleanPhone(out.customer.phoneNumber);
  }

  if (out.delivery) out.delivery = prune(out.delivery);
  if (out.delivery?.address) out.delivery.address = prune(out.delivery.address);
  if (out.customer) out.customer = prune(out.customer);

  out.branchCode = out.branchCode || BRANCH;
  out.status = out.status || "Open";
  out.channel = out.channel || CHANNEL;
  out.items = (out.items || []).map((it: SaleItem) => {
    const options = (it.options || []).map((op) => {
      const amount =
        op.amount ?? round2(toNum(op.quantity, 1) * toNum(op.unitPrice, 0));
      return { ...op, amount };
    });
    const optionAmount = round2(options.reduce((s, op) => s + toNum(op.amount, 0), 0));
    const itemAmount = round2(toNum(it.quantity, 0) * toNum(it.unitPrice, 0));
    const discountAmount = round2(toNum(it.discountAmount, 0));
    const itemTotalAmount = round2(itemAmount + optionAmount + discountAmount);
    return { ...it, options, optionAmount, itemAmount, itemTotalAmount };
  });

  return out as RistaSalePayload;
}

const SALE_URL = `${BASE_URL}/sale/`;

async function postToRista(
  payload: RistaSalePayload
): Promise<{ ok: boolean; data?: any; error?: any }> {
  try {
    const token = generateToken();
    const resp = await axios.post(SALE_URL, payload, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "x-api-token": token,
      },
      timeout: 30000,
    });
    return { ok: true, data: resp.data };
  } catch (e: any) {
    return {
      ok: false,
      error: e?.response?.data || e?.message || e,
    };
  }
}

// =====================
// Controller
// =====================
export async function newOrderHandler(req: Request, res: Response) {
  const {
    order,        // array of lines
    price,        // items subtotal from app (pre-discount or post — we recompute anyway)
    handling = 0,
    delivery = 0,
    phone,
    paymentMethod,
    paymentStatus, // "completed" or "pending"
    orderMode,
    discount = 0,      // optional absolute value sent by app
    loyalty = 0,       // absolute rupees
    couponCode,
    address,
    TransactionID,

    // NEW (optional from client)
    clientPlacedAt,          // ISO (UTC) made on device: new Date().toISOString()
    clientTzOffsetMinutes,   // e.g., -330 for IST
  } = req.body;

  try {
    // ---- Monetary base ----
    const packagingTotal = Math.max(0, toNum(handling, 0));
    const deliveryTotal  = Math.max(0, toNum(delivery, 0));
    const subtotalFromApp = round2(toNum(price, 0));

    // ---- User ----
    const user = await userModel.findOne({ phone });
    if (!user) {
      res.status(400).json({ status: false, message: "User not found" });
      return;
    }
    const phoneStr = cleanPhone(phone);
    const fullName =
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      String(phoneStr || "");

    // ---- Build items & subtotal (server-trust) ----
    const { items: payloadItems, itemTotalSum, chosenMode } = buildItemsSmart(
      order || [],
      subtotalFromApp
    );

    // Prefer app subtotal if close, else fallback to computed sum
    const itemTotalAmount =
      Math.abs(itemTotalSum - subtotalFromApp) <= 0.01
        ? subtotalFromApp
        : itemTotalSum;

    // ---- Coupon (generic; DB-driven) ----
    // Start from client-provided amount (if any)
    let couponDiscount = Math.max(0, toNum(discount, 0));
    let couponReason: string | undefined;

    if (couponDiscount === 0 && couponCode) {
      const { amount, reason } = await computeCouponDiscount(
        String(couponCode).trim().toUpperCase(),
        itemTotalAmount
      );
      couponDiscount = amount;
      couponReason = reason;
    }
    // Ensure not over subtotal
    couponDiscount = Math.min(couponDiscount, itemTotalAmount);

    // ---- Loyalty ----
    const loyaltyDiscount = Math.max(0, toNum(loyalty, 0));

    // ---- Final Bill (item subtotal – coupon – loyalty + charges) ----
    const finalBill = Math.max(
      0,
      round2(itemTotalAmount - couponDiscount - loyaltyDiscount + deliveryTotal + packagingTotal)
    );

    // ---- Canonical timestamps ----
    const utcPlacedISO = ((): string => {
      try {
        return clientPlacedAt ? new Date(clientPlacedAt).toISOString() : nowUtcISO();
      } catch {
        return nowUtcISO();
      }
    })();
    const tzOffsetMin = coerceTzOffsetMinutes(clientTzOffsetMinutes); // may be undefined

    // ---- Persist local order ----
    const localOrder = await orderModel.create({
      order,
      price: finalBill,
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
      TransactionID: TransactionID || "",
      breakdownMode: chosenMode, // "INCLUDE" | "EXCLUDE"
      // NEW ↓↓↓
      orderDate: utcPlacedISO,                // store UTC
      clientTzOffsetMinutes: tzOffsetMin ?? undefined,
      couponReason: couponReason ?? undefined // for debugging/reporting
    });
    const savedOrder = await localOrder.save();
    if (!savedOrder) {
      res.status(400).json({ status: false, message: "Order not saved" });
      return;
    }

    // ---- Loyalty redemption (server-side)
    let redeemedPoints = 0;
    if (loyaltyDiscount > 0) {
      const current = toNum((user as any).loyaltyPoints, 0);
      redeemedPoints = Math.max(0, Math.min(Math.floor(loyaltyDiscount), current));
      if (redeemedPoints > 0) {
        await userModel.updateOne(
          { _id: user._id },
          { $inc: { loyaltyPoints: -redeemedPoints } }
        );
      }
    }

    // ---- Loyalty earn (items subtotal)
    let earnedPoints = 0;
    const slabs = await pointsModel.find({});
    for (const slab of slabs) {
      if (itemTotalAmount >= slab.lower && itemTotalAmount <= slab.upper) {
        earnedPoints = slab.loyaltyPoints;
        break;
      }
    }
    await userModel.findOneAndUpdate(
      { phone },
      { $push: { orders: savedOrder._id }, $inc: { loyaltyPoints: earnedPoints } }
    );

    // ---- Charges & Payment block ----
    const { charges, totalDirectCharges } = buildCharges(
      deliveryTotal,
      packagingTotal
    );

    const deliveryMode = resolveDeliveryMode(orderMode, deliveryTotal);
    const deliveryAddressObj = buildDeliveryAddress(
      // @ts-ignore
      address || (user as any)?.addressString || (user as any)?.address,
      ""
    );

    const isCOD = (paymentMethod || "").toUpperCase() === "COD";
    const payments: SalePayment[] = isCOD
      ? [{ mode: "Cash", amount: 0, note: "Cash on Delivery" }]
      : [
          {
            mode: "Online",
            amount: finalBill,
            reference: TransactionID?.toString?.() || "",
            note: "Prepaid via Razorpay",
            postedDate: isoNow(),
          },
        ];
    const balanceAmount = isCOD ? finalBill : 0;

    // ---- Only loyalty at sale level in Rista (negative)
    const saleLevelDiscounts: SaleItemDiscount[] =
      loyaltyDiscount > 0
        ? [
            {
              name: "Loyalty Redemption",
              type: "Absolute",
              rate: loyaltyDiscount,
              amount: -loyaltyDiscount,
              loyaltyPoints: redeemedPoints,
              reason: "Loyalty points redeemed at checkout",
            },
          ]
        : [];

    const salePayload: Partial<RistaSalePayload> = {
      branchCode: BRANCH,
      status: "Open",
      channel: CHANNEL,

      customer: {
        id: "",
        title: "",
        name: fullName,
        // @ts-ignore
        email: (user as any)?.email || "",
        phoneNumber: phoneStr,
      },

      items: payloadItems,
      itemTotalAmount: itemTotalAmount,
      directChargeAmount: totalDirectCharges,
      chargeAmount: totalDirectCharges,

      // We are NOT sending coupon discount to Rista (only loyalty), to keep
      // parity with your existing integration. If you want coupon also there,
      // add another sale-level discount entry.
      discountAmount: loyaltyDiscount > 0 ? -loyaltyDiscount : 0,
      discounts: saleLevelDiscounts,

      taxAmountIncluded: 0,
      taxAmountExcluded: 0,

      billAmount: finalBill,
      roundOffAmount: 0,
      billRoundedAmount: finalBill,
      tipAmount: 0,
      totalAmount: finalBill,

      charges,
      taxes: [],
      payments,
      balanceAmount,

      delivery: {
        title: "",
        name: fullName,
        // @ts-ignore
        email: (user as any)?.email || "",
        phoneNumber: phoneStr,
        mode: deliveryMode,
        address: deliveryAddressObj,
      },

      sourceInfo: {
        source: "TiffinWala App",
        sourceOutletId: "",
        outletId: "",
        isEditable: false,
        verifyCoupons: false,
        isEcomOrder: true,
        orderTransactionId: savedOrder?._id?.toString?.() || "",
        companyName: "Tiffinwala",
        invoiceNumber: "",
        callbackURL: "",
        callbackHeaders: {},
      },

      note:
        (couponCode ? `Coupon used in app: ${couponCode}. ` : "") +
        (req.body?.notes || ""),
      tags: isCOD ? ["Cash on Delivery"] : ["Prepaid"],
    };

    const norm = normalizeRistaPayload(salePayload);
    const resp = await postToRista(norm);

    // notify coins
    let coinsOk = false;
    try {
      if (earnedPoints > 0) {
        coinsOk = await sendCoins(phoneStr, earnedPoints.toString());
      }
    } catch (e) {
      console.error("[sendCoins] error:", e);
      coinsOk = false;
    }

    if (resp.ok) {
      res.status(201).json({
        status: true,
        message: "Sale created successfully",
        data: savedOrder,
        earnedPoints,
        coinsAwarded: coinsOk,
        loyaltyRedeemed: redeemedPoints,
        ristaResponse: resp.data,
        summary: {
          subtotal: itemTotalAmount,
          couponDiscount,          // now computed from DB + validated
          loyaltyDiscount,
          delivery: deliveryTotal,
          packaging: packagingTotal,
          amountPayable: finalBill,
          mode: chosenMode,        // INCLUDE or EXCLUDE (debug)
          payment: isCOD ? "Cash on Delivery (Balance due)" : "Prepaid via Razorpay",
        },
      });
      return;
    }

    console.error("[Rista] Rejected:", resp.error);
    res.status(500).json({
      status: false,
      message: "Error creating sale in Rista",
      error: resp.error,
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