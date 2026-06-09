const api = globalThis.browser ?? globalThis.chrome;

let settings = {
  enabled: true,
  mode: "auto",
  siteOverrides: {},
  exceptions: []
};

// Navigation
document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();

    const target = link.dataset.section;

    document.querySelectorAll(".nav-link").forEach((item) => {
      item.classList.remove("active");
    });

    document.querySelectorAll(".section").forEach((section) => {
      section.classList.remove("active");
    });

    link.classList.add("active");
    document.getElementById(target)?.classList.add("active");
  });
});

// Remove a site from exceptions
async function removeException(site) {
  settings.exceptions = settings.exceptions.filter(
    (savedSite) => savedSite !== site
  );

  await api.storage.local.set({
    exceptions: settings.exceptions
  });

  renderExceptions();
}

// Create an exception item safely
function createExceptionItem(site) {
  const li = document.createElement("li");
  li.className = "exception-item";

  const domain = document.createElement("span");
  domain.className = "domain";
  domain.textContent = site;

  const badge = document.createElement("span");
  badge.className = "mode-badge";
  badge.textContent = "غیرفعال";

  const removeButton = document.createElement("button");
  removeButton.className = "remove-btn";
  removeButton.type = "button";
  removeButton.dataset.site = site;
  removeButton.title = "حذف";
  removeButton.textContent = "×";

  removeButton.addEventListener("click", async () => {
    await removeException(site);
  });

  li.appendChild(domain);
  li.appendChild(badge);
  li.appendChild(removeButton);

  return li;
}

// Render exceptions list
function renderExceptions() {
  const list = settings.exceptions ?? [];
  const ul = document.getElementById("exceptionList");
  const empty = document.getElementById("noExceptions");

  if (!ul || !empty) return;

  // Safe replacement for: ul.innerHTML = "";
  ul.replaceChildren();

  empty.style.display = list.length ? "none" : "";

  list.forEach((site) => {
    ul.appendChild(createExceptionItem(site));
  });
}

// Validate and normalize domain input
function normalizeDomain(raw) {
  let value = raw.trim().toLowerCase();

  // Remove protocol
  value = value.replace(/^https?:\/\//, "");

  // Remove path, query and hash
  value = value.split("/")[0];
  value = value.split("?")[0];
  value = value.split("#")[0];

  // Remove port
  value = value.replace(/:\d+$/, "");

  if (!value) return null;

  // No spaces allowed
  if (/\s/.test(value)) return null;

  // Domain should contain at least one dot
  if (!value.includes(".")) return null;

  return value;
}

// Add site
const input = document.getElementById("newSiteInput");
const addBtn = document.getElementById("addSiteBtn");
const errEl = document.getElementById("inputError");

let errorTimer;

function showError(message) {
  if (!errEl) return;

  errEl.textContent = message;

  clearTimeout(errorTimer);

  errorTimer = setTimeout(() => {
    errEl.textContent = "";
  }, 2500);
}

async function addSite() {
  if (!input) return;

  const domain = normalizeDomain(input.value);

  if (!domain) {
    showError("آدرس معتبر نیست.");
    return;
  }

  const exceptions = settings.exceptions ?? [];

  if (exceptions.includes(domain)) {
    showError("این سایت قبلاً اضافه شده.");
    return;
  }

  settings.exceptions = [...exceptions, domain];

  await api.storage.local.set({
    exceptions: settings.exceptions
  });

  input.value = "";
  renderExceptions();
}

addBtn?.addEventListener("click", addSite);

input?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addSite();
  }
});

// Global enabled toggle
const globalEnabledInput = document.getElementById("globalEnabled");

globalEnabledInput?.addEventListener("change", async () => {
  settings.enabled = globalEnabledInput.checked;

  await api.storage.local.set({
    enabled: settings.enabled
  });
});

// Mode radios
document.querySelectorAll("input[name='mode']").forEach((inputElement) => {
  inputElement.addEventListener("change", async () => {
    if (!inputElement.checked) return;

    settings.mode = inputElement.value;

    await api.storage.local.set({
      mode: settings.mode
    });
  });
});

// Version
try {
  const manifest = api.runtime.getManifest();
  const versionElement = document.getElementById("extVersion");

  if (versionElement) {
    versionElement.textContent = `نسخه ${manifest.version}`;
  }
} catch (error) {
  console.error("Could not read extension version:", error);
}

// Initialize
(async () => {
  try {
    const stored = await api.storage.local.get(settings);

    settings = {
      ...settings,
      ...stored
    };

    if (!Array.isArray(settings.exceptions)) {
      settings.exceptions = [];
    }

    if (globalEnabledInput) {
      globalEnabledInput.checked = settings.enabled;
    }

    document.querySelectorAll("input[name='mode']").forEach((inputElement) => {
      inputElement.checked = inputElement.value === settings.mode;
    });

    renderExceptions();

    // Open a requested section:
    // settings.html?section=exceptions
    const params = new URLSearchParams(location.search);
    const section = params.get("section");

    if (section) {
      document
        .querySelector(`.nav-link[data-section="${section}"]`)
        ?.click();
    }
  } catch (error) {
    console.error("Failed to load settings:", error);
    showError("خطا در بارگذاری تنظیمات.");
  }
})();
