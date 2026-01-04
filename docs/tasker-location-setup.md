# Tasker Location Update Setup

This guide explains how to set up Tasker on Android to automatically send location updates to your home automation server for location-based scene conditions.

## Prerequisites

- Tasker app installed on Android
- Home automation server running and accessible
- Authentication credentials (session cookie or API key)

## Tasker Profile Setup

### Option 1: Time-Based Updates (Recommended)

This profile sends location updates periodically when you're moving.

1. **Create a new Profile:**
   - Name: "Location Update to Server"
   - Trigger: Time → Every 3-5 minutes (adjust based on your needs)

2. **Add Condition (Optional):**
   - State → Location → Near (your work location or train station)
   - This ensures updates only happen when you're away from home

3. **Create Task:**
   - Name: "Send Location Update"

### Option 2: Location Change Based

This profile sends updates when your location changes significantly.

1. **Create a new Profile:**
   - Name: "Location Update to Server"
   - Trigger: State → Location → Any location change > 500m

2. **Create Task:**
   - Name: "Send Location Update"

## Task Configuration

### Step 1: Get Current Location

1. Add action: **Location → Get Location**
   - Source: GPS
   - Timeout: 30 seconds
   - Store result in: `%LOCATION`

### Step 2: Parse Location

1. Add action: **Variables → Variable Split**
   - Variable: `%LOCATION`
   - Splitter: `,`
   - This creates `%LOCATION1` (latitude) and `%LOCATION2` (longitude)

### Step 3: Get GPS Accuracy (Optional)

1. Add action: **Variables → Variable Set**
   - Name: `%ACCURACY`
   - To: `%LOCATIONACCURACY` (if available)

### Step 4: Send HTTP Request

1. Add action: **Net → HTTP Request**
   - Method: POST
   - URL: `https://your-server.com/location/update`
   - Headers:
     ```
     Content-Type: application/json
     Cookie: your-session-cookie-here
     ```
   - Body: (Raw)
     ```json
     {
       "latitude": %LOCATION1,
       "longitude": %LOCATION2,
       "accuracy": %ACCURACY,
       "timestamp": %TIMES
     }
     ```

### Step 5: Handle Response (Optional)

1. Add action: **Variables → Variable Set**
   - Name: `%HTTPD`
   - To: `%HTTPD` (response data)

2. Add action: **Alert → Flash**
   - Text: `Location sent: %HTTPD`
   - (Optional - for debugging)

## Authentication Setup

### Option A: Session Cookie

1. Log into your home automation dashboard in a browser
2. Open browser developer tools (F12)
3. Go to Application/Storage → Cookies
4. Copy the session cookie value
5. Use it in the HTTP Request headers as shown above

### Option B: API Key (if implemented)

1. Generate an API key from your dashboard
2. Use it in the HTTP Request headers:
   ```
   Authorization: Bearer your-api-key-here
   ```

## Advanced Configuration

### Battery Optimization

To ensure Tasker runs reliably:

1. Go to Android Settings → Apps → Tasker
2. Disable battery optimization for Tasker
3. Enable "Allow background activity"

### Network Conditions

Add conditions to only send updates when:
- Connected to WiFi or mobile data
- Not on home WiFi network

**Example Condition:**
- State → Net → WiFi Connected
- SSID: Not your home WiFi SSID

## Testing

1. Manually run the task to test
2. Check server logs for location updates
3. Verify in dashboard at `/location/status` endpoint
4. Create a scene with location condition to test

## Security Notes

- Session cookies expire - you may need to refresh periodically
- Consider using HTTPS only
- Don't share your session cookie
- For production, consider implementing API key authentication
