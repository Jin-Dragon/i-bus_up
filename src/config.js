const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

function readBoolean(name, fallback = false) {
  const raw = process.env[name];
  if (raw == null || raw === "") {
    return fallback;
  }
  return raw === "1" || raw.toLowerCase() === "true";
}

const config = {
  rootDir,
  appRole: process.env.APP_ROLE || "web",
  dataDir: path.join(rootDir, "data"),
  storageStatePath: path.join(rootDir, "data", "onebus-storage.json"),
  draftPath: path.join(rootDir, "data", "last-draft.json"),
  worknetUploadHistoryPath: path.join(rootDir, "data", "worknet-upload-history.json"),
  worknetApiKey: process.env.WORKNET_API_KEY || "",
  worknetApiUrl:
    process.env.WORKNET_API_URL ||
    "https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L01.do",
  loginUrl:
    process.env.ONEBUS_LOGIN_URL || "https://1-bus.com/login?back_url=Lw%3D%3D&used_login_btn=Y",
  jobListUrl: process.env.ONEBUS_JOB_LIST_URL || "https://1-bus.com/job/?category=",
  defaultCategory: process.env.ONEBUS_DEFAULT_CATEGORY || "",
  username: process.env.ONEBUS_USERNAME || "",
  password: process.env.ONEBUS_PASSWORD || "",
  workerBaseUrl: (process.env.WORKER_BASE_URL || "").replace(/\/+$/, ""),
  workerSharedToken: process.env.WORKER_SHARED_TOKEN || "",
  headless: readBoolean("HEADLESS", false)
};

module.exports = { config };
