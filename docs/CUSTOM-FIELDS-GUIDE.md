# Custom Fields Autocomplete Guide

This guide explains how to fetch and cache custom fields from your Sumo Logic organization for use in autocomplete.

## Overview

Sumo Logic allows you to define [custom fields](https://help.sumologic.com/docs/manage/fields/) to extract specific values from your logs. This extension can fetch those custom field definitions and add them to autocomplete, making it easier to write queries using your organization's custom fields.

## Prerequisites

⚠️ **Permission Required**: Your user role must have the **"Manage fields"** capability to use this feature.

If you don't have this permission, you'll see a warning message and the command will fail gracefully without affecting other functionality.

## How to Use

### Step 1: Fetch Custom Fields

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Run: `Sumo Logic: Fetch Custom Fields for Autocomplete`
3. Wait for the API call to complete

### Step 2: Start Writing Queries

Your custom fields are now available in autocomplete! As you type, you'll see:

```sumo
_sourceCategory=prod
| where custom_field_  <-- Autocomplete shows your custom fields! ✨
```

## What Gets Added

When you fetch custom fields:

- ✅ All custom field names are added to autocomplete
- ✅ Each field is marked as "Custom field (from API)"
- ✅ Fields persist for your entire VS Code session
- ✅ Duplicates are automatically filtered

## Example Workflow

**Scenario: You have custom fields like `app_name`, `environment`, `user_id`**

1. Run `Fetch Custom Fields for Autocomplete`
2. See message: `Added 3 custom fields to autocomplete: app_name, environment, user_id`
3. Start typing a query:

```sumo
_sourceCategory=*
| where app_  <-- Autocomplete suggests: app_name ✨
| count by environment  <-- Already in autocomplete! ✨
```

## Autocomplete Sources

After fetching custom fields, your autocomplete includes:

1. **Built-in operators** - `count`, `sum`, `avg`, etc.
2. **Built-in metadata** - `_raw`, `_source`, `_sourceCategory`, etc.
3. **Query result fields** - Fields discovered from running queries
4. **Custom fields** - Fields fetched from the API ← **NEW!**

## Error Handling

### Permission Denied (403/401)

```
Unable to fetch custom fields: Insufficient permissions.
Your user role may not have "Manage fields" capability.
```

**Solution**: Contact your Sumo Logic admin to grant "Manage fields" capability, or continue using the extension without custom fields autocomplete.

### API Error

```
Failed to fetch custom fields: HTTP 500: Internal Server Error
```

**Solution**: Check your connection, verify the active profile is correct, and try again.

### No Custom Fields Found

```
No custom fields found in this organization.
```

**Solution**: Your organization hasn't defined any custom fields yet. This is normal for new organizations.

## Session Persistence

- **Custom fields persist** for your entire VS Code session
- **Restart VS Code** to clear custom fields and fetch fresh data
- **Switch profiles** and re-fetch to get custom fields from different orgs

## Multi-Profile Support

Custom fields are **session-global**, not profile-specific:

- Fetch custom fields from Profile A → They appear in autocomplete
- Switch to Profile B and fetch → Fields from both A and B appear
- To clear: Restart VS Code or use developer console

## API Details

**Endpoint**: `GET /api/v1/fields`

**Response Structure**:
```json
{
  "data": [
    {
      "id": "00000000000001C8",
      "fieldName": "app_name",
      "dataType": "String",
      "state": "Enabled"
    },
    {
      "id": "00000000000001C9",
      "fieldName": "environment",
      "dataType": "String",
      "state": "Enabled"
    }
  ]
}
```

## Comparison: Custom Fields vs Query Results

| Feature | Custom Fields | Query Result Fields |
|---------|---------------|---------------------|
| **Source** | API (`/api/v1/fields`) | Query execution results |
| **When Added** | Manual command | Automatic after query |
| **Permission** | Requires "Manage fields" | No special permission |
| **Scope** | Organization-defined fields | Any field in results |
| **Icon** | Field icon | Field icon |
| **Detail** | "Custom field (from API)" | "Field from query results" |

## Tips

1. **Fetch once per session**: Custom fields don't change often, so fetch them once when you start working

2. **Check permissions first**: Run `Test Connection` to verify your credentials before fetching custom fields

3. **Combine approaches**: Use both custom fields fetch AND query results for comprehensive autocomplete

4. **Field naming**: Custom fields often use prefixes like `custom_`, `app_`, `user_` - use these to filter autocomplete

## Troubleshooting

### Fields Not Appearing in Autocomplete

1. Check the success message after running the command
2. Verify fields were added: Look for console log
3. Try typing the exact field name to test
4. Restart VS Code and fetch again

### Too Many Fields in Autocomplete

This is normal! Autocomplete combines:
- ~100 built-in operators
- ~15 metadata fields
- N query result fields
- M custom fields

Use the first few characters to filter the list quickly.

### Want to Clear Custom Fields

**Option 1**: Restart VS Code

**Option 2**: Developer Console
```javascript
// Not recommended, but available if needed
// Open Developer Tools and run:
// Clear is not exposed via command, restart is recommended
```

## Best Practices

✅ **DO**: Fetch custom fields once per session when starting work

✅ **DO**: Check permissions before using in team environments

✅ **DO**: Combine with query result discovery for best coverage

❌ **DON'T**: Fetch custom fields repeatedly (they're cached)

❌ **DON'T**: Expect real-time updates (cache is session-scoped)

## Future Enhancements

Planned improvements:
- Auto-fetch on profile switch (with user setting)
- Per-profile custom field caching
- Refresh command to update cached fields
- Field type information in hover documentation
- Filter by field state (Enabled/Disabled)

## References

- [Sumo Logic Custom Fields Documentation](https://help.sumologic.com/docs/manage/fields/)
- [Fields API Documentation](https://api.sumologic.com/docs/#operation/listCustomFields)
- [Field Extraction Rules](https://help.sumologic.com/docs/manage/field-extractions/)
