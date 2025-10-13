# Sumo Logic Extension - UX Improvement Plan

## Overview
This document outlines architectural recommendations for improving the Sumo Logic VS Code extension's user experience and interface design, based on VS Code extension best practices.

## Current State
- 27 commands, mostly accessible only via Command Palette (Cmd+Shift+P)
- Limited UI surface area (editor toolbar buttons only)
- No dedicated sidebar or persistent UI
- Basic status bar integration

## Critical UX Improvements

### 1. **Add Tree View Sidebar** 🎯 **TOP PRIORITY**

Create a dedicated sidebar view as the primary interface for the extension.

**Recommended structure:**
- **Sumo Logic Explorer** view with:
  - Profile switcher at top (current active profile)
  - Content browser (folders, saved searches, dashboards)
  - Recent queries history
  - Collectors & sources tree
  - Quick actions (New Query, Test Connection, etc.)

**Benefits:**
- Reduces command palette dependency by 70-80%
- Provides persistent context
- Better discoverability
- Central hub for all Sumo Logic operations

**Implementation:**
- Create `SumoLogicViewProvider` implementing `vscode.TreeDataProvider`
- Add `viewsContainers` and `views` contributions in `package.json`
- Organize tree items hierarchically with icons
- Add click/expand handlers for navigation

---

### 2. **Status Bar Enhancements**

Enhance the existing status bar to show more contextual information.

**Add:**
- Active profile name (clickable to switch)
- Connection status indicator (✓ connected / ✗ disconnected)
- Last query execution time/status
- Quick action buttons

**Implementation:**
- Extend `StatusBarManager` class
- Add tooltips with detailed info
- Make items clickable to trigger relevant commands

---

### 3. **Context Menus**

Add right-click context menus for better discoverability.

**Editor context menu** (when in .sumo files):
- Run Query
- Run in Webview
- Run and Chart
- Save to Sumo Logic
- Format Query

**Explorer context menu** (for .sumo/.csv files):
- Import/Export content
- Chart CSV data

**Implementation:**
- Add `editor/context`, `explorer/context` contributions in `package.json`
- Use `when` clauses to show context-appropriate items

---

### 4. **Command Organization**

Reorganize 27 commands into logical groups with consistent naming.

**Proposed structure:**

```
Sumo Logic: Query
  ├─ New Query File
  ├─ Run Query
  ├─ Run Query (Webview)
  └─ Run Query and Chart

Sumo Logic: Profile
  ├─ Create/Update Profile
  ├─ Switch Profile
  ├─ List Profiles
  ├─ Delete Profile
  └─ Test Connection

Sumo Logic: Content
  ├─ Export Content by ID
  ├─ Export Admin Recommended
  ├─ Export Global Folder
  ├─ Export Installed Apps
  ├─ Get Personal Folder
  ├─ Get Folder by ID
  └─ Get Content by Path

Sumo Logic: Data Collection
  ├─ Fetch Collectors
  ├─ Get Collector by ID
  ├─ Get Sources for Collector
  ├─ Fetch Custom Fields
  └─ Fetch Partitions

Sumo Logic: Developer
  ├─ View Autocomplete Data
  ├─ Clear Autocomplete Data
  ├─ Cache Key Metadata
  └─ Cleanup Old Files

Sumo Logic: Visualization
  ├─ Chart CSV Data
  └─ Run Query and Chart
```

**Implementation:**
- Update command titles in `package.json` to follow consistent pattern
- Add `when` clauses to hide irrelevant commands
- Group related commands together

---

### 5. **Add CodeLens**

Provide inline code actions above queries in .sumo files.

**Example:**
```
▶ Run | 📊 Chart | 🔍 Explain | 💾 Save to Sumo Logic
_sourceCategory=prod | count by _sourceHost
```

**Implementation:**
- Create `SumoLogicCodeLensProvider` implementing `vscode.CodeLensProvider`
- Register for `.sumo` language
- Parse queries and add action lenses
- Support multi-query files with lens per query

---

### 6. **Query Results Panel**

Create a dedicated output panel instead of relying on CSV files.

**Features:**
- Tabbed results (multiple concurrent queries)
- Inline charts/visualization
- Export options (CSV, JSON, etc.)
- Query history in same panel
- Re-run capability
- Copy individual cells or rows

**Implementation:**
- Create custom webview panel
- Use VS Code webview API
- Persist panel state across sessions
- Add keyboard navigation

---

### 7. **Welcome/Walkthrough**

Improve first-time user experience.

**Features:**
- Interactive walkthrough for profile setup
- Sample queries library
- Getting started tutorial
- Link to documentation

**Implementation:**
- Add `walkthroughs` contribution in `package.json`
- Create welcome webview with quick start guide
- Show on first activation
- Add "Get Started" command

---

### 8. **Webview Enhancements**

Improve the current query results webview.

**Add:**
- In-panel query editing (modify query, re-run)
- Column sorting/filtering
- Export format selection
- Query performance metrics (execution time, rows returned)
- Pagination controls
- Search within results

**Implementation:**
- Enhance existing webview HTML/CSS/JS
- Add message passing for interactions
- Implement client-side sorting/filtering for performance

---

### 9. **Keyboard Shortcuts**

Define intuitive default keybindings.

**Proposed shortcuts:**
- `Cmd+Enter` (Mac) / `Ctrl+Enter` (Win/Linux) - Run Query
- `Cmd+Shift+Enter` - Run Query in Webview
- `Cmd+Shift+N` - New Sumo Query File
- `Cmd+K Cmd+S` - Switch Profile
- `Cmd+Shift+C` - Chart Results

**Implementation:**
- Add `keybindings` contribution in `package.json`
- Use `when` clauses for context-appropriate activation
- Document in README

---

### 10. **Settings UI Contributions**

Improve settings management beyond JSON editing.

**Add dedicated UI for:**
- Profile management (list, create, edit, delete)
- Query defaults (timeout, row limits)
- Auto-refresh intervals
- Formatting preferences
- Cache management

**Implementation:**
- Add structured settings in `configuration` contribution
- Use `enum`, `number`, `boolean` types for better UX
- Add validation and descriptions
- Consider custom settings webview for complex config

---

## Architecture Pattern Recommendations

### Design Patterns to Implement

1. **ViewProvider pattern** - Create `SumoLogicViewProvider` for tree view
2. **WebviewViewProvider** - For persistent result panels in sidebar
3. **HoverProvider** - Show field statistics/examples on hover
4. **DocumentFormattingProvider** - Format .sumo queries (align pipes, indent, etc.)
5. **ProgressLocation.Notification** - Better feedback for long operations
6. **DiagnosticCollection** - Show syntax errors/warnings in problems panel
7. **CodeActionProvider** - Quick fixes for common issues
8. **DefinitionProvider** - Jump to field/parser definitions

### Code Organization

```
src/
├── views/
│   ├── sumoExplorer.ts          # Main tree view
│   ├── queryHistory.ts          # Recent queries view
│   └── resultsPanel.ts          # Results webview
├── providers/
│   ├── codeLensProvider.ts
│   ├── hoverProvider.ts
│   ├── formattingProvider.ts
│   └── diagnosticsProvider.ts
├── webviews/
│   ├── results/                 # Query results webview
│   ├── welcome/                 # Welcome page
│   └── settings/                # Settings UI
├── commands/                    # Existing
├── api/                         # API client utilities
└── utils/                       # Shared utilities
```

---

## Low-Hanging Fruit (Quick Wins)

These can be implemented quickly for immediate impact:

1. **File icons** - Add custom icon for .sumo files (iconTheme contribution)
2. **"When" clauses** - Only show relevant commands based on context
3. **MRU Quick Pick** - Most Recently Used profiles at top of switcher
4. **Validation diagnostics** - Red squiggles for syntax errors
5. **Folding ranges** - Collapse multi-line queries
6. **Bracket matching** - Highlight matching parentheses/brackets
7. **Comment toggling** - `Cmd+/` to comment lines
8. **Word pattern** - Better word selection for Sumo Logic operators

---

## Priority Implementation Order

Recommended sequence for implementation:

### Phase 1: Core UI (Highest Impact)
1. ✅ **Tree View Sidebar** (transforms UX completely)
2. **Context Menus** (better discoverability)
3. **CodeLens** (inline actions)

### Phase 2: Developer Experience
4. **Keyboard Shortcuts** (power user experience)
5. **Command Organization** (cleanup and categorization)
6. **Status Bar Enhancements** (always-visible context)

### Phase 3: Results & Visualization
7. **Query Results Panel** (better output handling)
8. **Webview Enhancements** (richer interactions)

### Phase 4: Onboarding & Polish
9. **Welcome Experience** (onboarding)
10. **Settings UI** (better configuration)

### Phase 5: Advanced Features
11. **Quick Wins** (small improvements)
12. **Additional Providers** (hover, diagnostics, etc.)

---

## Success Metrics

Track these metrics to measure improvement:

- **Command Palette Usage** - Reduce by 70-80% for common operations
- **Time to First Query** - Reduce setup time for new users
- **Query Execution Efficiency** - Faster access to run operations
- **User Feedback** - Collect ratings/reviews
- **Feature Discovery** - Track which features are actually used

---

## Migration Strategy

For existing users:

1. **Preserve existing workflows** - All commands remain functional
2. **Progressive enhancement** - New UI is additive, not replacing
3. **Migration guide** - Document new features in CHANGELOG
4. **Settings migration** - Auto-migrate old settings format if changed
5. **Backward compatibility** - Support older VS Code versions where possible

---

## Future Enhancements (Post-MVP)

Ideas for future consideration:

- **Query Templates** - Save and reuse common query patterns
- **Collaborative Features** - Share queries with team
- **AI-Powered Suggestions** - Query optimization hints
- **Integrated Alerting** - Manage alerts from VS Code
- **Dashboard Editor** - Create/edit dashboards visually
- **Git Integration** - Version control for queries
- **Query Performance Profiler** - Analyze slow queries
- **Scheduled Queries** - Background execution
- **Query Snippets** - Community-contributed patterns
- **Multi-Workspace Support** - Different profiles per workspace

---

## Resources

- [VS Code Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [VS Code UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/overview)
- [Tree View API](https://code.visualstudio.com/api/extension-guides/tree-view)
- [Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [Command API](https://code.visualstudio.com/api/references/commands)

---

## Notes

- Focus on **discoverability** - users should find features without reading docs
- Follow **VS Code design patterns** - leverage familiar UI elements
- Maintain **performance** - lazy load tree items, cache results
- Support **accessibility** - keyboard navigation, screen readers
- Enable **customization** - let users configure the experience
- Provide **feedback** - progress indicators, success/error messages

---

*Last Updated: 2025-10-13*
