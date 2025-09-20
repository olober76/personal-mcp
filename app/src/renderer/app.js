class GmailCalendarAssistant {
  constructor() {
    this.currentScreen = "welcome";
    this.emailData = null;
    this.calendarData = null;
    this.configStatus = null;

    this.initializeEventListeners();
    this.checkConfiguration();
  }

  initializeEventListeners() {
    // Welcome screen
    document.getElementById("getStartedBtn").addEventListener("click", () => {
      this.showScreen("dashboard");
      this.loadDashboardData();
    });

    // Dashboard navigation
    document.getElementById("emailSummaryApp").addEventListener("click", () => {
      this.launchEmailSummary();
    });

    document
      .getElementById("calendarAnalysisApp")
      .addEventListener("click", () => {
        this.launchCalendarAnalysis();
      });

    document.getElementById("configBtn").addEventListener("click", () => {
      this.showConfigModal();
    });

    // Email screen
    document
      .getElementById("backFromEmailBtn")
      .addEventListener("click", () => {
        this.showScreen("dashboard");
      });

    document.getElementById("refreshEmailBtn").addEventListener("click", () => {
      this.loadEmailSummary();
    });

    document.getElementById("retryEmailBtn").addEventListener("click", () => {
      this.loadEmailSummary();
    });

    // Calendar screen
    document
      .getElementById("backFromCalendarBtn")
      .addEventListener("click", () => {
        this.showScreen("dashboard");
      });

    document
      .getElementById("refreshCalendarBtn")
      .addEventListener("click", () => {
        this.loadCalendarAnalysis();
      });

    document
      .getElementById("retryCalendarBtn")
      .addEventListener("click", () => {
        this.loadCalendarAnalysis();
      });

    // Configuration modal
    document.getElementById("closeConfigBtn").addEventListener("click", () => {
      this.hideConfigModal();
    });

    document
      .getElementById("selectCredentialsBtn")
      .addEventListener("click", () => {
        this.selectCredentialsFile();
      });

    // Close modal on backdrop click
    document.getElementById("configModal").addEventListener("click", (e) => {
      if (e.target.id === "configModal") {
        this.hideConfigModal();
      }
    });
  }

  showScreen(screenName) {
    // Hide all screens
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.remove("active");
    });

    // Show target screen
    document.getElementById(`${screenName}Screen`).classList.add("active");
    this.currentScreen = screenName;
  }

  async checkConfiguration() {
    try {
      this.configStatus = await window.electronAPI.checkConfigStatus();
      this.updateConfigurationStatus();
    } catch (error) {
      console.error("Error checking configuration:", error);
    }
  }

  updateConfigurationStatus() {
    const { hasCredentials, hasToken, hasGroqApi, configured } =
      this.configStatus;

    // Update Groq status
    const groqStatus = document.getElementById("groqStatus");
    const groqDot = groqStatus.querySelector(".status-dot");
    const groqText = groqStatus.querySelector(".status-text");

    if (hasGroqApi) {
      groqDot.className = "status-dot connected";
      groqText.textContent = "Connected";
    } else {
      groqDot.className = "status-dot error";
      groqText.textContent = "Not configured";
    }

    // Update Gmail status
    const gmailStatus = document.getElementById("gmailStatus");
    const gmailDot = gmailStatus.querySelector(".status-dot");
    const gmailText = gmailStatus.querySelector(".status-text");

    if (hasCredentials && hasToken) {
      gmailDot.className = "status-dot connected";
      gmailText.textContent = "Connected";
    } else if (hasCredentials) {
      gmailDot.className = "status-dot";
      gmailText.textContent = "Needs auth";
    } else {
      gmailDot.className = "status-dot error";
      gmailText.textContent = "Not configured";
    }

    // Update Calendar status (same as Gmail)
    const calendarStatus = document.getElementById("calendarStatus");
    const calendarDot = calendarStatus.querySelector(".status-dot");
    const calendarText = calendarStatus.querySelector(".status-text");

    if (hasCredentials && hasToken) {
      calendarDot.className = "status-dot connected";
      calendarText.textContent = "Connected";
    } else if (hasCredentials) {
      calendarDot.className = "status-dot";
      calendarText.textContent = "Needs auth";
    } else {
      calendarDot.className = "status-dot error";
      calendarText.textContent = "Not configured";
    }

    // Update modal configuration status
    if (document.getElementById("credentialsStatus")) {
      const credentialsStatus = document.getElementById("credentialsStatus");
      if (hasCredentials && hasToken) {
        credentialsStatus.textContent = "Configured";
        credentialsStatus.className = "config-status success";
      } else if (hasCredentials) {
        credentialsStatus.textContent = "Needs authentication";
        credentialsStatus.className = "config-status";
      } else {
        credentialsStatus.textContent = "Not configured";
        credentialsStatus.className = "config-status error";
      }
    }

    if (document.getElementById("groqApiStatus")) {
      const groqApiStatus = document.getElementById("groqApiStatus");
      if (hasGroqApi) {
        groqApiStatus.textContent = "Configured";
        groqApiStatus.className = "config-status success";
      } else {
        groqApiStatus.textContent = "Not configured";
        groqApiStatus.className = "config-status error";
      }
    }
  }

  async loadDashboardData() {
    // Load email count
    try {
      const emailResult = await window.electronAPI.getRecentEmails(10);
      if (emailResult.success) {
        document.getElementById(
          "emailCount"
        ).textContent = `${emailResult.count} emails`;
      } else {
        document.getElementById("emailCount").textContent =
          "Check configuration";
      }
    } catch (error) {
      document.getElementById("emailCount").textContent = "Error loading";
    }

    // Load event count
    try {
      const calendarResult = await window.electronAPI.getUpcomingEvents(7);
      if (calendarResult.success) {
        document.getElementById(
          "eventCount"
        ).textContent = `${calendarResult.count} events`;
      } else {
        document.getElementById("eventCount").textContent =
          "Check configuration";
      }
    } catch (error) {
      document.getElementById("eventCount").textContent = "Error loading";
    }
  }

  async launchEmailSummary() {
    this.showScreen("email");
    await this.loadEmailSummary();
  }

  async loadEmailSummary() {
    const loadingSection = document.getElementById("emailLoading");
    const summarySection = document.getElementById("emailSummary");
    const errorSection = document.getElementById("emailError");

    // Show loading, hide others
    loadingSection.style.display = "flex";
    summarySection.style.display = "none";
    errorSection.style.display = "none";

    try {
      // Get emails from last 24 hours
      const emailResult = await window.electronAPI.getRecentEmails(50);

      if (!emailResult.success) {
        throw new Error(emailResult.error || "Failed to fetch emails");
      }

      this.emailData = emailResult;

      if (emailResult.emails.length === 0) {
        // No emails found
        loadingSection.style.display = "none";
        summarySection.style.display = "block";

        document.getElementById("emailSummaryContent").textContent =
          "No emails found in the last 24 hours. Your inbox is clean! 📧✨";
        document.getElementById("emailList").innerHTML =
          '<div class="email-item"><h4>No emails to display</h4></div>';
        return;
      }

      // Get AI summary
      const summaryResult = await window.electronAPI.summarizeEmails(
        emailResult.emails
      );

      if (!summaryResult.success) {
        throw new Error(summaryResult.error || "Failed to generate summary");
      }

      // Display results
      loadingSection.style.display = "none";
      summarySection.style.display = "block";

      // Display AI summary
      document.getElementById("emailSummaryContent").textContent =
        summaryResult.summary;

      // Display email list
      this.displayEmailList(emailResult.emails);
    } catch (error) {
      console.error("Error loading email summary:", error);

      loadingSection.style.display = "none";
      errorSection.style.display = "block";

      document.getElementById("emailErrorMessage").textContent = error.message;
    }
  }

  displayEmailList(emails) {
    const emailList = document.getElementById("emailList");
    emailList.innerHTML = "";

    emails.forEach((email) => {
      const emailItem = document.createElement("div");
      emailItem.className = "email-item";

      emailItem.innerHTML = `
                <h4>${this.escapeHtml(email.subject)}</h4>
                <div class="email-meta">
                    <span><strong>From:</strong> ${this.escapeHtml(
                      email.from
                    )}</span>
                    <span><strong>Date:</strong> ${new Date(
                      email.date
                    ).toLocaleDateString()}</span>
                </div>
                <div class="email-snippet">${this.escapeHtml(
                  email.snippet || "No preview available"
                )}</div>
            `;

      emailList.appendChild(emailItem);
    });
  }

  async launchCalendarAnalysis() {
    this.showScreen("calendar");
    await this.loadCalendarAnalysis();
  }

  async loadCalendarAnalysis() {
    const loadingSection = document.getElementById("calendarLoading");
    const analysisSection = document.getElementById("calendarAnalysis");
    const errorSection = document.getElementById("calendarError");

    // Show loading, hide others
    loadingSection.style.display = "flex";
    analysisSection.style.display = "none";
    errorSection.style.display = "none";

    try {
      // Get upcoming events
      const calendarResult = await window.electronAPI.getUpcomingEvents(7);

      if (!calendarResult.success) {
        throw new Error(calendarResult.error || "Failed to fetch events");
      }

      this.calendarData = calendarResult;

      if (calendarResult.events.length === 0) {
        // No events found
        loadingSection.style.display = "none";
        analysisSection.style.display = "block";

        document.getElementById("calendarAnalysisContent").textContent =
          "No upcoming events found in your calendar for the next week. Enjoy your free time! 📅✨";
        document.getElementById("eventsList").innerHTML =
          '<div class="event-item"><h4>No events to display</h4></div>';
        return;
      }

      // Get AI analysis
      const analysisResult = await window.electronAPI.analyzeCalendar(
        calendarResult.events
      );

      if (!analysisResult.success) {
        throw new Error(analysisResult.error || "Failed to generate analysis");
      }

      // Display results
      loadingSection.style.display = "none";
      analysisSection.style.display = "block";

      // Display AI analysis
      document.getElementById("calendarAnalysisContent").textContent =
        analysisResult.analysis;

      // Display events list
      this.displayEventsList(calendarResult.events);
    } catch (error) {
      console.error("Error loading calendar analysis:", error);

      loadingSection.style.display = "none";
      errorSection.style.display = "block";

      document.getElementById("calendarErrorMessage").textContent =
        error.message;
    }
  }

  displayEventsList(events) {
    const eventsList = document.getElementById("eventsList");
    eventsList.innerHTML = "";

    events.forEach((event) => {
      const eventItem = document.createElement("div");
      eventItem.className = "event-item";

      const startTime = new Date(event.start);
      const endTime = event.end ? new Date(event.end) : null;

      eventItem.innerHTML = `
                <h4>${this.escapeHtml(event.title)}</h4>
                <div class="event-meta">
                    <span><strong>Start:</strong> ${startTime.toLocaleString()}</span>
                    ${
                      endTime
                        ? `<span><strong>End:</strong> ${endTime.toLocaleString()}</span>`
                        : ""
                    }
                    ${
                      event.location
                        ? `<span><strong>Location:</strong> ${this.escapeHtml(
                            event.location
                          )}</span>`
                        : ""
                    }
                </div>
                ${
                  event.description
                    ? `<div class="event-description">${this.escapeHtml(
                        event.description
                      )}</div>`
                    : ""
                }
            `;

      eventsList.appendChild(eventItem);
    });
  }

  showConfigModal() {
    document.getElementById("configModal").classList.add("active");
    this.updateConfigurationStatus();
  }

  hideConfigModal() {
    document.getElementById("configModal").classList.remove("active");
  }

  async selectCredentialsFile() {
    try {
      const result = await window.electronAPI.selectCredentialsFile();

      if (result.success) {
        alert(
          "Credentials file saved successfully! Please restart the application and complete OAuth authentication."
        );
        // Refresh configuration status
        await this.checkConfiguration();
      } else {
        alert("Error: " + result.error);
      }
    } catch (error) {
      console.error("Error selecting credentials file:", error);
      alert("Error selecting credentials file: " + error.message);
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Utility methods
  showNotification(message, type = "info") {
    // Simple notification - could be enhanced with toast library
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;

    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${
              type === "success"
                ? "#4caf50"
                : type === "error"
                ? "#f44336"
                : "#2196f3"
            };
            color: white;
            padding: 1rem 2rem;
            border-radius: 8px;
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = "slideOutRight 0.3s ease";
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  formatDate(dateString) {
    return new Date(dateString).toLocaleString();
  }

  formatFileSize(bytes) {
    const sizes = ["Bytes", "KB", "MB", "GB"];
    if (bytes === 0) return "0 Byte";
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  }
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  const app = new GmailCalendarAssistant();

  // Make app globally accessible for debugging
  window.app = app;

  console.log("Gmail Calendar Assistant initialized");
});

// Add CSS animations for notifications
const style = document.createElement("style");
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
