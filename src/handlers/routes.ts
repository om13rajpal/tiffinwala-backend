import { Router } from "express";
import { otpHandler, verifyOtpHandler } from "./otp/otp";
import { menuHandler } from "./menu/menu";
import handleAuth from "./user/auth";

export const userRouter = Router();
export const otpRouter = Router();
export const menuRouter = Router();

userRouter.post("/auth", handleAuth);

otpRouter.post("/verify", verifyOtpHandler);
otpRouter.post("/send", otpHandler);

menuRouter.get("/", menuHandler);
