import mongoose from "mongoose";

let mongoConnectionPromise: Promise<typeof mongoose> | null = null;

export function getMongoUri(mongoUri = Bun.env.MONGO_URI): string | undefined {
  const normalizedMongoUri = mongoUri?.trim();
  if (!normalizedMongoUri) {
    return undefined;
  }

  return normalizedMongoUri;
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function connectToDatabase(
  mongoUri = getMongoUri(),
): Promise<boolean> {
  if (!mongoUri) {
    return false;
  }

  if (isDatabaseConnected()) {
    return true;
  }

  if (!mongoConnectionPromise) {
    mongoConnectionPromise = mongoose.connect(mongoUri, {
      dbName: Bun.env.MONGO_DB_NAME ?? "careplus",
    });
  }

  try {
    await mongoConnectionPromise;
    return true;
  } catch (error) {
    mongoConnectionPromise = null;
    throw error;
  }
}
