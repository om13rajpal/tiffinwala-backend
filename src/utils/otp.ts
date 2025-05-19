import axios from "axios";
import { FAST2SMS_API_KEY } from "../config/config";

export default async function sendOTP(phone: string, otp: string) {
  try {
    var body = {
      variables_values: otp,
      route: "otp",
      numbers: phone,
    };
    const response = await axios.post(
      " https://www.fast2sms.com/dev/bulkV2",
      body,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: FAST2SMS_API_KEY,
        },
      }
    );

    // @ts-ignore
    return response.data.message;
  } catch (error) {
    console.log(error);
    return false;
  }
}
