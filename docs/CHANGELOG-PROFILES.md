# Multi-Profile Feature Changelog

## Version 0.0.4 - Multi-Profile Support

### 🎉 New Features

#### Connection Profiles
- **Multiple Organization Support**: Configure and manage connections to multiple Sumo Logic organizations
- **Named Profiles**: Give each connection a descriptive name (e.g., `Production`, `Development`, `Customer-ABC`)
- **Profile Switching**: Quickly switch between profiles via status bar or command palette
- **Secure Storage**: Each profile's credentials are stored securely in OS keychain

#### New Commands
- `Sumo Logic: Create/Update Connection Profile` - Create new profile or update existing
- `Sumo Logic: Switch Profile` - Change active profile
- `Sumo Logic: List Profiles` - View all configured profiles
- `Sumo Logic: Delete Profile` - Remove a profile and credentials

#### User Interface
- **Status Bar Item**: Shows active profile name (e.g., `$(database) Production`)
- **Click to Switch**: Click status bar to quickly change profiles
- **Visual Indicators**: Active profile marked in selection lists

### 🔧 Architecture Changes

#### New Modules
- **`profileManager.ts`**: Core profile management logic
  - `ProfileManager` class handles CRUD operations for profiles
  - Secure credential storage per profile
  - Active profile tracking

- **`statusBar.ts`**: Status bar integration
  - `StatusBarManager` displays active profile
  - Auto-updates on configuration changes
  - Clickable to trigger profile switching

#### Modified Modules
- **`commands/authenticate.ts`**: Refactored for multi-profile support
  - Profile name prompt added
  - Region/deployment selection improved
  - Duplicate profile detection and update workflow
  - All commands now profile-aware

- **`extension.ts`**: Command registration updated
  - Status bar initialization
  - Profile refresh after operations
  - New command bindings

- **`package.json`**: Configuration schema updated
  - `sumologic.profiles`: Array of profile metadata
  - `sumologic.activeProfile`: Currently active profile name
  - Removed old single-profile settings (`sumologic.region`, `sumologic.endpoint`)

### 📦 Storage Model

#### Profile Metadata (VS Code Settings)
```json
{
  "sumologic.profiles": [
    {
      "name": "Production",
      "region": "us1"
    },
    {
      "name": "Development",
      "region": "us2"
    },
    {
      "name": "Customer-Custom",
      "region": "us1",
      "endpoint": "https://api.custom.sumologic.com"
    }
  ],
  "sumologic.activeProfile": "Production"
}
```

#### Credentials (SecretStorage)
- Key pattern: `sumologic.profile.{profileName}.accessId`
- Key pattern: `sumologic.profile.{profileName}.accessKey`
- Stored in OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)

### 🔄 Breaking Changes

#### Configuration Migration
- **Old configuration keys are deprecated**:
  - `sumologic.region` (replaced by per-profile region)
  - `sumologic.endpoint` (replaced by per-profile endpoint)

- **No automatic migration**: Users must manually create profiles using new command

- **Backward compatibility**: Old credentials are not automatically migrated

### 🔐 Security Enhancements

1. **Credential Isolation**: Each profile's credentials are stored separately
2. **Secure Deletion**: Deleting a profile removes both metadata and credentials
3. **No Plain Text**: Credentials never stored in settings files
4. **OS-Level Encryption**: Leverages operating system's secure storage

### 📝 User-Facing Changes

#### Command Palette
**Replaced:**
- ~~`Sumo Logic: Configure Credentials`~~

**New:**
- `Sumo Logic: Create/Update Connection Profile`
- `Sumo Logic: Switch Profile`
- `Sumo Logic: List Profiles`
- `Sumo Logic: Delete Profile`

**Unchanged:**
- `Sumo Logic: Run Query` (now uses active profile)
- `Sumo Logic: Test Connection` (now shows profile name)

#### Workflow Changes

**Before (v0.0.3):**
```
1. Configure Credentials (single org)
2. Run queries against that org
3. Manually reconfigure to switch orgs
```

**After (v0.0.4):**
```
1. Create profiles for each org
2. Click status bar to switch
3. Run queries against active profile
4. Switch profiles instantly
```

### 🧪 Testing Checklist

- [x] Create first profile (auto-sets as active)
- [x] Create additional profiles
- [x] Switch between profiles
- [x] Status bar updates correctly
- [x] Update existing profile
- [x] Delete profile (auto-switches if active)
- [x] Profile name validation
- [x] Custom endpoint support
- [x] Credentials isolated per profile
- [x] Run query uses active profile
- [x] Test connection shows profile name
- [x] Compilation successful
- [ ] Integration test: Run queries with different profiles
- [ ] Integration test: Credential persistence after restart

### 📚 Documentation

- **[MULTI-PROFILE-GUIDE.md](MULTI-PROFILE-GUIDE.md)**: Comprehensive guide to multi-profile features
- **[README.md](README.md)**: Updated with multi-profile overview
- **[IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)**: Developer documentation (needs update)

### 🚀 Future Enhancements

1. **Profile Management UI**
   - Dedicated view for managing profiles
   - Edit profiles without re-entering credentials
   - Drag-to-reorder profiles

2. **Profile Features**
   - Import/export profile metadata (credentials excluded)
   - Profile groups or tags
   - Auto-switch based on workspace or file path
   - Per-profile query history

3. **User Experience**
   - Profile quick-pick with search
   - Recent profiles list
   - Profile icons or colors
   - Keyboard shortcuts for common profiles

4. **Enterprise Features**
   - Profile templates
   - Shared profile metadata (credentials remain local)
   - Profile validation and health checks

### 🐛 Known Issues

None at this time.

### 💡 Usage Tips

1. **Profile Naming**: Use descriptive names that indicate purpose
   - ✅ `Prod-US1`, `Dev-EU`, `Customer-Acme-AU`
   - ❌ `Profile1`, `Test`, `New`

2. **Testing**: After creating a profile, run `Test Connection` to verify

3. **Status Bar**: Keep an eye on the status bar to know which org you're querying

4. **Deletion**: Delete unused profiles to keep the list manageable

5. **Updates**: If credentials change, use "Create/Update" with the same profile name

### 📞 Support

For issues or questions about multi-profile support:
- See [MULTI-PROFILE-GUIDE.md](MULTI-PROFILE-GUIDE.md) for detailed documentation
- Check "Troubleshooting" section for common issues
- Report bugs via GitHub issues
