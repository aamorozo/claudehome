# Claude Code Remote Control

Reference notes for agents operating inside a Claude Code session that may be
driven remotely. This is reference material about **Claude Code itself**.
It is captured here so an agent has context for what "Remote Control" means
when a user asks about it, and can advise the user on setup, limitations, and
security.

Source: <<https://docs.claude.com/en/remote-control>>

## What it is

Remote Control connects [<claude.ai/code>](<https://claude.ai/code>) or the Claude
mobile app ([iOS](<https://apps.apple.com/us/app/claude-by-anthropic/id6473753684>),
[Android](<https://play.google.com/store/apps/details?id=com.anthropic.claude>))
to a Claude Code session running on the user's machine. The session keeps
running locally the entire time — only routing messages travel through the
Anthropic API.

With Remote Control:

- The full local environment stays available — filesystem, MCP servers, tools,
  project configuration, `@`-autocomplete on file paths.
- The conversation stays in sync across all connected devices (terminal, browser,
  phone), and the user can send messages from any of them interchangeably.
- Reconnects are automatic when the laptop wakes or the network comes back.

Unlike [Claude Code on the web](<https://docs.claude.com/en/claude-code-on-the-web>)
(cloud-hosted), Remote Control sessions execute on the user's machine. The web
and mobile UIs are just a window into the local session.

Requires Claude Code v2.1.51 or later (`claude --version`).

## Requirements

- **Subscription**: Pro, Max, Team, or Enterprise. API keys are not supported.
  On Team/Enterprise, an admin must enable the Remote Control toggle in
  [Claude Code admin settings](<https://claude.ai/admin-settings/claude-code>).
- **Authentication**: signed in via `claude` + `/login` (<claude.ai> OAuth, not
  API key, not `setup-token`).
- **Workspace trust**: the user must have run `claude` in the project directory
  at least once and accepted the workspace trust dialog.

## Starting a session

Four ways to start, all equivalent in result but different in mode:

### Server mode (CLI)

```bash
claude remote-control
```

Stays running in the terminal as a server. Prints a session URL; press space
to toggle a QR code. Useful flags:

| Flag                                            | Description                                                                                                |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `--name "My Project"`                           | Custom session title in the <claude.ai/code> session list.                                                   |
| `--remote-control-session-name-prefix <prefix>` | Prefix for auto-generated names (default = hostname). Env: `CLAUDE_REMOTE_CONTROL_SESSION_NAME_PREFIX`.    |
| `--spawn <mode>`                                | `same-dir` (default), `worktree` (per-session git worktree), or `session` (single-session, rejects extras). Press `w` at runtime to toggle between `same-dir` and `worktree`. |
| `--capacity <N>`                                | Max concurrent sessions (default 32). Incompatible with `--spawn=session`.                                 |
| `--verbose`                                     | Detailed connection/session logs.                                                                          |
| `--sandbox` / `--no-sandbox`                    | Filesystem and network isolation. Off by default.                                                          |

### Interactive session (CLI)

```bash
claude --remote-control            # or --rc
claude --remote-control "My Project"
```

Normal interactive Claude Code session, additionally controllable from
<claude.ai> or the mobile app. The user can still type messages locally.

### From an existing session

```text
/remote-control                    # or /rc
/remote-control My Project
```

Continues the current conversation history under Remote Control. Does not
support `--verbose`, `--sandbox`, or `--no-sandbox`.

### VS Code extension

Type `/remote-control` (or `/rc`) in the prompt box of the [Claude Code VS Code
extension](<https://docs.claude.com/en/vs-code>) (v2.1.79+). A banner shows
connection state with an **Open in browser** action. No name argument or QR
code in this surface; the title is derived from history or the first prompt.
Run `/remote-control` again or click the close icon to disconnect.

### Connecting from another device

- Open the printed session URL in any browser.
- Scan the QR code (press space in server mode to toggle).
- Open [<claude.ai/code>](<https://claude.ai/code>) or the Claude mobile app (Code
  tab) and pick the session by name. Remote Control sessions show a computer
  icon with a green status dot when online.

If the environment already has an active session, the user is prompted to
continue it or start a new one.

Session title precedence:

1. The name passed to `--name`, `--remote-control`, or `/remote-control`.
2. A title set with `/rename`.
3. The last meaningful message in existing history.
4. Auto-generated name like `myhost-graceful-unicorn` (uses hostname or
   `--remote-control-session-name-prefix`).

Need the mobile app? Run `/mobile` inside Claude Code to display a download QR
code.

### Enable for all sessions

By default Remote Control is opt-in per invocation. To make every interactive
session register a remote session automatically, run `/config` and set
**Enable Remote Control for all sessions** to `true`. Each interactive process
registers exactly one remote session in this mode — for multiple concurrent
sessions from a single process, use server mode instead.

## Connection and security

- Outbound HTTPS only. No inbound ports are opened on the user's machine.
- The local process registers with the Anthropic API and polls for work; once
  a remote client connects, the API streams messages between client and local
  session.
- All traffic is TLS through the Anthropic API, same transport as any Claude
  Code session.
- Multiple short-lived credentials, each scoped to a single purpose and
  expiring independently.

## Remote Control vs Claude Code on the web

Both use the <claude.ai/code> interface; they differ in **where the session
runs**.

- **Remote Control**: session runs on the user's machine. Local MCP servers,
  tools, and project config stay available. Best when continuing in-progress
  local work from another device.
- **Claude Code on the web**: session runs in Anthropic-managed cloud
  infrastructure. Best when kicking off a task without local setup, working on
  a repo not cloned locally, or running many tasks in parallel.

## Mobile push notifications

When Remote Control is active, Claude can push notifications to the phone.
Claude decides when (typically: long task finished, or a decision is needed).
The user can also request a push in their prompt
(e.g. "notify me when the tests finish"). Beyond on/off, there is no per-event
configuration.

Requires Claude Code v2.1.110+.

Setup:

1. Install the Claude mobile app (iOS or Android).
2. Sign in with the same account/org used for Claude Code in the terminal.
3. Accept the OS notification permission prompt.
4. In Claude Code, run `/config` and enable **Push when Claude decides**.

If notifications don't arrive:

- `/config` shows **No mobile registered**: open the Claude app on the phone
  to refresh its push token. The warning clears on the next Remote Control
  reconnect.
- iOS: Focus modes and notification summaries can suppress/delay pushes —
  check **Settings → Notifications → Claude**.
- Android: aggressive battery optimization can delay delivery — exempt the
  Claude app in system settings.

## Limitations

- **One remote session per interactive process** outside server mode. Use
  server mode for multiple concurrent sessions from one process.
- **Local process must keep running.** Closing the terminal, quitting VS Code,
  or otherwise stopping `claude` ends the session.
- **Network outage > ~10 minutes** while the machine is awake times out the
  session and exits the process. Restart with `claude remote-control`.
- **Ultraplan disconnects Remote Control.** Both occupy the <claude.ai/code> UI;
  only one can be connected at a time.
- **Some commands are local-only.** Interactive pickers (`/mcp`, `/plugin`,
  `/resume`) work only from the local CLI. Text-output commands (`/compact`,
  `/clear`, `/context`, `/usage`, `/exit`, `/extra-usage`, `/recap`,
  `/reload-plugins`) work from mobile and web.

## Troubleshooting

### "Remote Control requires a <claude.ai> subscription"

Not authenticated with a <claude.ai> account. Run `claude auth login` and pick
<claude.ai>. If `ANTHROPIC_API_KEY` is set in the environment, unset it first.

### "Remote Control requires a full-scope login token"

Authenticated with a long-lived token from `claude setup-token` or
`CLAUDE_CODE_OAUTH_TOKEN`. Those are inference-only. Run `claude auth login`
to get a full-scope session token.

### "Unable to determine your organization for Remote Control eligibility"

Cached account info is stale. Run `claude auth login` to refresh.

### "Remote Control is not yet enabled for your account"

The eligibility check can fail with these env vars present:

- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` or `DISABLE_TELEMETRY`: unset and
  retry.
- `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY`:
  Remote Control needs <claude.ai> auth and does not work with third-party
  providers.

If none are set, `/logout` then `/login`.

### "Remote Control is disabled by your organization's policy"

Run `/status` first to see login method and subscription. Four causes:

- **Authenticated with API key or Console account**: Remote Control needs
  <claude.ai> OAuth. `/login` and pick <claude.ai>. Unset `ANTHROPIC_API_KEY`.
- **Team/Enterprise admin hasn't enabled it**: off by default on those plans.
  An admin enables it at
  [<claude.ai/admin-settings/claude-code>](<https://claude.ai/admin-settings/claude-code>).
- **Admin toggle is grayed out**: the org has a data retention or compliance
  config incompatible with Remote Control. Not changeable from the panel —
  contact Anthropic support.
- **Error mentions `disableRemoteControl`**: an IT admin has disabled it on
  this device via [managed settings](<https://docs.claude.com/en/settings#settings-files>),
  independent of the org-wide toggle.

### "Remote credentials fetch failed"

Could not obtain a short-lived credential. Re-run with `--verbose`:

```bash
claude remote-control --verbose
```

Common causes:

- Not signed in (`claude` + `/login`, <claude.ai> only — API keys not supported).
- Firewall/proxy blocking outbound HTTPS to the Anthropic API on port 443.
- If you also see `Session creation failed — see debug log`, the failure
  happened earlier in setup; check that the subscription is active.

## How it relates to other "work remotely" options

| Mechanism                                              | Trigger                                                  | Runs on                                | Setup                                                                         | Best for                                                |
| ------------------------------------------------------ | -------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------- |
| [Dispatch](<https://docs.claude.com/en/desktop>)         | Message a task from the Claude mobile app                | User's machine (Desktop)               | Pair the mobile app with Desktop                                              | Delegating work while away                              |
| Remote Control                                         | Drive a running session from <claude.ai/code> or mobile    | User's machine (CLI or VS Code)        | `claude remote-control`                                                       | Steering in-progress work from another device           |
| [Channels](<https://docs.claude.com/en/channels>)        | Push events from Telegram, Discord, or your own server   | User's machine (CLI)                   | Install a channel plugin                                                      | Reacting to chat messages or external events            |
| [Slack](<https://docs.claude.com/en/slack>)              | `@Claude` mention in a Slack channel                     | Anthropic cloud                        | Install Slack app with Claude Code on the web enabled                         | PRs and reviews from team chat                          |
| [Scheduled tasks](<https://docs.claude.com/en/scheduled-tasks>) | Cron-style schedule                                      | CLI / Desktop / cloud                  | Pick a frequency                                                              | Recurring automation like daily reviews                 |
