const fs = require("fs");
const path = require("path");
const iconv = require("iconv-lite");

async function main() {
  const url = process.argv[2];
  const outFile = process.argv[3];

  if (!url || !outFile) {
    throw new Error("usage: node scripts/dump_saramin.js <url> <outfile>");
  }

  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`fetch failed: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const html = iconv.decode(buffer, "cp949");
  fs.writeFileSync(path.resolve(outFile), html, "utf8");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
