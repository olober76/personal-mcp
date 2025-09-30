#!/usr/bin/env python3
"""
Echo Test Server - Based on FastMCP examples
"""

from fastmcp import FastMCP

# Create server
mcp = FastMCP("Echo Test Server")

@mcp.tool
def echo_tool(text: str) -> str:
    """Echo the input text"""
    return f"Echo: {text}"

@mcp.tool
def get_recent_emails(maxResults: int = 50) -> dict:
    """Get recent emails - mock implementation"""
    return {
        "success": True,
        "emails": [
            {
                "id": "1",
                "subject": "Test Email 1", 
                "from": "test1@example.com",
                "date": "2025-01-01T10:00:00Z",
                "snippet": "This is a test email",
                "body": "This is the body of test email 1"
            }
        ],
        "count": min(maxResults, 1),
        "total_found": 1
    }

@mcp.tool  
def get_upcoming_events(days: int = 7) -> dict:
    """Get upcoming events - mock implementation"""
    return {
        "success": True,
        "events": [
            {
                "id": "event1",
                "title": "Test Meeting",
                "description": "This is a test meeting",
                "start": "2025-01-02T14:00:00Z",
                "end": "2025-01-02T15:00:00Z",
                "location": "Conference Room A",
                "attendees": ["attendee1@example.com"]
            }
        ],
        "count": min(days, 1)  # Use the days parameter
    }

@mcp.tool
def search_web_insights(query: str, context: str = "") -> dict:
    """Search web insights - mock implementation"""  
    return {
        "success": True,
        "results": [{
            "title": f"Results for: {query}",
            "link": "https://example.com",
            "snippet": f"Mock results for '{query}' with context: {context}"
        }],
        "query": query,
        "context": context
    }

@mcp.tool
def summarize_emails_ai(emails: list) -> dict:
    """Summarize emails using AI - mock implementation"""
    if not emails:
        return {
            "success": False,
            "error": "No emails provided for summarization"
        }
    
    summary = f"📧 Email Summary: Found {len(emails)} emails. "
    summary += "Key topics include: test communications, mock data, and server testing. "
    summary += "No urgent actions required at this time."
    
    return {
        "success": True,
        "summary": summary,
        "email_count": len(emails)
    }

@mcp.tool
def analyze_calendar_ai(events: list) -> dict:
    """Analyze calendar events using AI - mock implementation"""
    if not events:
        return {
            "success": False,
            "error": "No events provided for analysis"
        }
    
    analysis = f"📅 Calendar Analysis: You have {len(events)} upcoming events. "
    analysis += "Your schedule looks manageable with good time distribution. "
    analysis += "Consider blocking time for focused work between meetings."
    
    return {
        "success": True,
        "analysis": analysis,
        "event_count": len(events)
    }

# Run server
if __name__ == "__main__":
    mcp.run()