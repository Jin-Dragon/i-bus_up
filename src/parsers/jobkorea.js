const cheerio = require("cheerio");
const iconv = require("iconv-lite");

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`잡코리아 공고를 불러오지 못했습니다. status=${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get("content-type") || "";
  const charsetMatch = contentType.match(/charset=([^;]+)/i);
  const charset = (charsetMatch ? charsetMatch[1] : "utf-8").toLowerCase();
  const decodeCharset = charset.includes("euc-kr") || charset.includes("cp949") ? "cp949" : "utf-8";
  return iconv.decode(buffer, decodeCharset);
}

function text($, selector) {
  return $(selector).first().text().replace(/\s+/g, " ").trim();
}

function list($, selector) {
  return $(selector)
    .toArray()
    .map((element) => $(element).text().replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

async function parseJobKoreaPosting(url) {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const companyName =
    $('meta[property="og:article:author"]').attr("content") ||
    $(".coName").first().text().trim() ||
    $(".tplName").first().text().trim();

  const title =
    $('meta[property="og:title"]').attr("content") ||
    $(".giTitle").first().text().trim() ||
    $("h1").first().text().trim();

  return {
    sourceUrl: url,
    sourceSite: "jobkorea",
    companyName,
    title,
    location: text($, ".info .loc, .tbRow .loc, .workPlace"),
    salary: text($, ".info .salary, .tbRow .salary, .pay"),
    workType: text($, ".info .duty, .tbRow .duty"),
    shift: text($, ".info .time, .tbRow .time"),
    experience: text($, ".info .career, .tbRow .career"),
    education: text($, ".info .education, .tbRow .education"),
    employmentType: text($, ".info .jobtype, .tbRow .jobtype, .hireType"),
    deadline: text($, ".info .date, .tbRow .date, .deadline"),
    contact: text($, ".manager, .contact, .recruitManager"),
    requirements: list($, ".detailList li, .qualification li, .qualificationList li"),
    preferences: list($, ".preferred li, .preferential li"),
    duties: list($, ".workList li, .dutyList li, .description li"),
    benefits: list($, ".benefitList li, .welfareList li"),
    rawText: $("body").text()
  };
}

module.exports = { parseJobKoreaPosting };
