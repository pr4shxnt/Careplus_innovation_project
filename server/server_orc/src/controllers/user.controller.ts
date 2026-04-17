import { connectToDatabase } from "../config/database";
import { type CreateUserInput, mapUserDocument, UserModel } from "../models/user.model";

function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "x-powered-by": "bun",
    },
  });
}

export function parseCreateUserPayload(payload: unknown): CreateUserInput {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload must be a valid object");
  }

  const maybeUser = payload as Record<string, unknown>;
  const name = maybeUser.name;
  const email = maybeUser.email;

  if (typeof name !== "string" || name.trim().length < 2) {
    throw new Error("Field 'name' must be at least 2 characters");
  }

  if (typeof email !== "string" || !email.includes("@")) {
    throw new Error("Field 'email' must be a valid email");
  }

  return {
    name: name.trim(),
    email: email.trim().toLowerCase(),
  };
}

async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new Error("Request body must be valid JSON");
  }
}

export async function createUserController(request: Request): Promise<Response> {
  let payload: unknown;

  try {
    payload = await parseJsonBody(request);
  } catch (error) {
    return jsonResponse({ error: (error as Error).message }, 400);
  }

  let userInput: CreateUserInput;
  try {
    userInput = parseCreateUserPayload(payload);
  } catch (error) {
    return jsonResponse({ error: (error as Error).message }, 422);
  }

  try {
    const isDatabaseReady = await connectToDatabase();
    if (!isDatabaseReady) {
      return jsonResponse(
        {
          error: "Database is not configured. Set MONGO_URI environment variable.",
        },
        503,
      );
    }

    const userDocument = await UserModel.create(userInput);

    return jsonResponse(
      {
        message: "User created",
        data: mapUserDocument(userDocument as never),
      },
      201,
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      return jsonResponse({ error: "Email already exists" }, 409);
    }

    return jsonResponse({ error: "Failed to create user" }, 500);
  }
}

export async function listUsersController(): Promise<Response> {
  try {
    const isDatabaseReady = await connectToDatabase();
    if (!isDatabaseReady) {
      return jsonResponse(
        {
          error: "Database is not configured. Set MONGO_URI environment variable.",
        },
        503,
      );
    }

    const userDocuments = await UserModel.find().sort({ createdAt: -1 }).limit(50).lean();

    return jsonResponse({
      data: userDocuments.map((userDocument: any) => mapUserDocument(userDocument as never)),
    });
  } catch {
    return jsonResponse({ error: "Failed to fetch users" }, 500);
  }
}
