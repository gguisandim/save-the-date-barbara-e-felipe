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

async function navigate(width, height, reducedMotion = false) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: reducedMotion ? "reduce" : "no-preference" }],
  });
  await send("Page.navigate", { url: baseUrl });
  await sleep(3500);
}

async function selectorCenter(selector) {
  return evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) throw new Error("Missing selector: " + ${JSON.stringify(selector)});
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
}

async function mouseClick(selector) {
  const point = await selectorCenter(selector);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
}

async function touch(selector) {
  const point = await selectorCenter(selector);
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: point.x, y: point.y }] });
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function pressKey(key, code = key) {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key, code });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key, code });
}

await send("Page.enable");
await send("Runtime.enable");

await navigate(1440, 900);
await screenshot("desktop-act-1-ocean.png");
const beforeInteraction = await evaluate(`({
  act: document.querySelector('.experience-shell').dataset.act,
  scrollLocked: document.documentElement.scrollHeight === document.documentElement.clientHeight,
  cue: document.querySelector('.discovery-cue').innerText.trim(),
  currentProgress: document.querySelector('.act-progress [aria-current="step"]').getAttribute('aria-label')
})`);
await sleep(1000);
const stillWaiting = await evaluate("document.querySelector('.experience-shell').dataset.act");

await mouseClick(".sound-toggle");
await sleep(600);
const audioBefore = await evaluate(`({
  pressed: document.querySelector('.sound-toggle').getAttribute('aria-pressed'),
  paused: document.querySelector('audio').paused,
  currentTime: document.querySelector('audio').currentTime,
  act: document.querySelector('.experience-shell').dataset.act
})`);

await mouseClick(".ocean-touch-surface");
await sleep(140);
await screenshot("desktop-ocean-ripple.png");
await sleep(2160);
await screenshot("desktop-act-2-photos.png");
const desktopPhotos = await evaluate(`({
  act: document.querySelector('.experience-shell').dataset.act,
  visiblePhotos: [...document.querySelectorAll('.act-photo')].filter((node) => getComputedStyle(node).opacity === '1').length,
  scrollLocked: document.documentElement.scrollHeight === document.documentElement.clientHeight,
  focusManaged: document.activeElement.matches('.experience-scene.scene-active'),
  audioPaused: document.querySelector('audio').paused,
  audioAdvanced: document.querySelector('audio').currentTime > ${audioBefore.currentTime}
})`);

await pressKey("ArrowRight");
await sleep(1100);
await screenshot("desktop-act-3-invitation.png");
const desktopInvitation = await evaluate(`({
  act: document.querySelector('.experience-shell').dataset.act,
  ctaVisible: Boolean(document.querySelector('.scene-active .invitation-cta')),
  chapterFourRemoved: !document.body.innerText.includes('CAPÍTULO IV'),
  focusManaged: document.activeElement.matches('.experience-scene.scene-active'),
  scrollLocked: document.documentElement.scrollHeight === document.documentElement.clientHeight
})`);

await pressKey("Home");
await sleep(1000);
const keyboardReturn = await evaluate("document.querySelector('.experience-shell').dataset.act");

await navigate(390, 844);
await screenshot("mobile-390-act-1-ocean.png");
await touch(".ocean-touch-surface");
await sleep(2300);
await screenshot("mobile-390-act-2-photos.png");
const mobile390Photos = await evaluate(`({
  act: document.querySelector('.experience-shell').dataset.act,
  documentWidth: document.documentElement.scrollWidth,
  viewportWidth: document.documentElement.clientWidth,
  documentHeight: document.documentElement.scrollHeight,
  viewportHeight: document.documentElement.clientHeight
})`);

await touch(".photo-act");
await sleep(1100);
await screenshot("mobile-390-act-3-invitation.png");
await touch(".invitation-cta");
await sleep(350);
const dialogOpen = await evaluate("document.querySelector('.invitation-dialog').open");
if (!dialogOpen) throw new Error("The invitation dialog did not open after the CTA touch.");
await screenshot("mobile-390-form.png");

const clientValidation = await evaluate(`(async () => {
  document.querySelector('.submit-address').click();
  await new Promise((resolve) => setTimeout(resolve, 150));
  return {
    errors: document.querySelectorAll('.form-field.has-error').length,
    focusedField: document.activeElement?.getAttribute('name') || '',
    message: document.querySelector('.form-error')?.textContent.trim() || '',
    requestSucceeded: Boolean(document.querySelector('.form-success')),
    internalScroll: document.querySelector('.invitation-sheet').scrollHeight > document.querySelector('.invitation-sheet').clientHeight,
    pageStillLocked: document.documentElement.scrollHeight === document.documentElement.clientHeight
  };
})()`);

const cepResult = await evaluate(`(async () => {
  const set = (name, value) => {
    const field = document.querySelector('[name="' + name + '"]');
    const setter = Object.getOwnPropertyDescriptor(field instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value').set;
    setter.call(field, value);
    field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  };
  set('cep', '01310-100');
  const cep = document.querySelector('[name="cep"]');
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
await screenshot("mobile-390-success.png");

await navigate(360, 800);
await touch(".ocean-touch-surface");
await sleep(2300);
await screenshot("mobile-360-act-2-photos.png");
await pressKey("ArrowRight");
await sleep(1100);
await screenshot("mobile-360-act-3-invitation.png");
const mobile360 = await evaluate(`({
  act: document.querySelector('.experience-shell').dataset.act,
  documentWidth: document.documentElement.scrollWidth,
  viewportWidth: document.documentElement.clientWidth,
  documentHeight: document.documentElement.scrollHeight,
  viewportHeight: document.documentElement.clientHeight,
  ctaInsideViewport: (() => {
    const rect = document.querySelector('.scene-active .invitation-cta').getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= innerHeight;
  })()
})`);

await navigate(390, 844, true);
const reducedMotionBefore = await evaluate(`({
  videos: document.querySelectorAll('video').length,
  act: document.querySelector('.experience-shell').dataset.act
})`);
await touch(".ocean-touch-surface");
await sleep(100);
const reducedMotionAfter = await evaluate("document.querySelector('.experience-shell').dataset.act");

console.log(JSON.stringify({
  desktop: {
    beforeInteraction,
    stillWaiting,
    audioBefore,
    photos: desktopPhotos,
    invitation: desktopInvitation,
    keyboardReturn,
  },
  mobile390: {
    photos: mobile390Photos,
    clientValidation,
    cepResult,
    submitResult,
  },
  mobile360,
  reducedMotion: {
    before: reducedMotionBefore,
    afterInteraction: reducedMotionAfter,
  },
}, null, 2));
socket.close();
