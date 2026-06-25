# Deploying the install site (VibeHub)

The `site/` folder is a self-contained static site that lets anyone install the
skill with one command. It contains:

```
site/
├── index.html            # landing + install page
├── install.sh            # the install script (curl … | bash)
├── package-skill.sh      # builds the skill bundle below
└── pitch.tar.gz  # the packaged skill (generated; git-ignored)
```

## 1. Build the skill bundle
```bash
bash site/package-skill.sh        # → site/pitch.tar.gz
```
Re-run this whenever the skill changes.

## 2. Pick the host URL
The install command and `install.sh` default to a VibeHub app URL. Set the real
one in **two** places (they must match):
- `site/index.html` → the `<code id="cmd">` install command
- `site/install.sh` → `BASE_URL` default

Example for VibeHub project slug `pitch`:
```
https://vibehub.microsoft.com/app/pitch/
  ├── install.sh
  └── pitch.tar.gz
```
→ install command: `curl -fsSL https://vibehub.microsoft.com/app/pitch/install.sh | bash`

## 3. Deploy to VibeHub
VibeHub hosts static apps. Following the DesignShift pattern
(`vibehub.microsoft.com/app/designshift`):
1. Create/choose a VibeHub project (note its **slug** + project id).
2. Put the **contents of `site/`** (incl. `pitch.tar.gz`) at the app root.
3. Deploy via your VibeHub flow — typically **push to the `vibehub` branch**
   (auto-deploys via GitHub Actions) or run the project's `package-vibehub` script
   and push the zip. (VibeHub is Microsoft-internal; deploy from your machine.)
4. Verify `…/app/<slug>/install.sh` and `…/app/<slug>/pitch.tar.gz` are
   reachable, then run the install command.

> The agent here can't reach VibeHub (internal). Build + commit happens locally;
> **you** push/deploy.

## Alternative hosts (no VibeHub)
Any static host works — just point the installer at it:
```bash
# host site/ anywhere (GitHub Pages, Azure Static Web Apps, S3, a plain server)
PITCH_BASE_URL="https://<your-host>/pitch" \
  bash -c "curl -fsSL \$PITCH_BASE_URL/install.sh | bash"
```

## Local smoke test
```bash
bash site/package-skill.sh
( cd site && python3 -m http.server 8099 ) &
SKILLS_DIR=/tmp/skills PITCH_BASE_URL=http://localhost:8099 \
  bash site/install.sh          # installs to /tmp/skills/pitch
```

## Backing git repo (optional but recommended)
VibeHub auto-deploy typically tracks a git repo (GitHub or Azure DevOps). To wire
that up you'll need to add a remote and push:
```bash
git remote add origin <your-repo-url>
git push -u origin main
```
(No remote is configured yet — choose GitHub or ADO and run the above.)
