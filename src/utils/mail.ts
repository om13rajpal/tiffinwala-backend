import nodemailer from "nodemailer";
import { EMAIL, EMAIL_PASSWORD } from "../config/config";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL,
    pass: EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

export default async function sendOTP(phone: string, otp: string) {
  try {
    const message = await transporter.sendMail({
      from: EMAIL,
      to: phone,
      subject: "Your OTP Code",
      text: `Your OTP is ${otp}`,
    });
    return message;
  } catch (error) {
    console.log(error);
    return false;
  }
}
