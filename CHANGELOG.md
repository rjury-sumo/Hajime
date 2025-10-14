# Change Log

All notable changes to the "hajime" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added - Users & Roles Management (Latest)

#### Users & Roles Features
- **User Management API**: Added `UsersRolesClient` with methods to fetch all users and roles
- **SQLite Storage**: New `users_roles.db` database per profile storing user and role metadata
- **Users Webview**: Interactive table view for browsing organization users
  - Searchable by ID, name, email
  - Filterable by status (Active/Inactive)
  - Sortable columns with visual indicators
  - Displays role memberships, MFA status, lock status
  - Export to CSV functionality
- **Roles Webview**: Interactive table view for browsing organization roles
  - Searchable by ID, name, description
  - Shows capabilities, user counts
  - Sortable columns
  - Export to CSV functionality
- **Tree Integration**: Added Users and Roles nodes under each Profile in sidebar
  - Click to open respective webviews
  - Profile-specific data isolation
- **Commands**:
  - `sumologic.fetchUsers` - Fetch and cache all users
  - `sumologic.fetchRoles` - Fetch and cache all roles
  - `sumologic.fetchUsersAndRoles` - Fetch both simultaneously

#### User Enrichment Features
- **Database Viewer Enrichment**: Created By column now shows user emails instead of IDs
  - Cross-database JOIN using SQLite ATTACH DATABASE
  - Graceful fallback to user ID if email not available
- **Library Content Enrichment**: Created By and Modified By fields show emails
  - Works in all webview types (Dashboard, Search, Generic)
  - API-fetched content enriched in real-time
- **Library Node Details**: New professional webview for viewing node properties
  - Replaced Quick Pick with dedicated webview
  - Live API fetching via `getPathById` and `getItemByPath`
  - User email enrichment for creators and modifiers
  - Action buttons: Refresh, Copy ID, Copy Path, Open in Web, Export to File
  - Children table for folders with sortable columns
- **Database Schema**:
  - Users table with email, roles, status flags
  - Roles table with capabilities, user membership
  - Efficient indexing for fast lookups
  - Helper methods for enrichment (`getUserEmail`, `getUserName`, `getRoleName`)

#### Technical Improvements
- **API Client**: Added `getItemByPath(path)` method to ContentClient
- **Cross-Database Queries**: Implemented SQLite ATTACH DATABASE for joining across library and users databases
- **Error Handling**: Graceful degradation when users_roles database doesn't exist
- **Permissions**: Features work correctly even if user lacks User Management API permissions

### Added - Previous Features

- Initial release