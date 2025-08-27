import axios from "axios";
import { AUTH_KEY } from "../config/config";

export default async function sendOTP(phone: string, otp: string) {
  try {
    var body = {
      country_code: "91",
      mobile: phone,
      wid: "10326",
      type: "text",
      bodyValues: { "1": otp },
    };
    const response = await axios.post(
      "https://console.authkey.io/restapi/requestjson.php",
      body,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${AUTH_KEY}`,
        },
      }
    );
    console.log(phone);
    console.log(otp);
    console.log(response.data);

    // @ts-ignore
    return response.data.status == 'Success';
  } catch (error) {
    console.log(error);
    return false;
  }
}
export async function sendCoins(phone: string, points: string) {
  try {
    var body = {
      country_code: "91",
      mobile: phone,
      wid: "14615",
      type: "text",
      bodyValues: { "1": points },
    };
    const response = await axios.post(
      "https://console.authkey.io/restapi/requestjson.php",
      body,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${AUTH_KEY}`,
        },
      }
    );
    console.log(phone);
    console.log(response.data);

    // @ts-ignore
    return response.data.status == 'Success';
  } catch (error) {
    console.log(error);
    return false;
  }
}