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
    mcpProcess = spawn(
      "python",
      [path.join(__dirname, "mcp-server", "google_services_server.py")],
      {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      }
    );

    mcpProcess.stdout.on("data", (data) => {
      console.log("MCP Server:", data.toString());
    });

    mcpProcess.stderr.on("data", (data) => {
      console.error("MCP Server Error:", data.toString());
    });

    mcpProcess.on("error", (error) => {
      console.error("Failed to start Python MCP server:", error);
    });

    console.log("Python MCP Server started with PID:", mcpProcess.pid);
  } catch (error) {
    console.error("Error starting MCP server:", error);
  }
}

// MCP Communication Helper
async function callMCPTool(toolName, params = {}) {
  return new Promise((resolve, reject) => {
    if (!mcpProcess) {
      reject(new Error("MCP server not running"));
      return;
    }

    const request = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: params,
      },
    };

    let responseData = "";

    const timeout = setTimeout(() => {
      reject(new Error("MCP call timeout"));
    }, 30000);

    const dataHandler = (data) => {
      responseData += data.toString();

      try {
        const response = JSON.parse(responseData);
        clearTimeout(timeout);
        mcpProcess.stdout.removeListener("data", dataHandler);

        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          const content = response.result?.content?.[0]?.text;
          if (content) {
            const parsedContent = JSON.parse(content);
            resolve(parsedContent);
          } else {
            resolve(response.result);
          }
        }
      } catch (parseError) {
        // Continue accumulating data
      }
    };

    mcpProcess.stdout.on("data", dataHandler);
    mcpProcess.stdin.write(JSON.stringify(request) + "\n");
  });
}

// IPC Handlers
ipcMain.handle("get-recent-emails", async (event, maxResults = 50) => {
  try {
    const result = await callMCPTool("get_recent_emails", { maxResults });
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
