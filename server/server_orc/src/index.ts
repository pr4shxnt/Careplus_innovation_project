import { handleRequest } from "./routes";

const APP_NAME = "server_orc";
const DEFAULT_PORT = 3000;

export function resolvePort(portValue: string | undefined): number {
  const parsedPort = Number.parseInt(portValue ?? "", 10);

  if (Number.isNaN(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
    return DEFAULT_PORT;
  }

  return parsedPort;
}

export { handleRequest };

export function startServer(port = resolvePort(Bun.env.PORT)) {
	return Bun.serve({
		port,
		fetch: handleRequest,
	});
}

if (import.meta.main) {
	const server = startServer();
	console.log(`🚀 ${APP_NAME} listening on http://localhost:${server.port}`);
}
