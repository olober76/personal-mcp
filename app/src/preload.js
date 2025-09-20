const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // MCP Tools
  getRecentEmails: (maxResults) =>
    ipcRenderer.invoke("get-recent-emails", maxResults),

  getUpcomingEvents: (days) => ipcRenderer.invoke("get-upcoming-events", days),

  searchWebInsights: (query, context) =>
    ipcRenderer.invoke("search-web-insights", query, context),

  // Groq AI
  summarizeEmails: (emails) => ipcRenderer.invoke("summarize-emails", emails),

  analyzeCalendar: (events) => ipcRenderer.invoke("analyze-calendar", events),

  // Configuration
  selectCredentialsFile: () => ipcRenderer.invoke("select-credentials-file"),

  checkConfigStatus: () => ipcRenderer.invoke("check-config-status"),

  // Utility
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
});
