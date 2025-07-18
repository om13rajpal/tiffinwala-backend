import { API_KEY, BASE_URL } from "../config/config";
import { SignupRequest } from "../handlers/user/auth";
import userModel from "../models/user";
import { generateLoginToken, generateToken } from "./generateToken";
import { validateSignup } from "./zod";
import axios from "axios";

export default async function handleSignup(
  phoneNumber: string,
  firstName: string,
  lastName: string,
  address: string,
  referral?: string
) {
  const signupBody: SignupRequest = {
    firstName,
    lastName,
    phoneNumber,
  };

  const isValidBody = validateSignup(signupBody);

  if (!isValidBody.success) {
    return {
      status: false,
      message: "Invalid body",
      error: isValidBody.error.message,
    };
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

    const user = new userModel({
      firstName: firstName,
      lastName: lastName,
      address: [address],
      phone: phoneNumber,
      joiningDate: new Date(),
    });

    await user.save();

    if (referral) {
      await userModel.findOneAndUpdate(
        { phone: referral },
        {
          $inc: {
            loyaltyPoints: 20,
          },
        }
      );
    }

    const loginToken = generateLoginToken(phoneNumber);

    return {
      status: true,
      message: "User created successfully",
      data: data,
      token: loginToken,
    };
  } catch (error) {
    console.log(error);

    return {
      status: false,
      message: "Internal Server Error",
      error: error,
    };
  }
}
