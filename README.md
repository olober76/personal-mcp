# MCP For Personal Use

---

AI-powered desktop application built with Electron, Fast MCP, and Groq AI for managing Gmail and Google Calendar.

## Features

- **Email Summary**: AI-powered summary of your last 24 hours emails using Groq's llama-3.3-70b-versatile model
- **Calendar Analysis**: Smart insights for your upcoming events with web search integration
- **Modern UI**: Beautiful Electron-based desktop interface
- **MCP Integration**: Uses Model Context Protocol for seamless tool integration
- **Google APIs**: Full integration with Gmail and Google Calendar APIs

## Tech Stack

- **Electron**: Cross-platform desktop app framework
- **FastMCP**: Fast Model Context Protocol framework for AI tool integration (Python)
- **Groq AI**: Advanced language model (llama-3.3-70b-versatile)
- **Google APIs**: Gmail API and Google Calendar API (Python)
- **Modern Web Technologies**: HTML5, CSS3, JavaScript ES6+

## Installation

### Prerequisites

- Node.js 16+
- Python 3.8+
- Google Cloud Console account with Gmail and Calendar APIs enabled

### Setup Steps

1. **Install Node.js dependencies**

   ```bash
   cd app
   npm install
   ```

2. **Install Python dependencies**

   ```bash
   pip install -r requirements.txt
   ```

3. **Set up Environment Variables**

   - Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

   - Edit `.env` file and add your Groq API key:

   ```
   GROQ_API_KEY="your-groq-api-key-here"
   ```

4. **Configure Google APIs**

   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select existing project
   - Enable Gmail API and Google Calendar API
   - Create OAuth 2.0 credentials for desktop application
   - Download the `credentials.json` file
   - Place it in `src/config/credentials.json`

5. **Run authentication setup**

   ```bash
   python src/auth_setup.py
   ```

   Follow the prompts to complete Google OAuth setup.

6. **Run the Application**
   ```bash
   npm start
   ```

## Project Structure

```
app/
├── package.json              # Project dependencies and scripts
├── src/
│   ├── main.js              # Electron main process
│   ├── preload.js           # IPC communication bridge
│   ├── mcp-server/          # MCP server implementation
│   │   └── google-services-server.js
│   ├── renderer/            # Frontend UI
│   │   ├── index.html       # Main HTML structure
│   │   ├── styles.css       # Modern CSS styling
│   │   └── app.js           # Frontend JavaScript logic
│   ├── config/              # Configuration files
│   │   └── README.md        # Setup instructions
│   └── assets/              # Static assets
│       ├── logo-placeholder.png
│       ├── email-logo-placeholder.png
│       └── calendar-logo-placeholder.png
```

## How to Use

1. **Welcome Screen**: Launch the app to see the greeting screen
2. **Getting Started**: Click the button to access the main dashboard
3. **Configuration**: Set up your Google API credentials via Settings
4. **Email Summary**: View AI-generated summaries of your recent emails
5. **Calendar Analysis**: Get smart insights about your upcoming events

## Configuration

### Google API Setup

1. Visit [Google Cloud Console](https://console.cloud.google.com)
2. Create/select a project
3. Enable Gmail API and Calendar API
4. Create OAuth 2.0 credentials
5. Download credentials.json
6. Use the app's configuration UI to upload the file

### Groq API Setup

1. Get your API key from [Groq](https://groq.com)
2. Add it to the `.env` file in the root directory

## Features in Detail

### Email Summary

- Fetches emails from the last 24 hours
- Uses Groq AI to generate intelligent summaries
- Groups similar topics together
- Highlights important items requiring attention

### Calendar Analysis

- Retrieves upcoming events for the next 7 days
- Provides AI-powered insights and recommendations
- Suggests preparation needs and optimization opportunities
- Identifies potential scheduling conflicts

## Development

### Build for Production

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

## Requirements

- Node.js 16+
- Windows, macOS, or Linux
- Google account with API access
- Groq API key

## Security

- All API keys are stored locally
- OAuth 2.0 secure authentication with Google
- No data is sent to external servers except Google and Groq APIs
- Local MCP server for secure data processing

## Troubleshooting

### Common Issues

1. **Google Authentication Errors**

   - Ensure credentials.json is properly configured
   - Check that Gmail and Calendar APIs are enabled
   - Verify OAuth consent screen is set up

2. **Groq API Errors**

   - Verify API key is correct in .env file
   - Check API quota and limits
   - Ensure model name is correct (llama-3.3-70b-versatile)

3. **MCP Server Issues**
   - Check console logs for server startup errors
   - Verify Node.js version compatibility
   - Ensure all dependencies are installed

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

For issues and questions, please create an issue in the GitHub repository.
