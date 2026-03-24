const { chromium } = require("playwright");
const { config } = require("../config");
const { ensureDir } = require("../store");

async function launchBrowser() {
  ensureDir(config.dataDir);
  return chromium.launch({ headless: config.headless });
}

async function createContext(browser) {
  try {
    return await browser.newContext({ storageState: config.storageStatePath });
  } catch (_error) {
    return browser.newContext();
  }
}

async function loginOneBus() {
  const browser = await launchBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  await page.goto(config.loginUrl, { waitUntil: "domcontentloaded" });
  await openLoginPage(page);

  if (config.username && config.password) {
    await fillFirstVisible(
      page,
      [
        'input[name="uid"]',
        'input[name="user_id"]',
        'input[name="userid"]',
        'input[name="mb_id"]',
        'input[type="text"]'
      ],
      config.username
    );

    await fillFirstVisible(
      page,
      [
        'input[name="passwd"]',
        'input[name="password"]',
        'input[name="user_pw"]',
        'input[name="mb_password"]',
        'input[type="password"]'
      ],
      config.password
    );

    await submitLogin(page);
  }

  await page.waitForTimeout(3000);
  await context.storageState({ path: config.storageStatePath });
  await browser.close();
}

async function publishToOneBus(draft, options = {}) {
  const browser = await launchBrowser();
  const context = await createContext(browser);
  const page = await context.newPage();
  const category = options.category || config.defaultCategory;
  let lastDialogMessage = "";

  page.on("dialog", async (dialog) => {
    lastDialogMessage = dialog.message();
    await dialog.accept().catch(() => {});
  });

  await page.goto(buildBoardUrl(category), { waitUntil: "domcontentloaded" });
  await openWritePage(page);

  if (needsLogin(page.url())) {
    await browser.close();
    throw new Error("1-BUS login is required. Run the login command first.");
  }

  await selectCategory(page, category);
  await fillTitle(page, draft.title);
  await fillBody(page, draft.body);

  await context.storageState({ path: config.storageStatePath });

  if (options.submit) {
    await clickFirstVisible(page, [
      "button.save_post",
      'button[onclick*="POST.submit"]',
      'button[type="submit"]',
      'input[type="submit"]',
      'a[onclick*="submit"]'
    ]);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);
  } else if (config.headless) {
    await page.screenshot({ path: `${config.dataDir}\\onebus-filled-form.png`, fullPage: true });
  } else {
    await page.pause();
  }

  const finalUrl = page.url();
  if (options.submit && !isViewPageUrl(finalUrl)) {
    await page.screenshot({ path: `${config.dataDir}\\onebus-submit-failed.png`, fullPage: true }).catch(() => {});
    await browser.close();
    throw new Error(
      lastDialogMessage
        ? `1-BUS submit did not complete: ${lastDialogMessage}`
        : `1-BUS submit did not complete. Final URL remained ${finalUrl}`
    );
  }

  await browser.close();
  return { finalUrl };
}

function buildBoardUrl(category) {
  return category ? `${config.jobListUrl}${category}` : config.jobListUrl;
}

function needsLogin(url) {
  return /login|signin|member/i.test(url);
}

function isViewPageUrl(url) {
  return /[?&]bmode=view/i.test(String(url || ""));
}

async function openWritePage(page) {
  const writeLink = await findVisibleLocator(page, ['a[href*="bmode=write"]']);
  if (!writeLink) {
    throw new Error("Could not find the write-post link on the board page.");
  }

  await writeLink.click();
  await page.waitForLoadState("domcontentloaded").catch(() => {});
}

async function openLoginPage(page) {
  const passwordField = await findVisibleLocator(page, ['input[type="password"]']);
  if (passwordField) {
    return;
  }

  const loginLink = await findVisibleLocator(page, ['a[href*="/login"]']);
  if (loginLink) {
    await loginLink.click();
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    return;
  }

  await page.goto(config.loginUrl, { waitUntil: "domcontentloaded" });
}

async function submitLogin(page) {
  const passwordField = await findVisibleLocator(page, ['input[name="passwd"]', 'input[type="password"]']);
  if (passwordField) {
    await passwordField.press("Enter");
    return;
  }

  await clickFirstVisible(page, ['button[type="submit"]', 'input[type="submit"]']);
}

async function selectCategory(page, category) {
  const select = await findVisibleLocator(page, ['select[name*="category"]', 'select[id*="category"]']);
  if (select) {
    const selectedByValue = await select.selectOption({ value: category }).catch(() => []);
    if (selectedByValue.length > 0) {
      return;
    }
  }

  const radio = await findVisibleLocator(page, [`input[type="radio"][value="${category}"]`]);
  if (radio) {
    await radio.check().catch(() => {});
    return;
  }

  const trigger = await findVisibleLocator(page, ["._category_type_list", ".div_select.category_select"]);
  if (trigger) {
    await trigger.click();
    const option = await findVisibleLocator(page, [".category_dropdown li", ".category_dropdown .txt"]);
    if (option) {
      await option.click();
      await page.waitForTimeout(200);
    }
  }

  await page.evaluate((value) => {
    const categoryInput = document.querySelector("#category_type");
    if (categoryInput) {
      categoryInput.value = value;
    }
  }, resolveCategoryValue(category));
}

async function fillTitle(page, title) {
  await fillFirstVisible(
    page,
    ['input[name="subject"]', 'input[name="wr_subject"]', 'input[name="title"]', 'input[type="text"]'],
    title
  );
}

async function fillBody(page, body) {
  const froalaEditor = page.locator(".fr-element.fr-view").first();
  if (await froalaEditor.count()) {
    await setFroalaHtml(page, body);
    return;
  }

  const textarea = await findVisibleLocator(page, [
    'textarea[name="content"]',
    'textarea[name="wr_content"]',
    'textarea[name="body"]',
    "textarea"
  ]);
  if (textarea) {
    await textarea.fill(body);
    return;
  }

  const editorBody = page.frameLocator("iframe").locator("body").first();
  if (await editorBody.count()) {
    await editorBody.fill(body);
    return;
  }

  throw new Error("Could not find the editor body field.");
}

async function setFroalaHtml(page, html) {
  await page.evaluate((value) => {
    const instance = window.FroalaEditor?.INSTANCES?.[0];
    if (!instance) {
      throw new Error("Could not find the Froala editor instance.");
    }

    instance.html.set(value);
    instance.events.trigger("contentChanged");

    const bodyInput = document.querySelector("#body_input");
    if (bodyInput) {
      bodyInput.value = value;
    }

    const plainBodyInput = document.querySelector("#plain_body_input");
    if (plainBodyInput) {
      const temp = document.createElement("div");
      temp.innerHTML = value;
      plainBodyInput.value = (temp.textContent || "").trim();
    }
  }, html);
}

async function fillFirstVisible(page, selectors, value) {
  const locator = await findVisibleLocator(page, selectors);
  if (!locator) {
    throw new Error(`Could not find an input field: ${selectors.join(", ")}`);
  }

  await locator.fill(value);
}

async function clickFirstVisible(page, selectors) {
  const locator = await findVisibleLocator(page, selectors);
  if (!locator) {
    throw new Error(`Could not find a clickable element: ${selectors.join(", ")}`);
  }

  await locator.click();
}

async function findVisibleLocator(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count();

    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }
  }

  return null;
}

function resolveCategoryValue(category) {
  const normalized = String(category || "").trim();
  if (!normalized || normalized === "1Ps1h24za0" || normalized === "일반") {
    return "1";
  }
  return normalized;
}

module.exports = {
  loginOneBus,
  publishToOneBus
};
