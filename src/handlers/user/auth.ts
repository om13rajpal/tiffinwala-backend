import { Request, Response } from "express";
import userModel from "../../models/user";
import handleLogin from "../../utils/handleLogin";
import handleSignup from "../../utils/handleSignup";

export interface SignupRequest {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  address: string
}

export async function handleAuth(req: Request, res: Response) {
  const { phoneNumber } = req.body;

  const user = await userModel.findOne({
    phone: phoneNumber,
  });

  if (!user) {
    res.status(400).json({
      status: false,
      message: "User not found",
    });
    return;
  }

  const response = await handleLogin(phoneNumber);
  if (!response.status) {
    res.status(400).json(response);
    return;
  }

  res.json(response);
}

export async function handleNewUser(req: Request, res: Response) {
  const { firstName, lastName, phoneNumber, address } = req.body;

  const response: any = await handleSignup(phoneNumber, firstName, lastName, address);

  if (!response.status) {
    res.status(400).json(response);
    return;
  }

  res.json(response);
}
