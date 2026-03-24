const path = require("path");
const express = require("express");
const { config } = require("./config");
const { searchWorknetJobs } = require("./worknetService");
const { annotateWorknetItems } = require("./worknetUploadHistory");
const {
  buildPostingFromWorknetItem,
  createDraftSnapshot,
  renderDraftFromPosting,
  publishFromPosting,
  publishFromUrl,
  publishBatch,
  publishSelectedWorknetItems,
  runLogin
} = require("./jobService");

const app = express();
const publicDir = path.join(config.rootDir, "public");

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicDir));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.post("/api/login", async (_request, response) => {
  try {
    await runLogin();
    response.json({ ok: true, message: "1-BUS 로그인 세션을 저장했습니다." });
  } catch (error) {
    response.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/draft", async (request, response) => {
  try {
    const snapshot = await createDraftSnapshot(request.body.url);
    response.json({ ok: true, snapshot, message: "공고 분석이 완료되었습니다." });
  } catch (error) {
    response.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/render", async (request, response) => {
  try {
    const snapshot = await renderDraftFromPosting(request.body.posting || {});
    response.json({ ok: true, snapshot, message: "미리보기를 생성했습니다." });
  } catch (error) {
    response.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/worknet/search", async (request, response) => {
  try {
    const searchResult = await searchWorknetJobs({
      keyword: request.body.keyword || "",
      region: request.body.region || ""
    });
    const result = {
      ...searchResult,
      items: annotateWorknetItems(searchResult.items)
    };

    response.json({
      ok: true,
      result,
      message: "워크넷 버스 관련 채용정보를 조회했습니다."
    });
  } catch (error) {
    response.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/worknet/render", async (request, response) => {
  try {
    const item = request.body.item || {};
    const posting = await buildPostingFromWorknetItem(item);
    const snapshot = await renderDraftFromPosting(posting);

    response.json({
      ok: true,
      snapshot,
      message: "선택한 워크넷 공고 미리보기를 생성했습니다."
    });
  } catch (error) {
    response.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/worknet/publish", async (request, response) => {
  try {
    const items = Array.isArray(request.body.items) ? request.body.items : [];
    const result = await publishSelectedWorknetItems(items, {
      category: request.body.category || config.defaultCategory,
      submit: true
    });

    response.json({
      ok: true,
      result,
      message: "선택한 워크넷 공고를 1-BUS에 등록했습니다."
    });
  } catch (error) {
    response.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/publish", async (request, response) => {
  try {
    const options = {
      category: request.body.category || config.defaultCategory,
      submit: Boolean(request.body.submit)
    };

    const snapshot = request.body.posting
      ? await publishFromPosting(request.body.posting, options)
      : await publishFromUrl(request.body.url, options);

    response.json({
      ok: true,
      snapshot,
      message: options.submit ? "등록되었습니다." : "1-BUS 작성 화면에 초안을 입력했습니다."
    });
  } catch (error) {
    response.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/batch", async (request, response) => {
  try {
    const urls = String(request.body.urls || "")
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);

    const result = await publishBatch(urls, {
      category: request.body.category || config.defaultCategory,
      submit: Boolean(request.body.submit)
    });

    response.json({ ok: true, result });
  } catch (error) {
    response.status(500).json({ ok: false, error: error.message });
  }
});

app.use((_request, response) => {
  response.sendFile(path.join(publicDir, "index.html"));
});

const port = Number(process.env.PORT) || 3010;
app.listen(port, () => {
  console.log(`Web dashboard running on http://localhost:${port}`);
});
