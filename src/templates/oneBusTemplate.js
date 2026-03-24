function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function nlToBr(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function joinLines(values) {
  return (values || []).map(cleanText).filter(Boolean).join("\n");
}

function firstNonEmpty(values) {
  const list = (values || []).map(cleanText).filter(Boolean);
  return list[0] || "";
}

function cleanTitle(title) {
  return cleanText(title);
}

function findVehicleType(text) {
  const source = String(text || "");
  const patterns = [
    /\d{2}\s*인승\s*대형버스/,
    /\d{2}\s*인승/,
    /대형버스/,
    /중형버스/,
    /통근버스/,
    /통학버스/,
    /전세버스/,
    /관광버스/,
    /광역버스/,
    /마을버스/
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match) {
      return cleanText(match[0]);
    }
  }

  return "";
}

function findWorkPeriod(text) {
  const source = String(text || "");
  if (/상시모집/.test(source)) {
    return "상시모집";
  }

  const match = source.match(/근무기간\s*[:：]?\s*([^\n]+)/);
  return cleanText(match ? match[1] : "");
}

function buildApplyMethodHtml(posting) {
  const label = cleanText(posting.applyMethod) || "사람인 입사지원";
  const url = cleanText(posting.sourceUrl);

  if (!url) {
    return nlToBr(label);
  }

  return `<a href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer" style="color: #0d6efd; text-decoration: underline;">${escapeHtml(label)}</a>`;
}

function buildPostingData(posting) {
  const raw = cleanText(posting.rawText);
  const title = cleanTitle(posting.title);
  const requirements = (posting.requirements || []).map(cleanText).filter(Boolean);
  const preferences = (posting.preferences || []).map(cleanText).filter(Boolean);
  const duties = (posting.duties || []).map(cleanText).filter(Boolean);
  const benefits = (posting.benefits || []).map(cleanText).filter(Boolean);

  return {
    title: title || "버스기사 모집",
    companyName: cleanText(posting.companyName),
    companyLocation: cleanText(posting.companyLocation),
    companyContact: cleanText(posting.contact || posting.managerPhone),
    duty: firstNonEmpty(duties),
    location: cleanText(posting.location),
    vehicleType: findVehicleType([title, raw, joinLines(duties)].filter(Boolean).join("\n")),
    workPeriod: findWorkPeriod(raw),
    workTime: cleanText(posting.shift),
    employmentType: cleanText(posting.employmentType || posting.workType),
    salary: cleanText(posting.salary),
    benefits: joinLines(benefits),
    deadline: cleanText(posting.deadline),
    education: cleanText(posting.education),
    experience: cleanText(posting.experience),
    required: firstNonEmpty(requirements),
    otherRequirements: joinLines(requirements.slice(1)),
    preferences: joinLines(preferences),
    documents: cleanText(posting.documents),
    process: cleanText(posting.process),
    applyMethodHtml: buildApplyMethodHtml(posting),
    managerName: cleanText(posting.managerName || posting.contact || posting.managerPhone),
    managerPhone: cleanText(posting.managerPhone || posting.contact),
    notice: cleanText(
      posting.notice || '전화 지원 시 "일버스에서 정보 보고 전화 드립니다" 라고 말씀해 주세요.'
    )
  };
}

function cell(value) {
  return nlToBr(cleanText(value));
}

function multilineCell(value) {
  const cleaned = String(value || "").trim();
  return cleaned ? nlToBr(cleaned) : "";
}

function buildTitle(posting) {
  return cleanTitle(posting.title) || "버스기사 모집";
}

function buildBody(posting) {
  const data = buildPostingData(posting);

  return `<div style="width: 100%; max-width: 1000px; margin: 0 auto; font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; color: #333; line-height: 1.6;">
<div style="background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 20px; margin-bottom: 30px;">
<h3 style="font-size: 18px; font-weight: bold; color: #dc3545; margin: 0 0 15px 0;">※ 기업 담당자님!</h3>
<ul style="margin: 0; padding-left: 20px;">
<li style="margin-bottom: 8px; font-size: 14px; color: #495057;">구인 공고 작성하실 때, 아래 양식대로 상세하게 작성해 주세요.</li>
<li style="margin-bottom: 8px; font-size: 14px; color: #495057;">양식에 맞지 않는 게시물은 통보 없이 삭제될 수 있습니다.</li>
<li style="margin-bottom: 8px; font-size: 14px; color: #495057;"><strong>ex) 표시 내용부분에 정보에 맞게 작성해 주시면 됩니다.</strong></li>
<li style="margin-bottom: 8px; font-size: 14px;"><strong style="color: #dc3545;">이 글은 작성 완료 후 삭제해 주세요.</strong></li>
</ul>
</div>

<h2 style="font-size: 20px; font-weight: bold; color: #2c3e50; margin: 30px 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #3498db;">담당 업무</h2>
<table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 20px; background-color: #fff;">
<colgroup>
<col style="width: 25%;">
<col style="width: 75%;">
</colgroup>
<tbody>
<tr>
<th style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #f1f3f5; font-weight: bold; color: #495057; text-align: left;">업무내용</th>
<td style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #fff; color: #212121;">${cell(data.duty)}</td>
</tr>
<tr>
<th style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #f1f3f5; font-weight: bold; color: #495057; text-align: left;">근무지</th>
<td style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #fff; color: #212121;">${cell(data.location)}</td>
</tr>
<tr>
<th style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #f1f3f5; font-weight: bold; color: #495057; text-align: left;">차량종류</th>
<td style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #fff; color: #212121;">${cell(data.vehicleType)}</td>
</tr>
<tr>
<th style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #f1f3f5; font-weight: bold; color: #495057; text-align: left;">근무기간</th>
<td style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #fff; color: #212121;">${cell(data.workPeriod)}</td>
</tr>
<tr>
<th style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #f1f3f5; font-weight: bold; color: #495057; text-align: left;">근무시간</th>
<td style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #fff; color: #212121;">${cell(data.workTime)}</td>
</tr>
</tbody>
</table>

<h2 style="font-size: 20px; font-weight: bold; color: #2c3e50; margin: 30px 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #3498db;">근무 환경</h2>
<table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 20px; background-color: #fff;">
<colgroup>
<col style="width: 20%;">
<col style="width: 30%;">
<col style="width: 20%;">
<col style="width: 30%;">
</colgroup>
<tbody>
<tr>
<th style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #f1f3f5; font-weight: bold; color: #495057; text-align: left;">근무형태</th>
<td style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #fff; color: #212121;">${cell(data.employmentType)}</td>
<th style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #f1f3f5; font-weight: bold; color: #495057; text-align: left;">급여</th>
<td style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #fff; color: #212121;">${cell(data.salary)}</td>
</tr>
<tr>
<th style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #f1f3f5; font-weight: bold; color: #495057; text-align: left; vertical-align: top;">복리후생</th>
<td colspan="3" style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #fff; color: #212121; min-height: 60px;">${multilineCell(data.benefits)}</td>
</tr>
<tr>
<th style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #f1f3f5; font-weight: bold; color: #495057; text-align: left;">모집 기간</th>
<td colspan="3" style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #fff; color: #212121;">${cell(data.deadline)}</td>
</tr>
</tbody>
</table>

<h2 style="font-size: 20px; font-weight: bold; color: #2c3e50; margin: 30px 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #3498db;">자격요건 &amp; 우대사항</h2>
<table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 20px; background-color: #fff;">
<colgroup>
<col style="width: 20%;">
<col style="width: 30%;">
<col style="width: 20%;">
<col style="width: 30%;">
</colgroup>
<tbody>
<tr>
<th style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #f1f3f5; font-weight: bold; color: #495057; text-align: left;">학력</th>
<td style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #fff; color: #212121;">${cell(data.education)}</td>
<th style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #f1f3f5; font-weight: bold; color: #495057; text-align: left;">경력</th>
<td style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #fff; color: #212121;">${cell(data.experience)}</td>
</tr>
<tr>
<th style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #f1f3f5; font-weight: bold; color: #495057; text-align: left;">필수</th>
<td colspan="3" style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #fff; color: #212121;">${cell(data.required)}</td>
</tr>
<tr>
<th style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #f1f3f5; font-weight: bold; color: #495057; text-align: left; vertical-align: top;">기타</th>
<td colspan="3" style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #fff; color: #212121; min-height: 60px;">${multilineCell(data.otherRequirements)}</td>
</tr>
<tr>
<th style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #f1f3f5; font-weight: bold; color: #495057; text-align: left; vertical-align: top;">우대사항</th>
<td colspan="3" style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #fff; color: #212121; min-height: 80px;">${multilineCell(data.preferences)}</td>
</tr>
</tbody>
</table>

<h2 style="font-size: 20px; font-weight: bold; color: #2c3e50; margin: 30px 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #3498db;">전형절차 &amp; 담당자</h2>
<table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 20px; background-color: #fff;">
<colgroup>
<col style="width: 20%;">
<col style="width: 30%;">
<col style="width: 20%;">
<col style="width: 30%;">
</colgroup>
<tbody>
<tr>
<th style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #f1f3f5; font-weight: bold; color: #495057; text-align: left;">제출서류</th>
<td colspan="3" style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #fff; color: #212121;">${cell(data.documents)}</td>
</tr>
<tr>
<th style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #f1f3f5; font-weight: bold; color: #495057; text-align: left;">전형절차</th>
<td colspan="3" style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #fff; color: #212121;">${cell(data.process)}</td>
</tr>
<tr>
<th style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #f1f3f5; font-weight: bold; color: #495057; text-align: left;">지원방법</th>
<td colspan="3" style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #fff; color: #212121;">${data.applyMethodHtml}</td>
</tr>
<tr>
<th style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #fff3cd; font-weight: bold; color: #856404; text-align: left;">채용담당자</th>
<td style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #fff3cd; color: #856404; font-weight: bold;">${cell(data.managerName)}</td>
<th style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #fff3cd; font-weight: bold; color: #856404; text-align: left;">전화번호</th>
<td style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #fff3cd; color: #856404; font-weight: bold;">${cell(data.managerPhone)}</td>
</tr>
<tr>
<th style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #f1f3f5; font-weight: bold; color: #495057; text-align: left; vertical-align: top;">안내사항</th>
<td colspan="3" style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #fff; min-height: 100px;">
<div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 4px; padding: 15px; margin-bottom: 10px; font-size: 14px; color: #0c5460;"><strong>전화 지원 시 &quot;일버스에서 정보 보고 전화 드립니다&quot; 라고 말씀해 주세요.</strong></div>
<p style="margin: 0; color: #212121;">${cell(data.notice)}</p>
</td>
</tr>
</tbody>
</table>

<h2 style="font-size: 20px; font-weight: bold; color: #2c3e50; margin: 30px 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #3498db;">기업 정보</h2>
<table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 20px; background-color: #fff;">
<colgroup>
<col style="width: 25%;">
<col style="width: 75%;">
</colgroup>
<tbody>
<tr>
<th style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #f1f3f5; font-weight: bold; color: #495057; text-align: left;">기업명</th>
<td style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #fff; color: #212121;">${cell(data.companyName)}</td>
</tr>
<tr>
<th style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #f1f3f5; font-weight: bold; color: #495057; text-align: left;">회사위치</th>
<td style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #fff; color: #212121;">${cell(data.companyLocation)}</td>
</tr>
<tr>
<th style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #f1f3f5; font-weight: bold; color: #495057; text-align: left;">연락처</th>
<td style="border: 1px solid #dee2e6; padding: 12px 15px; font-size: 15px; background-color: #fff; color: #212121;">${cell(data.companyContact)}</td>
</tr>
</tbody>
</table>

<div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 12px; margin-top: 20px; font-size: 13px; color: #721c24; text-align: center;"><strong>ex) 표시 내용부분에 정보에 맞게 작성해 주시면 됩니다.<br>&nbsp;이 글은 작성 완료 후 삭제해 주세요.</strong></div></div>`;
}

function buildOneBusDraft(posting) {
  return {
    title: buildTitle(posting),
    body: buildBody(posting)
  };
}

module.exports = {
  buildOneBusDraft
};
