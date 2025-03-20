import express from "express";
import logger from "./middeware/logger";
import { errorHandler, notFoundHandler } from "./middeware/error";
import { menuRouter, otpRouter, userRouter } from "./handlers/routes";
import connectMongo from "./db/db";

connectMongo();

const app = express();

app.use(express.json());
app.use(logger);

app.use("/user", userRouter);
app.use("/otp", otpRouter);
app.use("/menu", menuRouter);

app.get("/", (req, res) => {
  res.send("Backend is up and working");
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
