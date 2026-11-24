// Run with Node 22 against a fresh V2 launcher and a local Chromium CDP port.
import assert from "node:assert/strict";
import {setTimeout as delay} from "node:timers/promises";

const [app, devtools] = process.argv.slice(2);
const tab = (await (await fetch(`${devtools}/json/list`)).json()).find(({type}) => type === "page");
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, {once: true});
  ws.addEventListener("error", reject, {once: true});
});
let sequence = 0;
const pending = new Map();
const exceptions = [];
ws.addEventListener("message", ({data}) => {
  const message = JSON.parse(data);
  const resolve = pending.get(message.id);
  if (resolve) {
    pending.delete(message.id);
    resolve(message);
  }
  if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails);
});
async function send(method, params = {}) {
  const id = ++sequence;
  const response = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out: ${method}`)), 5000);
    pending.set(id, (value) => { clearTimeout(timer); resolve(value); });
  });
  ws.send(JSON.stringify({id, method, params}));
  const {result, error} = await response;
  assert.equal(error, undefined);
  return result;
}
async function evaluate(expression) {
  const {result, exceptionDetails} = await send("Runtime.evaluate", {expression, returnByValue: true});
  assert.equal(exceptionDetails, undefined);
  return result.value;
}
async function until(expression) {
  for (let i = 0; i < 80; i++) {
    if (await evaluate(expression)) return;
    await delay(100);
  }
  assert.fail(`Browser condition not met: ${expression}`);
}

try {
  await send("Runtime.enable");
  await send("Page.navigate", {url: app});
  await until("document.querySelector('#status')?.textContent === 'Local data loaded.'");
  assert.match(await evaluate("document.querySelector('#daily-status').textContent"), /0 observed days/);
  await evaluate("document.querySelector('#correlation-form button').click()");
  await until("document.querySelector('#correlation-status').textContent.includes('0 paired days')");

  const rows = Array.from({length: 12}, (_, i) => [
    {metric: "weight", unit: "kg", value: 55 + i, observed_at: `2026-02-${String(i + 1).padStart(2, '0')}T12:00:00Z`},
    {metric: "heart_rate", unit: "bpm", value: 70 + 2 * i, observed_at: `2026-02-${String(i + 2).padStart(2, '0')}T12:00:00Z`},
  ]).flat();
  // Exercise the browser's fixture-upload and refresh path.
  await evaluate(`(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([${JSON.stringify(JSON.stringify(rows))}], 'synthetic.json', {type: 'application/json'}));
    document.querySelector('#fixture').files = transfer.files;
    document.querySelector('#upload').requestSubmit();
  })()`);
  await until("document.querySelector('#status').textContent.includes('(24 rows).') && !document.querySelector('#fixture').disabled");
  assert.equal(await evaluate("document.querySelectorAll('#daily-chart svg circle').length"), 12);
  assert.equal(await evaluate("document.querySelectorAll('#daily-data tbody tr').length"), 12);

  await evaluate(`(() => {
    document.querySelector('#correlation-y').value = 'heart_rate';
    document.querySelector('#lag-days').value = '1';
    document.querySelector('#rolling-days').value = '3';
    document.querySelector('#correlation-form button').click();
  })()`);
  await until("document.querySelector('#correlation-status').textContent.includes('12 paired days')");
  assert.match(await evaluate("document.querySelector('#correlation-status').textContent"), /Pearson: 1.*Spearman: 1/);
  assert.match(await evaluate("document.querySelector('#correlation-method').textContent"), /lag 1.*No p-values or confidence intervals/);
  assert.equal(await evaluate("document.querySelectorAll('#correlation-plot circle').length"), 12);
  assert.equal(await evaluate("document.querySelectorAll('#correlation-plot polyline').length"), 2);
  assert.equal(await evaluate("document.querySelectorAll('#correlation-distributions tbody tr').length"), 2);
  assert.equal(await evaluate("document.querySelectorAll('#correlation-pairs tbody tr').length"), 12);
  await evaluate(`(() => {
    document.querySelector('#correlation-start').value = '2026-02-15';
    document.querySelector('#correlation-end').value = '2026-02-01';
    document.querySelector('#correlation-form button').click();
  })()`);
  await until("document.querySelector('#correlation-status').textContent.includes('Choose an inclusive X date range')");
  assert.equal(await evaluate("document.querySelectorAll('#correlation-plot svg').length"), 0);
  assert.deepEqual(exceptions, []);
  console.log("Chromium: empty states, fixture upload, daily chart, lagged R fit, and validation passed.");
} finally {
  ws.close();
}
