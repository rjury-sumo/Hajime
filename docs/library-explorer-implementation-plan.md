# Content Library Explorer - Implementation Plan

## Overview
Add a hierarchical tree view to navigate the Sumo Logic Content Library within the VSCode extension, supporting multiple profiles with lazy-loaded, cached content nodes.

## Architecture Decisions

### Data Loading Strategy
- **Lazy Loading**: Fetch child nodes only when a user expands a parent node
- **Caching**: Store fetched nodes locally, update only on explicit refresh or first-time expansion
- **Rate Limiting**: Synchronous API calls (max 4 per second per access key) - no parallel requests

### Storage Architecture
- **Default Storage Location**: `~/.sumologic/<profile>/` (user home directory)
  - Persists across all workspaces/projects
  - Configurable via `sumologic.fileStoragePath` setting
  - Supports variables: `${userHome}`, `${workspaceFolder}`
- **SQLite Database**: Store content metadata (id, name, description, itemType, created/modified dates, parentId, profile)
  - Location: `~/.sumologic/<profile>/library/library_cache.db`
  - Enables fast lookups, queries, and relationship traversal
- **JSON Files**: Store complete API responses
  - Location: `~/.sumologic/<profile>/library/content/<contentId>.json`
  - Preserves full content detail for export/display operations

### Tree Structure
- **Multi-Profile Support**: Show all profiles with expandable Library nodes
- **Four Top-Level Nodes per Profile**:
  1. Personal (GET folder API - fast)
  2. Global (Export content - uses `data` array for children)
  3. Admin Recommended (Export content - uses `children` array)
  4. Installed Apps (Export content - uses `children` array)

### Property Display
- **Quick View**: VSCode Quick Pick showing key properties (id, name, type, description, dates)
- **Full View**: Option to open JSON file in editor
- **Tooltip**: Show name, type, and both hex/decimal IDs

## Implementation Components

### 1. Utility Module: `src/utils/contentId.ts`
**Purpose**: Convert between hex and decimal content IDs

```typescript
export function hexToDecimal(hexId: string): string;
export function decimalToHex(decimalId: string): string;
export function formatContentId(hexId: string): string; // Returns "hex (decimal)"
```

### 2. Database Module: `src/database/libraryCache.ts`
**Purpose**: SQLite operations for content metadata

**Schema**:
```sql
CREATE TABLE content_items (
  id TEXT PRIMARY KEY,              -- Hex content ID
  profile TEXT NOT NULL,            -- Profile name
  name TEXT NOT NULL,
  itemType TEXT NOT NULL,           -- Folder, Dashboard, Search, etc.
  parentId TEXT,
  description TEXT,
  createdAt TEXT,
  createdBy TEXT,
  modifiedAt TEXT,
  modifiedBy TEXT,
  hasChildren BOOLEAN DEFAULT 0,    -- True if Folder or has children array
  childrenFetched BOOLEAN DEFAULT 0,-- True if children have been loaded
  permissions TEXT,                 -- JSON array as string
  lastFetched TEXT,                 -- ISO timestamp of last API fetch
  FOREIGN KEY (profile) REFERENCES profiles(name)
);

CREATE INDEX idx_profile_parent ON content_items(profile, parentId);
CREATE INDEX idx_profile_type ON content_items(profile, itemType);
```

**Key Methods**:
```typescript
class LibraryCacheDB {
  constructor(profileName: string);

  // Core operations
  async upsertContentItem(item: ContentItem): Promise<void>;
  async getContentItem(id: string): Promise<ContentItem | null>;
  async getChildren(parentId: string): Promise<ContentItem[]>;
  async markChildrenFetched(parentId: string): Promise<void>;
  async needsRefresh(id: string, maxAgeMinutes: number = 30): Promise<boolean>;

  // Utility
  async deleteProfile(profileName: string): Promise<void>;
  async close(): Promise<void>;
}
```

### 3. Content Client Extensions: `src/api/content.ts`
**Purpose**: Add methods to handle Library-specific API calls

**New Methods**:
```typescript
// Get Personal folder (top-level only, no children)
async getPersonalFolderTopLevel(): Promise<ApiResponse<ContentFolder>>;

// Get folder with children (for expanding nodes)
async getFolderWithChildren(folderId: string): Promise<ApiResponse<ContentFolder>>;

// Export content (for non-Folder items and special top-level nodes)
async exportContentById(contentId: string): Promise<ApiResponse<ExportedContent>>;

// Batch operations (respects rate limiting)
async batchGetFolders(folderIds: string[], delayMs: number = 250): Promise<Map<string, ContentFolder>>;
```

### 4. Library Tree Provider: `src/views/libraryExplorer.ts`
**Purpose**: VSCode TreeDataProvider for Library navigation

**Tree Item Types**:
```typescript
enum LibraryItemType {
  ProfileLibraryRoot = 'profileLibraryRoot',  // "Library" node under profile
  TopLevelNode = 'topLevelNode',              // Personal, Global, Admin, Apps
  Folder = 'folder',                          // Expandable folder
  Content = 'content',                        // Dashboard, Search, etc.
}

class LibraryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly profile: string,
    public readonly contentId: string,
    public readonly itemType: string,
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly hasChildren: boolean,
    public readonly childrenFetched: boolean
  );
}
```

**Key Methods**:
```typescript
class LibraryExplorerProvider implements vscode.TreeDataProvider<LibraryTreeItem> {
  // Standard TreeDataProvider methods
  getTreeItem(element: LibraryTreeItem): vscode.TreeItem;
  async getChildren(element?: LibraryTreeItem): Promise<LibraryTreeItem[]>;

  // Library-specific operations
  private async getTopLevelNodes(profile: SumoLogicProfile): Promise<LibraryTreeItem[]>;
  private async fetchPersonalFolder(profile: SumoLogicProfile): Promise<LibraryTreeItem>;
  private async fetchTopLevelExport(
    profile: SumoLogicProfile,
    nodeType: 'global' | 'adminRecommended' | 'installedApps'
  ): Promise<LibraryTreeItem>;

  private async expandFolder(item: LibraryTreeItem): Promise<LibraryTreeItem[]>;
  private async expandNonFolder(item: LibraryTreeItem): Promise<void>; // Triggers export

  // Cache management
  private async populateFromCache(item: LibraryTreeItem): Promise<LibraryTreeItem[]>;
  private async fetchAndCache(item: LibraryTreeItem): Promise<void>;

  // Refresh operations
  async refreshNode(item: LibraryTreeItem): Promise<void>;
  async refreshEntireTree(): Promise<void>;
}
```

**Icon Strategy**:
```typescript
private getIconForItemType(itemType: string): vscode.ThemeIcon {
  const iconMap: Record<string, string> = {
    'Folder': 'folder',
    'Dashboard': 'dashboard',
    'Search': 'search',
    'Lookups': 'table',
    'Report': 'file-text',
    // ... other types
  };
  return new vscode.ThemeIcon(iconMap[itemType] || 'file');
}
```

### 5. Library Commands: `src/commands/library.ts`
**Purpose**: User-invoked commands for Library operations

**Commands**:
```typescript
// View node details in Quick Pick
export async function viewLibraryNodeDetails(
  context: vscode.ExtensionContext,
  treeItem: LibraryTreeItem
): Promise<void>;

// Open JSON representation in editor
export async function openLibraryNodeJson(
  context: vscode.ExtensionContext,
  treeItem: LibraryTreeItem
): Promise<void>;

// Copy content ID (hex) to clipboard
export async function copyLibraryNodeId(
  treeItem: LibraryTreeItem
): Promise<void>;

// Copy content path to clipboard
export async function copyLibraryNodePath(
  treeItem: LibraryTreeItem
): Promise<void>;

// Open in Sumo Logic web UI
export async function openLibraryNodeInWeb(
  context: vscode.ExtensionContext,
  treeItem: LibraryTreeItem
): Promise<void>;

// Refresh specific node (re-fetch from API)
export async function refreshLibraryNode(
  context: vscode.ExtensionContext,
  treeItem: LibraryTreeItem
): Promise<void>;

// Export node content to file (markdown/JSON/both)
export async function exportLibraryNodeToFile(
  context: vscode.ExtensionContext,
  treeItem: LibraryTreeItem
): Promise<void>;
```

### 6. Integration: `src/views/sumoExplorer.ts`
**Purpose**: Add Library node to existing tree structure

**Modifications**:
```typescript
// Add new tree item type
enum TreeItemType {
  // ... existing types
  LibrarySection = 'librarySection',
}

// In getRootItems(), add Library section per profile
private async getRootItems(): Promise<SumoTreeItem[]> {
  // ... existing code

  // For each profile (or just active profile), add Library node
  items.push(new SumoTreeItem(
    'Library',
    TreeItemType.LibrarySection,
    vscode.TreeItemCollapsibleState.Collapsed,
    activeProfile
  ));

  return items;
}

// Delegate to LibraryExplorerProvider when expanding Library nodes
async getChildren(element?: SumoTreeItem): Promise<SumoTreeItem[]> {
  // ... existing switch cases

  case TreeItemType.LibrarySection:
    return this.libraryExplorerProvider.getChildren(element);
}
```

### 7. Context Menu: `package.json`
**Purpose**: Right-click actions on Library tree items

```json
"menus": {
  "view/item/context": [
    {
      "command": "sumologic.viewLibraryNodeDetails",
      "when": "view == sumoExplorer && viewItem =~ /^library/",
      "group": "navigation@1"
    },
    {
      "command": "sumologic.openLibraryNodeJson",
      "when": "view == sumoExplorer && viewItem =~ /^library/",
      "group": "navigation@2"
    },
    {
      "command": "sumologic.openLibraryNodeInWeb",
      "when": "view == sumoExplorer && viewItem =~ /^library/",
      "group": "navigation@3"
    },
    {
      "command": "sumologic.copyLibraryNodeId",
      "when": "view == sumoExplorer && viewItem =~ /^library/",
      "group": "clipboard@1"
    },
    {
      "command": "sumologic.copyLibraryNodePath",
      "when": "view == sumoExplorer && viewItem =~ /^library/",
      "group": "clipboard@2"
    },
    {
      "command": "sumologic.refreshLibraryNode",
      "when": "view == sumoExplorer && viewItem =~ /^library/",
      "group": "refresh@1"
    },
    {
      "command": "sumologic.exportLibraryNodeToFile",
      "when": "view == sumoExplorer && viewItem =~ /^library/",
      "group": "export@1"
    }
  ]
}
```

## Implementation Phases

### Phase 1: Foundation (Core Infrastructure)
**Goal**: Set up database, utilities, and basic tree structure

**Tasks**:
1. Create `src/utils/contentId.ts` with hex/decimal conversion functions
2. Create `src/database/libraryCache.ts` with SQLite schema and operations
3. Add library-specific methods to `src/api/content.ts`
4. Update `src/profileManager.ts` to create library directories
5. Write unit tests for contentId utilities and database operations

**Acceptance Criteria**:
- Hex/decimal conversion works bidirectionally
- Database can store and retrieve content items
- Profile directories include library subfolder
- Rate limiting helper functions work correctly

### Phase 2: Tree Provider (Display Layer)
**Goal**: Display Library tree with lazy loading

**Tasks**:
1. Create `src/views/libraryExplorer.ts` with TreeDataProvider implementation
2. Implement lazy loading for folder expansion
3. Add top-level node fetching (Personal, Global, Admin, Apps)
4. Integrate with existing `src/views/sumoExplorer.ts`
5. Add icons for different content types
6. Update `src/extension.ts` to register tree provider

**Acceptance Criteria**:
- Library node appears under each profile in tree
- Expanding "Library" shows 4 top-level nodes
- Expanding "Personal" fetches and displays folder contents
- Expanding folders shows children from cache or API
- Icons display correctly for each item type
- Multiple profiles show independent library trees

### Phase 3: Commands (Interaction Layer)
**Goal**: Enable user interactions with library nodes

**Tasks**:
1. Create `src/commands/library.ts` with all command implementations
2. Register commands in `src/extension.ts`
3. Add context menu entries to `package.json`
4. Implement Quick Pick for node details display
5. Implement JSON export and editor opening
6. Implement clipboard copy operations (ID, path)
7. Implement "Open in Web" with decimal ID conversion

**Acceptance Criteria**:
- Right-click menu shows all relevant options
- View Details shows Quick Pick with key properties
- Open JSON opens editor with formatted content
- Copy ID copies hex ID to clipboard
- Copy Path copies full content path
- Open in Web opens correct library URL with decimal ID
- Refresh updates node from API

### Phase 4: Cache Management (Performance Layer)
**Goal**: Optimize performance and handle stale data

**Tasks**:
1. Implement cache expiration checks (default 30 minutes)
2. Add configuration setting for cache TTL
3. Implement background refresh for stale nodes (optional)
4. Add cache statistics view command
5. Add "Clear Cache" command for profile
6. Handle profile switching and cache loading

**Acceptance Criteria**:
- Stale nodes show visual indicator (e.g., faded icon)
- Refresh command updates stale nodes
- Cache TTL configurable in settings
- Profile switching loads correct cached data
- Clear cache command removes all cached data for profile

### Phase 5: Edge Cases & Polish
**Goal**: Handle errors, edge cases, and UX refinement

**Tasks**:
1. Handle API errors gracefully (403, 404, 429 rate limiting)
2. Show progress indicators for slow operations
3. Handle empty folders and leaf nodes correctly
4. Add loading states for expanding nodes
5. Handle profile deletion (clean up library cache)
6. Add telemetry/logging for debugging
7. Write integration tests
8. Update documentation

**Acceptance Criteria**:
- 403 errors show "Insufficient permissions" message
- 429 errors trigger exponential backoff retry
- Empty folders show "(empty)" child node
- Loading spinner shows during API calls
- Profile deletion removes library cache
- Error logs provide actionable information
- All edge cases documented

## Data Flow Examples

### Example 1: Expanding Personal Folder (First Time)
```
1. User clicks "Personal" node under "rick" profile
2. TreeProvider.getChildren() called with PersonalNode
3. Check cache: childrenFetched = false
4. Call ContentClient.getPersonalFolderTopLevel()
5. Parse response, insert items into LibraryCacheDB
6. Mark Personal node as childrenFetched = true
7. Return child TreeItems to VSCode
8. Save JSON to /output/rick/library/content/00000000005E5403.json
```

### Example 2: Expanding Folder (Cached)
```
1. User clicks "Log Portal" folder
2. TreeProvider.getChildren() called with FolderNode (id: 00000000020E7ECB)
3. Check cache: childrenFetched = true
4. Query LibraryCacheDB.getChildren(00000000020E7ECB)
5. Return cached child TreeItems to VSCode
6. No API call needed
```

### Example 3: Refreshing Stale Node
```
1. User right-clicks "Admin Recommended" node
2. User selects "Refresh"
3. Call ContentClient.exportAdminRecommended()
4. Parse response, update items in LibraryCacheDB
5. Update lastFetched timestamp
6. TreeProvider.refresh() fires event
7. VSCode re-renders tree branch
```

### Example 4: Opening Dashboard in Web
```
1. User right-clicks "Metadata Explorer" dashboard (id: 0000000001E6FB2B)
2. User selects "Open in Library Web UI"
3. Call hexToDecimal("0000000001E6FB2B") → "32046891"
4. Get profile instanceName: "rick.au.sumologic.com"
5. Construct URL: "https://rick.au.sumologic.com/library/32046891"
6. Call vscode.env.openExternal(url)
```

## Configuration Settings

```json
"sumologic.library.cacheTTL": {
  "type": "number",
  "default": 30,
  "description": "Cache time-to-live in minutes for library content"
},
"sumologic.library.autoRefreshStale": {
  "type": "boolean",
  "default": false,
  "description": "Automatically refresh stale nodes on expansion"
},
"sumologic.library.showItemCounts": {
  "type": "boolean",
  "default": true,
  "description": "Show child item counts in folder labels"
},
"sumologic.library.defaultExportFormat": {
  "type": "string",
  "enum": ["json", "markdown", "both"],
  "default": "both",
  "description": "Default format for exporting library content"
}
```

## Database Queries Reference

```sql
-- Get all children of a folder
SELECT * FROM content_items
WHERE profile = ? AND parentId = ?
ORDER BY itemType, name;

-- Check if node needs refresh
SELECT lastFetched FROM content_items
WHERE id = ? AND profile = ?;

-- Get all top-level nodes for profile
SELECT * FROM content_items
WHERE profile = ? AND parentId = '0000000000000000'
ORDER BY name;

-- Get content item with parent path
WITH RECURSIVE item_path AS (
  SELECT id, name, parentId, 0 as level
  FROM content_items WHERE id = ? AND profile = ?
  UNION ALL
  SELECT c.id, c.name, c.parentId, level + 1
  FROM content_items c
  JOIN item_path p ON c.id = p.parentId
  WHERE c.profile = ?
)
SELECT * FROM item_path ORDER BY level DESC;

-- Delete all items for a profile
DELETE FROM content_items WHERE profile = ?;
```

## Testing Strategy

### Unit Tests
- `contentId.test.ts`: Hex/decimal conversion edge cases
- `libraryCache.test.ts`: Database CRUD operations
- `content.test.ts`: API response parsing for different item types

### Integration Tests
- `libraryExplorer.test.ts`: Tree expansion with mock API
- `libraryCommands.test.ts`: Command execution with mock tree items
- `profileSwitch.test.ts`: Cache isolation between profiles

### Manual Testing Checklist
- [ ] Create new profile, verify Library node appears
- [ ] Expand Personal folder, verify children load
- [ ] Expand Global folder, verify special handling of `data` array
- [ ] Expand Admin Recommended, verify `children` array handling
- [ ] Expand Installed Apps, verify correct rendering
- [ ] Expand deep folder hierarchy (3+ levels)
- [ ] Right-click → View Details shows correct properties
- [ ] Right-click → Open JSON opens editor with content
- [ ] Right-click → Copy ID copies hex to clipboard
- [ ] Right-click → Open in Web opens correct URL
- [ ] Right-click → Refresh updates node from API
- [ ] Switch profiles, verify Library trees are independent
- [ ] Delete profile, verify cache is cleaned up
- [ ] Trigger rate limit (429), verify retry behavior
- [ ] Expand folder with 100+ children, verify performance

## Dependencies

### New NPM Packages
```json
{
  "better-sqlite3": "^9.0.0",  // SQLite database
  "@types/better-sqlite3": "^7.6.8"
}
```

### Existing Dependencies (No Changes)
- `axios`: HTTP client for API calls
- `vscode`: VSCode extension API

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Rate limiting (429 errors) | High | Implement exponential backoff, queue requests, synchronous calls only |
| Large folders (1000+ items) | Medium | Add pagination, virtual scrolling, or warn user |
| Cache corruption | Medium | Add schema version, validate on load, provide "Clear Cache" command |
| API response changes | Low | Version check responses, graceful degradation |
| Multi-profile concurrency | Low | Separate DB per profile, no shared state |
| SQLite file locking | Low | Use WAL mode, single connection per profile |

## Future Enhancements (Out of Scope)

1. **Search/Filter**: Add search box to filter library tree
2. **Drag & Drop**: Move content between folders
3. **Duplicate/Copy**: Copy content to another location
4. **Share/Permissions**: Manage content permissions
5. **History/Audit**: View content change history
6. **Favorites/Bookmarks**: Pin frequently used content
7. **Sync to Workspace**: Auto-sync library content to local files
8. **Diff View**: Compare local vs remote content
9. **Bulk Operations**: Select multiple items for batch export
10. **Content Preview**: Inline preview of dashboard/search content

---

## Questions for Review

1. Should we support offline mode (read-only cache when API unreachable)?
2. Should we add visual indicators for permission levels on nodes?
3. Should "Personal" folder fetch be automatic on profile activation?
4. Should we cache negative results (404s) to avoid repeated failed fetches?
5. Should we add keyboard shortcuts for common operations?
6. Should we support exporting entire folder hierarchies as ZIP?
7. Should we add a "Recently Accessed" section in Library tree?
8. Should we integrate with existing "Content" section or replace it?

---

**Document Version**: 1.0
**Last Updated**: 2025-10-14
**Author**: Claude (AI Assistant)
**Reviewer**: User
