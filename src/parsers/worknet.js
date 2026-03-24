const cheerio = require("cheerio");
const iconv = require("iconv-lite");

function normalizeSpace(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`워크넷 공고를 불러오지 못했습니다. status=${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get("content-type") || "";
  const charsetMatch = contentType.match(/charset=([^;]+)/i);
  const charset = (charsetMatch ? charsetMatch[1] : "utf-8").toLowerCase();
  const decodeCharset = charset.includes("euc-kr") || charset.includes("cp949") ? "cp949" : "utf-8";
  return iconv.decode(buffer, decodeCharset);
}

function cloneText($, element) {
  const clone = $(element).clone();
  clone.find("script, style, button, .blind, .box_tooltip").remove();
  return normalizeSpace(clone.text());
}

function text($, selector) {
  return normalizeSpace($(selector).first().text());
}

function htmlToText($, selector) {
  const html = $(selector).first().html() || "";
  return normalizeSpace(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "));
}

function extractItems($, selector) {
  return $(selector)
    .toArray()
    .map((element) => cloneText($, element))
    .filter(Boolean);
}

function extractTableMap($, rootSelector) {
  const map = {};

  $(`${rootSelector} table.box_table tr`).each((_, row) => {
    const cells = $(row).children("th, td").toArray();

    for (let index = 0; index < cells.length; index += 2) {
      const th = cells[index];
      const td = cells[index + 1];
      if (!th || !td || th.tagName !== "th") {
        continue;
      }

      const key = cloneText($, th);
      const value = cloneText($, td);
      if (key && value) {
        map[key] = value;
      }
    }
  });

  return map;
}

function extractPageTableMap($) {
  const map = {};

  $("table.box_table tr").each((_, row) => {
    const cells = $(row).children("th, td").toArray();

    for (let index = 0; index < cells.length; index += 2) {
      const th = cells[index];
      const td = cells[index + 1];
      if (!th || !td || th.tagName !== "th") {
        continue;
      }

      const key = cloneText($, th);
      const value = cloneText($, td);
      if (key && value) {
        map[key] = value;
      }
    }
  });

  return map;
}

function extractSummaryColumns($) {
  const result = {};

  $(".emp_detail .column").each((_, column) => {
    const heading = normalizeSpace($(column).find("strong.b1_sb").first().text());
    if (!heading) {
      return;
    }

    const values = {};
    $(column)
      .find("li")
      .each((__, item) => {
        const label = normalizeSpace($(item).find(".tit").first().text());
        const value = cloneText($, item).replace(label, "").trim();
        if (label && value) {
          values[label] = normalizeSpace(value);
        }
      });

    result[heading] = {
      values,
      items: extractItems($, $(column).find(".items span"))
    };
  });

  return result;
}

function extractCompanyInfo($) {
  const result = {};

  $("#tab-panel06 .corp_info_grp li").each((_, item) => {
    const label = normalizeSpace($(item).find(".tit").first().text());
    const value = cloneText($, item).replace(label, "").trim();
    if (label && value) {
      result[label] = normalizeSpace(value);
    }
  });

  return result;
}

function dedupe(values) {
  return [...new Set((values || []).map(normalizeSpace).filter(Boolean))];
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = normalizeSpace(value);
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

function cleanDash(value) {
  const normalized = normalizeSpace(value);
  return normalized === "-" ? "" : normalized;
}

function mergeSummaryWithDetail(summary, detail) {
  return {
    sourceUrl: detail.sourceUrl || summary.detailUrl || summary.mobileUrl || "",
    sourceSite: "worknet",
    companyName: firstNonEmpty(detail.companyName, summary.company),
    title: firstNonEmpty(detail.title, summary.title),
    location: firstNonEmpty(detail.location, summary.region),
    salary: firstNonEmpty(detail.salary, [summary.salaryType, summary.salary].filter(Boolean).join(" ")),
    workType: firstNonEmpty(detail.workType, summary.holidayType),
    shift: firstNonEmpty(detail.shift, summary.holidayType),
    experience: firstNonEmpty(detail.experience, summary.career),
    education: firstNonEmpty(detail.education, summary.minEducation),
    employmentType: firstNonEmpty(detail.employmentType, summary.holidayType),
    deadline: firstNonEmpty(detail.deadline, summary.closeDate),
    contact: firstNonEmpty(detail.contact),
    companyLocation: firstNonEmpty(detail.companyLocation, summary.address),
    documents: firstNonEmpty(detail.documents),
    process: firstNonEmpty(detail.process),
    applyMethod: firstNonEmpty(detail.applyMethod, "워크넷 입사지원"),
    managerName: firstNonEmpty(detail.managerName, detail.contact),
    managerPhone: firstNonEmpty(detail.managerPhone, detail.contact),
    notice: firstNonEmpty(detail.notice, "지원 전 워크넷 원문 공고를 꼭 확인해 주세요."),
    requirements: dedupe(detail.requirements),
    preferences: dedupe(detail.preferences),
    duties: dedupe(detail.duties),
    benefits: dedupe(detail.benefits),
    rawText: normalizeSpace(
      [detail.rawText, summary.title, summary.company, summary.region, summary.salary, summary.address]
        .filter(Boolean)
        .join("\n")
    )
  };
}

async function parseWorknetPosting(url, summaryItem = {}) {
  const sourceUrl = summaryItem.detailUrl || summaryItem.mobileUrl || url;
  const html = await fetchHtml(sourceUrl);
  const $ = cheerio.load(html);

  const recruitTable = extractTableMap($, "#tab-panel01");
  const conditionTable = extractTableMap($, "#tab-panel02");
  const pageTable = extractPageTableMap($);
  const companyInfo = extractCompanyInfo($);
  const summaryColumns = extractSummaryColumns($);

  const duties = [cleanDash(cloneText($, $("#tab-panel01 .fold").first()))].filter(Boolean);
  const benefits = dedupe([
    ...extractItems($, "#tab-panel04 .emp_box_items li:not(.disable) p"),
    cleanDash(text($, "#tab-panel04 .box_border_type.mt16 p.b1_r"))
  ]);
  const processItems = dedupe(extractItems($, "#tab-panel05 .emp_box_items.line li:not(.disable) p"));
  const preferences = [cleanDash(text($, "#tab-panel03 .box_border_type .b1_r"))].filter(Boolean);

  const applyMethod = cleanDash(htmlToText($, "#tab-panel05 .emp_colbox_div .flex1 .b1_r"));
  const documents = cleanDash($("#tab-panel05 .emp_colbox_div .flex1 .b1_r").eq(1).text());
  const recruiterText = cleanDash(cloneText($, $("#tab-panel05 .mt70").eq(1)));
  const agencyPhone = cleanDash(pageTable["알선기관 연락처"]);
  const phoneMatch = recruiterText.match(/(0\d{1,2}[-)\s]?\d{3,4}[-\s]?\d{4})/);
  const emailMatch = recruiterText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);

  const detail = {
    sourceUrl,
    sourceSite: "worknet",
    companyName: firstNonEmpty(companyInfo["기업명"], summaryItem.company),
    title: firstNonEmpty(summaryItem.title, text($, ".tit_job"), text($, "h3")),
    location: firstNonEmpty(
      conditionTable["근무 예정지"],
      summaryColumns["근무조건"]?.values["지역"],
      summaryItem.region
    ),
    salary: firstNonEmpty(
      conditionTable["임금 조건"],
      summaryColumns["근무조건"]?.values["임금"],
      [summaryItem.salaryType, summaryItem.salary].filter(Boolean).join(" ")
    ),
    workType: firstNonEmpty(
      conditionTable["근무 형태"],
      summaryColumns["고용형태"]?.values["근무형태"],
      summaryItem.holidayType
    ),
    shift: [conditionTable["근무 시간"], conditionTable["휴게 시간"]]
      .map(cleanDash)
      .filter(Boolean)
      .join("\n"),
    experience: firstNonEmpty(
      recruitTable["경력"],
      summaryColumns["지원자격"]?.values["경력"],
      summaryItem.career
    ),
    education: firstNonEmpty(
      recruitTable["학력"],
      summaryColumns["지원자격"]?.values["학력"],
      summaryItem.minEducation
    ),
    employmentType: firstNonEmpty(
      conditionTable["고용 형태"],
      summaryColumns["고용형태"]?.values["고용형태"]
    ),
    deadline: firstNonEmpty(text($, "#tab-panel05 .left_area .cl-red"), summaryItem.closeDate),
    contact: firstNonEmpty(phoneMatch?.[1], agencyPhone),
    companyLocation: firstNonEmpty(
      companyInfo["기업주소"],
      conditionTable["근무 예정지"],
      summaryItem.address
    ),
    documents,
    process: processItems.join("\n"),
    applyMethod: firstNonEmpty(applyMethod, "워크넷 입사지원"),
    managerName: "",
    managerPhone: firstNonEmpty(phoneMatch?.[1], agencyPhone),
    notice: recruiterText,
    requirements: [
      recruitTable["자격 면허"],
      recruitTable["경력"],
      recruitTable["학력"]
    ].filter(Boolean),
    preferences,
    duties,
    benefits,
    rawText: normalizeSpace(
      [
        duties.join("\n"),
        Object.values(recruitTable).join("\n"),
        Object.values(conditionTable).join("\n"),
        benefits.join("\n"),
        processItems.join("\n"),
        applyMethod,
        documents,
        recruiterText,
        emailMatch ? emailMatch[0] : "",
        Object.values(companyInfo).join("\n")
      ]
        .filter(Boolean)
        .join("\n")
    )
  };

  return mergeSummaryWithDetail(summaryItem, detail);
}

module.exports = {
  parseWorknetPosting
};
