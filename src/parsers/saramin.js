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
    throw new Error(`사람인 공고를 불러오지 못했습니다. status=${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get("content-type") || "";
  const charsetMatch = contentType.match(/charset=([^;]+)/i);
  const charset = (charsetMatch ? charsetMatch[1] : "utf-8").toLowerCase();
  const decodeCharset = charset.includes("euc-kr") || charset.includes("cp949") ? "cp949" : "utf-8";
  return iconv.decode(buffer, decodeCharset);
}

function extractRecIdx(url) {
  const match = String(url).match(/rec_idx=(\d+)/);
  return match ? match[1] : "";
}

function buildCanonicalUrl(url) {
  const recIdx = extractRecIdx(url);
  return recIdx ? `https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=${recIdx}` : url;
}

function cleanNodeText($, element) {
  const clone = $(element).clone();
  clone.find("button, svg, script, style, .toolTipWrap, .toolTip, .salary_wrap").remove();
  return normalizeSpace(clone.text());
}

function extractDefinitionMap($, rootSelector) {
  const result = {};

  $(`${rootSelector} dl`).each((_, dl) => {
    const dt = normalizeSpace($(dl).find("dt").first().text());
    const dd = cleanNodeText($, $(dl).find("dd").first());
    if (dt && dd) {
      result[dt] = dd;
    }
  });

  return result;
}

function extractPreferredItems($) {
  return $(".jv_summary .preferred .toolTipTxt li")
    .toArray()
    .map((item) => {
      const label = normalizeSpace($(item).find("span").first().text());
      const clone = $(item).clone();
      clone.find("span").remove();
      const value = normalizeSpace(clone.text());
      return normalizeSpace(label ? `${label}: ${value}` : value);
    })
    .filter(Boolean);
}

function extractMetaDeadline($) {
  const dt = $(".jv_recruit_info dt")
    .toArray()
    .find((element) => normalizeSpace($(element).text()) === "마감일");

  if (!dt) {
    return "";
  }

  return normalizeSpace($(dt).next("dd").text());
}

function extractInfoBlocks($, container) {
  return container
    .find(".info-block")
    .toArray()
    .map((block) => {
      const title = normalizeSpace($(block).find(".info-block__title").first().text());
      const items = $(block)
        .find(".info-block__list p, .info-block__list li")
        .toArray()
        .map((item) => cleanNodeText($, item))
        .filter(Boolean);

      return { title, items };
    })
    .filter((block) => block.title || block.items.length > 0);
}

function findBlock(blocks, keyword) {
  return blocks.find((block) => block.title.includes(keyword));
}

function parseLabeledItems(items) {
  const result = {};

  for (const item of items || []) {
    const match = normalizeSpace(item).match(/^[•·\-\s]*([^:：]+)\s*[:：]\s*(.+)$/);
    if (match) {
      result[normalizeSpace(match[1])] = normalizeSpace(match[2]);
    }
  }

  return result;
}

function extractInfoValue($, label) {
  const target = $("dt")
    .toArray()
    .find((element) => normalizeSpace($(element).text()) === label);

  if (!target) {
    return "";
  }

  return normalizeSpace($(target).next("dd").text());
}

function extractWorkplaceAddress($) {
  return normalizeSpace($(".jv_location address .txt_adr").first().text());
}

function buildRawText(parts) {
  return parts
    .flatMap((part) => (Array.isArray(part) ? part : [part]))
    .map(normalizeSpace)
    .filter(Boolean)
    .join("\n");
}

async function parseSaraminPosting(url) {
  const sourceUrl = buildCanonicalUrl(url);
  const html = await fetchHtml(sourceUrl);
  const $ = cheerio.load(html);
  const recIdx = extractRecIdx(sourceUrl);

  const metaTitle = $('meta[property="og:title"]').attr("content") || $("title").text();
  const metaDescription = $('meta[name="description"]').attr("content") || "";
  const summary = extractDefinitionMap($, ".jv_summary .cont");
  const preferredItems = extractPreferredItems($);
  const detailContainer =
    $(`.jobsViewDetail_${recIdx}`).first().length > 0
      ? $(`.jobsViewDetail_${recIdx}`).first()
      : $(".jv_detail .user_content").first();
  const blocks = extractInfoBlocks($, detailContainer);

  const dutiesBlock = findBlock(blocks, "주요업무");
  const requirementsBlock = findBlock(blocks, "자격요건");
  const preferencesBlock = findBlock(blocks, "우대사항");
  const workConditionBlock = findBlock(blocks, "근무조건");
  const welfareBlock = findBlock(blocks, "복지");
  const processBlock = findBlock(blocks, "채용절차");
  const noticeBlock = findBlock(blocks, "유의사항");

  const workCondition = parseLabeledItems(workConditionBlock?.items || []);
  const processInfo = parseLabeledItems(processBlock?.items || []);

  const title =
    normalizeSpace($(".jv_header h1").first().text()) ||
    normalizeSpace(metaTitle.replace(/\s*-\s*사람인\s*$/, ""));

  const companyName =
    normalizeSpace($(".company_name .company").first().text()) ||
    normalizeSpace($(".jv_header .company_name").first().text()) ||
    normalizeSpace(metaTitle.match(/^\[([^\]]+)\]/)?.[1]);

  const duties = dutiesBlock?.items || [];
  const requirements = requirementsBlock?.items || [];
  const preferences = [...(preferencesBlock?.items || []), ...preferredItems].filter(Boolean);
  const benefits = welfareBlock?.items || [];

  const companyContact = extractInfoValue($, "연락처");
  const managerName = extractInfoValue($, "담당자") || extractInfoValue($, "채용담당자");
  const companyAddress = extractInfoValue($, "기업주소");
  const workplaceAddress = extractWorkplaceAddress($);

  return {
    sourceUrl,
    sourceSite: "saramin",
    companyName,
    title,
    location: summary["근무지역"] || workCondition["근무지"] || workplaceAddress || "",
    salary: summary["급여"] || workCondition["급여"] || "",
    workType: summary["고용형태"] || workCondition["고용형태"] || "",
    shift: summary["근무일시"] || workCondition["근무시간"] || workCondition["근무일시"] || "",
    experience: summary["경력"] || "",
    education: summary["학력"] || "",
    employmentType: summary["고용형태"] || workCondition["고용형태"] || "",
    deadline: extractMetaDeadline($) || processInfo["접수기간"] || "",
    contact: companyContact,
    companyLocation: companyAddress || workplaceAddress,
    documents: processInfo["제출서류"] || "",
    process: processInfo["전형절차"] || "",
    applyMethod: processInfo["접수방법"] || "",
    managerName: managerName || companyContact,
    managerPhone: companyContact,
    notice: (noticeBlock?.items || []).join("\n"),
    requirements,
    preferences,
    duties,
    benefits,
    rawText: buildRawText([
      metaDescription,
      Object.values(summary),
      duties,
      requirements,
      preferences,
      benefits,
      workConditionBlock?.items || [],
      processBlock?.items || [],
      noticeBlock?.items || [],
      companyAddress,
      companyContact,
      managerName,
      workplaceAddress
    ])
  };
}

module.exports = { parseSaraminPosting };
