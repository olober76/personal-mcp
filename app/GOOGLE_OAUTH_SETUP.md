# Google OAuth Setup Instructions

## Current Issue Resolution

If you're getting "localhost refused to connect" error, you need to update your Google Cloud Console OAuth configuration.

## Step-by-Step Fix:

### 1. Update Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project: **iron-cycle-416504**
3. Go to **APIs & Services** > **Credentials**
4. Find your OAuth 2.0 Client ID: `858272735729-ljk91r9shodrre3pbp0hc0h9n7r9a3dr.apps.googleusercontent.com`
5. Click the **Edit** button (pencil icon)
6. In **Authorized redirect URIs** section, add:
   ```
   http://localhost:8080
   ```
7. Remove the old redirect URI if it's different
8. Click **Save**

**Note**: Meskipun Anda membuat "Web Application" di Google Cloud Console, kita menggunakan format "installed" di credentials.json karena aplikasi ini berjalan secara lokal sebagai desktop app.

### 2. Your credentials.json should look like this:

```json
{
  "installed": {
    "client_id": "858272735729-ljk91r9shodrre3pbp0hc0h9n7r9a3dr.apps.googleusercontent.com",
    "project_id": "iron-cycle-416504",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "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",
    "redirect_uris": ["http://localhost:8080"]
  }
}
```

### 3. Run the auth setup again:

```bash
cd app
python src/auth_setup.py
```

## How the New Flow Works:

1. The script will start a local server on port 8080
2. Your browser will open automatically
3. Complete the Google OAuth flow in the browser
4. You'll be redirected back to localhost:8080
5. The local server will capture the authorization code
6. The script will exchange it for tokens automatically
7. Tokens will be saved to `src/config/token.json`

## Troubleshooting:

### Port 8080 already in use:

```bash
# Check what's using port 8080
netstat -ano | findstr :8080

# Kill the process if needed (replace PID with actual process ID)
taskkill /PID <PID> /F
```

### Firewall blocking:

- Make sure Windows Firewall allows connections on port 8080
- Try temporarily disabling antivirus software

### Still getting errors:

- Make sure you've updated the redirect URI in Google Cloud Console
- Wait a few minutes after updating Google Cloud Console settings
- Try using a different port (update both the script and Google Cloud Console)

## Alternative Manual Method:

If the automatic method still doesn't work, you can use the manual method:

1. Replace the redirect URI in both places with: `urn:ietf:wg:oauth:2.0:oob`
2. The script will give you a URL to visit
3. After authorization, Google will show you a code
4. Copy and paste the code back into the script

But the automatic method (localhost:8080) is preferred and more secure.
