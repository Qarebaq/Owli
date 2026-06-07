const api = globalThis.browser ?? globalThis.chrome;

const enabledInput = document.querySelector("#enabled");
const siteLabel    = document.querySelector("#site");
const globalToggle = document.querySelector("#globalToggle");
const globalLabel  = document.querySelector("#globalToggleLabel");
const modeInputs   = [...document.querySelectorAll("input[name='mode']")];
const pupils       = [document.querySelector(".pupil-l"), document.querySelector(".pupil-r")];

let hostname = "";
let settings = { enabled: true, mode: "auto", siteOverrides: {} };

// subtle eye tracking
document.addEventListener("mousemove", (e) => {
  pupils.forEach((p, i) => {
    if (!p) return;
    const rect = p.closest("svg").getBoundingClientRect();
    const cx = rect.left + rect.width * (i === 0 ? 0.39 : 0.61);
    const cy = rect.top  + rect.height * 0.47;
    const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
    const d = 1.2;
    p.style.transform = `translate(${Math.cos(angle)*d}px,${Math.sin(angle)*d}px)`;
  });
});

async function getActiveTab() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function render() {
  const on = settings.siteOverrides[hostname] ?? settings.enabled;
  enabledInput.checked = on;
  siteLabel.textContent = hostname || "—";
  modeInputs.forEach(inp => inp.checked = inp.value === settings.mode);
  globalLabel.textContent = settings.enabled
    ? "خاموش کردن روی همه سایت‌ها"
    : "روشن کردن روی همه سایت‌ها";
}

async function notifyTab(tabId) {
  try { await api.tabs.sendMessage(tabId, { type: "smart-bidi-refresh" }); } catch (_) {}
}

(async () => {
  const tab = await getActiveTab();
  try { hostname = new URL(tab.url).hostname; } catch (_) {}
  settings = { ...settings, ...(await api.storage.local.get(settings)) };
  render();

  enabledInput.addEventListener("change", async () => {
    settings.siteOverrides = { ...settings.siteOverrides, [hostname]: enabledInput.checked };
    await api.storage.local.set({ siteOverrides: settings.siteOverrides });
    await notifyTab(tab.id);
  });

  modeInputs.forEach(inp => {
    inp.addEventListener("change", async () => {
      if (!inp.checked) return;
      settings.mode = inp.value;
      await api.storage.local.set({ mode: settings.mode });
      await notifyTab(tab.id);
    });
  });

  globalToggle.addEventListener("click", async () => {
    settings.enabled = !settings.enabled;
    settings.siteOverrides = {};
    await api.storage.local.set({ enabled: settings.enabled, siteOverrides: settings.siteOverrides });
    render();
    await notifyTab(tab.id);
  });
})();
