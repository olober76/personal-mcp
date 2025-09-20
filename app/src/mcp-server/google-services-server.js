import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class GoogleServicesMCP {
  constructor() {
    this.auth = null;
    this.gmail = null;
    this.calendar = null;

    // Initialize MCP Server
    this.server = new Server(
      {
        name: "google-services-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "get_recent_emails",
            description: "Get Gmail emails from the last 24 hours",
            inputSchema: {
              type: "object",
              properties: {
                maxResults: {
                  type: "number",
                  description: "Maximum number of emails to fetch",
                  default: 50,
                },
              },
            },
          },
          {
            name: "get_upcoming_events",
            description: "Get Google Calendar events for the next week",
            inputSchema: {
              type: "object",
              properties: {
                days: {
                  type: "number",
                  description: "Number of days to look ahead",
                  default: 7,
                },
              },
            },
          },
          {
            name: "search_web_insights",
            description: "Search web for insights related to events or topics",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query",
                },
                context: {
                  type: "string",
                  description: "Additional context for the search",
                },
              },
              required: ["query"],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "get_recent_emails":
            return await this.getRecentEmails(args);
          case "get_upcoming_events":
            return await this.getUpcomingEvents(args);
          case "search_web_insights":
            return await this.searchWebInsights(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error executing tool ${name}: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  async initializeAuth() {
    try {
      // Load credentials from environment or file
      const credentialsPath = path.join(
        __dirname,
        "../config/credentials.json"
      );
      const tokenPath = path.join(__dirname, "../config/token.json");

      let credentials;
      try {
        const credentialsContent = await fs.readFile(credentialsPath, "utf8");
        credentials = JSON.parse(credentialsContent);
      } catch (error) {
        throw new Error(
          "Google credentials not found. Please set up credentials.json"
        );
      }

      const { client_secret, client_id, redirect_uris } =
        credentials.installed || credentials.web;

      this.auth = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0]
      );

      // Try to load existing token
      try {
        const token = JSON.parse(await fs.readFile(tokenPath, "utf8"));
        this.auth.setCredentials(token);
      } catch (error) {
        console.log("No existing token found. Authentication needed.");
        return false;
      }

      // Initialize Gmail and Calendar clients
      this.gmail = google.gmail({ version: "v1", auth: this.auth });
      this.calendar = google.calendar({ version: "v3", auth: this.auth });

      return true;
    } catch (error) {
      console.error("Failed to initialize Google Auth:", error.message);
      return false;
    }
  }

  async getRecentEmails(args = {}) {
    if (!this.auth) {
      const initialized = await this.initializeAuth();
      if (!initialized) {
        return {
          content: [
            {
              type: "text",
              text: "Google authentication not configured. Please set up credentials and token.",
            },
          ],
        };
      }
    }

    try {
      const maxResults = args.maxResults || 50;

      // Calculate 24 hours ago
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const query = `after:${Math.floor(yesterday.getTime() / 1000)}`;

      // Get message IDs
      const listResponse = await this.gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: maxResults,
      });

      if (!listResponse.data.messages) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                emails: [],
                count: 0,
                message: "No emails found in the last 24 hours",
              }),
            },
          ],
        };
      }

      // Get detailed message info (limit to 10 for performance)
      const emails = [];
      const messagesToProcess = listResponse.data.messages.slice(0, 10);

      for (const message of messagesToProcess) {
        try {
          const msgResponse = await this.gmail.users.messages.get({
            userId: "me",
            id: message.id,
            format: "full",
          });

          const msg = msgResponse.data;
          const headers = msg.payload.headers;

          const email = {
            id: msg.id,
            subject:
              headers.find((h) => h.name === "Subject")?.value || "No Subject",
            from: headers.find((h) => h.name === "From")?.value || "Unknown",
            date: headers.find((h) => h.name === "Date")?.value || "",
            snippet: msg.snippet,
            body: this.extractEmailBody(msg.payload),
          };

          emails.push(email);
        } catch (error) {
          console.error("Error processing email:", error.message);
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              emails: emails,
              count: emails.length,
              totalFound: listResponse.data.messages.length,
            }),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
            }),
          },
        ],
      };
    }
  }

  async getUpcomingEvents(args = {}) {
    if (!this.auth) {
      const initialized = await this.initializeAuth();
      if (!initialized) {
        return {
          content: [
            {
              type: "text",
              text: "Google authentication not configured. Please set up credentials and token.",
            },
          ],
        };
      }
    }

    try {
      const days = args.days || 7;

      const now = new Date();
      const endDate = new Date();
      endDate.setDate(now.getDate() + days);

      const response = await this.calendar.events.list({
        calendarId: "primary",
        timeMin: now.toISOString(),
        timeMax: endDate.toISOString(),
        maxResults: 50,
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = response.data.items.map((event) => ({
        id: event.id,
        title: event.summary || "No Title",
        description: event.description || "",
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        location: event.location || "",
        attendees: event.attendees?.map((a) => a.email) || [],
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              events: events,
              count: events.length,
            }),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
            }),
          },
        ],
      };
    }
  }

  async searchWebInsights(args) {
    // Simple web search simulation - in production, integrate with Google Custom Search API
    const query = args.query;
    const context = args.context || "";

    try {
      // For now, return a mock response
      // In production, you would integrate with Google Custom Search API
      const mockResults = [
        {
          title: `Insights for: ${query}`,
          link: "https://example.com",
          snippet: `Based on your search for "${query}", here are some general insights and recommendations.`,
        },
      ];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              results: mockResults,
              query: query,
              context: context,
              note: "Web search integration requires Google Custom Search API setup",
            }),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
            }),
          },
        ],
      };
    }
  }

  extractEmailBody(payload) {
    let body = "";

    if (payload.body && payload.body.data) {
      body = Buffer.from(payload.body.data, "base64").toString("utf-8");
    } else if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === "text/plain" && part.body && part.body.data) {
          body = Buffer.from(part.body.data, "base64").toString("utf-8");
          break;
        }
      }
    }

    // Clean and limit body length
    return body.replace(/\n+/g, " ").substring(0, 500);
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log("Google Services MCP Server started");
  }
}

// Start the server
const mcpServer = new GoogleServicesMCP();
mcpServer.start().catch(console.error);
