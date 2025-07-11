import { Request, Response } from "express";
import storeModel from "../../models/store";

export async function getStoreStatus(req: Request, res: Response) {
  
  try {
    const status = await storeModel.findById("687025cb187681e09dfb685a")


    res.json({
      status: true,
      store: status?.active,
    });
  } catch (error) {
    console.error("error getting the status", error);
    res.status(500).json({
      status: false,
      message: "internal server error",
    });
  }
}


