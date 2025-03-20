import { Request, Response } from "express";
import { validateSignup } from "../../utils/zod";
import { generateLoginToken, generateToken } from "../../utils/generateToken";
import { API_KEY, BASE_URL } from "../../config/config";
import axios from "axios";

export interface SignupRequest {
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

export async function signupHandler(req: Request, res: Response) {
  const signupBody: SignupRequest = req.body;

  const isValidBody = validateSignup(signupBody);

  if (!isValidBody.success) {
    res.status(400).json({
      status: false,
      message: isValidBody.error.message,
    });
    return;
  }

  const token = generateToken();
  try {
    const response = await axios.post(`${BASE_URL}/customer`, signupBody, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "x-api-token": token,
      },
    });

    const data = response.data;

    res.status(201).json({
      status: true,
      message: "User created successfully",
      data: data,
    });

    return;
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error,
    });
    return;
  }
}

export async function loginHandler(req: Request, res: Response) {
  const { phoneNumber } = req.body;

  const token = generateToken();

  try {
    const response: any = await axios.get(`${BASE_URL}/customer`, {
      params: {
        phoneNumber: phoneNumber,
      },
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "x-api-token": token,
      },
    });

    const data = response.data;

    const loginToken = generateLoginToken(phoneNumber);

    res.status(200).json({
      status: true,
      message: "User logged in successfully",
      data: {
        token: loginToken,
        user: data,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error,
    });
  }
}
