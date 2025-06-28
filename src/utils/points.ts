import mongoose from "mongoose";
import pointsModel from "../models/points";

export async function getLoyaltyPoints(price: number) {
  const loyaltyPoints = await pointsModel.findOne({
    lower: {
      $lt: price,
    },
    upper: {
      $gte: price,
    },
  });

  if (!loyaltyPoints) return 0;

  return loyaltyPoints.loyaltyPoints;
}
