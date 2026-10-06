<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Staff/Admin sign-in uses a User ID (staff.username) resolved to the auth account inside a server function; new staff logins get a synthetic internal email. Why: users never handle emails and the lookup stays server-side.
- Staff role assignment derives the access level from master_roles on the server; only Owner/Admin may assign owner-level roles. Why: prevents privilege escalation from the client.
