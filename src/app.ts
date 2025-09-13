import express from "express";
import logger from "./middeware/logger";
import { errorHandler, notFoundHandler } from "./middeware/error";
import {
  analyticsRouter,
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
import storeModel from "./models/store";
import helmet from "helmet";
import compression from "compression";
import hpp from "hpp";
import { versionModel } from "./models/version";
connectMongo();

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(hpp());
app.use(cors());
app.use(compression());
app.use(ExpressMongoSanitize());
app.use(express.json({ limit: "1mb" }));
app.use(logger);
app.use(limiter);

app.use((req, res, next) => {
  const forbiddenPaths = [
    /^\/\.env/,
    /^\/\.git/,
    /^\/phpinfo\.php/,
    /^\/info\.php/,
    /^\/_profiler/,
    /^\/aws/,
    /^\/config/,
    /^\/docker/,
    /^\/logs/,
    /^\/core/,
    /^\/admin/,
    /^\/settings\.py/,
    /^\/application\.properties/,
    /^\/docker-compose\.yml/,
  ];

  if (forbiddenPaths.some((regex) => regex.test(req.path))) {
    console.warn(`Blocked suspicious request: ${req.path} from ${req.ip}`);
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  next();
});

app.use("/user", userRouter);
app.use("/otp", otpRouter);
app.use("/menu", menuRouter);
app.use("/order", orderRouter);
app.use("/coupon", couponRouter);
app.use("/transaction", transactionRouter);
app.use("/banner", bannerRouter);
app.use("/store", storeRouter);
app.use("/notification", notificationRouter);
app.use("/points", pointsRouter);
app.use("/analytics", analyticsRouter);

app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.send("Backend is up and working");
});

// @ts-ignore
app.get("/version", async (req, res) => {
  try {
    const version = await versionModel.findOne().sort({ createdAt: -1 });
    if (!version) {
      return res.status(404).json({ message: "Version not found" });
    }
    res.json({ version: version.version });
  } catch (err) {
    res.status(500).json({ message: "Error fetching version" });
  }
});

app.post("/", async (req, res) => {
  const key = req.headers["x-api-key"];
  if (!key) {
    console.log("Webhook pinged without key");
    res.sendStatus(200);
    return;
  }
  if (key !== DOTPE_API_KEY) {
    res.status(401).json({
      status: false,
      message: "Unauthorized",
    });
    return;
  }
  const body = req.body;
  if (body.type === "outlet.status.change") {
    const isActive = body.data?.active;

    await storeModel.findByIdAndUpdate("687025cb187681e09dfb685a", {
      active: isActive,
      updatedAt: Date.now(),
    });
  }
  console.log("Webhook payload", req.body);
  res.sendStatus(200);
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;