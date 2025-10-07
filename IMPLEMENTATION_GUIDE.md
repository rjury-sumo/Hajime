# Sumo Logic API Integration - Implementation Guide

This document describes the new Sumo Logic API integration features added to the VS Code extension.

## Architecture

### Module Structure

```
src/
├── extension.ts              # Main extension with command registration
├── api/
│   ├── client.ts            # Base HTTP client with Basic Auth
│   └── searchJob.ts         # Search Job API client
└── commands/
    ├── authenticate.ts      # Credential management
    └── runQuery.ts          # Query execution
```

### Key Components

#### 1. Base API Client (`api/client.ts`)
- HTTP client using Node's native `https` module
- Basic Authentication using Base64-encoded credentials
- Support for all Sumo Logic regions (us1, us2, eu, au, de, jp, ca, in)
- Custom endpoint support for on-premise deployments

#### 2. Search Job API Client (`api/searchJob.ts`)
- Complete implementation of Search Job API v1
- Job creation, polling, and result retrieval
- Support for both messages and records
- Automatic cleanup (job deletion after completion)
- Relative time parsing (`-1h`, `-30m`, `now`, etc.)

#### 3. Credential Management (`commands/authenticate.ts`)
- Secure storage using VS Code's SecretStorage API
- Region configuration via VS Code settings
- Connection testing capability

#### 4. Query Execution (`commands/runQuery.ts`)
- Execute queries from open `.sumo` files
- Parse metadata directives from comments (`@from`, `@to`, `@timezone`)
- Progress reporting during job execution
- Results displayed in new text document

## Usage

### 1. Configure Credentials

Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and run:

```
Sumo Logic: Configure Credentials
```

You will be prompted for:
1. **Deployment Region**: Select your Sumo Logic deployment (us1, us2, eu, au, de, jp, ca, in, or custom)
2. **Access ID**: Your Sumo Logic access ID (e.g., `suABC123...`)
3. **Access Key**: Your secret access key

**Important**: The region/deployment must match where your Sumo Logic organization is hosted. You can find this in your Sumo Logic URL:
- `https://service.us1.sumologic.com` → Select **US1**
- `https://service.au.sumologic.com` → Select **AU**
- `https://service.eu.sumologic.com` → Select **EU**
- `https://service.de.sumologic.com` → Select **DE**
- And so on...

Credentials are stored securely in VS Code's secret storage, and the region is saved in workspace settings.

### 2. Advanced: Custom Endpoint (Optional)

If your organization uses a custom or on-premise deployment, select "Custom Endpoint" during credential configuration and enter the full API URL (e.g., `https://api.custom.sumologic.com`)

### 3. Test Connection

Run:
```
Sumo Logic: Test Connection
```

Verifies credentials and connectivity to the API.

### 4. Run a Query

Open a `.sumo` file and run:
```
Sumo Logic: Run Query
```

The query will be executed and results displayed in a new tab.

## Query Metadata Directives

You can specify time range and timezone in your query file using special comments:

```sumo
// @from -1h
// @to now
// @timezone UTC

_sourceCategory=prod/application
| count by _sourceHost
```

### Supported Directives

- **@from**: Start time (relative or absolute)
- **@to**: End time (relative or absolute)
- **@timezone**: Timezone for the query (default: UTC)

### Time Format Examples

**Relative times:**
- `-1s` = 1 second ago
- `-15m` = 15 minutes ago
- `-2h` = 2 hours ago
- `-1d` = 1 day ago
- `-1w` = 1 week ago
- `now` = current time

**Absolute times:**
- ISO format: `2024-01-01T00:00:00Z`
- Epoch milliseconds: `1704067200000`

If directives are not provided, you'll be prompted for the time range.

## Configuration

### VS Code Settings

```json
{
  "sumologic.region": "us1",
  "sumologic.endpoint": ""  // Optional custom endpoint
}
```

### Secret Storage

Credentials are stored securely using VS Code's SecretStorage API:
- `sumologic.accessId`
- `sumologic.accessKey`

These are encrypted and stored in your OS keychain/credential manager.

## API Implementation Details

### Authentication

Uses HTTP Basic Authentication as specified in Sumo Logic API docs:

```typescript
const credentials = `${accessId}:${accessKey}`;
const encoded = Buffer.from(credentials).toString('base64');
headers['Authorization'] = `Basic ${encoded}`;
```

### Search Job Workflow

1. **Create Job**: POST to `/api/v1/search/jobs`
2. **Poll Status**: GET `/api/v1/search/jobs/{jobId}` every 2 seconds
3. **Fetch Results**: GET `/api/v1/search/jobs/{jobId}/records`
4. **Delete Job**: DELETE `/api/v1/search/jobs/{jobId}`

### Error Handling

- Network errors are caught and displayed to user
- HTTP errors include status code and response body
- Authentication failures show clear error messages
- Connection timeouts are handled gracefully

## Future Enhancements

### Phase 2 Features (To Be Implemented)

1. **Content Management API**
   - Browse content library
   - Save queries to library
   - Load queries from library
   - Support for admin/global/personal folders

2. **Folder Management API**
   - Navigate folder hierarchy
   - Create/update/delete folders
   - Manage permissions

3. **Enhanced Results View**
   - Webview panel with interactive table
   - Export to CSV/JSON
   - Column sorting and filtering
   - Chart visualization for aggregate queries

4. **Query History**
   - Track executed queries
   - Re-run previous queries
   - Export query history

5. **Multi-Query Execution**
   - Batch query execution
   - Time range splitting (like Python script's batch mode)
   - Parallel query execution

## Troubleshooting

### "No credentials configured" Error

Run `Sumo Logic: Configure Credentials` to set up your access credentials.

### Connection Failures

1. Verify your credentials are correct
2. Check region setting matches your Sumo Logic deployment
3. Ensure you have network connectivity
4. Verify firewall/proxy settings allow HTTPS to Sumo Logic APIs

### Query Execution Fails

1. Test your query in the Sumo Logic web UI first
2. Verify time range is valid
3. Check query syntax for errors
4. Ensure you have permission to run searches

## Development

### Building

```bash
npm run compile
```

### Testing

```bash
# Open extension development host
Press F5 in VS Code
```

### Adding New API Endpoints

1. Extend `SumoLogicClient` in `src/api/client.ts`
2. Create new API-specific client (e.g., `content.ts`, `folder.ts`)
3. Add commands in `src/commands/`
4. Register commands in `src/extension.ts`
5. Add command contributions to `package.json`

## References

- [Search Job API Documentation](https://help.sumologic.com/docs/api/search-job/)
- [Content Management API](https://help.sumologic.com/docs/api/content-management/)
- [Folder Management API](https://help.sumologic.com/docs/api/folder-management/)
- [Python Reference Implementation](../sumo-public-content/apis/scripts/search_job/)
