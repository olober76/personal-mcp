#!/usr/bin/env python3
"""
Google OAuth Setup Helper
This script helps users set up Google API authentication
"""

import json
import os
import asyncio
from pathlib import Path
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

            # Create OAuth2 flow
            self.flow = Flow.from_client_config(
                credentials_info,
                scopes=SCOPES,
                redirect_uri='http://localhost:8080'
            )

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

    async def generate_auth_url(self):
        """Generate authorization URL"""
        auth_url, _ = self.flow.authorization_url(
            access_type='offline',
            prompt='consent'
        )

        print('\n🔗 Please visit this URL to authorize the application:')
        print(f'\n{auth_url}\n')
        return auth_url

    async def get_access_token(self):
        """Get access token from authorization code"""
        try:
            code = input('📝 Enter the authorization code from the webpage: ').strip()
            
            # Exchange code for token
            self.flow.fetch_token(code=code)
            self.credentials = self.flow.credentials
            
            # Save token to file
            await self.save_token(self.credentials)
            
            print(f'✅ Token saved successfully to: {TOKEN_PATH}')
            return self.credentials
        except Exception as error:
            print(f'❌ Error retrieving access token: {error}')
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
            print('5. Download the credentials.json file')
            print('6. Place it in the src/config/ directory')
            print('7. Run this script again\n')
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

        # Generate auth URL and get new token
        try:
            await self.generate_auth_url()
            await self.get_access_token()
            
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