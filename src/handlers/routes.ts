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
import {
  getReceivedTransactionHandler,
  getSentTransactionHandler,
  saveTransactionHandler,
} from "./transaction/transaction";
import multer from "multer";
import {
  deleteBannerHandler,
  getAllBanners,
  uploadBannerHandler,
} from "./banner/banner";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
});

export const userRouter = Router();
export const otpRouter = Router();
export const menuRouter = Router();
export const orderRouter = Router();
export const saleRouter = Router();
export const couponRouter = Router();
export const bannerRouter = Router();
export const transactionRouter = Router();

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

transactionRouter.post("/", saveTransactionHandler);
transactionRouter.get("/sent/:id", getSentTransactionHandler);
transactionRouter.get("/received/:id", getReceivedTransactionHandler);

bannerRouter.post("/upload", upload.single("banner"), uploadBannerHandler);
bannerRouter.get("/", getAllBanners);
bannerRouter.delete("/:id", deleteBannerHandler);
