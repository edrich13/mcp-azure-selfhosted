# Changelog

All notable changes to this project will be documented in this file.

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

[1.0.0]: https://github.com/edrich13/mcp-azure-selfhosted/releases/tag/v1.0.0
