import { API_KEY, BASE_URL } from "../config/config";
import userModel from "../models/user";
import { generateLoginToken, generateToken } from "./generateToken";
import axios from "axios";

export default async function handleLogin(phone: string) {
  try {
    const user = await userModel.findOne({
      phone,
    });

    if (!user) {
      return {
        status: false,
        message: "User not found",
      };
    }

    const token = generateToken();

    const response = await axios.get(`${BASE_URL}/customer`, {
      params: {
        phoneNumber: phone,
      },
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "x-api-token": token,
      },
    });

    const data = response.data;

    const loginToken = generateLoginToken(phone);

    return {
      status: true,
      message: "User logged in successfully",
      data: data,
      token: loginToken
    };
  } catch (error) {
    return {
      status: false,
      message: "Internal Server Error",
      error: error,
    };
  }
}
