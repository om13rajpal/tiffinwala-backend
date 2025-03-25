import { Request, Response } from "express";
import userModel from "../../models/user";
import handleLogin from "../../utils/handleLogin";
import handleSignup from "../../utils/handleSignup";

export interface SignupRequest {
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

export default async function handleAuth(req: Request, res: Response) {
  const { phoneNumber, firstName, lastName } = req.body;

  const user = await userModel.findOne({
    phone: phoneNumber,
  });

  if (!user) {
    const response = await handleSignup(phoneNumber, firstName, lastName);
    if (!response.status) {
      res.status(400).json(response);
      return;
    }

    res.json(response);
    return;
  }

  const response = await handleLogin(phoneNumber);
  if (!response.status) {
    res.status(400).json(response);
    return;
  }

  res.json(response);
}
