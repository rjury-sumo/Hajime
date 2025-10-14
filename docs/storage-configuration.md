# Storage Configuration

## Overview

The Sumo Logic extension stores profile data, cached metadata, library content, and query output files in a configurable location. By default, this data is stored in the user's home directory to ensure persistence across all VSCode workspaces.

## Default Storage Location

**`~/.sumologic/`** (User home directory)

This location is used when the `sumologic.fileStoragePath` setting is empty (the default).

### Directory Structure

```
~/.sumologic/
├── <profile1>/
│   ├── library/
│   │   ├── library_cache.db        # SQLite cache for library content
│   │   └── content/
│   │       ├── <contentId1>.json   # Full JSON exports
│   │       ├── <contentId2>.json
│   │       └── ...
│   ├── metadata/
│   │   ├── partitions.json         # Cached partitions
│   │   ├── customfields.json       # Cached custom fields
│   │   └── keys_*.json             # Cached metadata keys
│   ├── queries/
│   │   └── *.csv                   # Query results
│   ├── folders/
│   │   └── *.txt                   # Folder exports
│   ├── content/
│   │   ├── *.json                  # Content exports (JSON)
│   │   └── *.md                    # Content exports (Markdown)
│   └── *.sumo                      # Recent query files
├── <profile2>/
│   └── ...
└── <profile3>/
    └── ...
```

## Why Home Directory?

**Rationale**: Profile credentials, cached metadata, and library content should persist globally across all projects:

1. **Credentials**: Stored in VSCode Secret Storage, but profile configurations are global
2. **Library Cache**: Content library structure rarely changes between projects
3. **Metadata Cache**: Partitions, custom fields, etc. are organization-level, not project-level
4. **Query History**: Users may want to reference queries across different workspaces

## Custom Storage Paths

You can override the default location using the `sumologic.fileStoragePath` setting.

### Configuration Examples

#### Example 1: Use a specific directory
```json
{
  "sumologic.fileStoragePath": "/Users/username/Documents/sumo-data"
}
```

#### Example 2: Use workspace-relative path (legacy behavior)
```json
{
  "sumologic.fileStoragePath": "${workspaceFolder}/output"
}
```

#### Example 3: Use subdirectory in home
```json
{
  "sumologic.fileStoragePath": "${userHome}/Documents/sumologic-profiles"
}
```

#### Example 4: Relative path (resolved relative to home directory)
```json
{
  "sumologic.fileStoragePath": "sumologic-data"
}
```
This resolves to `~/sumologic-data/`

## Variable Substitution

The following variables are supported in `sumologic.fileStoragePath`:

| Variable | Description | Example |
|----------|-------------|---------|
| `${userHome}` | User's home directory | `/Users/username` (macOS)<br>`C:\Users\Username` (Windows)<br>`/home/username` (Linux) |
| `${workspaceFolder}` | Current workspace root | `/Users/username/projects/myapp` |

**Note**: If `${workspaceFolder}` is used but no workspace is open, the extension falls back to `~/.sumologic/`

## Path Resolution Logic

1. If `sumologic.fileStoragePath` is **empty** → use `~/.sumologic/`
2. If `sumologic.fileStoragePath` is **absolute** → use as-is
3. If `sumologic.fileStoragePath` contains **variables** → substitute and resolve
4. If `sumologic.fileStoragePath` is **relative** and workspace is open → resolve relative to workspace
5. If `sumologic.fileStoragePath` is **relative** and no workspace → resolve relative to home directory

## Migration from Workspace-Local Storage

If you previously used the extension with workspace-relative storage (`${workspaceFolder}/output`), your data will remain in that location until you:

1. Manually move the profile directories to `~/.sumologic/`, OR
2. Re-create your profiles (which will create them in the new default location)

### Manual Migration Steps

```bash
# Example: Move from workspace to home directory
mv /path/to/workspace/output/my-profile ~/.sumologic/my-profile
```

## Accessing Storage Location

To find out where your data is stored:

1. Open VSCode Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Run: `Sumo Logic: List Profiles`
3. The profile directory paths will be shown in the output

Alternatively, check the setting:
```bash
# View current setting
code --list-extensions --show-versions | grep sumologic
```

## Security Considerations

- **Credentials**: Stored securely in VSCode Secret Storage (not in filesystem)
- **Profile Data**: Stored in plaintext JSON/SQLite files
- **Access Control**: Uses standard filesystem permissions (`chmod 755` on Unix)
- **Sensitive Data**: Avoid storing sensitive queries or data in profile directories if shared storage is used

## Troubleshooting

### Issue: "No workspace folder open" error
**Cause**: You have `${workspaceFolder}` in your `fileStoragePath` setting but no workspace is open.

**Solution**: Either:
- Open a workspace, OR
- Clear the `sumologic.fileStoragePath` setting to use default home directory, OR
- Set an absolute path or use `${userHome}`

### Issue: Permission denied when creating directories
**Cause**: The configured path does not have write permissions.

**Solution**:
- Verify directory permissions
- Use a path where you have write access
- On Unix/Linux: `chmod 755 ~/.sumologic`

### Issue: Profiles not persisting across workspaces
**Cause**: Using workspace-relative path (`${workspaceFolder}/output`)

**Solution**: Clear the `sumologic.fileStoragePath` setting to use the default home directory location.

## FAQ

**Q: Can I use a cloud-synced directory (Dropbox, iCloud, etc.)?**
A: Yes, but be cautious:
- SQLite databases may not handle concurrent access well if synced while open
- Large library caches may consume significant sync bandwidth
- Consider excluding `library/` from sync if only syncing query files

**Q: Can different machines share the same storage?**
A: Credentials are machine-specific (stored in VSCode Secret Storage), but cached data can be shared via network storage or sync services. You'll need to re-enter credentials on each machine.

**Q: How much disk space does this use?**
A: Typical usage:
- SQLite cache: 1-10 MB per profile (depends on library size)
- JSON exports: 1-100 KB per content item
- Query results: Varies (CSV files can be large)
- Total per profile: Usually < 50 MB

**Q: How do I reset/clear all cached data?**
A: Delete the profile directory:
```bash
rm -rf ~/.sumologic/my-profile/
```
Then run `Sumo Logic: Fetch Partitions` and other cache commands to repopulate.

---

**Document Version**: 1.0
**Last Updated**: 2025-10-14
**Applies to**: Extension v0.0.3+
