#!/usr/bin/env python3
"""
Test MCP communication directly
"""
import json
import subprocess
import sys
import time

def test_mcp_server():
    print("🧪 Testing MCP server communication...")
    
    # Start the server
    server_path = "src/mcp-server/echo_test_server.py"
    try:
        process = subprocess.Popen(
            ["python", server_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        
        print("✅ Server started, PID:", process.pid)
        
        # Wait a bit for server to initialize
        time.sleep(3)
        
        # Send initialization request
        initialize_request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "clientInfo": {
                    "name": "test-client",
                    "version": "1.0.0"
                }
            }
        }
        
        print("📤 Sending initialize request...")
        process.stdin.write(json.dumps(initialize_request) + "\n")
        process.stdin.flush()
        
        # Read response
        response_line = process.stdout.readline()
        print("📥 Initialize response:", response_line.strip())
        
        # Send initialized notification
        initialized_notification = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized"
        }
        
        print("📤 Sending initialized notification...")
        process.stdin.write(json.dumps(initialized_notification) + "\n")
        process.stdin.flush()
        
        # Wait a moment
        time.sleep(1)
        
        # Send tool call
        tool_request = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": "echo_tool",
                "arguments": {
                    "text": "Hello MCP!"
                }
            }
        }
        
        print("📤 Sending tool call...")
        process.stdin.write(json.dumps(tool_request) + "\n")
        process.stdin.flush()
        
        # Read response
        response_line = process.stdout.readline()
        print("📥 Tool response:", response_line.strip())
        
        # Clean up
        process.terminate()
        process.wait()
        
        print("✅ Test completed")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")

if __name__ == "__main__":
    test_mcp_server()