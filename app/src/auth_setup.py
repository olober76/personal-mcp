#!/usr/bin/env python3
"""
Google OAuth Setup Helper
This script helps users set up Google API authentication
"""

import json
import os
import asyncio
import webbrowser
import urllib.parse
import time
import threading
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly'
]

# Get the directory where this script is located
SCRIPT_DIR = Path(__file__).parent
TOKEN_PATH = SCRIPT_DIR / 'config' / 'token.json'
CREDENTIALS_PATH = SCRIPT_DIR / 'config' / 'credentials.json'

# Global variable to store authorization code
authorization_code = None

class OAuthCallbackHandler(BaseHTTPRequestHandler):
    """HTTP request handler for OAuth callback"""
    
    def do_GET(self):
        global authorization_code
        
        # Parse the query parameters
        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)
        
        if 'code' in params:
            authorization_code = params['code'][0]
            
            # Send success response
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            
            success_html = """
            <html>
            <head><title>Authorization Successful</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: green;">✅ Authorization Successful!</h1>
                <p>You can close this browser tab and return to the terminal.</p>
                <p>The authentication process will continue automatically.</p>
            </body>
            </html>
            """
            self.wfile.write(success_html.encode())
            
        elif 'error' in params:
            # Handle error
            error = params['error'][0]
            self.send_response(400)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            
            error_html = f"""
            <html>
            <head><title>Authorization Error</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: red;">❌ Authorization Error</h1>
                <p>Error: {error}</p>
                <p>Please close this tab and try again.</p>
            </body>
            </html>
            """
            self.wfile.write(error_html.encode())
        
        else:
            # Unknown request
            self.send_response(400)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(b'Invalid request')
    
    def log_message(self, format, *args):
        # Suppress log messages
        pass


class GoogleAuthSetup:
    def __init__(self):
        self.flow = None
        self.credentials = None

    async def initialize(self):
        """Initialize OAuth2 flow"""
        try:
            # Read credentials file
            credentials_info = await self.load_credentials()
            if not credentials_info:
                raise Exception('Credentials file not found. Please set up credentials.json first.')

            # Create OAuth2 flow for web application
            self.flow = Flow.from_client_config(
                credentials_info,
                scopes=SCOPES
            )
            self.flow.redirect_uri = 'http://localhost:8080'

            print('✅ OAuth2 flow initialized successfully')
            return True
        except Exception as error:
            print(f'❌ Error initializing OAuth2 flow: {error}')
            return False

    async def load_credentials(self):
        """Load credentials from file"""
        try:
            if not CREDENTIALS_PATH.exists():
                print(f'❌ Credentials file not found: {CREDENTIALS_PATH}')
                return None
            
            with open(CREDENTIALS_PATH, 'r', encoding='utf-8') as f:
                credentials_info = json.load(f)
            
            return credentials_info
        except Exception as error:
            print(f'❌ Could not read credentials file: {error}')
            return None

    async def check_existing_token(self):
        """Check if valid token already exists"""
        try:
            if not TOKEN_PATH.exists():
                print('ℹ️  No existing token found, will create new one')
                return False

            # Load existing credentials
            self.credentials = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
            
            # Check if credentials are valid
            if not self.credentials or not self.credentials.valid:
                if self.credentials and self.credentials.expired and self.credentials.refresh_token:
                    print('ℹ️  Token expired, attempting to refresh...')
                    self.credentials.refresh(Request())
                    # Save refreshed token
                    await self.save_token(self.credentials)
                    print('✅ Token refreshed successfully')
                    return True
                else:
                    print('ℹ️  Token invalid, will create new one')
                    return False
            
            print('✅ Existing valid token found and loaded')
            return True
        except Exception as error:
            print(f'ℹ️  Error checking existing token: {error}')
            print('ℹ️  Will create new token')
            return False

    def get_access_token(self):
        """Get access token using manual local server"""
        global authorization_code
        authorization_code = None
        
        try:
            print('\n🔗 Starting local server for OAuth callback...')
            
            # Start local server
            server = HTTPServer(('localhost', 8080), OAuthCallbackHandler)
            server_thread = threading.Thread(target=server.serve_forever)
            server_thread.daemon = True
            server_thread.start()
            
            print('✅ Local server started on http://localhost:8080')
            
            # Generate authorization URL
            auth_url, _ = self.flow.authorization_url(
                access_type='offline',
                prompt='consent'
            )
            
            print('\n🌐 Opening browser for Google OAuth authorization...')
            print('📋 Instructions:')
            print('1. Your browser will open automatically')
            print('2. Sign in to your Google account if prompted')
            print('3. Grant the requested permissions')
            print('4. You will be redirected back automatically')
            print('5. Wait for the success message\n')
            
            # Open browser
            webbrowser.open(auth_url)
            
            # Wait for authorization code
            print('⏳ Waiting for authorization...')
            timeout = 120  # 2 minutes timeout
            elapsed = 0
            
            while authorization_code is None and elapsed < timeout:
                time.sleep(1)
                elapsed += 1
                
                if elapsed % 10 == 0:
                    print(f'⏳ Still waiting... ({elapsed}/{timeout}s)')
            
            # Stop the server
            server.shutdown()
            server.server_close()
            
            if authorization_code is None:
                raise Exception('Authorization timeout. Please try again.')
            
            print('✅ Authorization code received!')
            
            # Exchange code for token
            self.flow.fetch_token(code=authorization_code)
            self.credentials = self.flow.credentials
            
            print(f'✅ Token obtained successfully!')
            return self.credentials
            
        except Exception as error:
            print(f'❌ Error retrieving access token: {error}')
            print('\n💡 Troubleshooting tips:')
            print('- Make sure no other application is using port 8080')
            print('- Check that your firewall allows the connection')
            print('- Verify the redirect URI (http://localhost:8080) is configured in Google Cloud Console')
            print('- Make sure you created a Web Application (not Desktop) in Google Cloud Console')
            raise

    async def save_token(self, credentials):
        """Save token to file"""
        # Create config directory if it doesn't exist
        TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
        
        # Save credentials to file
        with open(TOKEN_PATH, 'w', encoding='utf-8') as f:
            f.write(credentials.to_json())

    async def test_connection(self):
        """Test API connections"""
        try:
            print('\n🧪 Testing Gmail API connection...')
            gmail_service = build('gmail', 'v1', credentials=self.credentials)
            
            profile = gmail_service.users().getProfile(userId='me').execute()
            print(f'✅ Gmail API test successful! Email: {profile["emailAddress"]}')

            print('\n🧪 Testing Calendar API connection...')
            calendar_service = build('calendar', 'v3', credentials=self.credentials)
            
            calendars = calendar_service.calendarList().list().execute()
            calendar_count = len(calendars.get('items', []))
            print(f'✅ Calendar API test successful! Found {calendar_count} calendars')

            return True
        except HttpError as error:
            print(f'❌ API test failed: {error}')
            return False
        except Exception as error:
            print(f'❌ Unexpected error during API test: {error}')
            return False

    async def run(self):
        """Run the complete setup process"""
        print('🚀 Google API Authentication Setup\n')

        # Initialize OAuth flow
        initialized = await self.initialize()
        if not initialized:
            print('\n📋 Setup Instructions:')
            print('1. Go to https://console.cloud.google.com')
            print('2. Create a new project or select existing one')
            print('3. Enable Gmail API and Calendar API')
            print('4. Create OAuth 2.0 credentials for desktop application')
            print('5. In the OAuth consent screen, add these redirect URIs:')
            print('   - http://localhost:8080')
            print('6. Download the credentials.json file')
            print('7. Place it in the src/config/ directory')
            print('8. Run this script again\n')
            return

        # Check for existing token
        has_existing_token = await self.check_existing_token()
        
        if has_existing_token:
            print('ℹ️  Token already exists. Testing connection...')
            test_result = await self.test_connection()
            
            if test_result:
                print('\n🎉 Authentication is already set up and working!')
                print('You can now run the main application with: npm start')
                return
            else:
                print('\n⚠️  Existing token seems invalid. Creating new one...')

        # Get new token using local server
        try:
            self.get_access_token()
            # Save token to file
            await self.save_token(self.credentials)
            
            # Test the new connection
            test_result = await self.test_connection()
            
            if test_result:
                print('\n🎉 Authentication setup completed successfully!')
                print('You can now run the main application with: npm start')
            else:
                print('\n⚠️  Setup completed but there might be issues. Please check your configuration.')
        except Exception as error:
            print(f'\n❌ Setup failed: {error}')


async def main():
    """Main function"""
    setup = GoogleAuthSetup()
    await setup.run()


if __name__ == '__main__':
    asyncio.run(main())