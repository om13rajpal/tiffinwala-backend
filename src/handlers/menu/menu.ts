// controllers/menu.ts
import axios from "axios";
import { Request, Response } from "express";
import { API_KEY, BASE_URL, BRANCH, CHANNEL } from "../../config/config";
import { generateToken } from "../../utils/generateToken";
import MenuSnapshot from "../../models/menu";

/**
 * GET (passthrough): call upstream vendor API and return raw response.
 * Path suggestion: GET /menu/remote
 */
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
 * Merge missing fields (image, inStock) in the new payload from the previous snapshot.
 * - Only fills when the new payload does NOT provide them:
 *    • inStock: if typeof !== 'boolean', inherit
 *    • image: if not a non-empty string, inherit
 * - Safe to call BEFORE ensureItemFields(), so ensureItemFields can still add defaults.
 */
function mergeFromPrevious(newPayload: any, prevPayload?: any) {
  if (!prevPayload) return;

  // Build quick lookup for previous items by itemId
  const prevItemMap = new Map<string, any>();
  if (Array.isArray(prevPayload.items)) {
    for (const it of prevPayload.items) {
      if (it && typeof it.itemId === "string") {
        prevItemMap.set(it.itemId, it);
      }
    }
  }

  // Option-level (optional) lookups if your data has stable IDs
  const prevOptionMap = new Map<string, any>(); // key: `${optionSetId}::${optionId}`
  if (Array.isArray(prevPayload.optionSets)) {
    for (const os of prevPayload.optionSets) {
      const osId = os?.optionSetId ?? os?.id;
      if (!osId || !Array.isArray(os?.options)) continue;
      for (const opt of os.options) {
        const optId = opt?.optionId ?? opt?.id;
        if (!optId) continue;
        prevOptionMap.set(`${osId}::${optId}`, opt);
      }
    }
  }

  // Merge for items
  if (newPayload && Array.isArray(newPayload.items)) {
    newPayload.items = newPayload.items.map((it: any) => {
      const out = { ...it };
      const prev = it?.itemId ? prevItemMap.get(it.itemId) : undefined;
      if (prev) {
        // inStock: only if missing/not-boolean
        if (typeof out.inStock !== "boolean" && typeof prev.inStock === "boolean") {
          out.inStock = prev.inStock;
        }
        // image: only if missing or empty string
        const hasImage = typeof out.image === "string" && out.image.trim().length > 0;
        if (!hasImage && typeof prev.image === "string" && prev.image.trim().length > 0) {
          out.image = prev.image;
        }
      }
      return out;
    });
  }

  // Merge for options (if you use them in UI and IDs are stable)
  if (newPayload && Array.isArray(newPayload.optionSets)) {
    newPayload.optionSets = newPayload.optionSets.map((os: any) => {
      const outOS = { ...os };
      const osId = os?.optionSetId ?? os?.id;
      if (Array.isArray(outOS.options) && osId) {
        outOS.options = outOS.options.map((opt: any) => {
          const o = { ...opt };
          const optId = opt?.optionId ?? opt?.id;
          if (optId) {
            const prevOpt = prevOptionMap.get(`${osId}::${optId}`);
            if (prevOpt) {
              if (typeof o.inStock !== "boolean" && typeof prevOpt.inStock === "boolean") {
                o.inStock = prevOpt.inStock;
              }
              const hasOptImage = typeof o.image === "string" && o.image.trim().length > 0;
              if (!hasOptImage && typeof prevOpt.image === "string" && prevOpt.image.trim().length > 0) {
                o.image = prevOpt.image;
              }
            }
          }
          return o;
        });
      }
      return outOS;
    });
  }
}

/**
 * Normalize payload shape:
 * - items[]: ensure inStock:boolean (default true), image:string (default "")
 * - optionSets[].options[]: ensure inStock/image too (if your UI relies on it)
 * Call AFTER mergeFromPrevious so defaults only fill what’s still missing.
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
 * 2) merge missing fields from the last snapshot
 * 3) normalize remaining fields
 * 4) save snapshot
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
    // deep clone the fresh payload (avoid accidental mutation of axios response object)
    const payload = JSON.parse(JSON.stringify(raw));

    // Load the most recent previous snapshot (if any)
    const prev = await MenuSnapshot.findOne(
      {},
      { payload: 1 },
      { sort: { createdAt: -1 } }
    ).lean();

    // Carry over fields from previous where new is missing
    // @ts-ignore
    mergeFromPrevious(payload, prev?.payload);

    // Normalize to ensure defaults for anything still missing
    ensureItemFields(payload);

    // Save as a new snapshot
    const doc = await MenuSnapshot.create({
      branch: BRANCH ?? null,
      channel: CHANNEL ?? null,
      fetchedAt: new Date(),
      payload,
    });

    res.status(201).json({
      status: true,
      message: "Menu fetched, merged with previous, and saved",
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
 * convenience: return the most recent saved snapshot (payload only)
 * Also exposes snapshot id in 'X-Menu-Snapshot-Id' header
 */
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.setHeader("X-Menu-Snapshot-Id", String((doc as any)._id));

    // Return the payload AS-IS (already includes merged/normalized fields)
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

/**
 * PUT /menu/item/:itemId[?snapshotId=<mongoId>]
 * Update a specific item's image/inStock inside a snapshot (latest by default).
 * Body: { image?: string; inStock?: boolean }
 */
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