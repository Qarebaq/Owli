const api = globalThis.browser ?? globalThis.chrome;

const enabledInput    = document.querySelector("#enabled");
const siteLabel       = document.querySelector("#site");
const globalToggle    = document.querySelector("#globalToggle");
const globalLabel     = document.querySelector("#globalToggleLabel");
const modeInputs      = [...document.querySelectorAll("input[name='mode']")];
const pupils          = [document.querySelector(".pupil-l"), document.querySelector(".pupil-r")];
const addExceptionBtn = document.querySelector("#addException");
const removeExBtn     = document.querySelector("#removeException");
const openSettingsBtn = document.querySelector("#openSettings");

let hostname = "";
let settings = { enabled: true, mode: "auto", siteOverrides: {}, exceptions: [] };

// eye tracking
document.addEventListener("mousemove", (e) => {
  pupils.forEach((p, i) => {
    if (!p) return;
    const rect = p.closest("svg").getBoundingClientRect();
    const cx = rect.left + rect.width * (i === 0 ? 0.39 : 0.61);
    const cy = rect.top + rect.height * 0.47;
    const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
    p.style.transform = `translate(${Math.cos(angle)*1.2}px,${Math.sin(angle)*1.2}px)`;
  });
});

async function getActiveTab() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isException() {
  return (settings.exceptions ?? []).includes(hostname);
}

function render() {
  const on = isException() ? false : (settings.siteOverrides[hostname] ?? settings.enabled);
  enabledInput.checked = on;
  siteLabel.textContent = hostname || "—";
  modeInputs.forEach(inp => inp.checked = inp.value === settings.mode);
  globalLabel.textContent = settings.enabled
    ? "خاموش کردن روی همه سایت‌ها"
    : "روشن کردن روی همه سایت‌ها";

  addExceptionBtn.style.display = isException() ? "none" : "";
  removeExBtn.style.display     = isException() ? "" : "none";
}

async function notifyTab(tabId) {
  try { await api.tabs.sendMessage(tabId, { type: "smart-bidi-refresh" }); } catch (_) {}
}

(async () => {
  const tab = await getActiveTab();
  try { hostname = new URL(tab.url).hostname; } catch (_) {}

  const stored = await api.storage.local.get(settings);
  settings = { ...settings, ...stored };
  if (!Array.isArray(settings.exceptions)) settings.exceptions = [];
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

  addExceptionBtn.addEventListener("click", async () => {
    if (!hostname || isException()) return;
    settings.exceptions = [...settings.exceptions, hostname];
    await api.storage.local.set({ exceptions: settings.exceptions });
    render();
    await notifyTab(tab.id);
  });

  removeExBtn.addEventListener("click", async () => {
    settings.exceptions = settings.exceptions.filter(s => s !== hostname);
    await api.storage.local.set({ exceptions: settings.exceptions });
    render();
    await notifyTab(tab.id);
  });

  openSettingsBtn.addEventListener("click", () => {
    api.runtime.openOptionsPage();
  });
})();
