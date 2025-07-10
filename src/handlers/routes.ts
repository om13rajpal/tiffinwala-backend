import { Router } from "express";
import { otpHandler, verifyOtpHandler } from "./otp/otp";
import { menuHandler } from "./menu/menu";
import { handleAuth, handleNewUser } from "./user/auth";
import { getOrdersHandler, newOrderHandler } from "./order/order";
import { AddPointsHandler, GetPointsHandler } from "./user/loyalty";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import {
  GetUserHandler,
  UpdateAddressHandler,
  UpdateNameHandler,
} from "./user/user";
import { IsAuthenticated } from "../middeware/authenticated";
import {
  addCouponHandler,
  deleteCouponHander,
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
import { getStoreStatus } from "./store/store";
import { sendNotificationHandler } from "./notifications/notifications";
import {
  deletePointsHandler,
  getPointsHandler,
  savePointsHandler,
} from "./points/points";
import {
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_CLOUD_NAME,
} from "../config/config";

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: "banners",
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
    };
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
export const storeRouter = Router();
export const notificationRouter = Router();
export const pointsRouter = Router();

pointsRouter.post("/", savePointsHandler);
pointsRouter.get("/", getPointsHandler);
pointsRouter.delete("/:id", deletePointsHandler);

notificationRouter.post("/send", sendNotificationHandler);

storeRouter.get("/status", getStoreStatus);

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
couponRouter.post("/verifyCoupon", verifyCouponHandler);
couponRouter.delete("/:id", deleteCouponHander);

transactionRouter.post("/", saveTransactionHandler);
transactionRouter.get("/sent/:id", getSentTransactionHandler);
transactionRouter.get("/received/:id", getReceivedTransactionHandler);

bannerRouter.post("/upload", upload.single("file"), uploadBannerHandler);
bannerRouter.get("/", getAllBanners);
bannerRouter.delete("/:id", deleteBannerHandler);
