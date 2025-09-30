# MCP Server Testing Guide

## Current Issue & Solution

The application was experiencing MCP communication errors due to protocol mismatch between the JavaScript client and FastMCP v2 server.

## Quick Fix Applied

1. **Created Simple Test Server**: `src/mcp-server/simple_test_server.py`

   - Mock implementations of all tools
   - Simplified FastMCP v2 integration
   - No external dependencies required

2. **Updated main.js**:

   - Improved MCP communication handling
   - Added server ready detection
   - Better error handling and timeouts

3. **Using Test Server**: App now uses `simple_test_server.py` instead of `google_services_server.py`

## Testing Steps

### 1. Install Dependencies

```bash
cd app
pip install fastmcp>=2.0.0
npm install
```

### 2. Run the Application

```bash
npm start
```

### 3. Test Features

- Click "Email Summary" - should show mock emails
- Click "Calendar Analysis" - should show mock events
- Both should work without authentication errors

## Expected Results

✅ **Email Summary**: Shows 2 mock test emails  
✅ **Calendar Analysis**: Shows 2 mock test events  
✅ **No MCP errors**: Server should initialize properly  
✅ **No "Invalid request parameters"**: Communication should work

## Files Changed

- ✅ `src/mcp-server/simple_test_server.py` - New mock server
- ✅ `src/main.js` - Updated MCP communication
- ✅ Using test server instead of full Google services server

## Next Steps (After Testing Works)

1. **If test server works**: We can fix the full Google services server
2. **If still errors**: Need to debug MCP protocol communication further
3. **Full integration**: Connect real Google APIs after basic MCP works

## Reverting to Full Server

To switch back to the full Google services server:

```javascript
// In src/main.js, change line ~47:
mcpProcess = spawn(
  "python",
  [path.join(__dirname, "mcp-server", "google_services_server.py")]
  // ...
);
```

## Troubleshooting

### If you get "fastmcp not installed":

```bash
pip install fastmcp>=2.0.0
```

### If you get "Python not found":

```bash
# Make sure Python is in PATH, or use:
python --version  # Should show Python 3.8+
```

### If MCP still not working:

1. Check terminal output for server startup messages
2. Look for "🚀 Starting Simple Test MCP Server..." message
3. Wait 3-5 seconds after server starts before clicking buttons

The test server should eliminate Google API and external dependency issues, allowing us to focus on fixing the core MCP communication.
