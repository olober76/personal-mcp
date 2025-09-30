const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs").promises;
require("dotenv").config({ path: path.join(__dirname, "../..", ".env") });

let mainWindow;
let mcpProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "../assets/icon.png"),
    titleBarStyle: "default",
    show: false, // Don't show until ready
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  // Show window when ready
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Start MCP server
  startMCPServer();

  // Handle window closed
  mainWindow.on("closed", () => {
    mainWindow = null;
    if (mcpProcess) {
      mcpProcess.kill();
    }
  });
}

function startMCPServer() {
  try {
    // Switch between servers as needed:
    // const serverPath = path.join(__dirname, "mcp-server", "echo_test_server.py"); // Test server
    const serverPath = path.join(
      __dirname,
      "mcp-server",
      "google_services_server.py"
    ); // Production server

    mcpProcess = spawn("python", [serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    let serverReady = false;

    mcpProcess.stdout.on("data", (data) => {
      const output = data.toString();
      console.log("MCP Server:", output);
    });

    mcpProcess.stderr.on("data", (data) => {
      const output = data.toString();
      console.error("MCP Server Error:", output);

      // Check if server is ready - FastMCP outputs to stderr
      if (
        (output.includes("FastMCP") ||
          output.includes("Starting MCP server")) &&
        (output.includes("Server name") ||
          output.includes("Echo Test Server") ||
          output.includes("Simple Test Server"))
      ) {
        setTimeout(async () => {
          await initializeMCPServer();
          serverReady = true;
          console.log("✅ MCP Server is ready for requests");
        }, 2000); // Wait 2 seconds after seeing the banner
      }
    });

    mcpProcess.on("error", (error) => {
      console.error("Failed to start Python MCP server:", error);
    });

    mcpProcess.on("close", (code) => {
      console.log(`MCP Server process exited with code ${code}`);
      mcpProcess = null;
    });

    console.log("Python MCP Server started with PID:", mcpProcess.pid);

    // Store server ready status
    mcpProcess.isReady = () => serverReady;
  } catch (error) {
    console.error("Error starting MCP server:", error);
  }
}

// Initialize MCP Server with proper protocol
async function initializeMCPServer() {
  return new Promise((resolve, reject) => {
    if (!mcpProcess) {
      reject(new Error("MCP server not running"));
      return;
    }

    const initRequest = {
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
        },
        clientInfo: {
          name: "gmail-calendar-assistant",
          version: "1.0.0",
        },
      },
    };

    let responseData = "";
    const timeout = setTimeout(() => {
      reject(new Error("MCP initialization timeout"));
    }, 10000);

    const dataHandler = (data) => {
      responseData += data.toString();

      try {
        const lines = responseData.split("\n");
        for (let line of lines) {
          line = line.trim();
          if (!line) continue;

          const response = JSON.parse(line);
          if (response.id === 0) {
            clearTimeout(timeout);
            mcpProcess.stdout.removeListener("data", dataHandler);

            // Send initialized notification
            const initNotification = {
              jsonrpc: "2.0",
              method: "notifications/initialized",
            };

            mcpProcess.stdin.write(JSON.stringify(initNotification) + "\n");
            console.log("✅ MCP Server initialized successfully");
            resolve();
            return;
          }
        }
      } catch (e) {
        // Continue accumulating data
      }
    };

    mcpProcess.stdout.on("data", dataHandler);
    mcpProcess.stdin.write(JSON.stringify(initRequest) + "\n");
  });
}

// MCP Communication Helper
async function callMCPTool(toolName, params = {}) {
  return new Promise(async (resolve, reject) => {
    if (!mcpProcess) {
      reject(new Error("MCP server not running"));
      return;
    }

    // Wait for server to be ready
    let attempts = 0;
    const maxAttempts = 15; // 7.5 seconds max
    while (!mcpProcess.isReady() && attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 500));
      attempts++;
      if (attempts % 5 === 0) {
        console.log(`Waiting for MCP server... (${attempts}/${maxAttempts})`);
      }
    }

    if (!mcpProcess.isReady()) {
      console.error(
        "MCP server still not ready after waiting. Server status:",
        !!mcpProcess
      );
      reject(
        new Error("MCP server not ready - timeout waiting for initialization")
      );
      return;
    }

    console.log(`🚀 MCP server ready! Making ${toolName} call...`);

    const request = {
      jsonrpc: "2.0",
      id: Date.now() + Math.floor(Math.random() * 1000),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: params,
      },
    };

    let responseData = "";
    let isComplete = false;

    const timeout = setTimeout(() => {
      if (!isComplete) {
        isComplete = true;
        mcpProcess.stdout.removeListener("data", dataHandler);
        reject(new Error("MCP call timeout"));
      }
    }, 45000); // Increase timeout

    const dataHandler = (data) => {
      if (isComplete) return;

      responseData += data.toString();

      // Try to parse each line as JSON (FastMCP sends line-delimited JSON)
      const lines = responseData.split("\n");

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        try {
          const response = JSON.parse(line);

          // Check if this is our response
          if (response.id === request.id) {
            isComplete = true;
            clearTimeout(timeout);
            mcpProcess.stdout.removeListener("data", dataHandler);

            if (response.error) {
              reject(
                new Error(
                  response.error.message ||
                    response.error.data ||
                    "Unknown MCP error"
                )
              );
            } else {
              // FastMCP v2 returns result directly
              resolve(response.result);
            }
            return;
          }
        } catch (parseError) {
          // Continue to next line
          continue;
        }
      }

      // Keep the last incomplete line
      responseData = lines[lines.length - 1];
    };

    mcpProcess.stdout.on("data", dataHandler);
    mcpProcess.stdin.write(JSON.stringify(request) + "\n");
  });
}

// IPC Handlers
ipcMain.handle("get-recent-emails", async (event, maxResults = 50) => {
  try {
    const result = await callMCPTool("get_recent_emails", { maxResults });
    // Extract structuredContent from MCP response
    if (result && result.structuredContent) {
      return result.structuredContent;
    }
    return result;
  } catch (error) {
    console.error("Error getting recent emails:", error);
    return {
      success: false,
      error: error.message,
    };
  }
});

ipcMain.handle("get-upcoming-events", async (event, days = 7) => {
  try {
    const result = await callMCPTool("get_upcoming_events", { days });
    // Extract structuredContent from MCP response
    if (result && result.structuredContent) {
      return result.structuredContent;
    }
    return result;
  } catch (error) {
    console.error("Error getting upcoming events:", error);
    return {
      success: false,
      error: error.message,
    };
  }
});

ipcMain.handle("search-web-insights", async (event, query, context = "") => {
  try {
    const result = await callMCPTool("search_web_insights", { query, context });
    // Extract structuredContent from MCP response
    if (result && result.structuredContent) {
      return result.structuredContent;
    }
    return result;
  } catch (error) {
    console.error("Error searching web insights:", error);
    return {
      success: false,
      error: error.message,
    };
  }
});

// Groq AI Handlers (now handled by Python MCP server)
ipcMain.handle("summarize-emails", async (event, emails) => {
  try {
    if (!emails || emails.length === 0) {
      return {
        success: false,
        error: "No emails to summarize",
      };
    }

    const result = await callMCPTool("summarize_emails_ai", { emails });
    // Extract structuredContent from MCP response
    if (result && result.structuredContent) {
      return result.structuredContent;
    }
    return result;
  } catch (error) {
    console.error("Error summarizing emails:", error);
    return {
      success: false,
      error: error.message,
    };
  }
});

ipcMain.handle("analyze-calendar", async (event, events) => {
  try {
    if (!events || events.length === 0) {
      return {
        success: false,
        error: "No events to analyze",
      };
    }

    const result = await callMCPTool("analyze_calendar_ai", { events });
    // Extract structuredContent from MCP response
    if (result && result.structuredContent) {
      return result.structuredContent;
    }
    return result;
  } catch (error) {
    console.error("Error analyzing calendar:", error);
    return {
      success: false,
      error: error.message,
    };
  }
});

// Configuration handlers
ipcMain.handle("select-credentials-file", async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Select Google API Credentials File",
      filters: [{ name: "JSON Files", extensions: ["json"] }],
      properties: ["openFile"],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const sourcePath = result.filePaths[0];
      const targetPath = path.join(__dirname, "config", "credentials.json");

      // Ensure config directory exists
      await fs.mkdir(path.join(__dirname, "config"), { recursive: true });

      // Copy file
      const content = await fs.readFile(sourcePath, "utf8");
      await fs.writeFile(targetPath, content);

      return {
        success: true,
        message: "Credentials file saved successfully",
      };
    }

    return {
      success: false,
      error: "No file selected",
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
});

ipcMain.handle("check-config-status", async () => {
  try {
    const credentialsPath = path.join(__dirname, "config", "credentials.json");
    const tokenPath = path.join(__dirname, "config", "token.json");

    const hasCredentials = await fs
      .access(credentialsPath)
      .then(() => true)
      .catch(() => false);
    const hasToken = await fs
      .access(tokenPath)
      .then(() => true)
      .catch(() => false);
    const hasGroqApi = !!process.env.GROQ_API_KEY;

    return {
      hasCredentials,
      hasToken,
      hasGroqApi,
      configured: hasCredentials && hasToken && hasGroqApi,
    };
  } catch (error) {
    return {
      hasCredentials: false,
      hasToken: false,
      hasGroqApi: !!process.env.GROQ_API_KEY,
      configured: false,
      error: error.message,
    };
  }
});

// App event handlers
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (mcpProcess) {
    mcpProcess.kill();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (mcpProcess) {
    mcpProcess.kill();
  }
});

// Handle app errors
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
