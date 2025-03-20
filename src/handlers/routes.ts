import { Router } from "express";
import { loginHandler, signupHandler } from "./user/auth";
import { otpHandler, verifyOtpHandler } from "./otp/otp";
import { menuHandler } from "./menu/menu";

export const userRouter = Router();
export const otpRouter = Router();
export const menuRouter = Router();

userRouter.post("/signup", signupHandler);
userRouter.post("/login", loginHandler);

otpRouter.post("/verify", verifyOtpHandler);
otpRouter.post("/send", otpHandler);

menuRouter.get("/", menuHandler);
