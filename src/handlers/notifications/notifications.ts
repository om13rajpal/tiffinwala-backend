import { Request, Response } from "express";

import admin from "firebase-admin";
import path from "path";
import { FIREBASE_CONFIG } from "../../config/config";

const serviceAccount = JSON.parse(
  Buffer.from(FIREBASE_CONFIG!, "base64").toString("utf-8")
);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export async function sendNotificationHandler(req: Request, res: Response) {
  const { title, body } = req.body;
  const messasge = {
    topic: "all_users",
    notification: {
      title,
      body,
    },
  };
  try {
    const response = await admin.messaging().send(messasge);
    console.log("notfication sent: ", response);
    res.json({
      status: true,
      message: "notification sent successfully",
      data: response,
    });
  } catch (error) {
    console.error("error sending notification", error);
    res.status(500).json({
      status: false,
      message: "internal server error",
    });
  }
}
