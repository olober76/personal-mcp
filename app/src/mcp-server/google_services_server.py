#!/usr/bin/env python3
"""
Google Services MCP Server
FastMCP v2 implementation with Google APIs and Groq AI
"""

import asyncio
import base64
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

# FastMCP imports
from fastmcp import FastMCP

# Google API imports
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Groq imports
from groq import Groq
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).parent.parent.parent / '.env')

# Configuration
SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly'
]

CONFIG_DIR = Path(__file__).parent.parent / 'config'
CREDENTIALS_FILE = CONFIG_DIR / 'credentials.json'
TOKEN_FILE = CONFIG_DIR / 'token.json'

# Initialize FastMCP server
mcp = FastMCP("Google Services MCP 🚀")

# Global variables for services
gmail_service = None
calendar_service = None
groq_client = None

# Initialize Groq client
groq_api_key = os.getenv('GROQ_API_KEY')
if groq_api_key:
    groq_client = Groq(api_key=groq_api_key)
async def initialize_google_services() -> bool:
    """Initialize Google API services"""
    global gmail_service, calendar_service
    
    try:
        creds = None
        
        # Load existing token
        if TOKEN_FILE.exists():
            creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
        
        # If no valid credentials, check for credentials file
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                try:
                    creds.refresh(Request())
                except Exception:
                    creds = None
            
            if not creds:
                if not CREDENTIALS_FILE.exists():
                    return False
                
                flow = InstalledAppFlow.from_client_secrets_file(
                    str(CREDENTIALS_FILE), SCOPES
                )
                creds = flow.run_local_server(port=0)
            
            # Save credentials
            CONFIG_DIR.mkdir(exist_ok=True)
            with open(TOKEN_FILE, 'w') as token:
                token.write(creds.to_json())
        
        # Build services
        gmail_service = build('gmail', 'v1', credentials=creds)
        calendar_service = build('calendar', 'v3', credentials=creds)
        
        return True
        
    except Exception as e:
        print(f"Error initializing Google services: {e}", file=sys.stderr)
        return False


def extract_email_body(payload: Dict) -> str:
    """Extract email body from payload"""
    body = ""
    
    if payload.get('body') and payload['body'].get('data'):
        body = base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8', errors='ignore')
    elif payload.get('parts'):
        for part in payload['parts']:
            if part.get('mimeType') == 'text/plain' and part.get('body') and part['body'].get('data'):
                body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8', errors='ignore')
                break
    
    # Clean and limit body length
    body = body.replace('\n', ' ').strip()
    return body[:500]  # Limit to 500 characters


@mcp.tool
async def get_recent_emails(max_results: int = 50) -> Dict[str, Any]:
    """Get Gmail emails from the last 24 hours"""
    global gmail_service
    
    if not gmail_service:
        if not await initialize_google_services():
            return {
                "success": False,
                "error": "Google services not configured. Please set up credentials."
            }
    
    try:
        # Calculate 24 hours ago
        yesterday = datetime.now() - timedelta(days=1)
        query = f"after:{int(yesterday.timestamp())}"
        
        # Get message IDs
        results = gmail_service.users().messages().list(
            userId='me',
            q=query,
            maxResults=max_results
        ).execute()
        
        messages = results.get('messages', [])
        
        if not messages:
            return {
                "success": True,
                "emails": [],
                "count": 0,
                "message": "No emails found in the last 24 hours"
            }
        
        # Get detailed message info (limit to 10 for performance)
        emails = []
        for message in messages[:10]:
            try:
                msg = gmail_service.users().messages().get(
                    userId='me',
                    id=message['id'],
                    format='full'
                ).execute()
                
                headers = msg['payload'].get('headers', [])
                
                # Extract headers
                subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
                from_addr = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown')
                date_str = next((h['value'] for h in headers if h['name'] == 'Date'), '')
                
                # Extract body
                body = extract_email_body(msg['payload'])
                
                email = {
                    'id': msg['id'],
                    'subject': subject,
                    'from': from_addr,
                    'date': date_str,
                    'snippet': msg.get('snippet', ''),
                    'body': body
                }
                
                emails.append(email)
                
            except Exception as e:
                print(f"Error processing email: {e}", file=sys.stderr)
                continue
        
        return {
            "success": True,
            "emails": emails,
            "count": len(emails),
            "total_found": len(messages)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@mcp.tool
async def get_upcoming_events(days: int = 7) -> Dict[str, Any]:
    """Get Google Calendar events for the next week"""
    global calendar_service
    
    if not calendar_service:
        if not await initialize_google_services():
            return {
                "success": False,
                "error": "Google services not configured. Please set up credentials."
            }
    
    try:
        now = datetime.now()
        end_date = now + timedelta(days=days)
        
        events_result = calendar_service.events().list(
            calendarId='primary',
            timeMin=now.isoformat() + 'Z',
            timeMax=end_date.isoformat() + 'Z',
            maxResults=50,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])
        
        formatted_events = []
        for event in events:
            formatted_event = {
                'id': event['id'],
                'title': event.get('summary', 'No Title'),
                'description': event.get('description', ''),
                'start': event['start'].get('dateTime', event['start'].get('date')),
                'end': event['end'].get('dateTime', event['end'].get('date')),
                'location': event.get('location', ''),
                'attendees': [a.get('email', '') for a in event.get('attendees', [])]
            }
            formatted_events.append(formatted_event)
        
        return {
            "success": True,
            "events": formatted_events,
            "count": len(formatted_events)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@mcp.tool
async def summarize_emails_ai(emails: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Summarize emails using Groq AI"""
    global groq_client
    
    if not groq_client:
        return {
            "success": False,
            "error": "Groq API not configured. Please check GROQ_API_KEY in .env file."
        }
    
    try:
        if not emails:
            return {
                "success": False,
                "error": "No emails provided for summarization"
            }
        
        # Prepare email text for AI
        email_text = []
        for email in emails:
            text = f"Subject: {email.get('subject', '')}\n"
            text += f"From: {email.get('from', '')}\n"
            text += f"Date: {email.get('date', '')}\n"
            text += f"Content: {email.get('snippet', '') or email.get('body', '')}"
            email_text.append(text)
        
        combined_text = "\n\n---\n\n".join(email_text)
        
        # Call Groq API
        response = groq_client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are an AI assistant that helps summarize emails efficiently. Provide a clear, organized summary of the key points from the emails, grouping similar topics together and highlighting important items that need attention."
                },
                {
                    "role": "user",
                    "content": f"Please summarize these emails from the last 24 hours. Focus on the most important items and group similar topics:\n\n{combined_text}"
                }
            ],
            model="llama-3.3-70b-versatile",
            max_tokens=1500,
            temperature=0.3
        )
        
        return {
            "success": True,
            "summary": response.choices[0].message.content,
            "email_count": len(emails)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@mcp.tool
async def analyze_calendar_ai(events: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Analyze calendar events using Groq AI"""
    global groq_client
    
    if not groq_client:
        return {
            "success": False,
            "error": "Groq API not configured. Please check GROQ_API_KEY in .env file."
        }
    
    try:
        if not events:
            return {
                "success": False,
                "error": "No events provided for analysis"
            }
        
        # Prepare events text for AI
        events_text = []
        for event in events:
            text = f"Event: {event.get('title', '')}\n"
            
            if event.get('start'):
                start_time = datetime.fromisoformat(event['start'].replace('Z', '+00:00'))
                text += f"Time: {start_time.strftime('%Y-%m-%d %H:%M')}\n"
            
            text += f"Description: {event.get('description', 'No description')}\n"
            text += f"Location: {event.get('location', 'No location')}"
            
            events_text.append(text)
        
        combined_text = "\n\n---\n\n".join(events_text)
        
        # Call Groq API
        response = groq_client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are an AI assistant that analyzes calendar events and provides helpful insights, time management suggestions, and preparation recommendations. Focus on identifying important meetings, potential conflicts, preparation needs, and optimization opportunities."
                },
                {
                    "role": "user",
                    "content": f"Analyze these upcoming calendar events and provide insights, suggestions, and recommendations for better time management and preparation:\n\n{combined_text}"
                }
            ],
            model="llama-3.3-70b-versatile",
            max_tokens=1500,
            temperature=0.4
        )
        
        return {
            "success": True,
            "analysis": response.choices[0].message.content,
            "event_count": len(events)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@mcp.tool
async def search_web_insights(query: str, context: str = "") -> Dict[str, Any]:
    """Search web for insights (placeholder implementation)"""
    # Mock implementation - in production, integrate with Google Custom Search API
    mock_results = [
        {
            'title': f'Insights for: {query}',
            'link': 'https://example.com',
            'snippet': f'Based on your search for "{query}", here are some general insights and recommendations with context: {context}'
        }
    ]
    
    return {
        "success": True,
        "results": mock_results,
        "query": query,
        "context": context,
        "note": "Web search integration requires Google Custom Search API setup"
    }


if __name__ == "__main__":
    # Run the FastMCP server with STDIO transport (default)
    mcp.run()