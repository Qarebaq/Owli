const api = globalThis.browser ?? globalThis.chrome;

let settings = { enabled: true, mode: "auto", siteOverrides: {}, exceptions: [] };

// Nav
document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const target = link.dataset.section;
    document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    link.classList.add("active");
    document.getElementById(target)?.classList.add("active");
  });
});

// Render exceptions list
function renderExceptions() {
  const list = settings.exceptions ?? [];
  const ul = document.getElementById("exceptionList");
  const empty = document.getElementById("noExceptions");

  ul.innerHTML = "";
  empty.style.display = list.length ? "none" : "";

  list.forEach(site => {
    const li = document.createElement("li");
    li.className = "exception-item";
    li.innerHTML = `
      <span class="domain">${site}</span>
      <span class="mode-badge">غیرفعال</span>
      <button class="remove-btn" data-site="${site}" title="حذف">×</button>
    `;
    li.querySelector(".remove-btn").addEventListener("click", async () => {
      settings.exceptions = settings.exceptions.filter(s => s !== site);
      await api.storage.local.set({ exceptions: settings.exceptions });
      renderExceptions();
    });
    ul.appendChild(li);
  });
}

// Validate and normalize domain input
function normalizeDomain(raw) {
  let s = raw.trim().toLowerCase();
  // strip protocol if pasted
  s = s.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!s) return null;
  // basic sanity: must have a dot and no spaces
  if (!s.includes(".") || /\s/.test(s)) return null;
  return s;
}

// Add site
const input    = document.getElementById("newSiteInput");
const addBtn   = document.getElementById("addSiteBtn");
const errEl    = document.getElementById("inputError");

function showError(msg) {
  errEl.textContent = msg;
  setTimeout(() => { errEl.textContent = ""; }, 2500);
}

async function addSite() {
  const domain = normalizeDomain(input.value);
  if (!domain) { showError("آدرس معتبر نیست."); return; }
  if ((settings.exceptions ?? []).includes(domain)) { showError("این سایت قبلاً اضافه شده."); return; }

  settings.exceptions = [...(settings.exceptions ?? []), domain];
  await api.storage.local.set({ exceptions: settings.exceptions });
  input.value = "";
  renderExceptions();
}

addBtn.addEventListener("click", addSite);
input.addEventListener("keydown", (e) => { if (e.key === "Enter") addSite(); });

// Global enabled toggle
const globalEnabledInput = document.getElementById("globalEnabled");
globalEnabledInput.addEventListener("change", async () => {
  settings.enabled = globalEnabledInput.checked;
  await api.storage.local.set({ enabled: settings.enabled });
});

// Mode radios
document.querySelectorAll("input[name='mode']").forEach(inp => {
  inp.addEventListener("change", async () => {
    if (!inp.checked) return;
    settings.mode = inp.value;
    await api.storage.local.set({ mode: settings.mode });
  });
});

// Version
try {
  const manifest = api.runtime.getManifest();
  document.getElementById("extVersion").textContent = `نسخه ${manifest.version}`;
} catch (_) {}

// Init
(async () => {
  const stored = await api.storage.local.get(settings);
  settings = { ...settings, ...stored };
  if (!Array.isArray(settings.exceptions)) settings.exceptions = [];

  globalEnabledInput.checked = settings.enabled;
  document.querySelectorAll("input[name='mode']").forEach(inp => {
    inp.checked = inp.value === settings.mode;
  });
  renderExceptions();

  // If opened with ?section=exceptions, jump there
  const params = new URLSearchParams(location.search);
  const sec = params.get("section");
  if (sec) {
    document.querySelector(`[data-section="${sec}"]`)?.click();
  }
})();
