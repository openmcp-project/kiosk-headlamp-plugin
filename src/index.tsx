import {
  registerSidebarEntryFilter,
  registerAppBarAction,
  registerAppTheme,
} from '@kinvolk/headlamp-plugin/lib';

// ── Custom theme: light-blue highlight for selected sidebar items ─────────────
registerAppTheme({
  name: 'kiosk',
  sidebar: {
    selectedBackground: '#b3d9f7',
    selectedColor: '#0a3d6b',
  },
});

// ── Sidebar entries to remove completely ─────────────────────────────────────
// registerSidebarEntryFilter only filters plugin-registered entries, not
// Headlamp's built-in sidebar items. Those are hidden via CSS (aria-label
// selectors) in applyKioskStyles below.
const HIDDEN_SIDEBAR_ENTRIES = new Set([
  'home',       // Home / overview section
  'storage',    // PVCs, PVs, StorageClasses
  'network',    // Services, Ingresses, NetworkPolicies, …
  'gatewayapi', // Gateways, HTTPRoutes, …
]);

registerSidebarEntryFilter(entry =>
  HIDDEN_SIDEBAR_ENTRIES.has(entry.name) ? null : entry
);

// ── Remove all app-bar actions (search, notifications, settings, user) ───────
// The AppBar itself is hidden via CSS, but stripping the actions prevents them
// from being keyboard-accessible or from interfering with layout.
registerAppBarAction({
  id: 'kiosk-strip-appbar-actions',
  processor: () => [],
});

// ── Default namespace filter to "default" ────────────────────────────────────
//
// Headlamp persists the selected namespaces in localStorage under the key
// "headlamp-selected-namespace_<clusterName>".  We pre-seed it to ["default"]
// so that on first load resources are scoped to the default namespace.
// We only write the value if it is currently empty (i.e. no user preference
// has been saved yet) to avoid overriding explicit user choices.
function forceDefaultNamespace() {
  try {
    // Derive the cluster name from the URL path: /c/<cluster>/...
    const match = window.location.pathname.match(/^\/c\/([^/]+)/);
    const cluster = match ? match[1] : null;
    if (!cluster) return;

    const key = `headlamp-selected-namespace_${cluster}`;
    const saved = localStorage.getItem(key);
    const current: string[] = saved ? JSON.parse(saved) : [];
    if (current.length === 0) {
      localStorage.setItem(key, JSON.stringify(['default']));
    }
  } catch (_) {
    // localStorage unavailable — skip
  }
}

// ── Force sidebar into collapsed (icon-only) state ───────────────────────────
//
// Headlamp reads localStorage['sidebar'] on startup.  Setting { shrink: true }
// ensures the sidebar starts collapsed.  We also dispatch the Redux action once
// the store is available so the state is correct even after hot reloads.
function forceSidebarCollapsed() {
  try {
    localStorage.setItem('sidebar', JSON.stringify({ shrink: true }));
  } catch (_) {
    // localStorage unavailable in some sandbox environments — skip
  }

  const tryDispatch = (): boolean => {
    try {
      const pluginLib = (window as any).pluginLib;
      if (!pluginLib) return false;

      const store = pluginLib['redux/stores/store']?.default;
      const sidebarSlice = pluginLib['components/Sidebar/sidebarSlice'];
      if (!store || !sidebarSlice?.setWhetherSidebarOpen) return false;

      store.dispatch(sidebarSlice.setWhetherSidebarOpen(false));
      return true;
    } catch (_) {
      return false;
    }
  };

  if (!tryDispatch()) {
    let attempts = 0;
    const id = setInterval(() => {
      attempts++;
      if (tryDispatch() || attempts >= 20) clearInterval(id);
    }, 100);
  }
}

// ── CSS: hide AppBar, error banners; fix layout ───────────────────────────────
//
// The error banner Headlamp shows for cluster connection failures is rendered
// as an MUI Alert (e.g. "Something went wrong with cluster ekx-hackathon…").
// We target both MUI class names and a data attribute Headlamp may set.
function applyKioskStyles() {
  const styleId = 'kiosk-mode-styles';
  document.getElementById(styleId)?.remove();

  const style = document.createElement('style');
  style.id = styleId;
  style.innerHTML = `
    /* ── Hide top app bar (logo, search, settings, user icon) ── */
    nav.MuiAppBar-root,
    nav[aria-label="Appbar Tools"] {
      display: none !important;
    }

    /* ── Hide specific built-in sidebar entries by aria-label ── */
    /* registerSidebarEntryFilter only works for plugin-registered entries;  */
    /* built-in entries must be hidden via CSS.                               */
    nav a[aria-label="Storage"],
    nav a[aria-label="Network"],
    nav a[aria-label="Gateway (beta)"] {
      display: none !important;
    }

    /* ── Hide all alerts (errors, warnings, info banners) everywhere ── */
    /* This covers: cluster connection errors, permission warnings, etc.     */
    [role="alert"],
    .MuiAlert-root,
    .MuiAlert-standardError,
    .MuiAlert-filledError,
    .MuiAlert-outlinedError,
    .MuiAlert-standardInfo,
    .MuiAlert-standardWarning,
    [class*="clusterError"],
    [class*="ClusterGroupError"] {
      display: none !important;
    }

    /* ── Hide the cluster-error banner box (wraps "Something went wrong…") ── */
    /* Headlamp renders this as a plain MuiBox directly inside <main>, not   */
    /* as an alert, so [role="alert"] does not catch it. Target by the MUI   */
    /* hash class and by structural selector (direct child of main with only  */
    /* text + a button, no MuiPaper children).                                */
    main > .MuiBox-root.css-1xoun1b,
    main > .MuiBox-root:not(:has(main)):not(:has(.MuiPaper-root)):not(:has(h1)):not(:has(table)) {
      display: none !important;
    }

    /* ── Remove top padding left over from the now-hidden AppBar ── */
    .MuiBox-root.css-1uqao6u {
      padding-top: 0 !important;
      flex-direction: row !important;
    }

    /* ── Expand main content area to fill the viewport ── */
    main {
      margin-left: 0 !important;
      padding: 16px !important;
      width: 100% !important;
      max-width: 100% !important;
      flex: 1 !important;
    }

    /* ── Make the content+sidebar row fill full height ── */
    .MuiBox-root.css-1xd9zsj {
      width: 100% !important;
    }
  `;

  document.head.appendChild(style);

  // Imperatively hide all alert nodes and cluster-error banner boxes.
  // CSS rules may lose to higher-specificity MUI styles; this ensures they
  // are always hidden regardless of position in the tree.
  document.querySelectorAll('[role="alert"], .MuiAlert-root').forEach((el) => {
    (el as HTMLElement).style.setProperty('display', 'none', 'important');
  });
  // Hide the MuiBox cluster-error container ("Something went wrong…")
  // which is a direct child of <main> but not an alert element.
  const main = document.querySelector('main');
  if (main) {
    Array.from(main.children).forEach((el) => {
      const text = (el as HTMLElement).textContent || '';
      if (text.includes('Something went wrong') || text.includes('Lost connection')) {
        (el as HTMLElement).style.setProperty('display', 'none', 'important');
      }
    });
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  forceSidebarCollapsed();
  forceDefaultNamespace();
  applyKioskStyles();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyKioskStyles);
  }

  // Re-apply after React hydration and lazy chunk loads
  setTimeout(applyKioskStyles, 100);
  setTimeout(applyKioskStyles, 500);
  setTimeout(applyKioskStyles, 1500);

  // Re-apply on every SPA navigation
  const observer = new MutationObserver(applyKioskStyles);
  observer.observe(document.body, { childList: true, subtree: true });

  // Re-collapse sidebar on every navigation so the user can't expand it
  window.addEventListener('popstate', forceSidebarCollapsed);
}
