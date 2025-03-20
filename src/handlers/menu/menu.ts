import axios from "axios";
import { Request, Response } from "express";
import { API_KEY, BASE_URL, BRANCH, CHANNEL } from "../../config/config";
import { generateToken } from "../../utils/generateToken";

export async function menuHandler(req: Request, res: Response) {
  const token = generateToken();
  try {
    const response = await axios.get(`${BASE_URL}/catalog/`, {
      params: {
        branch: BRANCH,
        channel: CHANNEL,
      },
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "x-api-token": token,
      },
    });

    const data = response.data;

    res.status(200).json({
      status: true,
      data: data,
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: err,
    });
    return;
  }
}
