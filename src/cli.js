const { config } = require("./config");
const { runLogin, createDraftSnapshot, publishFromUrl, publishBatch } = require("./jobService");

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function parseSubmitFlag(value) {
  if (value == null) {
    return false;
  }
  return value === true || value === "true" || value === "1";
}

function parseUrls(args) {
  if (args.url) {
    return [args.url];
  }

  if (args.urls) {
    return args.urls
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

async function run() {
  const command = process.argv[2];
  const args = parseArgs(process.argv.slice(3));

  if (!command || ["help", "--help", "-h"].includes(command)) {
    printHelp();
    return;
  }

  if (command === "login") {
    await runLogin();
    console.log(`로그인 세션 저장 완료: ${config.storageStatePath}`);
    return;
  }

  if (command === "draft") {
    if (!args.url) {
      throw new Error("--url 인자가 필요합니다.");
    }

    const snapshot = await createDraftSnapshot(args.url);
    console.log(snapshot.draft.title);
    console.log("");
    console.log(snapshot.draft.body);
    return;
  }

  if (command === "publish") {
    if (!args.url) {
      throw new Error("--url 인자가 필요합니다.");
    }

    await publishFromUrl(args.url, {
      category: args.category || config.defaultCategory,
      submit: parseSubmitFlag(args.submit)
    });
    console.log("1-BUS 입력 작업을 마쳤습니다.");
    return;
  }

  if (command === "batch") {
    const urls = parseUrls(args);
    if (urls.length === 0) {
      throw new Error("--url 또는 --urls 인자가 필요합니다.");
    }

    const result = await publishBatch(urls, {
      category: args.category || config.defaultCategory,
      submit: parseSubmitFlag(args.submit)
    });

    console.log(`총 ${result.total}건 처리`);
    console.log(`성공 ${result.successCount}건 / 실패 ${result.failureCount}건`);
    return;
  }

  throw new Error(`지원하지 않는 명령입니다: ${command}`);
}

function printHelp() {
  console.log("사용법");
  console.log('  node src/cli.js login');
  console.log('  node src/cli.js draft --url "공고URL"');
  console.log('  node src/cli.js publish --url "공고URL" --category "1Ps1h24za0" --submit false');
  console.log('  node src/cli.js batch --urls "URL1,URL2" --category "1Ps1h24za0" --submit false');
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
