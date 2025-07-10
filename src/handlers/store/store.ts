import { Request, Response } from "express";
import { API_KEY, BASE_URL, BRANCH, CHANNEL } from "../../config/config";
import { generateToken } from "../../utils/generateToken";
import axios from 'axios'
import storeModel from "../../models/store";

export async function updateStoreHandler(req: Request, res: Response) {
  const { status, reason } = req.body;
  const token = generateToken();

  try {
    const body = {
      branch: BRANCH,
      channel: CHANNEL,
      status: status,
      reason: reason,
    };
    const response = await axios.put(`${BASE_URL}/outlet/status`, body, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "x-api-token": token,
      },
    });

    const data = response.data;

    res.status(200).json({
      status: true,
      message: "store updated",
      data: data,
    });
  } catch (error) {
    console.error("error updating the store");
    res.status(500).json({
      status: false,
      message: "internal server error",
    });
  }
}

export async function getStoreStatus(req: Request, res: Response) {
  const token = generateToken();
  try {
    const response: any = await axios.get(`${BASE_URL}/branch/list`, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "x-api-token": token,
      },
    });

    res.json({
      status: true,
      store: response.data[0].status,
    });
  } catch (error) {
    console.error("error getting the status", error);
    res.status(500).json({
      status: false,
      message: "internal server error",
    });
  }
}
