import { Router } from "express";
import { otpHandler, verifyOtpHandler } from "./otp/otp";
import { menuHandler } from "./menu/menu";
import { handleAuth, handleNewUser } from "./user/auth";
import { getOrdersHandler, newOrderHandler } from "./order/order";
import { AddPointsHandler, GetPointsHandler } from "./user/loyalty";
import {
  GetUserHandler,
  UpdateAddressHandler,
  UpdateNameHandler,
} from "./user/user";
import { IsAuthenticated } from "../middeware/authenticated";
import {
  addCouponHandler,
  getCouponsHandler,
  verifyCouponHandler,
} from "./coupon/coupon";

export const userRouter = Router();
export const otpRouter = Router();
export const menuRouter = Router();
export const orderRouter = Router();
export const saleRouter = Router();
export const couponRouter = Router();

userRouter.post("/auth", handleAuth);
userRouter.post("/signup", handleNewUser);
userRouter.post("/loyalty", AddPointsHandler);

userRouter.get("/orders/:phone", IsAuthenticated, getOrdersHandler);
userRouter.get("/loyalty/:phone", IsAuthenticated, GetPointsHandler);
userRouter.get("/:phone", IsAuthenticated, GetUserHandler);

userRouter.put("/name/:phone", IsAuthenticated, UpdateNameHandler);
userRouter.put("/address/:phone", IsAuthenticated, UpdateAddressHandler);

otpRouter.post("/verify", verifyOtpHandler);
otpRouter.post("/send", otpHandler);

menuRouter.get("/", menuHandler);

orderRouter.post("/new", IsAuthenticated, newOrderHandler);

couponRouter.get("/", getCouponsHandler);
couponRouter.post("/", addCouponHandler);
couponRouter.post("/verify", verifyCouponHandler);