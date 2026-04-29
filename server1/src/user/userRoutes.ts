import { Router } from "express";
import { registerUser, loginUser, savePushToken } from "./userController";
import { strictLimiter } from "../middlewares/rate-limiter";

const userRouter = Router();

userRouter.post("/register", strictLimiter, registerUser);
userRouter.post("/login", strictLimiter, loginUser);
userRouter.patch("/:userId/push-token", savePushToken); // Register Expo push token

export default userRouter;

