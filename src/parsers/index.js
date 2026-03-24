const { parseSaraminPosting } = require("./saramin");
const { parseJobKoreaPosting } = require("./jobkorea");

function normalizeText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

async function parseJobPosting(url) {
  if (!url) {
    throw new Error("공고 URL이 필요합니다.");
  }

  if (url.includes("saramin.co.kr")) {
    return parseSaraminPosting(url);
  }

  if (url.includes("jobkorea.co.kr")) {
    return parseJobKoreaPosting(url);
  }

  throw new Error(`지원하지 않는 공고 도메인입니다: ${url}`);
}

function finalizePosting(raw) {
  return {
    sourceUrl: raw.sourceUrl,
    sourceSite: raw.sourceSite,
    companyName: normalizeText(raw.companyName),
    title: normalizeText(raw.title),
    location: normalizeText(raw.location),
    salary: normalizeText(raw.salary),
    workType: normalizeText(raw.workType),
    shift: normalizeText(raw.shift),
    experience: normalizeText(raw.experience),
    education: normalizeText(raw.education),
    employmentType: normalizeText(raw.employmentType),
    deadline: normalizeText(raw.deadline),
    contact: normalizeText(raw.contact),
    companyLocation: normalizeText(raw.companyLocation),
    documents: normalizeText(raw.documents),
    process: normalizeText(raw.process),
    applyMethod: normalizeText(raw.applyMethod),
    managerName: normalizeText(raw.managerName),
    managerPhone: normalizeText(raw.managerPhone),
    notice: normalizeText(raw.notice),
    requirements: (raw.requirements || []).map(normalizeText).filter(Boolean),
    preferences: (raw.preferences || []).map(normalizeText).filter(Boolean),
    duties: (raw.duties || []).map(normalizeText).filter(Boolean),
    benefits: (raw.benefits || []).map(normalizeText).filter(Boolean),
    rawText: normalizeText(raw.rawText)
  };
}

module.exports = {
  parseJobPosting,
  finalizePosting
};
