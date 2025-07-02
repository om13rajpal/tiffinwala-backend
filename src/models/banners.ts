import { model, Schema } from "mongoose";

const bannerSchema = new Schema({
  url: {
    type: String,
    required: true,
  },
  redirect: {
    type: String,
  },
  created_at: {
    type: Date,
    default: Date.now(),
  },
});

const bannerModel = model("Banner", bannerSchema);
export default bannerModel;
