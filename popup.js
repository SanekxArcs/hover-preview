const preferences = HoverPreviewSettings;
const enabledInput = document.getElementById("enabled");
const widthInput = document.getElementById("width");
const delayInput = document.getElementById("delay");
const settingsGroup = document.getElementById("settings");
const feedback = document.getElementById("feedback");
const presetButtons = [...document.querySelectorAll("[data-width]")];
let settings = { ...preferences.defaults };
let ready = false;
let saveQueue = Promise.resolve();

const render = () => {
  enabledInput.checked = settings.enabled;
  enabledInput.disabled = !ready;
  settingsGroup.disabled = !ready || !settings.enabled;
  document.getElementById("reset").disabled = !ready;
  widthInput.value = settings.width;
  delayInput.value = settings.delay;
  document.getElementById("sizeVal").textContent =
    `${settings.width} × ${preferences.heightFor(settings.width)}`;
  document.getElementById("delayVal").textContent =
    `${(settings.delay / 1000).toFixed(1)} s`;
  document.getElementById("statusText").textContent = settings.enabled
    ? "Ready when you hover"
    : "Paused until you switch it on";
  document
    .getElementById("statusDot")
    .classList.toggle("paused", !settings.enabled);
  document.getElementById("demoCard").style.width =
    `${105 + ((settings.width - 320) / 680) * 105}px`;
  presetButtons.forEach((button) =>
    button.setAttribute(
      "aria-pressed",
      String(Number(button.dataset.width) === settings.width),
    ),
  );
  [widthInput, delayInput].forEach((input) =>
    input.style.setProperty(
      "--progress",
      `${((Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min))) * 100}%`,
    ),
  );
};

const save = (changes) => {
  if (!ready) return;
  settings = preferences.normalize({ ...settings, ...changes });
  render();
  const snapshot = { ...settings };
  saveQueue = saveQueue.then(async () => {
    try {
      await chrome.storage.local.set(snapshot);
      feedback.textContent = "";
    } catch {
      feedback.textContent = "Could not save settings. Please try again.";
    }
  });
};

enabledInput.addEventListener("change", () =>
  save({ enabled: enabledInput.checked }),
);
widthInput.addEventListener("input", () =>
  save({ width: Number(widthInput.value) }),
);
delayInput.addEventListener("input", () =>
  save({ delay: Number(delayInput.value) }),
);
presetButtons.forEach((button) =>
  button.addEventListener("click", () =>
    save({ width: Number(button.dataset.width) }),
  ),
);
document
  .getElementById("reset")
  .addEventListener("click", () => save(preferences.defaults));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const next = { ...settings };
  Object.keys(preferences.defaults).forEach((key) => {
    if (changes[key])
      next[key] = changes[key].newValue ?? preferences.defaults[key];
  });
  settings = preferences.normalize(next);
  render();
});

(async () => {
  try {
    settings = preferences.normalize(
      await chrome.storage.local.get(preferences.defaults),
    );
    ready = true;
  } catch {
    feedback.textContent =
      "Could not load settings. Reopen this popup to retry.";
  }
  render();
})();
