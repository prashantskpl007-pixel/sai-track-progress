# Fix Overview permissions and menu visibility

## What will change
- Show **Overview** in the existing Role Permissions table by relabeling the existing internal dashboard permission; no database keys or saved data will be renamed.
- Give Overview the existing **View** and **Menu visible** controls, while Owner continues to receive full access automatically.
- Make the admin navigation consistently require both `View` and `Menu visible` before showing Enquiry, Workflow, Overview, Master, and Analytics tabs.
- Block rendering of any tab whose role lacks its `View` permission, including Overview.
- Choose the first permitted visible tab when the current/default tab is unavailable, so restricted users never land on inaccessible content.
- Preserve the existing permission editor, roles, records, routes, module layouts, and all non-permission behavior.

## Technical details
- Keep the persisted module key `dashboard` for backward compatibility, but change its user-facing label to `Overview`.
- Use the existing `role_permissions.can_view` and `role_permissions.menu_visible` values; no new permission system or database migration is needed.
- Keep Owner/admin bypass behavior in `usePermissions`, so Overview cannot be removed from Owner access.
- Refresh the in-memory permission map after saving so changes are immediately reflected for the current session where relevant and remain persisted after login/refresh.

## Verification
- Confirm Overview appears in the permission grid with View and Menu visible switches.
- Confirm saved Overview values reload correctly.
- Confirm navigation visibility requires both values, and Overview content cannot render without View access.
- Run type checks and test the owner-facing permission screen in the browser.
