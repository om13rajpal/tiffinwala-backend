import express from "express";
import logger from "./middeware/logger";
import { errorHandler, notFoundHandler } from "./middeware/error";
import {
  bannerRouter,
  couponRouter,
  menuRouter,
  notificationRouter,
  orderRouter,
  otpRouter,
  pointsRouter,
  storeRouter,
  transactionRouter,
  userRouter,
} from "./handlers/routes";
import ExpressMongoSanitize from "express-mongo-sanitize";
import connectMongo from "./db/db";
import cors from "cors";
import { limiter } from "./middeware/limiter";
import { DOTPE_API_KEY } from "./config/config";

connectMongo();

const app = express();

app.set("trust proxy", 1);
app.use(cors());
app.use(ExpressMongoSanitize());
app.use(express.json());
app.use(logger);

app.use("/user", limiter, userRouter);
app.use("/otp", limiter, otpRouter);
app.use("/menu", menuRouter);
app.use("/order", limiter, orderRouter);
app.use("/coupon", limiter, couponRouter);
app.use("/transaction", limiter, transactionRouter);
app.use("/banner", bannerRouter);
app.use("/store", storeRouter);
app.use("/notification", notificationRouter);
app.use("/points", pointsRouter);

app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.send("Backend is up and working");
});

app.get("/webhook", (req, res) => {
  res.sendStatus(200);
});

app.post("/webhook", (req, res) => {
  const key = req.headers["x-api-key"];
  if (!key) {
    // Allow empty key for health check
    console.log("Webhook pinged without key");
    res.sendStatus(200);
    return
  }
  if (key !== DOTPE_API_KEY) {
    res.status(401).json({
      status: false,
      message: "Unauthorized",
    });
    return
  }

  console.log("Webhook payload", req.body);
  res.sendStatus(200);
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
