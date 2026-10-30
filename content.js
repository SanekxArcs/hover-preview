(() => {
  if (window.__hoverPreviewInitialized) return;
  window.__hoverPreviewInitialized = true;

  const preferences = HoverPreviewSettings;
  const pageWidth = 1280;
  const pageHeight = 800;
  const headerHeight = preferences.headerHeight;
  let settings = { ...preferences.defaults, enabled: false };
  let anchor = null;
  let currentUrl = "";
  let showTimer;
  let hideTimer;
  let loadTimer;
  let visible = false;

  const host = document.createElement("div");
  host.style.cssText =
    "all:initial!important;position:fixed!important;z-index:2147483647!important;top:0!important;left:0!important;width:0!important;height:0!important;color-scheme:light dark!important;";
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `<style>
    :host{all:initial;color-scheme:light dark}
    *{box-sizing:border-box}
    .card{--bg:#fff;--fg:#18181b;--muted:#71717a;--border:#e4e4e7;position:fixed;display:none;flex-direction:column;background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:12px;box-shadow:0 12px 40px #0002,0 2px 8px #0001;overflow:hidden;font:12px/1.5 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:left}
    .header{display:flex;align-items:center;gap:8px;height:${headerHeight}px;min-height:${headerHeight}px;padding:0 8px 0 12px;border-bottom:1px solid var(--border)}
    .mark{width:6px;height:6px;border:1.5px solid var(--muted);border-radius:2px;flex-shrink:0}
    .address{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:11px}
    a,button{display:grid;place-items:center;width:24px;height:24px;padding:0;border:0;border-radius:5px;background:transparent;color:var(--muted);text-decoration:none;font:16px system-ui;cursor:pointer}
    a:hover,button:hover{background:color-mix(in srgb,var(--muted) 12%,transparent);color:var(--fg)}
    a:focus-visible,button:focus-visible{outline:2px solid var(--muted);outline-offset:-2px}
    .viewport{position:relative;flex:1;overflow:hidden;background:var(--bg)}
    iframe{position:absolute;inset:0;width:${pageWidth}px;height:${pageHeight}px;transform-origin:0 0;border:0;background:#fff}
    .loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:8px;background:var(--bg);color:var(--muted);pointer-events:none}
    .loading[hidden]{display:none}
    .spinner{width:14px;height:14px;border:1.5px solid var(--border);border-top-color:var(--muted);border-radius:50%;animation:spin .8s linear infinite}
    .notice{position:absolute;bottom:8px;left:8px;right:8px;display:flex;align-items:center;justify-content:center;gap:6px;padding:7px 10px;border:1px solid var(--border);border-radius:7px;background:var(--bg);color:var(--muted);font-size:11px;box-shadow:0 2px 8px #0001}
    .notice[hidden]{display:none}
    .notice a{display:inline;width:auto;height:auto;font-size:11px;text-decoration:underline}
    @keyframes spin{to{transform:rotate(360deg)}}
    @media(prefers-color-scheme:dark){.card{--bg:#18181b;--fg:#fafafa;--muted:#a1a1aa;--border:#303036;box-shadow:0 12px 40px #0006}}
    @media(prefers-reduced-motion:reduce){.spinner{animation:none}}
  </style>
  <section class="card" role="region" aria-label="Link preview">
    <header class="header"><span class="mark" aria-hidden="true"></span><span class="address"></span><a class="open" target="_blank" rel="noopener noreferrer" aria-label="Open link in a new tab" title="Open in new tab">↗</a><button type="button" aria-label="Close preview" title="Close preview (Esc)">×</button></header>
    <div class="viewport"><iframe title="Link preview" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe><div class="loading" role="status"><span class="spinner" aria-hidden="true"></span><span>Loading preview…</span></div><div class="notice" hidden><span>Not displaying?</span><a target="_blank" rel="noopener noreferrer">Open page ↗</a></div></div>
  </section>`;

  const card = shadow.querySelector(".card");
  const frame = shadow.querySelector("iframe");
  const address = shadow.querySelector(".address");
  const loading = shadow.querySelector(".loading");
  const notice = shadow.querySelector(".notice");
  const openLinks = [...shadow.querySelectorAll("a")];

  const close = () => {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    clearTimeout(loadTimer);
    visible = false;
    card.style.display = "none";
    frame.removeAttribute("src");
    currentUrl = "";
    anchor = null;
  };

  const place = () => {
    if (!anchor || !visible) return;
    const margin = 10;
    const availableWidth = Math.max(1, innerWidth - margin * 2);
    const availableHeight = Math.max(1, innerHeight - margin * 2);
    const width = Math.max(
      1,
      Math.min(
        settings.width,
        availableWidth,
        ((availableHeight - headerHeight - 2) * pageWidth) / pageHeight + 2,
      ),
    );
    const height = Math.min(
      availableHeight,
      Math.round(((width - 2) * pageHeight) / pageWidth) + headerHeight + 2,
    );
    const bounds = anchor.getBoundingClientRect();
    const top =
      bounds.bottom + 8 + height <= innerHeight - margin
        ? bounds.bottom + 8
        : bounds.top - height - 8;
    card.style.width = `${width}px`;
    card.style.height = `${height}px`;
    card.style.left = `${Math.max(margin, Math.min(bounds.left, innerWidth - width - margin))}px`;
    card.style.top = `${Math.max(margin, Math.min(top, innerHeight - height - margin))}px`;
    frame.style.transform = `scale(${Math.max(1, width - 2) / pageWidth})`;
  };

  const getLink = (target) => {
    if (!(target instanceof Element)) return null;
    const link = target.closest("a[href]");
    if (!link || link.hasAttribute("download")) return null;
    let url;
    try {
      url = new URL(link.href, location.href);
    } catch {
      return null;
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    if (
      url.origin === location.origin &&
      url.pathname === location.pathname &&
      url.search === location.search
    )
      return null;
    return link;
  };

  const show = (link) => {
    if (!settings.enabled || !link.isConnected) return;
    clearTimeout(hideTimer);
    if (visible && currentUrl === link.href) {
      anchor = link;
      place();
      return;
    }
    close();
    if (!host.isConnected) document.documentElement.appendChild(host);
    anchor = link;
    currentUrl = link.href;
    visible = true;
    address.textContent = new URL(currentUrl).hostname;
    address.title = currentUrl;
    openLinks.forEach((openLink) => {
      openLink.href = currentUrl;
    });
    loading.hidden = false;
    notice.hidden = true;
    card.style.display = "flex";
    place();
    frame.src = currentUrl;
    loadTimer = setTimeout(() => {
      loading.hidden = true;
      notice.hidden = false;
    }, 6000);
  };

  const scheduleClose = () => {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(close, 250);
  };

  document.addEventListener("mouseover", (event) => {
    if (!settings.enabled) return;
    const link = getLink(event.target);
    if (
      !link ||
      (event.relatedTarget instanceof Node &&
        link.contains(event.relatedTarget))
    )
      return;
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    showTimer = setTimeout(() => {
      if (getLink(link) === link) show(link);
    }, settings.delay);
  });

  document.addEventListener("mouseout", (event) => {
    const link = getLink(event.target);
    if (
      !link ||
      (event.relatedTarget instanceof Node &&
        link.contains(event.relatedTarget))
    )
      return;
    scheduleClose();
  });

  card.addEventListener("mouseenter", () => clearTimeout(hideTimer));
  card.addEventListener("mouseleave", scheduleClose);
  shadow.querySelector("button").addEventListener("click", close);
  frame.addEventListener("load", () => {
    if (!visible || !frame.hasAttribute("src")) return;
    loading.hidden = true;
    notice.hidden = false;
    clearTimeout(loadTimer);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!event.composedPath().includes(host)) close();
    },
    true,
  );
  window.addEventListener("scroll", close, { passive: true, capture: true });
  window.addEventListener("resize", place, { passive: true });
  window.addEventListener("pagehide", close);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) close();
  });

  chrome.storage.local
    .get(preferences.defaults)
    .then((values) => {
      settings = preferences.normalize(values);
    })
    .catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const next = { ...settings };
    Object.keys(preferences.defaults).forEach((key) => {
      if (changes[key])
        next[key] = changes[key].newValue ?? preferences.defaults[key];
    });
    settings = preferences.normalize(next);
    if (!settings.enabled || changes.delay) close();
    else place();
  });
})();
