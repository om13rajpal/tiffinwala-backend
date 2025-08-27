import axios from "axios";
import { Request, Response } from "express";

// ---- Config (adjust paths) ----
import { BASE_URL, API_KEY, BRANCH, CHANNEL } from "../../config/config";
import { generateToken } from "../../utils/generateToken";

// ---- Models (adjust paths) ----
import userModel from "../../models/user";
import orderModel from "../../models/order";
import pointsModel from "../../models/points";
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
  /** ✅ Rista computes optionAmount = sum(options.amount). Send this explicitly. */
  amount?: number;
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
  unitPrice: number;
  overridden?: boolean;
  measuringUnit?: string;
  itemAmount?: number;
  optionAmount?: number;
  discountAmount?: number;
  itemTotalAmount?: number;
  taxAmountIncluded?: number;
  taxAmountExcluded?: number;
  note?: string;
  createdBy?: string;
  createdTime?: string;
  options?: SaleItemOption[];
  discounts?: SaleItemDiscount[];
  taxes?: SaleItemTax[];
  itemLog?: any[];
  // internal helper
  _computedLineGrand?: number;
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
  mode: string;
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
  };

  deliveryBy?: {
    name?: string;
    email?: string;
    phoneNumber?: string;
  };

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
  return new Date().toISOString();
}
function cleanPhone(p: any): string {
  return (p ?? "").toString().replace(/\s+/g, "").trim();
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
// Builders
// =====================

/**
 * Build Rista items from client 'order' lines.
 * Each line shape expected:
 * { shortName, skuCode, quantity, unitPrice, options?: [{ name, skuCode, quantity, unitPrice, amount }] }
 * NOTE: Client now sends discounted unitPrice (after BOGO), and option.amount.
 */
function buildItems(orderLines: any[]): {
  items: SaleItem[];
  itemBaseTotal: number;
  itemGrandTotal: number;
} {
  let baseTotal = 0;
  let grandTotal = 0;

  const items: SaleItem[] = (orderLines || []).map((line) => {
    const qty = toNum(line.quantity ?? line.qty ?? 0, 0);
    const price = toNum(
      line.unitPrice ?? line.price ?? line.rate ?? line.value ?? 0,
      0
    );

    const itemAmount = round2(qty * price);

    const options: SaleItemOption[] = (line.options || []).map((op: any) => {
      const oq = toNum(op.quantity ?? op.qty ?? 1, 1);
      const ou = toNum(
        op.unitPrice ?? op.price ?? op.rate ?? op.value ?? op.amount ?? 0,
        0
      );
      const oAmount = round2(
        toNum(op.amount, oq * ou) // prefer explicit amount, else compute
      );
      return {
        name: op.name || op.shortName || "Option",
        optionId: op.optionId || "",
        skuCode: op.skuCode || "",
        quantity: oq,
        unitPrice: ou,
        amount: oAmount, // ✅ REQUIRED for Rista to sum into optionAmount
        taxes: [],
      };
    });

    // ✅ Rista uses sum(options.amount) for item.optionAmount
    const optionAmount = round2(
      options.reduce((sum, o) => sum + toNum(o.amount, o.quantity * o.unitPrice), 0)
    );

    const itemTotalAmount = round2(itemAmount + optionAmount);
    baseTotal = round2(baseTotal + itemAmount);
    grandTotal = round2(grandTotal + itemTotalAmount);

    const saleItem: SaleItem = {
      shortName: line.shortName || line.name || "Item",
      longName: line.longName || "",
      variants: line.variants || "",
      skuCode: line.skuCode || "",
      barCode: line.barCode || "",
      itemNature: "Goods",
      quantity: qty,
      unitPrice: price, // ✅ discounted unit from client (after BOGO)
      overridden: true,
      measuringUnit: line.measuringUnit || "Each",
      itemAmount,        // qty * unitPrice
      optionAmount,      // sum(options.amount)
      discountAmount: 0, // keep 0 here; proration handles line discounts if used
      itemTotalAmount,   // itemAmount + optionAmount (+ discounts)
      taxAmountIncluded: 0,
      taxAmountExcluded: 0,
      note: line.note || "",
      options,
      discounts: [],
      taxes: [],
      _computedLineGrand: itemTotalAmount,
    };

    return saleItem;
  });

  return { items, itemBaseTotal: baseTotal, itemGrandTotal: grandTotal };
}

/**
 * Build charges for delivery & packaging. Mark them Direct if you want them included in net sales.
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

/**
 * Prorate a total discount across items as negative item-level discounts.
 */
function applyLineLevelProration(
  items: SaleItem[],
  totalDiscount: number
): SaleItem[] {
  if (!items.length || totalDiscount <= 0) return items;

  const total = items.reduce(
    (s, it) => s + (it._computedLineGrand || it.itemTotalAmount || 0),
    0
  );
  if (total <= 0) return items;

  let remaining = totalDiscount;
  const out = items.map((it, idx) => {
    const base = it._computedLineGrand || it.itemTotalAmount || 0;
    let share = round2((base / total) * totalDiscount);
    if (idx === items.length - 1) share = round2(remaining);
    remaining = round2(remaining - share);

    const neg = -Math.abs(share); // negative for Sale
    const discounts: SaleItemDiscount[] = [
      ...(it.discounts || []),
      {
        name: "Prorated Discount",
        type: "Absolute",
        rate: share,
        amount: neg,
        saleAmount: base,
      },
    ];

    const newItemTotal = round2((it.itemTotalAmount || base) + neg);

    return {
      ...it,
      discounts,
      discountAmount: round2((it.discountAmount || 0) + neg),
      itemTotalAmount: newItemTotal,
      _computedLineGrand: newItemTotal,
    };
  });

  return out;
}

// =====================
// Normalizer + Posting
// =====================
function normalizeRistaPayload(p: Partial<RistaSalePayload>): RistaSalePayload {
  const out: any = { ...p };

  // keep delivery.address as object
  if (out.delivery?.address && typeof out.delivery.address !== "object") {
    out.delivery.address = buildDeliveryAddress(out.delivery.address, "");
  }

  // stringify phones
  if (out.delivery?.phoneNumber != null) {
    out.delivery.phoneNumber = cleanPhone(out.delivery.phoneNumber);
  }
  if (out.customer?.phoneNumber != null) {
    out.customer.phoneNumber = cleanPhone(out.customer.phoneNumber);
  }

  // prune undefined/null (keep 0/false)
  const prune = (obj: any) =>
    Object.fromEntries(
      Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null)
    );

  if (out.delivery) out.delivery = prune(out.delivery);
  if (out.delivery?.address) out.delivery.address = prune(out.delivery.address);
  if (out.customer) out.customer = prune(out.customer);

  // Required top-level fields
  out.branchCode = out.branchCode || BRANCH;
  out.status = out.status || "Open";
  out.channel = out.channel || CHANNEL;
  out.items = out.items || [];

  // ✅ Ensure each option has 'amount' (defensive)
  out.items = out.items.map((it: SaleItem) => {
    const options = (it.options || []).map((op) => {
      const amount =
        op.amount ?? round2(toNum(op.quantity, 1) * toNum(op.unitPrice, 0));
      return { ...op, amount };
    });
    const optionAmount = round2(options.reduce((s, op) => s + toNum(op.amount, 0), 0));
    const itemAmount = round2(toNum(it.quantity, 0) * toNum(it.unitPrice, 0));
    const discountAmount = round2(toNum(it.discountAmount, 0)); // usually <= 0
    const itemTotalAmount = round2(itemAmount + optionAmount + discountAmount);

    return {
      ...it,
      options,
      optionAmount,
      itemAmount,
      itemTotalAmount,
      _computedLineGrand: itemTotalAmount,
    };
  });

  return out as RistaSalePayload;
}

// Adjust endpoint if your tenant uses a different path:
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

// Stub for loyalty coin sending (replace with your real integration

// =====================
// Controller
// =====================
export async function newOrderHandler(req: Request, res: Response) {
  const {
    order, // array of lines (client now sends discounted unitPrice + option.amount)
    price, // discounted subtotal (after BOGO)
    handling = 0,
    delivery = 0,
    phone,
    paymentMethod,
    paymentStatus,
    orderMode,
    discount = 0, // absolute rupees (coupon)
    loyalty = 0,  // absolute rupees (loyalty)
    couponCode,
    address, // string or object
    TransactionID,
  } = req.body;

  try {
    // ---- Monetary derivations ----
    const packagingTotal = Math.max(0, toNum(handling, 0));
    const deliveryTotal = Math.max(0, toNum(delivery, 0));
    const couponDiscount = Math.max(0, toNum(discount, 0));
    const loyaltyDiscount = Math.max(0, toNum(loyalty, 0));
    const totalDiscount = couponDiscount + loyaltyDiscount;

    // ---- User ----
    const user = await userModel.findOne({ phone });
    if (!user) {
      res.status(400).json({ status: false, message: "User not found" });
      return;
    }
    const fullName =
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      String(phone || "");

    // ---- Items ----
    const {
      items: payloadItemsRaw,
      itemBaseTotal,
      itemGrandTotal,
    } = buildItems(order || []);

    // We trust client `price` as discounted subtotal after BOGO.
    // If client sent something wildly off, we could compare with computed.
    const discountedSubtotalFromApp = toNum(price, 0);
    const computedSubtotal = itemGrandTotal || itemBaseTotal;
    const subtotal =
      Math.abs(discountedSubtotalFromApp - computedSubtotal) < 0.01
        ? discountedSubtotalFromApp
        : computedSubtotal;

    const finalBill = Math.max(
      0,
      round2(subtotal - totalDiscount + deliveryTotal + packagingTotal)
    );

    // ---- Persist local order ----
    const localOrder = await orderModel.create({
      order,
      price: finalBill,           // ✅ store what customer actually pays
      handling: packagingTotal,
      delivery: deliveryTotal,
      paymentMethod,
      paymentStatus,
      orderMode,
      discount: couponDiscount,
      loyalty: loyaltyDiscount,
      couponCode,
      amountPayable: finalBill,   // kept for compatibility
      customerName: fullName,
      phone,
      TransactionID: TransactionID || "",
      // any other fields you store...
    });
    const savedOrder = await localOrder.save();
    if (!savedOrder) {
      res.status(400).json({ status: false, message: "Order not saved" });
      return;
    }

    // ---- Loyalty earn (on subtotal - coupon) ----
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
      {
        $push: { orders: savedOrder._id },
        $inc: { loyaltyPoints: earnedPoints },
      }
    );

    // ---- Charges & Payments ----
    const { charges, totalDirectCharges } = buildCharges(
      deliveryTotal,
      packagingTotal
    );

    const phoneStr = cleanPhone(phone);
    const payments: SalePayment[] = [
      {
        mode:
          (paymentMethod || "").toUpperCase() === "COD"
            ? "Cash"
            : paymentMethod || "Online",
        amount: finalBill,
        reference: TransactionID?.toString?.() || "",
        note: "",
      },
    ];

    // ---- Delivery object ----
    const deliveryMode = resolveDeliveryMode(orderMode, deliveryTotal);
    const deliveryAddressObj = buildDeliveryAddress(
      // @ts-ignore
      address || user?.addressString || user?.address,
      ""
    );

    // ----------------------
    // Attempt A: Sale-level negative discount
    // ----------------------
    const saleLevelDiscounts_A: SaleItemDiscount[] =
      totalDiscount > 0
        ? [
            {
              name: "Coupon + Loyalty",
              type: "Absolute",
              rate: totalDiscount,
              amount: -totalDiscount, // negative for Sale
              saleAmount: totalDiscount,
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
        // @ts-ignore
        email: user?.email || "",
        phoneNumber: phoneStr,
      },

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
        title: "",
        name: fullName,
        // @ts-ignore
        email: user?.email || "",
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

      note: (couponCode ? `Coupon: ${couponCode}. ` : "") + (req.body?.notes || ""),
    };

    const normA = normalizeRistaPayload(salePayload_A);
    console.log("[Rista Attempt A] Payload:", JSON.stringify(normA, null, 2));
    let resp = await postToRista(normA);
    if (resp.ok) {
  let coinsOk = false;
  try {
    // sendCoins returns boolean (true on success)
    coinsOk = await sendCoins(phoneStr, earnedPoints.toString());
    console.log("[sendCoins] ok:", coinsOk);
  } catch (e) {
    console.error("[sendCoins] error:", e);
    coinsOk = false;
  }

  if (!coinsOk) {
    console.warn("[sendCoins] awarding loyalty points failed. Continuing anyway.");
  }

  res.status(201).json({
    status: true,
    message: "Sale created successfully",
    data: savedOrder,
    earnedPoints,
    coinsAwarded: coinsOk,  // expose whether it worked
    ristaResponse: resp.data,
    summary: {
      subtotal: subtotal,
      couponDiscount,
      loyaltyDiscount,
      delivery: deliveryTotal,
      packaging: packagingTotal,
      amountPayable: finalBill,
    },
  });
  return;
}


    // ----------------------
    // Attempt B: Sale-level positive amount (for tenants that treat sign internally)
    // ----------------------
    const saleLevelDiscounts_B: SaleItemDiscount[] =
      totalDiscount > 0
        ? [
            {
              name: "Coupon + Loyalty",
              type: "Absolute",
              rate: 0,
              amount: totalDiscount, // positive
              saleAmount: totalDiscount,
            },
          ]
        : [];

    const salePayload_B: Partial<RistaSalePayload> = {
      ...salePayload_A,
      discounts: saleLevelDiscounts_B,
      discountAmount: totalDiscount,
    };

    console.log("[Rista Attempt A] Rejected:", resp.error);
    const normB = normalizeRistaPayload(salePayload_B);
    console.log("[Rista Attempt B] Payload:", JSON.stringify(normB, null, 2));
    resp = await postToRista(normB);
    if (resp.ok) {
  let coinsOk = false;
  try {
    // sendCoins returns boolean (true on success)
    coinsOk = await sendCoins(phoneStr, earnedPoints.toString());
    console.log("[sendCoins] ok:", coinsOk);
  } catch (e) {
    console.error("[sendCoins] error:", e);
    coinsOk = false;
  }

  if (!coinsOk) {
    console.warn("[sendCoins] awarding loyalty points failed. Continuing anyway.");
  }

  res.status(201).json({
    status: true,
    message: "Sale created successfully",
    data: savedOrder,
    earnedPoints,
    coinsAwarded: coinsOk,  // expose whether it worked
    ristaResponse: resp.data,
    summary: {
      subtotal: subtotal,
      couponDiscount,
      loyaltyDiscount,
      delivery: deliveryTotal,
      packaging: packagingTotal,
      amountPayable: finalBill,
    },
  });
  return;
}


    // ----------------------
    // Attempt C: Line-level prorated discounts; sale-level = 0
    // ----------------------
    const proratedItems = applyLineLevelProration(
      payloadItemsRaw,
      totalDiscount
    );
    const salePayload_C: Partial<RistaSalePayload> = {
      ...salePayload_A,
      items: proratedItems.map(({ _computedLineGrand, ...rest }) => rest),
      discountAmount: 0,
      discounts: [],
    };

    console.log("[Rista Attempt B] Rejected:", resp.error);
    const normC = normalizeRistaPayload(salePayload_C);
    console.log("[Rista Attempt C] Payload:", JSON.stringify(normC, null, 2));
    resp = await postToRista(normC);
    if (resp.ok) {
  let coinsOk = false;
  try {
    // sendCoins returns boolean (true on success)
    coinsOk = await sendCoins(phoneStr, earnedPoints.toString());
    console.log("[sendCoins] ok:", coinsOk);
  } catch (e) {
    console.error("[sendCoins] error:", e);
    coinsOk = false;
  }

  if (!coinsOk) {
    console.warn("[sendCoins] awarding loyalty points failed. Continuing anyway.");
  }

  res.status(201).json({
    status: true,
    message: "Sale created successfully",
    data: savedOrder,
    earnedPoints,
    coinsAwarded: coinsOk,  // expose whether it worked
    ristaResponse: resp.data,
    summary: {
      subtotal: subtotal,
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
    console.error("[Rista Attempt C] Rejected:", resp.error);
    res.status(500).json({
      status: false,
      message: "Error creating sale",
      error: resp.error,
      attempts: {
        A: "Sale-level (negative amount)",
        B: "Sale-level (rate=0, positive amount)",
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