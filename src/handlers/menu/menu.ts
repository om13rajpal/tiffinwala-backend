import axios from "axios";
import { Request, Response } from "express";
import { API_KEY, BASE_URL, BRANCH, CHANNEL } from "../../config/config";
import { generateToken } from "../../utils/generateToken";
import MenuSnapshot from "../../models/menu";

// your existing "get only"
export async function menuHandler(req: Request, res: Response) {
  const token = generateToken();
  try {
    const response = await axios.get(`${BASE_URL}/catalog/`, {
      params: { branch: BRANCH, channel: CHANNEL },
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "x-api-token": token,
      },
    });

    res.status(200).json({ status: true, data: response.data });
    return;
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ status: false, message: "Internal Server Error", error: err });
    return;
  }
}

/**
 * Normalize the exact shape you posted:
 * - payload.items[]: ensure inStock:boolean (default true), image:string (default "")
 * - (optional) payload.optionSets[].options[]: ensure inStock/image too (handy for UI)
 */
function ensureItemFields(payload: any) {
  if (payload && Array.isArray(payload.items)) {
    payload.items = payload.items.map((it: any) => {
      const out: any = { ...it };

      // inStock
      if (typeof out.inStock !== "boolean") {
        out.inStock = out.inStock != null ? Boolean(out.inStock) : true;
      }

      // image
      if (typeof out.image !== "string") {
        // try to derive if you ever store images in extraInfo.* or elsewhere
        const candidate =
          out.imageURL || out.extraInfo?.imageURL || out.extraInfo?.image || "";
        out.image = typeof candidate === "string" ? candidate : "";
      }

      return out;
    });
  }

  // Optional: make options “safe” too (if your UI needs it)
  if (payload && Array.isArray(payload.optionSets)) {
    payload.optionSets = payload.optionSets.map((os: any) => {
      const outOS: any = { ...os };
      if (Array.isArray(outOS.options)) {
        outOS.options = outOS.options.map((opt: any) => {
          const o: any = { ...opt };
          if (typeof o.inStock !== "boolean") o.inStock = true;
          if (typeof o.image !== "string") o.image = "";
          return o;
        });
      }
      return outOS;
    });
  }
}

/**
 * POST /menu/sync
 * 1) fetch from external API
 * 2) normalize (add inStock/image)
 * 3) save snapshot
 */
export async function syncAndSaveMenuHandler(req: Request, res: Response) {
  const token = generateToken();
  try {
    const response = await axios.get(`${BASE_URL}/catalog/`, {
      params: { branch: BRANCH, channel: CHANNEL },
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "x-api-token": token,
      },
    });

    const raw = response.data;
    const payload = JSON.parse(JSON.stringify(raw)); // deep clone
    ensureItemFields(payload);

    const doc = await MenuSnapshot.create({
      branch: BRANCH ?? null,
      channel: CHANNEL ?? null,
      fetchedAt: new Date(),
      payload,
    });

    res.status(201).json({
      status: true,
      message: "Menu fetched & saved",
      snapshotId: doc._id,
    });
    return;
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ status: false, message: "Failed to sync menu", error: err });
    return;
  }
}

/**
 * GET /menu/latest
 * convenience: return the most recent saved snapshot
 */
// controllers/menu.ts
export async function getLatestMenuSnapshot(req: Request, res: Response) {
  try {
    // Only fetch the payload quickly with lean()
    const doc = await MenuSnapshot.findOne(
      {},
      { payload: 1 },
      { sort: { createdAt: -1 } }
    ).lean();

    if (!doc) {
      res.status(404).json({ status: false, message: "No snapshot found" });
      return;
    }

    // Optional: expose snapshot id in a header (not in body)
    res.setHeader("X-Menu-Snapshot-Id", String((doc as any)._id));

    // ✅ Return the payload AS-IS (exact same shape as the original API),
    //    but it already includes your added image/inStock fields from the sync step.
    // @ts-ignore
    res.status(200).json({ status: true, data: doc.payload });
    return;
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ status: false, message: "Error fetching snapshot", error: err });
    return;
  }
}

// PUT /menu/item/:itemId[?snapshotId=<mongoId>]
export async function editMenuItemHandler(req: Request, res: Response) {
  try {
    const { itemId } = req.params;
    const { image, inStock } = req.body as {
      image?: string;
      inStock?: boolean;
    };
    const { snapshotId } = req.query as { snapshotId?: string };

    if (image === undefined && inStock === undefined) {
      res.status(400).json({
        status: false,
        message: "Provide at least one of: { image: string, inStock: boolean }",
      });
      return;
    }

    // Load the snapshot doc (NOT lean, we need to modify and save)
    const doc = snapshotId
      ? await MenuSnapshot.findById(snapshotId)
      : await MenuSnapshot.findOne({}, {}, { sort: { createdAt: -1 } });

    if (!doc) {
      res.status(404).json({ status: false, message: "Snapshot not found" });
      return;
    }

    // Ensure payload & items exist
    const payload: any = doc.payload;
    if (!payload || !Array.isArray(payload.items)) {
      res.status(400).json({
        status: false,
        message: "Snapshot payload has no items array to edit",
      });
      return;
    }

    // Find the item by itemId
    const idx = payload.items.findIndex((it: any) => it?.itemId === itemId);
    if (idx === -1) {
      res
        .status(404)
        .json({ status: false, message: "Item not found in snapshot" });
      return;
    }

    const item = payload.items[idx];

    // Apply updates
    if (image !== undefined) {
      if (typeof image !== "string") {
        res
          .status(400)
          .json({ status: false, message: "`image` must be a string" });
        return;
      }
      item.image = image;
    }
    if (inStock !== undefined) {
      if (typeof inStock !== "boolean") {
        res
          .status(400)
          .json({ status: false, message: "`inStock` must be a boolean" });
        return;
      }
      item.inStock = inStock;
    }

    // Mark modified & save
    doc.markModified("payload");
    await doc.save();

    res.status(200).json({
      status: true,
      snapshotId: doc._id,
      updatedItem: item,
    });
    return;
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ status: false, message: "Error updating item", error: err });
    return;
  }
}
