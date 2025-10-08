# Multi-Profile Support Guide

The Sumo Logic VS Code extension now supports multiple connection profiles, allowing you to work with multiple Sumo Logic organizations or deployments simultaneously.

## Overview

**Connection Profiles** allow you to:
- Configure multiple Sumo Logic organizations (Production, Development, Customer orgs, etc.)
- Quickly switch between different deployments
- Maintain separate credentials for each organization
- See which profile is active in the status bar

## Managing Profiles

### Create a New Profile

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Run: `Sumo Logic: Create/Update Connection Profile`
3. Enter a profile name (e.g., `Production`, `Dev`, `Customer-XYZ`)
4. Select deployment region (us1, us2, eu, au, de, jp, ca, in, or custom)
5. Enter Access ID
6. Enter Access Key

The profile will be created and automatically set as active if it's your first profile.

**Profile Name Rules:**
- Can contain letters, numbers, hyphens, and underscores
- Examples: `Production`, `Dev-US2`, `Customer_ABC`, `Test-Environment`

### Switch Between Profiles

**Method 1: Click Status Bar**
- Click the profile name in the status bar (bottom-right)
- Select a profile from the dropdown

**Method 2: Command Palette**
- Open Command Palette
- Run: `Sumo Logic: Switch Profile`
- Select a profile from the list

The active profile is marked with `(Active)` in the selection list.

### List All Profiles

Open Command Palette and run: `Sumo Logic: List Profiles`

Shows all configured profiles with:
- ✓ Active profile indicator
- Profile name
- Region/endpoint

### Update a Profile

1. Run: `Sumo Logic: Create/Update Connection Profile`
2. Enter the **exact same name** as an existing profile
3. Confirm you want to update it
4. Enter new region and credentials

### Delete a Profile

1. Open Command Palette
2. Run: `Sumo Logic: Delete Profile`
3. Select the profile to delete
4. Confirm deletion

**Note:** If you delete the active profile, the extension automatically switches to the first remaining profile.

## Using Profiles

### Status Bar Indicator

The status bar (bottom-right) shows:
```
$(database) Production
```

- **$(database)** icon indicates Sumo Logic connection
- **Profile name** shows which profile is active
- **Click** to quickly switch profiles

If no profile is configured, the status bar is hidden.

### Running Queries

When you run a query with `Sumo Logic: Run Query`, it uses the **active profile** automatically.

The query executes against the organization/deployment configured in the active profile.

### Testing Connections

Run `Sumo Logic: Test Connection` to verify the active profile's credentials and connectivity.

The test shows which profile it's testing:
```
Testing connection to Sumo Logic (Production)...
```

## Example Workflow

### Scenario: Managing Production and Development

```
1. Create Production profile:
   - Name: Production
   - Region: us1
   - Access ID/Key: prod-credentials

2. Create Development profile:
   - Name: Development
   - Region: us2
   - Access ID/Key: dev-credentials

3. Work on Production:
   - Click status bar → Select "Production"
   - Open prod-queries.sumo
   - Run queries against production

4. Switch to Development:
   - Click status bar → Select "Development"
   - Open dev-queries.sumo
   - Run queries against development

5. Status bar always shows active profile
```

### Scenario: Managing Multiple Customer Deployments

```
1. Create profiles for each customer:
   - Customer-ABC (us1)
   - Customer-XYZ (eu)
   - Customer-DEF (au)

2. Switch between customers:
   - Click status bar
   - Select customer profile
   - Run customer-specific queries

3. All credentials stored securely per profile
```

## Profile Storage

### Where Are Profiles Stored?

**Credentials (Secure):**
- Access ID and Access Key are stored in VS Code's **SecretStorage**
- Uses your OS keychain/credential manager (Keychain on macOS, Credential Manager on Windows, Secret Service on Linux)
- Encrypted and protected by your OS

**Profile Metadata (Settings):**
- Profile names and regions are stored in VS Code **User Settings**
- Located in: `~/.config/Code/User/settings.json` (Linux/macOS) or `%APPDATA%\Code\User\settings.json` (Windows)
- Stored as:
  ```json
  {
    "sumologic.profiles": [
      {"name": "Production", "region": "us1"},
      {"name": "Development", "region": "us2", "endpoint": "https://custom.api.com"}
    ],
    "sumologic.activeProfile": "Production"
  }
  ```

### Security

- ✅ Credentials are **never** stored in plain text
- ✅ Credentials are encrypted by your operating system
- ✅ Each profile's credentials are isolated
- ✅ Deleting a profile removes both metadata and credentials

## Migration from Legacy Configuration

If you have the old single-profile configuration (pre-v0.0.4), you can:

1. Create a new profile with your desired name
2. Enter your existing credentials
3. The old configuration keys (`sumologic.region`, `sumologic.endpoint`) are now unused

There is no automatic migration - you must create profiles manually.

## Troubleshooting

### "No active profile" Error

**Cause:** No profiles have been created yet.

**Solution:** Run `Sumo Logic: Create/Update Connection Profile` to create your first profile.

### Profile Not Appearing in Status Bar

**Cause:** Profile created but not set as active.

**Solution:** Run `Sumo Logic: Switch Profile` and select the profile.

### "No credentials found for profile" Error

**Cause:** Profile metadata exists but credentials were not saved or were deleted.

**Solution:**
1. Run `Sumo Logic: Create/Update Connection Profile`
2. Enter the same profile name
3. Re-enter credentials to update

### Profile Name Already Exists

**Cause:** Trying to create a profile with a name that already exists.

**Solution:**
- Choose "Update" to modify the existing profile, or
- Choose "Cancel" and use a different name

### Credentials Not Working After OS Update

**Cause:** OS keychain was reset or credentials were cleared.

**Solution:**
- Run `Sumo Logic: Create/Update Connection Profile`
- Update the affected profile with valid credentials

## Command Reference

| Command | Description |
|---------|-------------|
| `Sumo Logic: Create/Update Connection Profile` | Create new profile or update existing |
| `Sumo Logic: Switch Profile` | Change active profile |
| `Sumo Logic: List Profiles` | Show all configured profiles |
| `Sumo Logic: Delete Profile` | Remove a profile and its credentials |
| `Sumo Logic: Test Connection` | Verify active profile credentials |
| `Sumo Logic: Run Query` | Execute query using active profile |

## API Reference

For extension developers, the multi-profile system is accessible via:

```typescript
import { ProfileManager } from './profileManager';

const profileManager = new ProfileManager(context);

// Get all profiles
const profiles = await profileManager.getProfiles();

// Get active profile
const active = await profileManager.getActiveProfile();

// Create profile
await profileManager.createProfile(
    { name: 'MyProfile', region: 'us1' },
    accessId,
    accessKey
);

// Switch profile
await profileManager.setActiveProfile('MyProfile');

// Get credentials
const creds = await profileManager.getProfileCredentials('MyProfile');
```

## Best Practices

1. **Use Descriptive Names**: Choose profile names that clearly indicate their purpose
   - ✅ `Production-US`, `Dev-EU`, `Customer-Acme`
   - ❌ `Profile1`, `Test`, `A`

2. **Test After Creation**: Run `Test Connection` after creating a profile to verify credentials

3. **Check Active Profile**: Always verify the status bar before running queries to ensure you're using the correct organization

4. **Separate Credentials**: Never share credentials between profiles - each profile should have its own access ID/key

5. **Delete Unused Profiles**: Keep your profile list clean by removing profiles you no longer use

## Future Enhancements

Planned features for multi-profile support:
- Profile-specific query history
- Per-profile saved searches
- Profile import/export (metadata only, credentials excluded for security)
- Profile groups or tags
- Auto-switch profile based on file path or workspace
