import React, { createContext, useContext, useState, useEffect } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    role: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredSession();
  }, []);

  async function loadStoredSession() {
    try {
      const storedUser = await AsyncStorage.getItem("user");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error("Failed to load user session", e);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    try {
      const response = await api.post("/users/login", { email, password });
      const userData = (response.data as any).user;
      await AsyncStorage.setItem("user", JSON.stringify(userData));
      await AsyncStorage.setItem("userId", userData._id || userData.id || "");
      setUser(userData);

      // Register Expo push token with the server
      await registerPushToken(userData._id || userData.id);
    } catch (error) {
      console.error("Login failed", error);
      throw error;
    }
  }

  async function register(
    name: string,
    email: string,
    password: string,
    role: string = "user",
  ) {
    try {
      const response = await api.post("/users/register", {
        name,
        email,
        password,
        role,
      });
      const userData = (response.data as any).user;
      await AsyncStorage.setItem("user", JSON.stringify(userData));
      await AsyncStorage.setItem("userId", userData._id || userData.id || "");
      setUser(userData);

      // Register Expo push token with the server
      await registerPushToken(userData._id || userData.id);
    } catch (error) {
      console.error("Registration failed", error);
      throw error;
    }
  }

  async function registerPushToken(userId: string) {
    try {
      if (!userId) return;
      // Request permission
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("medicine-reminders", {
          name: "Medicine Reminders",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#10b981",
          sound: "default",
        });
      }
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") return;

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: "your-expo-project-id", // Replace with your EAS project ID
      }).catch(() => null);

      if (tokenData?.data) {
        await api.put(`/users/${userId}/push-token`, {
          expoPushToken: tokenData.data,
        });
        console.log("[Auth] Push token registered:", tokenData.data);
      }
    } catch (e) {
      // Non-critical – silently fail
      console.log("[Auth] Push token registration skipped:", e);
    }
  }

  async function logout() {
    try {
      await AsyncStorage.removeItem("user");
      await AsyncStorage.removeItem("userToken");
      setUser(null);
    } catch (e) {
      console.error("Logout failed", e);
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
