import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const debuggingPort = process.env.CDP_PORT || "9223";
const baseUrl = process.env.QA_URL || "http://localhost:3100";
const outputDir = path.resolve(process.env.QA_OUTPUT || ".qa");
await mkdir(outputDir, { recursive: true });

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let targets;
for (let attempt = 0; attempt < 20; attempt += 1) {
  try {
    targets = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`).then((response) => response.json());
    if (targets.length) break;
  } catch {
    // Browser is still starting.
  }
  await sleep(250);
}
if (!targets?.length) throw new Error("No Chrome DevTools target was available.");

const target = await fetch(`http://127.0.0.1:${debuggingPort}/json/new?about:blank`, { method: "PUT" })
  .then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let messageId = 0;
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
};
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});

function send(method, params = {}) {
  const id = ++messageId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function screenshot(name) {
  const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(path.join(outputDir, name), Buffer.from(result.data, "base64"));
}

async function navigate(width, height) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await send("Page.navigate", { url: baseUrl });
  await sleep(5000);
  await evaluate("history.scrollRestoration = 'manual'; window.scrollTo(0, 0)");
  await sleep(200);
}

await send("Page.enable");
await send("Runtime.enable");

await navigate(1440, 900);
await screenshot("desktop-hero.png");
for (const [selector, fileName, offset = 0] of [
  [".story-opening", "desktop-couple.png", 360],
  [".small-moments", "desktop-moments.png", 780],
  [".horizon-chapter", "desktop-horizon.png", 710],
  [".closing-chapter", "desktop-closing.png", 0],
]) {
  await evaluate(`{ const node = document.querySelector(${JSON.stringify(selector)}); window.scrollTo(0, window.scrollY + node.getBoundingClientRect().top + ${offset}); }`);
  await sleep(500);
  await screenshot(fileName);
}

const desktopOverflow = await evaluate(`({
  documentWidth: document.documentElement.scrollWidth,
  viewportWidth: document.documentElement.clientWidth,
  dialogPresent: Boolean(document.querySelector('.invitation-dialog'))
})`);

await navigate(390, 844);
await screenshot("mobile-hero.png");
await evaluate("{ const node = document.querySelector('.closing-chapter'); window.scrollTo(0, window.scrollY + node.getBoundingClientRect().top); }");
await sleep(500);
await screenshot("mobile-closing.png");
await evaluate("document.querySelector('.invitation-cta').click()");
await sleep(350);
const dialogOpen = await evaluate("document.querySelector('.invitation-dialog').open");
if (!dialogOpen) throw new Error("The invitation dialog did not open after the CTA click.");
await screenshot("mobile-form.png");

const cepResult = await evaluate(`(async () => {
  const set = (name, value) => {
    const field = document.querySelector('[name="' + name + '"]');
    const setter = Object.getOwnPropertyDescriptor(field instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value').set;
    setter.call(field, value);
    field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  };
  set('cep', '01310-100');
  const cep = document.querySelector('[name="cep"]');
  await new Promise((resolve) => setTimeout(resolve, 150));
  cep.focus();
  cep.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return {
    street: document.querySelector('[name="street"]').value,
    city: document.querySelector('[name="city"]').value,
    feedback: document.querySelector('.cep-feedback').textContent.trim()
  };
})()`);

const submitResult = await evaluate(`(async () => {
  const set = (name, value) => {
    const field = document.querySelector('[name="' + name + '"]');
    const setter = Object.getOwnPropertyDescriptor(field instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value').set;
    setter.call(field, value);
    field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  };
  set('fullName', 'Convidado Visual de Teste');
  set('street', document.querySelector('[name="street"]').value || 'Avenida Paulista');
  set('number', '1000');
  set('neighborhood', document.querySelector('[name="neighborhood"]').value || 'Bela Vista');
  set('city', document.querySelector('[name="city"]').value || 'São Paulo');
  set('state', document.querySelector('[name="state"]').value || 'SP');
  document.querySelector('.submit-address').click();
  await new Promise((resolve) => setTimeout(resolve, 2500));
  return {
    success: Boolean(document.querySelector('.form-success')),
    text: document.querySelector('.form-success')?.innerText || document.querySelector('.form-error')?.innerText || ''
  };
})()`);
await screenshot("mobile-success.png");

const mobileOverflow = await evaluate(`({
  documentWidth: document.documentElement.scrollWidth,
  viewportWidth: document.documentElement.clientWidth
})`);

console.log(JSON.stringify({ desktopOverflow, mobileOverflow, cepResult, submitResult }, null, 2));
socket.close();
