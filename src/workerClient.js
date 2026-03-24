const { config } = require("./config");

function hasRemoteWorker() {
  return config.appRole !== "worker" && Boolean(config.workerBaseUrl);
}

async function callWorker(path, body) {
  if (!config.workerBaseUrl) {
    throw new Error("WORKER_BASE_URL is not configured.");
  }

  const response = await fetch(`${config.workerBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-worker-token": config.workerSharedToken
    },
    body: JSON.stringify(body || {})
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `Worker request failed with status ${response.status}.`);
  }

  return payload;
}

async function loginViaWorker() {
  return callWorker("/internal/worker/login", {});
}

async function publishDraftViaWorker(draft, options = {}) {
  const payload = await callWorker("/internal/worker/publish", { draft, options });
  return payload.publishResult;
}

module.exports = {
  hasRemoteWorker,
  loginViaWorker,
  publishDraftViaWorker
};
