# JIRA Import Troubleshooting Guide

## Issue: Import Always Shows "2 tickets imported"

This happens when Tiergarten is using mock data instead of fetching from JIRA. The system falls back to mock data when JIRA credentials are not properly configured.

## Root Cause

The server checks for valid JIRA credentials and uses mock data if any of these conditions are true:
- JIRA credentials are missing
- Credentials contain placeholder values like 'your-domain', 'your-email', or 'your-api-token'

## Solution

### 1. Configure JIRA Credentials

Create or update `/server/.env` file with your actual JIRA credentials:

```bash
# Copy the example file
cp server/.env.example server/.env

# Edit with your actual values
JIRA_BASE_URL=https://your-company.atlassian.net
JIRA_EMAIL=your.email@company.com
JIRA_API_TOKEN=your-actual-api-token-here
```

### 2. Generate JIRA API Token

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a name like "Tiergarten Integration"
4. Copy the token and paste it in your `.env` file

### 3. Verify Configuration

After setting up credentials:

1. Restart the server:
   ```bash
   cd server
   npm run dev
   ```

2. Check the server logs for:
   - "Using mock JIRA projects - no valid credentials configured" (BAD)
   - Actual JIRA API calls without this message (GOOD)

### 4. Test Import

1. Go to the Clients tab
2. Click "Import from JIRA" 
3. You should now see your actual JIRA projects
4. Configure import settings and click "Import"

## Debugging Steps

### Check Current Configuration

Add this temporary endpoint to `server.js` to debug:

```javascript
app.get('/api/debug/config', (req, res) => {
    const hasValidCredentials = !!(
        process.env.JIRA_BASE_URL && 
        process.env.JIRA_EMAIL && 
        process.env.JIRA_API_TOKEN &&
        !process.env.JIRA_BASE_URL.includes('your-domain') &&
        !process.env.JIRA_EMAIL.includes('your-email') &&
        !process.env.JIRA_API_TOKEN.includes('your-api-token')
    );
    
    res.json({
        hasValidCredentials,
        baseUrl: process.env.JIRA_BASE_URL ? 'Set' : 'Not set',
        email: process.env.JIRA_EMAIL ? 'Set' : 'Not set',
        token: process.env.JIRA_API_TOKEN ? 'Set' : 'Not set',
        containsPlaceholders: {
            baseUrl: process.env.JIRA_BASE_URL?.includes('your-domain'),
            email: process.env.JIRA_EMAIL?.includes('your-email'),
            token: process.env.JIRA_API_TOKEN?.includes('your-api-token')
        }
    });
});
```

Then visit http://localhost:3000/api/debug/config to see the configuration status.

### Common Issues

1. **Wrong JIRA URL Format**
   - ❌ `https://jira.company.com` (self-hosted format)
   - ✅ `https://company.atlassian.net` (cloud format)

2. **Using Password Instead of API Token**
   - ❌ Your JIRA login password
   - ✅ API token from Atlassian account settings

3. **Permission Issues**
   - Ensure your JIRA user has permission to:
     - Browse projects
     - View issues in the projects you want to import

4. **Firewall/Proxy Issues**
   - Check if your network allows outbound HTTPS to `*.atlassian.net`

## Mock Data Reference

When credentials are invalid, Tiergarten returns these mock tickets:
- PROJ-123: "Critical server outage"
- PROJ-124: "Database connection timeout"

If you see these exact tickets, you're still using mock data.

## Next Steps After Successful Import

1. **Configure Clients**: Map your JIRA projects to Tiergarten clients
2. **Set Tiers**: Assign appropriate tiers to each client
3. **Configure Rules**: Set up global rules for automatic action assignment
4. **Create Dashboards**: Build custom dashboards with filtered widgets