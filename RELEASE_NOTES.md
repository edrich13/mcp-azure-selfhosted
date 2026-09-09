# Release Notes

## v1.1.0 — 2026-09-09

**14 new tools** across Git, QA/Test, product management, design, and developer productivity — bringing the server to **39 tools total**.

### Highlights

- Read repository files and search code directly from your MCP client.
- Full Test Plans workflow: list plans/suites, author test cases, record pass/fail results, and auto-file bugs from failures.
- Decompose a PRD into a linked Feature → User Stories → Tasks hierarchy in one call.
- Bulk-create work items, inspect cross-team delivery plans, attach design assets, and detect duplicate bugs before filing.

### New tools

**Git & Repos**
- `azure_get_file_content` — read raw file content from a repository (optional branch).
- `azure_search_code` — search code across a project. *Requires the Code Search extension.*

**Developer productivity**
- `azure_get_my_work_items` — everything currently assigned to you.

**Product & program management**
- `azure_bulk_create_work_items` — batch create with per-item error reporting.
- `azure_get_delivery_plan` — list delivery plans or fetch a plan's timeline.
- `azure_generate_prd_to_stories` — create a Feature → User Stories → Tasks hierarchy from a structured breakdown.

**Attachments**
- `azure_add_attachment` — attach a local file or inline/base64 content to a work item.
- `azure_get_attachments` — list and optionally download a work item's attachments.

**Test Plans / QA**
- `azure_list_test_plans`, `azure_get_test_plan`, `azure_list_test_suites`
- `azure_create_test_case` — ordered steps, optional suite assignment.
- `azure_add_test_result` — create a run, record the outcome, and complete it.
- `azure_create_bug_from_test_failure` — file a Bug with repro details, linked to the failing test case.

**Duplicate detection**
- `azure_duplicate_detection` — rank likely-duplicate work items by title similarity.

### Prerequisites & notes

- `azure_search_code` requires the Code Search extension on the organization/collection.
- The Test Plans tools require Test Plans licensing.
- No breaking changes; all existing tools are unchanged.

### Upgrade

```bash
npx -y mcp-azure-selfhosted@1.1.0
```
