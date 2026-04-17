import mongoose, { Schema } from "mongoose";

export type CreateUserInput = {
  name: string;
  email: string;
};

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const UserModel =
  (mongoose.models.User as mongoose.Model<CreateUserInput & mongoose.Document>) ??
  mongoose.model("User", userSchema);

export function mapUserDocument(userDocument: {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}): ApiUser {
  return {
    id: userDocument._id.toString(),
    name: userDocument.name,
    email: userDocument.email,
    createdAt: userDocument.createdAt.toISOString(),
    updatedAt: userDocument.updatedAt.toISOString(),
  };
}
