**Product Requirements Document (PRD)**

**Product Title:** EasyCraft Host - Simple Local Minecraft Server Hosting

**Audience:** Internal Development Team

---

### 1. Overview
**Goal:** Build a Windows desktop application that enables anyone—including children—to easily host a modded Minecraft Java server on their local machine, with secure public access through an abstracted tunnel (no port forwarding required).

**Key Value Propositions:**
- No technical setup needed (no port forwarding, no exposed IPs).
- One-click modded Minecraft hosting from a friendly UI.
- Safe and secure way to play with friends.

---

### 2. Target Users
- Minecraft Java Edition players who want to host servers for friends.
- Primarily casual users with limited technical knowledge (children, teens).
- Users with basic Windows setups.

---

### 3. Key Features
- **Local Server Management**: Launch, stop, reset, and configure Minecraft Java Edition servers locally.
- **Modded Server Support**: Use local modpacks or browse/install from CurseForge (optional API integration).
- **Automatic Tunneling**: Use Playit.gg to expose local server with a DNS-masked public IP by installing and managing the Playit agent as a background Windows service.
- **Auto Minecraft Detection**: Detect user Minecraft installation or prompt to locate/install.
- **Performance Recommendation Engine**: Suggest CPU/RAM settings based on whether the user is playing and hosting on the same device.
- **Whitelist Feature**: Allow only invited usernames to join.
- **World Tools**: Reset, import, and download worlds.
- **Update Checker**: App checks for new versions and notifies the user.
- **Crash/Error Reporting**: Anonymous logging to help improve stability.

---

### 4. User Flow
1. User installs the app and opens it.
2. App auto-detects Minecraft or prompts for install path.
3. App asks whether the user wants to host a **vanilla** or **modded** server.
4. If modded: user selects a modpack (upload or browse CurseForge).
5. App suggests optimal performance settings based on system specs.
6. User launches the server.
7. App installs and starts the Playit.gg agent in the background as a Windows service.
8. App retrieves the public address and shows a sharable link.
9. User shares link with friends.
10. Server runs locally until user stops or shuts down.

---

### 5. Technical Architecture
| Layer | Technology |
|-------|------------|
| Desktop Shell | Electron (Node.js backend + Vite + React frontend) |
| Tunneling | Playit.gg agent, managed as a Windows service via NSSM from Electron backend |
| Minecraft Server Control | Node.js `child_process` API for jar execution |
| UI Components | React + Tailwind CSS + shadcn/ui |
| System Insights | `systeminformation` npm package for RAM/CPU detection |
| Modpack Source | CurseForge API (optional) + local zip upload support |
| Updates | `electron-updater` + GitHub Releases or custom update endpoint |
| Error Reporting | Sentry (or custom log-based crash uploader) |

---

### 6. Technical Constraints
- Windows-only support (for v1)
- Internet access required for tunnel creation and modpack browsing
- App size will be larger due to Electron (expect ~80-100MB)
- Playit.gg agent must be authenticated/configured initially (handled once via background setup)

---

### 7. Success Criteria
- App runs without requiring any terminal commands.
- A 12-year-old can host a server, share a link, and invite a friend to join.
- No user has to touch router settings or deal with IP addresses.
- >90% of users complete server setup and launch in under 5 minutes.
- <5% crash/error reports across 100+ installs.

