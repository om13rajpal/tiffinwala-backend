import twilio from "twilio";
import {
  ACCOUNT_SID_TWILIO,
  AUTH_TOKEN_TWILIO,
  PHONE_NUMBER_TWILIO,
} from "../config/config";

export default async function sendOTP(phone: string, otp: string) {
  const client = twilio(ACCOUNT_SID_TWILIO, AUTH_TOKEN_TWILIO);

  try {
    const message = await client.messages.create({
      to: phone,
      from: PHONE_NUMBER_TWILIO,
      body: `Your OTP is ${otp}`,
    });
    return message
  } catch (error) {
    console.log(error);
    return false;
  }
}
