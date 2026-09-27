// Verification for mos_cap_sim.html (prompt section 7). Run: node tests/verify.mjs
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require(execSync("npm root -g").toString().trim() + "/playwright"); }
const { chromium } = pw;
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "screenshots");
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", m => { if (m.type() === "error" || m.type() === "assert" || /FAIL|failed/.test(m.text())) errors.push(m.text()); });
page.on("pageerror", e => errors.push(String(e)));
await page.goto("file://" + path.join(here, "..", "mos_cap_sim.html"));
await page.evaluate(() => MOS.setManualClock(true));

let fails = 0;
const check = (name, ok, info = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${info}`); if (!ok) fails++; };

// 1. derived quantities
const st = await page.evaluate(() => MOS.selfTest());
st.forEach(r => check(r.name, r.pass, `(${r.value})`));
const p = await page.evaluate(() => MOS.params);

// 2. equilibrium states
const neutral = async tag => {
  const c = await page.evaluate(() => ({ ...MOS.counts }));
  check(`charge neutrality ${tag}`, c.gate === c.dep + c.inv + c.acc, JSON.stringify(c));
};
await page.evaluate(() => MOS.toggleSwitch());
const cases = [["VFB-1", p.VFB - 1], ["VFB", p.VFB], ["0", 0], ["0.3", 0.3], ["VT", p.VT], ["VT+1.5", p.VT + 1.5]];
const eq = {};
for (const [tag, v] of cases) {
  const s = await page.evaluate(v => { MOS.setVG(v); MOS.settle(); return MOS.state(); }, v);
  eq[tag] = s;
  console.log(`  V_G=${v.toFixed(3)}  phi_s=${s.phis.toFixed(4)}  V_ox=${s.Vox.toFixed(4)}  x_d=${(s.xd * 1e4).toFixed(4)}um  Q'inv=${s.Qinv.toExponential(3)}  V_int=${s.Vint.toFixed(4)}`);
  await neutral(tag);
  await page.screenshot({ path: path.join(out, `eq_${tag}.png`) });
}
check("V_FB: flat, zero charge", Math.abs(eq.VFB.Qm) < 1e-15 && eq.VFB.phis === 0);
check("V_G=0: phi_s ≈ 0.38", Math.abs(eq["0"].phis - 0.38) < 0.01, eq["0"].phis.toFixed(4));
check("V_G=0: V_ox ≈ 0.32", Math.abs(eq["0"].Vox - 0.32) < 0.01, eq["0"].Vox.toFixed(4));
check("V_T: phi_s ≈ 2phi_fp", Math.abs(eq.VT.phis - 2 * p.phifp) < 1e-3);
check("V_T: x_d ≈ x_dT", Math.abs(eq.VT.xd - p.xdT) / p.xdT < 1e-3);
check("V_T+1.5: x_d fixed", Math.abs(eq["VT+1.5"].xd - p.xdT) / p.xdT < 1e-3);
const slope = (eq["VT+1.5"].Qinv - eq.VT.Qinv) / 1.5;
check("Q'_inv slope ≈ -C_ox", Math.abs(slope / -p.Cox - 1) < 1e-3, slope.toExponential(3));

// 3. switch-closing transient, 0.25 s steps
await page.evaluate(() => MOS.reset());
await page.screenshot({ path: path.join(out, "fresh_slide8.png") });
await page.evaluate(() => MOS.toggleSwitch());
let prevE = null, prevN = -1, mono = true;
for (let i = 1; i <= 6; i++) {
  const s = await page.evaluate(() => { MOS.advance(0.25); return { ...MOS.state(), counts: { ...MOS.counts } }; });
  const EFm = -s.Vint;
  console.log(`  t=${(i * 0.25).toFixed(2)}s  E_Fm=${EFm.toFixed(4)} eV  +:${s.counts.gate}  -:${s.counts.dep}  phi_s=${s.phis.toFixed(4)}`);
  if (prevE !== null && !(EFm < prevE)) mono = false;
  if (s.counts.gate < prevN) mono = false;
  prevE = EFm; prevN = s.counts.gate;
  await neutral(`t=${i * 0.25}`);
  await page.screenshot({ path: path.join(out, `transient_${i}.png`) });
}
check("E_Fm decreases monotonically, +/- counts grow", mono);
await page.evaluate(() => MOS.advance(1.5));
const closed = await page.evaluate(() => MOS.state());
check("settled at V_G=0 within ~3 s", Math.abs(closed.Vint) < 1e-3, closed.Vint.toExponential(2));
// open: charge frozen, dial changes do nothing to the device
await page.evaluate(() => { MOS.toggleSwitch(); MOS.setVG(1.5); MOS.advance(2); });
const opened = await page.evaluate(() => MOS.state());
check("switch open: charge frozen", Math.abs(opened.Qm - closed.Qm) < 1e-15);
await page.screenshot({ path: path.join(out, "open_trapped.png") });
// reclose: goes to 1.5 V
await page.evaluate(() => { MOS.toggleSwitch(); MOS.advance(3); });
const reclosed = await page.evaluate(() => MOS.state());
check("reclose drives to new V_G", Math.abs(reclosed.Vint - 1.5) < 1e-3);
// reset
await page.evaluate(() => MOS.reset());
const fresh = await page.evaluate(() => MOS.state());
check("reset -> fresh device", fresh.Qm === 0 && !fresh.closed && !fresh.everConnected && Math.abs(fresh.Vint - p.phims) < 1e-12);
await page.evaluate(() => MOS.showE0(true));
await page.screenshot({ path: path.join(out, "fresh_E0.png") });
// accumulation with E0
await page.evaluate(() => { MOS.toggleSwitch(); MOS.setVG(MOS.params.VFB - 1); MOS.settle(); MOS.showE0(false); });
await page.screenshot({ path: path.join(out, "accumulation.png") });

check("no console errors / failed asserts", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(fails ? `\n${fails} check(s) FAILED` : "\nALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
