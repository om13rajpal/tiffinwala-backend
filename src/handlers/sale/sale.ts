import { Request, Response } from "express";
import axios from "axios";
import { API_KEY, BASE_URL, BRANCH, CHANNEL } from "../../config/config";
import { generateToken } from "../../utils/generateToken";

export async function SaveSaleHandler(req: Request, res: Response) {
    const { items } = req.body;
    const body = {
      branchCode: BRANCH,
      channel: CHANNEL,
      items: items,
    };
    const token = generateToken();
    try {
      const response = await axios.post(`${BASE_URL}/sale`, body, {
        headers: {
          "x-api-key": API_KEY,
          "x-api-token": token,
          "Content-Type": "application/json",
        },
      });
  
      if (response.status === 201) {
        res.status(201).json({
          status: true,
          message: "Sale created successfully",
          data: response.data,
        });
        return;
      } else {
        res.status(500).json({
          status: false,
          message: "Internal Server Error",
          error: response.data,
        });
        return;
      }
    } catch (error) {
      console.error("Error creating sale:", error);
      res.status(500).json({
        status: false,
        message: "Internal Server Error",
        error: error,
      });
      return;
    }
}