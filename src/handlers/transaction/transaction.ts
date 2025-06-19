import { Request, Response } from "express";
import transactionModel, { Transaction } from "../../models/transaction";
import userModel from "../../models/user";

export async function saveTransactionHandler(req: Request, res: Response) {
  const { senderId, receiverId, amount }: Transaction = req.body;

  try {
    const transaction = await new transactionModel({
      senderId,
      receiverId,
      amount,
    }).save();

    if (!transaction) {
      res.status(500).json({
        status: false,
        message: "internal server error",
      });
      return;
    }

    const sender = await userModel.findByIdAndUpdate(senderId, {
      $inc: {
        loyaltyPoints: -amount,
      },
    });

    if (!sender) {
      res.status(404).json({
        status: false,
        message: "sender not found",
      });
      return;
    }

    const receiver = await userModel.findByIdAndUpdate(receiverId, {
      $inc: {
        balance: amount,
      },
    });

    if (!receiver) {
      res.status(404).json({
        status: false,
        message: "receiver not found",
      });
      return;
    }

    res.json({
      status: true,
      message: "transaction saved successfully",
      data: transaction,
    });
  } catch (error) {
    console.error("Error saving transaction", error);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
}

export async function getSentTransactionHandler(req: Request, res: Response) {
  const id = req.params.id;

  try {
    const transactions = transactionModel.find({
      senderId: id,
    });

    res.json({
      status: true,
      data: transactions,
    });
  } catch (error) {
    console.error("error getting transaction", error);
    res.status(500).json({
      status: false,
      message: "internal server error",
    });
  }
}

export async function getReceivedTransactionHandler(
  req: Request,
  res: Response
) {
  const id = req.params.id;

  try {
    const transaction = transactionModel.find({
      receiverId: id,
    });

    res.json({
      status: true,
      data: transaction,
    });
  } catch (error) {
    console.error("error getting transaction", error);
    res.status(500).json({
      status: false,
      message: "internal server error",
    });
  }
}
