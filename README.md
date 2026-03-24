# 1-BUS Job Automation

Transforms Saramin and JobKorea posting URLs into a 1-BUS job post draft, then fills the 1-BUS write form with Playwright.

## Scope

- Parse Saramin and JobKorea job posting URLs
- Build a 1-BUS title and body draft
- Save a reusable 1-BUS login session
- Open the `general` board and fill the write form
- Optionally stop before submit for review

## Install

```powershell
& 'C:\Program Files\nodejs\npm.cmd' install
```

## Environment

Copy `.env.example` to `.env` and fill:

- `ONEBUS_LOGIN_URL`: 1-BUS login URL
- `ONEBUS_JOB_LIST_URL`: 1-BUS job board base URL
- `ONEBUS_DEFAULT_CATEGORY`: default category code, `general` is `1Ps1h24za0`
- `ONEBUS_USERNAME`: 1-BUS username
- `ONEBUS_PASSWORD`: 1-BUS password
- `HEADLESS`: `true` hides the browser

## Commands

Login and save session:

```powershell
node src/cli.js login
```

Generate a draft only:

```powershell
node src/cli.js draft --url "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=00000000"
```

Fill the 1-BUS form without submitting:

```powershell
node src/cli.js publish --url "https://www.jobkorea.co.kr/Recruit/GI_Read/00000000" --category "1Ps1h24za0" --submit false
```

Use `--submit true` only after you trust the selectors and template output.

## Web dashboard

Run the local dashboard:

```powershell
node src/server.js
```

Then open `http://localhost:3010`.

## Render deploy

This project includes a `Dockerfile` and `render.yaml` for Render deployment.

Recommended deployment:

- Create a new GitHub repository for this project
- Push this folder as its own repository
- In Render, create a new Blueprint or Web Service from that repository
- Set these environment variables in Render:
  - `ONEBUS_LOGIN_URL`
  - `ONEBUS_JOB_LIST_URL`
  - `ONEBUS_DEFAULT_CATEGORY`
  - `ONEBUS_USERNAME`
  - `ONEBUS_PASSWORD`
  - `WORKNET_API_KEY`

Health check path:

```text
/api/health
```

## Batch mode

Run multiple URLs in one go:

```powershell
node src/cli.js batch --urls "URL1,URL2,URL3" --submit false
```
