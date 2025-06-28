import express from "express";
import logger from "./middeware/logger";
import { errorHandler, notFoundHandler } from "./middeware/error";
import {
  bannerRouter,
  couponRouter,
  menuRouter,
  orderRouter,
  otpRouter,
  storeRouter,
  transactionRouter,
  userRouter,
} from "./handlers/routes";
import ExpressMongoSanitize from "express-mongo-sanitize";
import connectMongo from "./db/db";
import cors from "cors";
import { limiter } from "./middeware/limiter";

connectMongo();

const app = express();

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
app.use("/store", storeRouter)

app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.send("Backend is up and working");
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
