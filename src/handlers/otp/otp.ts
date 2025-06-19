import { Request, Response } from "express";
import { otpModel } from "../../models/otp";
import sendOTP from "../../utils/otp";

export async function otpHandler(req: Request, res: Response) {
  const { phoneNumber } = req.body;
  const existingOtp = await otpModel.findOne({
    phone: phoneNumber,
  });

  if (existingOtp) {
    await existingOtp.deleteOne();
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  const createOtp = await new otpModel({
    phone: phoneNumber,
    otp,
  }).save();

  if (!createOtp) {
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
    return;
  }
  const sendResponse: any = await sendOTP(phoneNumber, otp);
  console.log(sendResponse)

  if (!sendResponse) {
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
    return;
  }

  res.status(200).json({
    status: true,
    message: "OTP sent successfully",
    otp: otp,
    phoneNumber: phoneNumber,
  });
}

export async function verifyOtpHandler(req: Request, res: Response) {
  const { phoneNumber, otp } = req.body;

  const otpData = await otpModel.findOne({
    phone: phoneNumber,
  });

  if (!otpData) {
    res.status(404).json({
      status: false,
      message: "Otp not found",
    });
    return;
  }

  if (otpData.otp != otp) {
    res.status(400).json({
      status: false,
      message: "Invalid OTP",
    });
    return;
  }
  await otpData.deleteOne();
  res.status(200).json({
    status: true,
    message: "OTP verified successfully",
  });
}
