import axios from "axios";
import { FAST2SMS_API_KEY, OTP_BASE_URL } from "../config/config";

export default async function sendOTP(phone: string, otp: string) {
  try {
    const response = await axios.get(OTP_BASE_URL!, {
      params: {
        route: "otp",
        variable_values: otp,
        numbers: phone,
        authorization: FAST2SMS_API_KEY,
      },
    });
    console.log(response.data);
    return response.data;
  } catch (error) {
    console.log(error);
    return error;
  }
}
