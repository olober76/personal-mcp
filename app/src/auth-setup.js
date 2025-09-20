const { google } = require("googleapis");
const fs = require("fs").promises;
const path = require("path");
const readline = require("readline");

/**
 * Google OAuth Setup Helper
 * This script helps users set up Google API authentication
 */

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
];

const TOKEN_PATH = path.join(__dirname, "config", "token.json");
const CREDENTIALS_PATH = path.join(__dirname, "config", "credentials.json");

class GoogleAuthSetup {
  constructor() {
    this.oAuth2Client = null;
  }

  async initialize() {
    try {
      // Read credentials file
      const credentials = await this.loadCredentials();
      if (!credentials) {
        throw new Error(
          "Credentials file not found. Please set up credentials.json first."
        );
      }

      // Create OAuth2 client
      const { client_secret, client_id, redirect_uris } =
        credentials.installed || credentials.web;
      this.oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0]
      );

      console.log("✅ OAuth2 client initialized successfully");
      return true;
    } catch (error) {
      console.error("❌ Error initializing OAuth2 client:", error.message);
      return false;
    }
  }

  async loadCredentials() {
    try {
      const credentialsContent = await fs.readFile(CREDENTIALS_PATH, "utf8");
      return JSON.parse(credentialsContent);
    } catch (error) {
      console.error("❌ Could not read credentials file:", error.message);
      return null;
    }
  }

  async checkExistingToken() {
    try {
      const tokenContent = await fs.readFile(TOKEN_PATH, "utf8");
      const token = JSON.parse(tokenContent);

      this.oAuth2Client.setCredentials(token);
      console.log("✅ Existing token found and loaded");
      return true;
    } catch (error) {
      console.log("ℹ️  No existing token found, will create new one");
      return false;
    }
  }

  async generateAuthUrl() {
    const authUrl = this.oAuth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
    });

    console.log("\n🔗 Please visit this URL to authorize the application:");
    console.log("\n" + authUrl + "\n");
    return authUrl;
  }

  async getAccessToken() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve, reject) => {
      rl.question(
        "📝 Enter the authorization code from the webpage: ",
        async (code) => {
          rl.close();

          try {
            const { tokens } = await this.oAuth2Client.getToken(code);
            this.oAuth2Client.setCredentials(tokens);

            // Save token to file
            await fs.mkdir(path.dirname(TOKEN_PATH), { recursive: true });
            await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));

            console.log("✅ Token saved successfully to:", TOKEN_PATH);
            resolve(tokens);
          } catch (error) {
            console.error("❌ Error retrieving access token:", error.message);
            reject(error);
          }
        }
      );
    });
  }

  async testConnection() {
    try {
      console.log("\n🧪 Testing Gmail API connection...");
      const gmail = google.gmail({ version: "v1", auth: this.oAuth2Client });

      const profile = await gmail.users.getProfile({ userId: "me" });
      console.log(
        `✅ Gmail API test successful! Email: ${profile.data.emailAddress}`
      );

      console.log("\n🧪 Testing Calendar API connection...");
      const calendar = google.calendar({
        version: "v3",
        auth: this.oAuth2Client,
      });

      const calendars = await calendar.calendarList.list();
      console.log(
        `✅ Calendar API test successful! Found ${calendars.data.items.length} calendars`
      );

      return true;
    } catch (error) {
      console.error("❌ API test failed:", error.message);
      return false;
    }
  }

  async run() {
    console.log("🚀 Google API Authentication Setup\n");

    // Initialize OAuth client
    const initialized = await this.initialize();
    if (!initialized) {
      console.log("\n📋 Setup Instructions:");
      console.log("1. Go to https://console.cloud.google.com");
      console.log("2. Create a new project or select existing one");
      console.log("3. Enable Gmail API and Calendar API");
      console.log("4. Create OAuth 2.0 credentials for desktop application");
      console.log("5. Download the credentials.json file");
      console.log("6. Place it in the src/config/ directory");
      console.log("7. Run this script again\n");
      return;
    }

    // Check for existing token
    const hasExistingToken = await this.checkExistingToken();

    if (hasExistingToken) {
      console.log("ℹ️  Token already exists. Testing connection...");
      const testResult = await this.testConnection();

      if (testResult) {
        console.log("\n🎉 Authentication is already set up and working!");
        console.log("You can now run the main application with: npm start");
        return;
      } else {
        console.log("\n⚠️  Existing token seems invalid. Creating new one...");
      }
    }

    // Generate auth URL and get new token
    try {
      await this.generateAuthUrl();
      await this.getAccessToken();

      // Test the new connection
      const testResult = await this.testConnection();

      if (testResult) {
        console.log("\n🎉 Authentication setup completed successfully!");
        console.log("You can now run the main application with: npm start");
      } else {
        console.log(
          "\n⚠️  Setup completed but there might be issues. Please check your configuration."
        );
      }
    } catch (error) {
      console.error("\n❌ Setup failed:", error.message);
    }
  }
}

// Run the setup if this file is executed directly
if (require.main === module) {
  const setup = new GoogleAuthSetup();
  setup.run().catch(console.error);
}

module.exports = GoogleAuthSetup;
