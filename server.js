const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const { spawn } = require("child_process");
const { createOpenApiSpec, createSwaggerHtml } = require("./openapi");

const externalPort = Number(process.env.PORT || 8000);
const internalPort = Number(process.env.INTERNAL_GATEWAY_PORT || 9000);
const token = process.env.MCP_INTERNAL_TOKEN;
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

if (!token) {
  console.error("MCP_INTERNAL_TOKEN is required");
  process.exit(1);
}

const sessions = new Map();

function requireInternalAuth(req, res, next) {
  const expected = `Bearer ${token}`;
  const actual = req.headers.authorization;

  if (actual !== expected) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  next();
}

console.log("Starting shared supergateway...");
console.log(`Internal gateway port: ${internalPort}`);

const gateway = spawn(
  npxCommand,
  [
    "supergateway",
    "--stdio",
    "uv run src/main.py",
    "--outputTransport",
    "streamableHttp",
    "--port",
    String(internalPort),
  ],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  }
);

gateway.on("exit", (code, signal) => {
  console.error(`supergateway exited. code=${code}, signal=${signal}`);
  process.exit(code || 1);
});

const app = express();
app.set("trust proxy", true);

function getBaseUrl(req) {
  return process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
}

app.get("/", (_req, res) => {
  res.redirect(302, "/docs");
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "systrade-qc-mcp-gateway",
    mode: "shared-session-ready",
    active_sessions: sessions.size,
  });
});

app.get("/openapi.json", (req, res) => {
  res.json(createOpenApiSpec(getBaseUrl(req)));
});

app.get(["/docs", "/docs/"], (_req, res) => {
  res.type("html").send(createSwaggerHtml());
});

app.post(
  "/sessions",
  requireInternalAuth,
  express.json({ limit: "2mb" }),
  (req, res) => {
    const {
      session_id,
      user_id,
      workflow_run_id,
      qc_user_id,
      qc_api_token,
    } = req.body || {};

    if (!session_id) {
      return res.status(422).json({ error: "session_id is required" });
    }

    if (!user_id) {
      return res.status(422).json({ error: "user_id is required" });
    }

    if (!workflow_run_id) {
      return res.status(422).json({ error: "workflow_run_id is required" });
    }

    if (!qc_user_id) {
      return res.status(422).json({ error: "qc_user_id is required" });
    }

    if (!qc_api_token) {
      return res.status(422).json({ error: "qc_api_token is required" });
    }

    sessions.set(session_id, {
      sessionId: session_id,
      userId: user_id,
      workflowRunId: workflow_run_id,
      qcUserId: qc_user_id,
      // Stored only for the future per-session mode. Never log this value.
      qcApiToken: qc_api_token,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    });

    res.json({
      status: "created",
      session_id,
      mode: "shared-mcp-process",
    });
  }
);

app.delete("/sessions/:sessionId", requireInternalAuth, (req, res) => {
  const { sessionId } = req.params;

  sessions.delete(sessionId);

  res.json({
    status: "deleted",
    session_id: sessionId,
  });
});

app.use(
  "/sessions/:sessionId/mcp",
  requireInternalAuth,
  (req, res, next) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        error: "MCP session not found",
        session_id: sessionId,
      });
    }

    session.lastUsedAt = Date.now();

    next();
  },
  createProxyMiddleware({
    target: `http://127.0.0.1:${internalPort}`,
    changeOrigin: true,
    ws: true,
    proxyTimeout: 120000,
    timeout: 120000,
    pathRewrite: () => "/mcp",
  })
);

process.on("SIGTERM", () => {
  console.log("Received SIGTERM. Stopping supergateway...");
  gateway.kill("SIGTERM");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Received SIGINT. Stopping supergateway...");
  gateway.kill("SIGINT");
  process.exit(0);
});

app.listen(externalPort, "0.0.0.0", () => {
  console.log(`Session-ready auth proxy listening on 0.0.0.0:${externalPort}`);
});
