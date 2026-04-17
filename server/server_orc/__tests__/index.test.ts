import { describe, expect, test } from "bun:test";
import { handleRequest, resolvePort } from "../src/index";
import { parseCreateUserPayload } from "../src/controllers/user.controller";

describe("resolvePort", () => {
  test("returns default port for invalid values", () => {
    expect(resolvePort(undefined)).toBe(3000);
    expect(resolvePort("abc")).toBe(3000);
    expect(resolvePort("0")).toBe(3000);
    expect(resolvePort("70000")).toBe(3000);
  });

  test("returns parsed port for valid values", () => {
    expect(resolvePort("8080")).toBe(8080);
  });
});

describe("handleRequest", () => {
  test("returns service metadata on root path", async () => {
    const response = await handleRequest(new Request("http://localhost/"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.service).toBe("server_orc");
    expect(typeof body.timestamp).toBe("string");
  });

  test("returns health status", async () => {
    const response = await handleRequest(new Request("http://localhost/health"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(typeof body.databaseConnected).toBe("boolean");
  });

  test("returns 404 for unknown routes", async () => {
    const response = await handleRequest(new Request("http://localhost/unknown"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Not Found");
    expect(body.path).toBe("/unknown");
  });

  test("returns 400 for invalid POST JSON body", async () => {
    const response = await handleRequest(
      new Request("http://localhost/api/users", {
        method: "POST",
        body: "{invalid-json",
        headers: { "content-type": "application/json" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Request body must be valid JSON");
  });

  test("returns 422 for invalid POST payload", async () => {
    const response = await handleRequest(
      new Request("http://localhost/api/users", {
        method: "POST",
        body: JSON.stringify({ name: "A" }),
        headers: { "content-type": "application/json" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toBe("Field 'name' must be at least 2 characters");
  });
});

describe("parseCreateUserPayload", () => {
  test("normalizes valid payload", () => {
    expect(
      parseCreateUserPayload({
        name: " Prashant ",
        email: " PRASHANT@EXAMPLE.COM ",
      }),
    ).toEqual({
      name: "Prashant",
      email: "prashant@example.com",
    });
  });
});
