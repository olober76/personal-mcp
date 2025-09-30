#!/usr/bin/env python3
"""
Simple MCP Server for testing
Based on FastMCP v2 examples
"""

import sys
from typing import Any, Dict, List

# FastMCP imports
try:
    from fastmcp import FastMCP
except ImportError:
    print("Error: fastmcp not installed. Run: pip install fastmcp>=2.0.0", file=sys.stderr)
    sys.exit(1)

# Create FastMCP server (like the examples)
mcp = FastMCP("Simple Test Server")

@mcp.tool
def test_tool(message: str = "Hello") -> Dict[str, Any]:
    """Simple test tool"""
    return {
        "success": True,
        "message": f"Test successful: {message}",
        "timestamp": "2025-01-01T00:00:00Z"
    }

@mcp.tool 
def get_recent_emails(max_results: int = 50) -> Dict[str, Any]:
    """Mock recent emails tool"""
    mock_emails = [
        {
            "id": "1",
            "subject": "Test Email 1",
            "from": "test1@example.com",
            "date": "2025-01-01T10:00:00Z",
            "snippet": "This is a test email",
            "body": "This is the body of test email 1"
        },
        {
            "id": "2", 
            "subject": "Test Email 2",
            "from": "test2@example.com",
            "date": "2025-01-01T11:00:00Z",
            "snippet": "This is another test email",
            "body": "This is the body of test email 2"
        }
    ]
    
    return {
        "success": True,
        "emails": mock_emails[:max_results],
        "count": len(mock_emails[:max_results]),
        "total_found": len(mock_emails)
    }

@mcp.tool
def get_upcoming_events(days: int = 7) -> Dict[str, Any]:
    """Mock upcoming events tool"""
    mock_events = [
        {
            "id": "event1",
            "title": "Test Meeting 1",
            "description": "This is a test meeting",
            "start": "2025-01-02T14:00:00Z",
            "end": "2025-01-02T15:00:00Z",
            "location": "Conference Room A",
            "attendees": ["attendee1@example.com"]
        },
        {
            "id": "event2",
            "title": "Test Meeting 2", 
            "description": "Another test meeting",
            "start": "2025-01-03T10:00:00Z",
            "end": "2025-01-03T11:00:00Z",
            "location": "Virtual",
            "attendees": ["attendee2@example.com", "attendee3@example.com"]
        }
    ]
    
    return {
        "success": True,
        "events": mock_events,
        "count": len(mock_events)
    }

@mcp.tool
def search_web_insights(query: str, context: str = "") -> Dict[str, Any]:
    """Mock web insights tool"""
    return {
        "success": True,
        "results": [
            {
                "title": f"Insights for: {query}",
                "link": "https://example.com",
                "snippet": f"Mock insights for query '{query}' with context: {context}"
            }
        ],
        "query": query,
        "context": context,
        "note": "This is a mock implementation"
    }

@mcp.tool
def summarize_emails_ai(emails: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Mock email summarization"""
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
def analyze_calendar_ai(events: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Mock calendar analysis"""
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

if __name__ == "__main__":
    # Run the FastMCP server (same as examples)
    mcp.run()