import mongoose from "mongoose";
import { MONGO_URI } from "../config/config";

export default function connectMongo() {
  mongoose
    .connect(MONGO_URI!)
    .then(() => {
      console.log("Connected to MongoDB");
    })
    .catch((err) => {
      console.log("Error connecting to MongoDB", err);
    });
}
