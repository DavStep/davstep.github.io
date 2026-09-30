# Project UI/UX skills

Installed with Codex's skill-installer into this project's `.agents/skills` directory, rather than adding global skills. They are discoverable on the next turn; their instructions were read and applied during installation.

| Skill | Source | Pinned commit |
| --- | --- | --- |
| frontend-design | https://github.com/anthropics/skills/tree/main/skills/frontend-design | `8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4` |
| web-design-guidelines | https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines | `063bee94c3f4df8453406c830b0a7df0f2860278` |

The Vercel skill retrieves the current review rules from https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md when used. Skill recommendations remain subject to the user's brief and project context. Neither skill requires installing a framework, adding a service, or deploying the website.
