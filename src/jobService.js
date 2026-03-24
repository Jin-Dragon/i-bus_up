const path = require("path");
const { config } = require("./config");
const { ensureDir, saveJson } = require("./store");
const { parseJobPosting, finalizePosting } = require("./parsers");
const { parseWorknetPosting } = require("./parsers/worknet");
const { buildOneBusDraft } = require("./templates/oneBusTemplate");
const { loginOneBus, publishToOneBus } = require("./publishers/oneBus");
const {
  annotateWorknetItems,
  getWorknetItemKey,
  markWorknetUploaded
} = require("./worknetUploadHistory");

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function createSnapshotFromPosting(inputPosting) {
  const posting = finalizePosting(inputPosting || {});
  const draft = buildOneBusDraft(posting);
  const snapshot = { posting, draft, generatedAt: new Date().toISOString() };

  ensureDir(config.dataDir);
  saveJson(config.draftPath, snapshot);
  return snapshot;
}

async function createDraftSnapshot(url) {
  const rawPosting = await parseJobPosting(url);
  return createSnapshotFromPosting(rawPosting);
}

async function runLogin() {
  await loginOneBus();
}

async function renderDraftFromPosting(posting) {
  return createSnapshotFromPosting(posting);
}

async function publishFromPosting(posting, options = {}) {
  const snapshot = createSnapshotFromPosting(posting);
  const publishResult = await publishToOneBus(snapshot.draft, options);
  return { ...snapshot, publishResult };
}

async function publishFromUrl(url, options = {}) {
  const snapshot = await createDraftSnapshot(url);
  const publishResult = await publishToOneBus(snapshot.draft, options);
  return { ...snapshot, publishResult };
}

async function publishBatch(urls, options = {}) {
  ensureDir(config.dataDir);

  const results = [];
  for (const url of urls) {
    try {
      const snapshot = await publishFromUrl(url, options);
      results.push({
        url,
        ok: true,
        title: snapshot.draft.title,
        finalUrl: snapshot.publishResult?.finalUrl || ""
      });
    } catch (error) {
      results.push({
        url,
        ok: false,
        error: error.message
      });
    }
  }

  const summary = {
    total: results.length,
    successCount: results.filter((item) => item.ok).length,
    failureCount: results.filter((item) => !item.ok).length,
    results,
    generatedAt: new Date().toISOString()
  };

  saveJson(path.join(config.dataDir, `batch-result-${timestamp()}.json`), summary);
  return summary;
}

async function buildPostingFromWorknetItem(item) {
  const detailUrl = item.detailUrl || item.mobileUrl || "";
  const parsed = await parseWorknetPosting(detailUrl, item);
  const posting = finalizePosting(parsed);

  if (posting.title && !/\(워크넷\)\s*$/u.test(posting.title)) {
    posting.title = `${posting.title} (워크넷)`;
  }

  return posting;
}

async function publishSelectedWorknetItems(items, options = {}) {
  const annotatedItems = annotateWorknetItems(items || []);
  const results = [];

  for (const item of annotatedItems) {
    const uploadKey = getWorknetItemKey(item);

    if (item.uploaded) {
      results.push({
        uploadKey,
        wantedAuthNo: item.wantedAuthNo || "",
        title: item.title || "",
        company: item.company || "",
        ok: false,
        skipped: true,
        uploadedAt: item.uploadedAt || "",
        oneBusUrl: item.uploadedOneBusUrl || "",
        message: "이미 업로드한 공고입니다."
      });
      continue;
    }

    try {
      const posting = await buildPostingFromWorknetItem(item);
      const snapshot = createSnapshotFromPosting(posting);
      const publishResult = await publishToOneBus(snapshot.draft, options);
      const historyItem = markWorknetUploaded(item, publishResult, snapshot.draft.title);

      results.push({
        uploadKey,
        wantedAuthNo: item.wantedAuthNo || "",
        title: snapshot.draft.title,
        company: item.company || "",
        ok: true,
        skipped: false,
        uploadedAt: historyItem.uploadedAt,
        oneBusUrl: publishResult?.finalUrl || ""
      });
    } catch (error) {
      results.push({
        uploadKey,
        wantedAuthNo: item.wantedAuthNo || "",
        title: item.title || "",
        company: item.company || "",
        ok: false,
        skipped: false,
        message: error.message
      });
    }
  }

  return {
    total: results.length,
    successCount: results.filter((item) => item.ok).length,
    skippedCount: results.filter((item) => item.skipped).length,
    failureCount: results.filter((item) => !item.ok && !item.skipped).length,
    results,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  buildPostingFromWorknetItem,
  createDraftSnapshot,
  renderDraftFromPosting,
  publishFromPosting,
  publishFromUrl,
  publishBatch,
  publishSelectedWorknetItems,
  runLogin
};
