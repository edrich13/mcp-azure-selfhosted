# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-09-09

### Added

- **Git & Repos**: `azure_get_file_content` (read raw file content from a repository, optional branch) and `azure_search_code` (Code Search across a project; requires the Code Search extension).
- **Developer productivity**: `azure_get_my_work_items` (items assigned to the authenticated user).
- **Product & program management**: `azure_bulk_create_work_items` (batch create with per-item error reporting), `azure_get_delivery_plan` (list delivery plans or fetch a plan timeline), and `azure_generate_prd_to_stories` (create a Feature → User Stories → Tasks hierarchy from a structured breakdown).
- **Attachments**: `azure_add_attachment` (attach a local file or inline/base64 content to a work item) and `azure_get_attachments` (list and optionally download work item attachments).
- **Test Plans / QA**: `azure_list_test_plans`, `azure_get_test_plan`, `azure_list_test_suites`, `azure_create_test_case` (with ordered steps; optional suite assignment), `azure_add_test_result` (create run, record outcome, complete run), and `azure_create_bug_from_test_failure` (file a Bug with repro details linked to the failing test case).
- **Duplicate detection**: `azure_duplicate_detection` (rank likely-duplicate work items by title similarity before creating a new one).

### Changed

- README updated with the new tool reference tables and prerequisites for Code Search and Test Plans.

### Notes

- This release brings the total to **39 tools** (25 existing + 14 new).
- `azure_search_code` requires the Code Search extension on the organization/collection; the Test Plans tools require Test Plans licensing.
- Tag `v1.1.0` is aligned to `package.json` version `1.1.0`.

## [1.0.0] - 2026-09-09

### Added

- Automated npm publishing workflow via GitHub Actions on version tags (`v*`).
- npm package metadata for repository, bugs URL, homepage, Node.js engine requirement, and public publish configuration.
- End-user package-first setup guidance (`npx -y mcp-azure-selfhosted`) for VS Code and Claude Desktop MCP configs.

### Changed

- Example MCP configuration files now run the server through the published npm package instead of a local build path.

### Notes

- This release includes the full Azure DevOps MCP server feature set (25 tools).
- Tag `v1.0.0` is aligned to `package.json` version `1.0.0`.

[1.1.0]: https://github.com/edrich13/mcp-azure-selfhosted/releases/tag/v1.1.0
[1.0.0]: https://github.com/edrich13/mcp-azure-selfhosted/releases/tag/v1.0.0
