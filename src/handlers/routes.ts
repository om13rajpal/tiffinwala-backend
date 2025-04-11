import { Router } from "express";
import { otpHandler, verifyOtpHandler } from "./otp/otp";
import { menuHandler } from "./menu/menu";
import { handleAuth, handleNewUser } from "./user/auth";
import { getOrdersHandler, newOrderHandler } from "./order/order";
import { AddPointsHandler, GetPointsHandler } from "./user/loyalty";

export const userRouter = Router();
export const otpRouter = Router();
export const menuRouter = Router();
export const orderRouter = Router();

userRouter.post("/auth", handleAuth);
userRouter.post("/signup", handleNewUser);
userRouter.post("/loyalty", AddPointsHandler);

userRouter.get("/orders", getOrdersHandler);
userRouter.get("/loyalty", GetPointsHandler);

otpRouter.post("/verify", verifyOtpHandler);
otpRouter.post("/send", otpHandler);

menuRouter.get("/", menuHandler);

orderRouter.post("/new", newOrderHandler);