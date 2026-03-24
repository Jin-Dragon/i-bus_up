const resultBox = document.getElementById("resultBox");
const analysisForm = document.getElementById("analysisForm");
const previewFrame = document.getElementById("previewFrame");
const previewTitle = document.getElementById("previewTitle");
const sourceLink = document.getElementById("sourceLink");
const worknetResultBox = document.getElementById("worknetResultBox");

const WORKNET_PAGE_SIZE = 10;

const fieldSchema = [
  { key: "sourceUrl", label: "원문 링크", type: "url" },
  { key: "sourceSite", label: "출처 사이트" },
  { key: "companyName", label: "회사명" },
  { key: "title", label: "공고 제목" },
  { key: "location", label: "근무지" },
  { key: "salary", label: "급여" },
  { key: "workType", label: "근무형태 요약" },
  { key: "shift", label: "근무시간" },
  { key: "experience", label: "경력" },
  { key: "education", label: "학력" },
  { key: "employmentType", label: "고용형태" },
  { key: "deadline", label: "모집 기간" },
  { key: "contact", label: "회사 연락처" },
  { key: "companyLocation", label: "회사 위치" },
  { key: "documents", label: "제출서류", multiline: true },
  { key: "process", label: "전형절차", multiline: true },
  { key: "applyMethod", label: "지원방법" },
  { key: "managerName", label: "채용담당자" },
  { key: "managerPhone", label: "전화번호" },
  { key: "notice", label: "안내사항", multiline: true },
  { key: "requirements", label: "필수/자격요건", list: true },
  { key: "preferences", label: "우대사항", list: true },
  { key: "duties", label: "업무내용", list: true },
  { key: "benefits", label: "복리후생", list: true },
  { key: "rawText", label: "원문 요약 텍스트", multiline: true }
];

let currentPosting = null;
let currentDraft = null;
let currentWorknetResult = null;
let currentWorknetPage = 1;
let selectedWorknetKeys = new Set();

async function callApi(path, body) {
  setResult("작업 중...");

  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "요청 처리에 실패했습니다.");
  }

  return payload;
}

function setResult(value) {
  resultBox.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderAnalysisForm(posting) {
  if (!posting) {
    analysisForm.className = "analysis-grid empty-state";
    analysisForm.textContent = "분석 대기 중입니다.";
    return;
  }

  analysisForm.className = "analysis-grid";
  analysisForm.innerHTML = fieldSchema
    .map((field) => {
      const rawValue = posting[field.key];
      const value = Array.isArray(rawValue) ? rawValue.join("\n") : rawValue || "";
      const input =
        field.multiline || field.list
          ? `<textarea data-field="${field.key}" rows="${field.key === "rawText" ? 6 : 3}">${escapeHtml(value)}</textarea>`
          : `<input data-field="${field.key}" type="${field.type || "text"}" value="${escapeHtml(value)}" />`;

      return `
        <label class="editor-field ${field.multiline || field.list ? "wide" : ""}">
          <span>${field.label}</span>
          ${input}
        </label>
      `;
    })
    .join("");
}

function collectPostingFromForm() {
  const posting = {};

  for (const field of fieldSchema) {
    const element = analysisForm.querySelector(`[data-field="${field.key}"]`);
    if (!element) {
      continue;
    }

    const value = element.value.trim();
    posting[field.key] = field.list
      ? value
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean)
      : value;
  }

  return posting;
}

function renderPreview(snapshot) {
  currentPosting = snapshot.posting;
  currentDraft = snapshot.draft;

  previewTitle.textContent = snapshot.draft.title || "제목 없음";
  previewFrame.srcdoc = snapshot.draft.body || "<p>미리보기가 없습니다.</p>";

  const url = snapshot.posting.sourceUrl || "";
  sourceLink.textContent = url || "-";
  sourceLink.href = url || "#";
}

function renderWorknetResults(result, page = 1) {
  currentWorknetResult = result;
  currentWorknetPage = page;

  if (!result || !result.items || result.items.length === 0) {
    worknetResultBox.className = "worknet-results empty-state";
    worknetResultBox.textContent = "조건에 맞는 워크넷 버스 일자리가 없습니다.";
    return;
  }

  const totalPages = Math.max(1, Math.ceil(result.items.length / WORKNET_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  currentWorknetPage = safePage;

  const startIndex = (safePage - 1) * WORKNET_PAGE_SIZE;
  const items = result.items.slice(startIndex, startIndex + WORKNET_PAGE_SIZE);

  worknetResultBox.className = "worknet-results";
  worknetResultBox.innerHTML = `
    <div class="worknet-summary">
      <div>
        <strong>검색어:</strong> ${escapeHtml(result.keywordQuery || "-")}
      </div>
      <div>
        <span>필터 결과 ${result.total}건</span>
        <span> / 수집 ${result.fetchedItems || result.total}건</span>
        <span> / ${result.fetchedPages || 1}페이지 조회</span>
      </div>
    </div>
    <div class="worknet-list">
      ${items.map((item) => renderWorknetItem(item)).join("")}
    </div>
    <div class="worknet-pagination">
      <button id="worknetPrevButton" class="button secondary" ${safePage <= 1 ? "disabled" : ""}>이전 10개</button>
      <span>${safePage} / ${totalPages}</span>
      <button id="worknetNextButton" class="button secondary" ${safePage >= totalPages ? "disabled" : ""}>다음 10개</button>
    </div>
  `;
}

function renderWorknetItem(item) {
  const key = item.uploadKey || item.wantedAuthNo || item.detailUrl || "";
  const checked = selectedWorknetKeys.has(key) ? "checked" : "";
  const disabled = item.uploaded ? "disabled" : "";
  const uploadedBadge = item.uploaded
    ? `<span class="worknet-badge uploaded">업로드 완료 ${escapeHtml(formatDate(item.uploadedAt))}</span>`
    : "";
  const selectedBadge = selectedWorknetKeys.has(key)
    ? '<span class="worknet-badge selected">선택됨</span>'
    : "";

  return `
    <article class="worknet-item ${item.uploaded ? "uploaded" : ""}">
      <div class="worknet-item-select">
        <div class="worknet-item-main">
          <div class="worknet-item-head">
            <strong>${escapeHtml(item.title || "제목 없음")}</strong>
            <div class="actions">
              <button class="button secondary worknet-preview-button" data-worknet-key="${escapeHtml(key)}" type="button">미리보기</button>
              <a href="${escapeHtml(item.detailUrl || item.mobileUrl || "#")}" target="_blank" rel="noopener noreferrer">원문 보기</a>
            </div>
          </div>
          <div class="worknet-meta">
            <span>${escapeHtml(item.company || "-")}</span>
            <span>${escapeHtml(item.region || "-")}</span>
            <span>${escapeHtml(item.salary || "-")}</span>
            <span>${escapeHtml(item.closeDate || "-")}</span>
          </div>
          <div class="worknet-badges">${uploadedBadge}${selectedBadge}</div>
        </div>
        <label class="worknet-checkbox-wrap" aria-label="공고 선택">
          <input type="checkbox" class="worknet-checkbox" data-worknet-key="${escapeHtml(key)}" ${checked} ${disabled} />
        </label>
      </div>
    </article>
  `;
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ko-KR");
}

function findWorknetItemByKey(key) {
  return currentWorknetResult?.items?.find((item) => item.uploadKey === key) || null;
}

function updateWorknetItemStatus(result) {
  if (!currentWorknetResult || !Array.isArray(result?.results)) {
    return;
  }

  const uploadedMap = new Map(
    result.results
      .filter((item) => item.ok)
      .map((item) => [
        item.uploadKey,
        {
          uploaded: true,
          uploadedAt: item.uploadedAt || "",
          uploadedOneBusUrl: item.oneBusUrl || ""
        }
      ])
  );

  currentWorknetResult.items = currentWorknetResult.items.map((item) => {
    const status = uploadedMap.get(item.uploadKey);
    if (!status) {
      return item;
    }

    selectedWorknetKeys.delete(item.uploadKey);

    return {
      ...item,
      ...status
    };
  });
}

function resetScreen() {
  currentPosting = null;
  currentDraft = null;
  currentWorknetResult = null;
  currentWorknetPage = 1;
  selectedWorknetKeys = new Set();

  document.getElementById("singleUrl").value = "";
  document.getElementById("worknetKeyword").value = "";
  document.getElementById("worknetRegion").value = "";
  renderAnalysisForm(null);
  previewTitle.textContent = "분석 후 생성됩니다";
  previewFrame.srcdoc =
    "<p style='font-family: Malgun Gothic, sans-serif; padding: 24px;'>미리보기가 없습니다.</p>";
  sourceLink.textContent = "-";
  sourceLink.href = "#";
  worknetResultBox.className = "worknet-results empty-state";
  worknetResultBox.textContent = "워크넷 검색 대기 중입니다.";
  setResult("준비됨");
}

async function analyzePosting() {
  const url = document.getElementById("singleUrl").value.trim();
  if (!url) {
    throw new Error("공고 URL을 입력하세요.");
  }

  const payload = await callApi("/api/draft", { url });
  currentPosting = payload.snapshot.posting;
  renderAnalysisForm(currentPosting);
  renderPreview(payload.snapshot);
  setResult(payload.message);
}

async function refreshPreview() {
  if (!currentPosting) {
    throw new Error("먼저 공고를 분석하세요.");
  }

  const payload = await callApi("/api/render", {
    posting: collectPostingFromForm()
  });

  renderPreview(payload.snapshot);
  renderAnalysisForm(payload.snapshot.posting);
  setResult(payload.message);
}

async function publishPosting(submit) {
  if (!currentPosting) {
    throw new Error("먼저 공고를 분석하세요.");
  }

  const payload = await callApi("/api/publish", {
    posting: collectPostingFromForm(),
    submit
  });

  renderPreview(payload.snapshot);
  renderAnalysisForm(payload.snapshot.posting);
  setResult(
    payload.snapshot.publishResult?.finalUrl
      ? `${payload.message}\n${payload.snapshot.publishResult.finalUrl}`
      : payload.message
  );

  if (submit) {
    alert("등록되었습니다.");
  }
}

async function searchWorknet() {
  const payload = await callApi("/api/worknet/search", {
    keyword: document.getElementById("worknetKeyword").value.trim(),
    region: document.getElementById("worknetRegion").value.trim()
  });

  selectedWorknetKeys = new Set();
  renderWorknetResults(payload.result, 1);
  setResult(payload.message);
}

async function previewWorknetItem(key) {
  const item = findWorknetItemByKey(key);
  if (!item) {
    throw new Error("선택한 워크넷 공고를 찾을 수 없습니다.");
  }

  const payload = await callApi("/api/worknet/render", { item });
  renderPreview(payload.snapshot);
  renderAnalysisForm(payload.snapshot.posting);
  setResult(payload.message);
}

async function publishSelectedWorknetItems() {
  if (!currentWorknetResult || !currentWorknetResult.items?.length) {
    throw new Error("먼저 워크넷 검색을 실행하세요.");
  }

  const items = currentWorknetResult.items.filter((item) => selectedWorknetKeys.has(item.uploadKey));
  if (!items.length) {
    throw new Error("등록할 워크넷 공고를 선택하세요.");
  }

  const payload = await callApi("/api/worknet/publish", { items });
  updateWorknetItemStatus(payload.result);
  renderWorknetResults(currentWorknetResult, currentWorknetPage);
  const summaryMessage = `${payload.message}\n성공 ${payload.result.successCount}건 / 중복 건너뜀 ${payload.result.skippedCount}건 / 실패 ${payload.result.failureCount}건`;
  setResult(summaryMessage);
  alert(summaryMessage);
}

document.getElementById("loginButton").addEventListener("click", async () => {
  try {
    const payload = await callApi("/api/login", {});
    setResult(payload.message);
  } catch (error) {
    setResult(error.message);
  }
});

document.getElementById("analyzeButton").addEventListener("click", async () => {
  try {
    await analyzePosting();
  } catch (error) {
    setResult(error.message);
  }
});

document.getElementById("resetButton").addEventListener("click", () => {
  resetScreen();
});

document.getElementById("worknetSearchButton").addEventListener("click", async () => {
  try {
    await searchWorknet();
  } catch (error) {
    setResult(error.message);
  }
});

document.getElementById("worknetPublishButton").addEventListener("click", async () => {
  try {
    await publishSelectedWorknetItems();
  } catch (error) {
    setResult(error.message);
  }
});

worknetResultBox.addEventListener("click", (event) => {
  if (event.target.id === "worknetPrevButton" && currentWorknetResult) {
    renderWorknetResults(currentWorknetResult, currentWorknetPage - 1);
  }

  if (event.target.id === "worknetNextButton" && currentWorknetResult) {
    renderWorknetResults(currentWorknetResult, currentWorknetPage + 1);
  }

  if (event.target.classList.contains("worknet-preview-button")) {
    previewWorknetItem(event.target.dataset.worknetKey).catch((error) => {
      setResult(error.message);
    });
  }
});

worknetResultBox.addEventListener("change", (event) => {
  if (!event.target.classList.contains("worknet-checkbox")) {
    return;
  }

  const key = event.target.dataset.worknetKey;
  if (!key) {
    return;
  }

  if (event.target.checked) {
    selectedWorknetKeys.add(key);
  } else {
    selectedWorknetKeys.delete(key);
  }

  renderWorknetResults(currentWorknetResult, currentWorknetPage);
});

document.getElementById("previewButton").addEventListener("click", async () => {
  try {
    await refreshPreview();
  } catch (error) {
    setResult(error.message);
  }
});

document.getElementById("prefillButton").addEventListener("click", async () => {
  try {
    await publishPosting(false);
  } catch (error) {
    setResult(error.message);
  }
});

document.getElementById("submitButton").addEventListener("click", async () => {
  try {
    await publishPosting(true);
  } catch (error) {
    setResult(error.message);
  }
});

resetScreen();
