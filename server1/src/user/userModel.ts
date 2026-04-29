import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["patient", "doctor"],
    default: "patient",
  },
  expoPushToken: {
    type: String,
    default: null, // Set when user registers device, e.g. "ExponentPushToken[xxx]"
  },
});

export const User = mongoose.model("User", userSchema);

