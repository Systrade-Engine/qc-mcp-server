const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const { spawn } = require("child_process");
const { createOpenApiSpec, createSwaggerHtml } = require("./openapi");

const externalPort = Number(process.env.PORT || 8000);
const internalPort = Number(process.env.INTERNAL_GATEWAY_PORT || 9000);
const token = process.env.MCP_INTERNAL_TOKEN;
const defaultSessionId = process.env.DEFAULT_SESSION_ID || "systradeapp-shared";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const maxSessions = readPositiveIntegerEnv("MAX_SESSIONS", 100);
const mcpSessionTimeoutMs = readPositiveIntegerEnv(
  "MCP_SESSION_TIMEOUT_MS",
  60 * 60 * 1000
);
const sessionTtlMs = readPositiveIntegerEnv(
  "SESSION_TTL_MS",
  24 * 60 * 60 * 1000
);
const sessionCleanupIntervalMs = readPositiveIntegerEnv(
  "SESSION_CLEANUP_INTERVAL_MS",
  5 * 60 * 1000
);
const proxyTimeoutMs = readPositiveIntegerEnv("PROXY_TIMEOUT_MS", 10 * 60 * 1000);
const gatewayRestartBaseDelayMs = readPositiveIntegerEnv(
  "GATEWAY_RESTART_BASE_DELAY_MS",
  1000
);
const gatewayRestartMaxDelayMs = readPositiveIntegerEnv(
  "GATEWAY_RESTART_MAX_DELAY_MS",
  30000
);

if (!token) {
  console.error("MCP_INTERNAL_TOKEN is required");
  process.exit(1);
}

const sessions = new Map();

function readPositiveIntegerEnv(name, defaultValue) {
  const value = Number(process.env[name]);

  if (!Number.isFinite(value) || value <= 0) {
    return defaultValue;
  }

  return Math.floor(value);
}

function pruneStaleSessions(now = Date.now()) {
  let pruned = 0;

  for (const [sessionId, session] of sessions) {
    if (session.bootstrap) {
      continue;
    }

    if (now - session.lastUsedAt > sessionTtlMs) {
      sessions.delete(sessionId);
      pruned += 1;
    }
  }

  if (pruned > 0) {
    console.log(`Pruned ${pruned} stale MCP session(s)`);
  }

  return pruned;
}

function pruneOldestSession() {
  let oldestSessionId = null;
  let oldestLastUsedAt = Infinity;

  for (const [sessionId, session] of sessions) {
    if (session.bootstrap) {
      continue;
    }

    if (session.lastUsedAt < oldestLastUsedAt) {
      oldestSessionId = sessionId;
      oldestLastUsedAt = session.lastUsedAt;
    }
  }

  if (!oldestSessionId) {
    return false;
  }

  sessions.delete(oldestSessionId);
  console.warn(`Pruned oldest MCP session after reaching MAX_SESSIONS`);
  return true;
}

function ensureSessionCapacity() {
  pruneStaleSessions();

  while (sessions.size >= maxSessions) {
    if (!pruneOldestSession()) {
      return false;
    }
  }

  return true;
}

function createSharedSession({ sessionId, userId, workflowRunId, bootstrap }) {
  const now = Date.now();
  const existing = sessions.get(sessionId);

  if (!existing && !ensureSessionCapacity()) {
    return false;
  }

  sessions.set(sessionId, {
    sessionId,
    userId,
    workflowRunId,
    bootstrap,
    createdAt: existing?.createdAt || now,
    lastUsedAt: now,
  });

  return true;
}

function bootstrapDefaultSession() {
  createSharedSession({
    sessionId: defaultSessionId,
    userId: "shared",
    workflowRunId: "shared-bootstrap",
    bootstrap: true,
  });
}

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

bootstrapDefaultSession();

const cleanupTimer = setInterval(() => {
  pruneStaleSessions();
}, sessionCleanupIntervalMs);
cleanupTimer.unref();

console.log("Starting stateful supergateway...");
console.log(`Internal gateway port: ${internalPort}`);
console.log(`Default shared session: ${defaultSessionId}`);
console.log(`Session limit: ${maxSessions}; TTL: ${sessionTtlMs}ms`);
console.log(`MCP transport session timeout: ${mcpSessionTimeoutMs}ms`);
console.log(`Proxy timeout: ${proxyTimeoutMs}ms`);

let gateway = null;
let gatewayRestartAttempt = 0;
let gatewayRestartTimer = null;
let gatewayStableTimer = null;
let shuttingDown = false;

function startGateway() {
  const child = spawn(
    npxCommand,
    [
      "supergateway",
      "--stdio",
      "uv run src/main.py",
      "--outputTransport",
      "streamableHttp",
      "--stateful",
      "--sessionTimeout",
      String(mcpSessionTimeoutMs),
      "--port",
      String(internalPort),
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    }
  );
  gateway = child;

  console.log(`supergateway started. pid=${child.pid}`);

  clearTimeout(gatewayStableTimer);
  gatewayStableTimer = setTimeout(() => {
    gatewayRestartAttempt = 0;
  }, 30000);
  gatewayStableTimer.unref();

  child.on("exit", (code, signal) => {
    console.error(`supergateway exited. code=${code}, signal=${signal}`);
    clearTimeout(gatewayStableTimer);

    if (gateway === child) {
      gateway = null;
    }

    if (shuttingDown) {
      return;
    }

    if (!gatewayRestartTimer) {
      scheduleGatewayRestart();
    }
  });

  child.on("error", (error) => {
    console.error(`supergateway failed to start: ${error.message}`);
    clearTimeout(gatewayStableTimer);

    if (gateway === child) {
      gateway = null;
    }

    if (shuttingDown) {
      return;
    }

    if (!gatewayRestartTimer) {
      scheduleGatewayRestart();
    }
  });
}

function scheduleGatewayRestart() {
  gatewayRestartAttempt += 1;

  const delay = Math.min(
    gatewayRestartBaseDelayMs * 2 ** (gatewayRestartAttempt - 1),
    gatewayRestartMaxDelayMs
  );

  console.warn(
    `Restarting supergateway in ${delay}ms (attempt ${gatewayRestartAttempt})`
  );

  gatewayRestartTimer = setTimeout(() => {
    gatewayRestartTimer = null;
    startGateway();
  }, delay);

  gatewayRestartTimer.unref();
}

startGateway();

const app = express();
app.set("trust proxy", true);

function getBaseUrl(req) {
  return process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
}

function toMb(bytes) {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}

function getNodeMemoryUsage() {
  const usage = process.memoryUsage();

  return {
    rss_mb: toMb(usage.rss),
    heap_used_mb: toMb(usage.heapUsed),
    heap_total_mb: toMb(usage.heapTotal),
    external_mb: toMb(usage.external),
    array_buffers_mb: toMb(usage.arrayBuffers),
  };
}

app.get("/", (_req, res) => {
  res.redirect(302, "/docs");
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "systrade-qc-mcp-gateway",
    mode: "stateful-streamable-http",
    active_sessions: sessions.size,
    max_sessions: maxSessions,
    session_ttl_ms: sessionTtlMs,
    mcp_session_timeout_ms: mcpSessionTimeoutMs,
    proxy_timeout_ms: proxyTimeoutMs,
    default_session_id: defaultSessionId,
    gateway_pid: gateway?.pid || null,
    gateway_running: Boolean(gateway),
    gateway_restart_attempt: gatewayRestartAttempt,
    node_memory: getNodeMemoryUsage(),
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

    const created = createSharedSession({
      sessionId: session_id,
      userId: user_id,
      workflowRunId: workflow_run_id,
      bootstrap: false,
    });

    if (!created) {
      return res.status(429).json({
        error: "session limit reached",
        max_sessions: maxSessions,
      });
    }

    res.json({
      status: "created",
      session_id,
      mode: "stateful-mcp-transport",
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
  (_req, res, next) => {
    if (!gateway) {
      return res.status(503).json({
        error: "MCP gateway is restarting",
      });
    }

    next();
  },
  createProxyMiddleware({
    target: `http://127.0.0.1:${internalPort}`,
    changeOrigin: true,
    ws: true,
    proxyTimeout: proxyTimeoutMs,
    timeout: proxyTimeoutMs,
    pathRewrite: () => "/mcp",
    on: {
      error(error, _req, res) {
        console.error(`MCP proxy error: ${error.message}`);

        if (!res) {
          return;
        }

        if (!res.headersSent) {
          res.writeHead(502, { "Content-Type": "application/json" });
        }

        res.end(JSON.stringify({ error: "MCP gateway proxy error" }));
      },
    },
  })
);

process.on("SIGTERM", () => {
  console.log("Received SIGTERM. Stopping supergateway...");
  shuttingDown = true;
  clearTimeout(gatewayRestartTimer);
  clearTimeout(gatewayStableTimer);
  gateway?.kill("SIGTERM");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Received SIGINT. Stopping supergateway...");
  shuttingDown = true;
  clearTimeout(gatewayRestartTimer);
  clearTimeout(gatewayStableTimer);
  gateway?.kill("SIGINT");
  process.exit(0);
});

app.listen(externalPort, "0.0.0.0", () => {
  console.log(`Session-ready auth proxy listening on 0.0.0.0:${externalPort}`);
});
