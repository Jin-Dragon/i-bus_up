const cheerio = require("cheerio");
const { config } = require("./config");

const DEFAULT_KEYWORDS = [
  "버스기사",
  "버스운전",
  "통근버스",
  "통학버스",
  "전세버스",
  "셔틀버스",
  "마을버스"
];

const BUS_RELATED_PATTERN =
  /버스|통근|통학|전세|셔틀|마을버스|고속버스|기사|운전원|운전기사|승무원/;

const API_PAGE_SIZE = 100;
const MAX_API_PAGES = 5;

function getText($node) {
  return $node.text().replace(/\s+/g, " ").trim();
}

function pickRootText($, selectors) {
  for (const selector of selectors) {
    const value = getText($(selector).first());
    if (value) {
      return value;
    }
  }
  return "";
}

function pickItemText($item, selectors) {
  for (const selector of selectors) {
    const value = getText($item.find(selector).first());
    if (value) {
      return value;
    }
  }
  return "";
}

function normalizeItems(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value || "")
    .split(/[,\n|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildKeywordQuery(keyword) {
  const requested = normalizeItems(keyword);
  const merged = [...new Set([...DEFAULT_KEYWORDS, ...requested])];
  return merged.join("|");
}

function toAbsoluteUrl(url) {
  if (!url) {
    return "";
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `https://www.work24.go.kr${url.startsWith("/") ? "" : "/"}${url}`;
}

function isBusRelatedJob(job) {
  const text = [job.title, job.company, job.occupation].filter(Boolean).join(" ");
  if (BUS_RELATED_PATTERN.test(text)) {
    return true;
  }

  return /^6222/.test(String(job.occupation || ""));
}

function parseListXml(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const total = Number(pickRootText($, ["total", "totalCount"])) || 0;
  const startPage = Number(pickRootText($, ["startPage"])) || 1;
  const display = Number(pickRootText($, ["display"])) || 0;
  const items = [];

  $("dhsOpenEmpInfo, wanted, item").each((_index, element) => {
    const $item = $(element);
    const job = {
      wantedAuthNo: pickItemText($item, ["wantedAuthNo"]),
      company: pickItemText($item, ["company"]),
      title: pickItemText($item, ["title", "jobTitle", "wantedTitle"]),
      salaryType: pickItemText($item, ["salTpNm", "salTp"]),
      salary: pickItemText($item, ["sal", "salary"]),
      region: pickItemText($item, ["region"]),
      holidayType: pickItemText($item, ["holidayTpNm"]),
      minEducation: pickItemText($item, ["minEdubg"]),
      career: pickItemText($item, ["career"]),
      regDate: pickItemText($item, ["regDt", "regDate"]),
      closeDate: pickItemText($item, ["closeDt", "closeDate"]),
      infoSource: pickItemText($item, ["empWantedTypeNm", "empWantedTitle"]),
      detailUrl: toAbsoluteUrl(pickItemText($item, ["wantedInfoUrl", "infoUrl"])),
      mobileUrl: toAbsoluteUrl(pickItemText($item, ["wantedMobileInfoUrl", "mobileInfoUrl"])),
      address: pickItemText($item, ["roadAddr", "basicAddr", "homePg"]),
      occupation: pickItemText($item, ["jobsCd", "jobsNm"])
    };

    if (job.title || job.company) {
      items.push(job);
    }
  });

  return {
    total,
    startPage,
    display,
    items
  };
}

async function fetchWorknetPage({ keywordQuery, region, page }) {
  const url = new URL(config.worknetApiUrl);
  url.searchParams.set("authKey", config.worknetApiKey);
  url.searchParams.set("callTp", "L");
  url.searchParams.set("returnType", "XML");
  url.searchParams.set("startPage", String(page));
  url.searchParams.set("display", String(API_PAGE_SIZE));
  url.searchParams.set("keyword", keywordQuery);

  if (region) {
    url.searchParams.set("region", region);
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/xml, text/xml;q=0.9, */*;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(`WorkNet API request failed with status ${response.status}.`);
  }

  return parseListXml(await response.text());
}

async function searchWorknetJobs({ keyword = "", region = "" } = {}) {
  if (!config.worknetApiKey) {
    throw new Error("WORKNET_API_KEY is not configured.");
  }

  const keywordQuery = buildKeywordQuery(keyword);
  const firstPage = await fetchWorknetPage({ keywordQuery, region, page: 1 });
  const allItems = [...firstPage.items];

  const totalPages = Math.min(
    MAX_API_PAGES,
    Math.max(1, Math.ceil(firstPage.total / API_PAGE_SIZE))
  );

  for (let page = 2; page <= totalPages; page += 1) {
    const nextPage = await fetchWorknetPage({ keywordQuery, region, page });
    allItems.push(...nextPage.items);
  }

  const uniqueItems = Array.from(
    new Map(
      allItems.map((item) => [item.wantedAuthNo || `${item.title}-${item.company}`, item])
    ).values()
  );
  const filteredItems = uniqueItems.filter(isBusRelatedJob);

  return {
    total: filteredItems.length,
    startPage: 1,
    display: filteredItems.length,
    items: filteredItems,
    keywordQuery,
    fetchedPages: totalPages,
    fetchedItems: uniqueItems.length
  };
}

module.exports = {
  DEFAULT_KEYWORDS,
  searchWorknetJobs
};
