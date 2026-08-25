import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const targetUrl = String(process.env.PERFORMANCE_URL || "").trim();
const timeoutMs = Math.max(5_000, Number(process.env.PERFORMANCE_TIMEOUT_MS || 15_000));
const device = String(process.env.PERFORMANCE_DEVICE || "desktop").toLowerCase() === "mobile"
  ? "mobile"
  : "desktop";

if (!targetUrl) {
  throw new Error("Defina PERFORMANCE_URL para executar a medição no navegador.");
}

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

async function findChrome() {
  for (const candidate of chromeCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continua procurando uma instalação local compatível.
    }
  }
  throw new Error("Chrome ou Edge não foi localizado para a medição headless.");
}

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function waitForDebuggingPort(userDataDir) {
  const portFile = join(userDataDir, "DevToolsActivePort");
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const [port] = (await readFile(portFile, "utf8")).trim().split(/\r?\n/);
      if (port) return Number(port);
    } catch {
      // O navegador ainda está inicializando.
    }
    await wait(100);
  }
  throw new Error("O navegador headless não abriu a porta de diagnóstico.");
}

async function findPageTarget(port) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await response.json();
    const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
    if (page) return page;
    await wait(100);
  }
  throw new Error("A página headless não ficou disponível para medição.");
}

function createProtocolClient(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  let requestId = 0;

  const ready = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result || {});
  });

  async function send(method, params = {}) {
    await ready;
    const id = ++requestId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  return { ready, send, close: () => socket.close() };
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error("Falha ao avaliar a página medida.");
  return result.result?.value;
}

const chromePath = await findChrome();
const userDataDir = await mkdtemp(join(tmpdir(), "torneio360-headless-"));
const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--disable-extensions",
  "--disable-background-networking",
  "--no-first-run",
  "--no-default-browser-check",
  "--remote-debugging-port=0",
  `--user-data-dir=${userDataDir}`,
  "about:blank",
], { stdio: "ignore", windowsHide: true });

let client;
try {
  const port = await waitForDebuggingPort(userDataDir);
  const pageTarget = await findPageTarget(port);
  client = createProtocolClient(pageTarget.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Network.enable");

  const viewport = device === "mobile"
    ? { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }
    : { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false };
  await client.send("Emulation.setDeviceMetricsOverride", viewport);
  await client.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      window.__t360Performance = { lcpMs: 0, cls: 0, longTasks: 0 };
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) window.__t360Performance.lcpMs = last.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__t360Performance.cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        window.__t360Performance.longTasks += list.getEntries().length;
      }).observe({ type: "longtask", buffered: true });
    `,
  });

  const navigationStartedAt = performance.now();
  await client.send("Page.navigate", { url: targetUrl });
  const deadline = Date.now() + timeoutMs;
  let profileVisible = false;
  while (Date.now() < deadline) {
    profileVisible = await evaluate(
      client,
      "Boolean(document.querySelector('.publicPage.publicArenaPage')) && !document.querySelector('.publicArenaLoadingScreen')"
    );
    if (profileVisible) break;
    await wait(100);
  }
  const profileVisibleMs = Math.round(performance.now() - navigationStartedAt);
  await wait(500);

  const metrics = await evaluate(client, `(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource");
    return {
      profileVisible: Boolean(document.querySelector(".publicPage.publicArenaPage")),
      loadingVisible: Boolean(document.querySelector(".publicArenaLoadingScreen")),
      unavailableVisible: Boolean(document.querySelector(".publicUnavailablePage")),
      eventCards: document.querySelectorAll(".publicArenaEventCard").length,
      domContentLoadedMs: Math.round(navigation?.domContentLoadedEventEnd || 0),
      loadEventMs: Math.round(navigation?.loadEventEnd || 0),
      lcpMs: Math.round(window.__t360Performance?.lcpMs || 0),
      cls: Number((window.__t360Performance?.cls || 0).toFixed(4)),
      longTasks: window.__t360Performance?.longTasks || 0,
      resourceCount: resources.length,
      transferKb: Math.round(resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0) / 1024),
    };
  })()`);

  const result = { device, profileVisibleMs, ...metrics };
  console.table([result]);
  if (!profileVisible || metrics.unavailableVisible) process.exitCode = 1;
} finally {
  client?.close();
  const chromeExited = new Promise((resolve) => chrome.once("exit", resolve));
  if (chrome.exitCode === null) chrome.kill();
  await Promise.race([chromeExited, wait(3_000)]);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rm(userDataDir, { recursive: true, force: true });
      break;
    } catch (error) {
      if (attempt === 9) {
        console.warn(`Não foi possível remover o diretório temporário do navegador: ${error.message}`);
      } else {
        await wait(200);
      }
    }
  }
}
