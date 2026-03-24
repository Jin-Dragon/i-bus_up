const { config } = require("./config");
const { ensureDir, readJson, saveJson } = require("./store");

function loadHistory() {
  ensureDir(config.dataDir);
  return readJson(config.worknetUploadHistoryPath, {
    items: {},
    updatedAt: null
  });
}

function saveHistory(history) {
  ensureDir(config.dataDir);
  saveJson(config.worknetUploadHistoryPath, {
    ...history,
    updatedAt: new Date().toISOString()
  });
}

function getWorknetItemKey(item) {
  return String(item?.wantedAuthNo || item?.detailUrl || item?.mobileUrl || "").trim();
}

function annotateWorknetItems(items) {
  const history = loadHistory();

  return (items || []).map((item) => {
    const key = getWorknetItemKey(item);
    const uploaded = key ? history.items[key] : null;

    return {
      ...item,
      uploadKey: key,
      uploaded: Boolean(uploaded),
      uploadedAt: uploaded?.uploadedAt || "",
      uploadedOneBusUrl: uploaded?.oneBusUrl || ""
    };
  });
}

function markWorknetUploaded(item, publishResult, draftTitle) {
  const history = loadHistory();
  const key = getWorknetItemKey(item);

  if (!key) {
    throw new Error("워크넷 공고 식별값이 없어 업로드 이력을 기록할 수 없습니다.");
  }

  history.items[key] = {
    wantedAuthNo: item.wantedAuthNo || "",
    title: item.title || "",
    company: item.company || "",
    worknetUrl: item.detailUrl || item.mobileUrl || "",
    oneBusUrl: publishResult?.finalUrl || "",
    draftTitle: draftTitle || "",
    uploadedAt: new Date().toISOString()
  };

  saveHistory(history);
  return history.items[key];
}

module.exports = {
  annotateWorknetItems,
  getWorknetItemKey,
  loadHistory,
  markWorknetUploaded
};
