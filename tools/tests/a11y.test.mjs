// Hygiene (ux-review/20-quality-bar.md §4): axe-core over every page and state, baseline empty — every control named,
// real buttons, valid ARIA. Contrast is legibility.test.mjs's (axe can't see what's behind glass; that test reads pixels).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const AXE = readFileSync(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
/** rules axe can't judge here, each with its reason (the baseline is the list's length: keep it short) */
const OFF = {
  "color-contrast": "legibility.test.mjs measures it from pixels (glass)",
};

/** one state: axe's violations, one line per rule and element */
async function check(k, label) {
  await k.sleep(700);
  const got = await k.ev(
    `axe.run(document,{runOnly:{type:"tag",values:${JSON.stringify(TAGS)}},rules:${JSON.stringify(
      Object.fromEntries(Object.keys(OFF).map(r => [r, { enabled: false }])),
    )},resultTypes:["violations"]}).then(r=>r.violations.flatMap(v=>v.nodes.map(n=>({rule:v.id,impact:v.impact,target:n.target.join(" "),html:n.html.slice(0,120)}))))`,
  );
  const loose = await k.ev(CLICKABLE);
  return [...got, ...loose].map(g => ({ ...g, state: label }));
}

/* what axe can't see: something you click that isn't a control — a pointer cursor on an element that is neither a native
   control nor given a control's role (a keyboard or a screen reader can't reach it). The top-most one is reported. A
   larger mouse target for a real control says which (data-click-for="<selector>", found in it or round it): the row
   around its button, the thumbnail beside its switch. */
const CONTROL =
  "button,a[href],input,select,textarea,label,summary,[role=button],[role=switch],[role=link],[role=tab],[role=option],[role=menuitem],[role=checkbox],[role=slider],[role=radio],[role=separator],[contenteditable=true]";
const CLICKABLE = `[...document.querySelectorAll("body *")].filter(el=>{
  if(el.closest(${JSON.stringify(CONTROL)})||el.closest("svg")&&el.tagName!=="svg")return false;
  const cs=getComputedStyle(el);if(cs.cursor!=="pointer"||cs.visibility==="hidden"||cs.display==="none")return false;
  const r=el.getBoundingClientRect();if(!r.width||!r.height)return false;
  const f=el.dataset.clickFor;if(f)for(let a=el;a;a=a.parentElement){const c=a.querySelector(f);if(c&&c.matches(${JSON.stringify(CONTROL)}))return false}
  const p=el.parentElement;return !(p&&getComputedStyle(p).cursor==="pointer"&&!p.closest(${JSON.stringify(CONTROL)}));
}).map(el=>({rule:"clickable-not-a-control",impact:"serious",target:el.id?"#"+el.id:el.tagName.toLowerCase()+(el.className&&typeof el.className==="string"?"."+el.className.trim().split(/ +/).join("."):""),html:el.outerHTML.slice(0,120)}))`;

const esc = async k => {
  for (const type of ["keyDown", "keyUp"])
    await k.send("Input.dispatchKeyEvent", { type, key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
};

export async function everyStateIsCleanForAxe(k, t) {
  await k.job("[fill:ffffff] a white page", { steps: 1, name: "White" });
  await k.job("[fail:vram] a cup", { steps: 2 });
  await k.until(`!current()&&jobs.some(j=>j.status==="error")&&jobs.some(j=>j.status==="done")`, 30000);
  await k.ev(`(setPaused(true),1)`);
  await k.job("a waiting one", { steps: 2, name: "Waiting" });
  await k.send("Runtime.evaluate", { expression: AXE }); // a whole script: not through ev, which takes an expression
  const all = [];
  const at = async (label, js) => {
    if (js) await k.ev(`(${js},1)`);
    all.push(...(await check(k, label)));
  };
  for (const glass of ["on", "off"]) {
    await k.setting("glass", glass);
    const g = `glass ${glass}`;
    await at(`${g}: Generating, your draft`, `showView("gen")`);
    await at(`${g}: the Gallery, a shown picture`, `(showView("gen"),browseTo(jobs.find(j=>j.name==="White")))`);
    const r = await k.rect("#frame");
    await k.mouse(r.left + r.width / 2, r.top + r.height / 2);
    await at(`${g}: hovering the picture`);
    await k.mouse(2, 2);
    await at(`${g}: the Queue (waiting, done, failed)`, `(endPeek(),showView("queue"))`);
    await at(`${g}: the LoRAs page`, `showView("loras")`);
    await at(`${g}: PNG Info`, `showView("png")`);
    await at(`${g}: Settings`, `(showView("gen"),$("gear").click())`);
    await esc(k);
    await at(`${g}: the Layout menu`, `$("layBtn").click()`);
    await esc(k);
    await at(`${g}: a pill's menu`, `$("pMP").click()`);
    await esc(k);
    await at(`${g}: private`, `toggleCover()`);
    await k.ev(`(toggleCover(),1)`);
    await at(`${g}: Vertical`, `setDock("below")`);
    await k.ev(`(setDock("left"),1)`);
  }
  /* one line per rule and element: its states */
  const seen = new Map();
  for (const v of all) {
    const key = `${v.rule} (${v.impact}) ${v.target}`;
    if (!seen.has(key)) seen.set(key, { ...v, states: [] });
    seen.get(key).states.push(v.state);
  }
  const lines = [...seen.entries()].map(
    ([key, v]) => `${key} — ${v.html} — ${v.states.length} state(s), first: ${v.states[0]}`,
  );
  mkdirSync(new URL("./out/", import.meta.url), { recursive: true }); // a fresh checkout (CI) has no out/ yet
  writeFileSync(new URL("./out/a11y.txt", import.meta.url), lines.join("\n") + "\n"); // the full list, for fixing
  t.ok(
    !seen.size,
    `axe finds nothing in ${all.length ? "" : "any "}state (${Object.keys(OFF).length} rule(s) off: ${Object.keys(OFF).join(", ")})`,
    lines,
  );
}
everyStateIsCleanForAxe.opts = { step: 0.2 };
