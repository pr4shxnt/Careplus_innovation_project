import { isDatabaseConnected } from "../config/database";

const APP_NAME = "server_orc";

type StatusResponse = {
  status: "ok";
  service: string;
  timestamp: string;
};

function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "x-powered-by": "bun",
    },
  });
}

export function getStatusController(): Response {
  const payload: StatusResponse = {
    status: "ok",
    service: APP_NAME,
    timestamp: new Date().toISOString(),
  };

  return jsonResponse(payload);
}

export function getHealthController(): Response {
  return jsonResponse({
    status: "ok",
    databaseConnected: isDatabaseConnected(),
  });
}
