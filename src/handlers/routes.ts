import { Router } from "express";
import { otpHandler, verifyOtpHandler } from "./otp/otp";
import { menuHandler } from "./menu/menu";
import { handleAuth, handleNewUser } from "./user/auth";

export const userRouter = Router();
export const otpRouter = Router();
export const menuRouter = Router();

userRouter.post("/auth", handleAuth);
userRouter.post("/signup", handleNewUser);

otpRouter.post("/verify", verifyOtpHandler);
otpRouter.post("/send", otpHandler);

menuRouter.get("/", menuHandler);
