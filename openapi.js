const DEFAULT_SESSION_ID = process.env.DEFAULT_SESSION_ID || "systradeapp-shared";

function createOpenApiSpec(baseUrl) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Systrade QuantConnect MCP Gateway",
      version: "0.1.0",
      description:
        "Session-ready authenticated gateway for the QuantConnect MCP server.",
    },
    servers: [
      {
        url: baseUrl,
      },
    ],
    tags: [
      {
        name: "Health",
        description: "Public service status endpoint.",
      },
      {
        name: "Sessions",
        description: "Authenticated MCP session lifecycle endpoints.",
      },
      {
        name: "MCP",
        description: "Authenticated JSON-RPC MCP proxy endpoint.",
      },
    ],
    paths: {
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Check service health",
          operationId: "getHealth",
          responses: {
            200: {
              description: "Gateway is running.",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/HealthResponse",
                  },
                  examples: {
                    ok: {
                      value: {
                        status: "ok",
                        service: "systrade-qc-mcp-gateway",
                        mode: "shared-session-ready",
                        active_sessions: 1,
                        max_sessions: 100,
                        session_ttl_ms: 86400000,
                        default_session_id: DEFAULT_SESSION_ID,
                        gateway_pid: 42,
                        node_memory: {
                          rss_mb: 72.4,
                          heap_used_mb: 12.1,
                          heap_total_mb: 18.6,
                          external_mb: 2.4,
                          array_buffers_mb: 0.2,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/sessions": {
        post: {
          tags: ["Sessions"],
          summary: "Create or replace an MCP session",
          operationId: "createSession",
          security: [
            {
              bearerAuth: [],
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CreateSessionRequest",
                },
                examples: {
                  local: {
                    value: {
                      session_id: "custom-shared-session-1",
                      user_id: "render-user-1",
                      workflow_run_id: "render-workflow-1",
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Session was created.",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/CreateSessionResponse",
                  },
                },
              },
            },
            401: {
              $ref: "#/components/responses/Unauthorized",
            },
            422: {
              $ref: "#/components/responses/ValidationError",
            },
            429: {
              description: "Session limit was reached.",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                  examples: {
                    sessionLimit: {
                      value: {
                        error: "session limit reached",
                        max_sessions: 100,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/sessions/{sessionId}": {
        delete: {
          tags: ["Sessions"],
          summary: "Delete an MCP session",
          operationId: "deleteSession",
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: "sessionId",
              in: "path",
              required: true,
              schema: {
                type: "string",
              },
              example: DEFAULT_SESSION_ID,
            },
          ],
          responses: {
            200: {
              description: "Session was deleted or did not exist.",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/DeleteSessionResponse",
                  },
                },
              },
            },
            401: {
              $ref: "#/components/responses/Unauthorized",
            },
          },
        },
      },
      "/sessions/{sessionId}/mcp": {
        post: {
          tags: ["MCP"],
          summary: "Send a JSON-RPC MCP message through a session",
          operationId: "postSessionMcpMessage",
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: "sessionId",
              in: "path",
              required: true,
              schema: {
                type: "string",
              },
              example: DEFAULT_SESSION_ID,
            },
            {
              name: "Accept",
              in: "header",
              required: false,
              schema: {
                type: "string",
                default: "application/json, text/event-stream",
              },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/JsonRpcMessage",
                },
                examples: {
                  initialize: {
                    value: {
                      jsonrpc: "2.0",
                      id: 1,
                      method: "initialize",
                      params: {
                        protocolVersion: "2025-03-26",
                        capabilities: {},
                        clientInfo: {
                          name: "render-test",
                          version: "0.1.0",
                        },
                      },
                    },
                  },
                  initialized: {
                    value: {
                      jsonrpc: "2.0",
                      method: "notifications/initialized",
                      params: {},
                    },
                  },
                  toolsList: {
                    value: {
                      jsonrpc: "2.0",
                      id: 2,
                      method: "tools/list",
                      params: {},
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "MCP response, often returned as server-sent events.",
              content: {
                "text/event-stream": {
                  schema: {
                    type: "string",
                    example:
                      'event: message\\ndata: {"jsonrpc":"2.0","id":1,"result":{}}\\n\\n',
                  },
                },
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/JsonRpcMessage",
                  },
                },
              },
            },
            202: {
              description: "Notification accepted.",
            },
            401: {
              $ref: "#/components/responses/Unauthorized",
            },
            404: {
              description: "Session was not found.",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                  examples: {
                    missingSession: {
                      value: {
                        error: "MCP session not found",
                        session_id: "unknown-session",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "MCP_INTERNAL_TOKEN",
        },
      },
      responses: {
        Unauthorized: {
          description: "Bearer token is missing or invalid.",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ErrorResponse",
              },
              examples: {
                unauthorized: {
                  value: {
                    error: "Unauthorized",
                  },
                },
              },
            },
          },
        },
        ValidationError: {
          description: "Required request field is missing.",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ErrorResponse",
              },
              examples: {
                missingSessionId: {
                  value: {
                    error: "session_id is required",
                  },
                },
              },
            },
          },
        },
      },
      schemas: {
        HealthResponse: {
          type: "object",
          required: [
            "status",
            "service",
            "mode",
            "active_sessions",
            "default_session_id",
          ],
          properties: {
            status: {
              type: "string",
              enum: ["ok"],
            },
            service: {
              type: "string",
              example: "systrade-qc-mcp-gateway",
            },
            mode: {
              type: "string",
              example: "shared-session-ready",
            },
            active_sessions: {
              type: "integer",
              minimum: 0,
              example: 1,
            },
            max_sessions: {
              type: "integer",
              minimum: 1,
              example: 100,
            },
            session_ttl_ms: {
              type: "integer",
              minimum: 1,
              example: 86400000,
            },
            default_session_id: {
              type: "string",
              description:
                "Auto-bootstrapped shared session id available immediately after service start.",
              example: DEFAULT_SESSION_ID,
            },
            gateway_pid: {
              type: "integer",
              minimum: 1,
              description: "Process id for the internal supergateway process.",
              example: 42,
            },
            node_memory: {
              type: "object",
              description:
                "Memory used by the Node.js gateway process. Render metrics remain the source of truth for total container memory.",
              required: [
                "rss_mb",
                "heap_used_mb",
                "heap_total_mb",
                "external_mb",
                "array_buffers_mb",
              ],
              properties: {
                rss_mb: {
                  type: "number",
                  example: 72.4,
                },
                heap_used_mb: {
                  type: "number",
                  example: 12.1,
                },
                heap_total_mb: {
                  type: "number",
                  example: 18.6,
                },
                external_mb: {
                  type: "number",
                  example: 2.4,
                },
                array_buffers_mb: {
                  type: "number",
                  example: 0.2,
                },
              },
            },
          },
        },
        CreateSessionRequest: {
          type: "object",
          required: ["session_id", "user_id", "workflow_run_id"],
          properties: {
            session_id: {
              type: "string",
              example: "custom-shared-session-1",
            },
            user_id: {
              type: "string",
              example: "render-user-1",
            },
            workflow_run_id: {
              type: "string",
              example: "render-workflow-1",
            },
          },
        },
        CreateSessionResponse: {
          type: "object",
          required: ["status", "session_id", "mode"],
          properties: {
            status: {
              type: "string",
              enum: ["created"],
            },
            session_id: {
              type: "string",
              example: "custom-shared-session-1",
            },
            mode: {
              type: "string",
              example: "shared-mcp-process",
            },
          },
        },
        DeleteSessionResponse: {
          type: "object",
          required: ["status", "session_id"],
          properties: {
            status: {
              type: "string",
              enum: ["deleted"],
            },
            session_id: {
              type: "string",
              example: DEFAULT_SESSION_ID,
            },
          },
        },
        JsonRpcMessage: {
          type: "object",
          required: ["jsonrpc"],
          additionalProperties: true,
          properties: {
            jsonrpc: {
              type: "string",
              enum: ["2.0"],
            },
            id: {
              oneOf: [
                {
                  type: "string",
                },
                {
                  type: "integer",
                },
              ],
            },
            method: {
              type: "string",
              example: "tools/list",
            },
            params: {
              type: "object",
              additionalProperties: true,
            },
            result: {
              type: "object",
              additionalProperties: true,
            },
            error: {
              type: "object",
              additionalProperties: true,
            },
          },
        },
        ErrorResponse: {
          type: "object",
          required: ["error"],
          additionalProperties: true,
          properties: {
            error: {
              type: "string",
            },
          },
        },
      },
    },
  };
}

function createSwaggerHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Systrade QC MCP Gateway Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body {
        margin: 0;
        background: #fafafa;
      }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
    <script>
      window.addEventListener("load", () => {
        SwaggerUIBundle({
          url: "/openapi.json",
          dom_id: "#swagger-ui",
          deepLinking: true,
          persistAuthorization: true,
          displayRequestDuration: true
        });
      });
    </script>
  </body>
</html>`;
}

module.exports = {
  createOpenApiSpec,
  createSwaggerHtml,
};
