import { Request, Response } from "express";

import admin from "firebase-admin";
import path from "path";

const serviceAccount = require(path.join(__dirname, "../../../firebasekey.json"));

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
    const response = await admin.messaging().send(messasge)
    console.log('notfication sent: ', response)
    res.json({
        status: true,
        message: "notification sent successfully",
        data: response
    })
  } catch (error) {
    console.error('error sending notification', error)
    res.status(500).json({
        status: false,
        message: "internal server error"
    })
  }
}
