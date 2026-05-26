import {
  registerSidebarEntryFilter,
  registerAppBarAction,
  registerAppTheme,
} from '@kinvolk/headlamp-plugin/lib';

// ── Fiori Horizon design tokens ───────────────────────────────────────────────
// These mirror the SAP Fiori Horizon palette used by the ManagedControlPlane UI
// so that the embedded Headlamp view feels visually coherent.
const FIORI = {
  primaryBlue:        '#0070F2',
  sidebarSelectedBg:  '#b3d9f7', // light SAP blue — visible but not full-filled
  sidebarSelectedFg:  '#0a3d6b', // dark navy for contrast on light bg
  pageBackground:     '#F5F6F7',
  cardBackground:     '#FFFFFF',
  bodyText:           '#1D2D3E',
  mutedText:          '#6B7280',
  successGreen:       '#107E3E',
  warningAmber:       '#E9730C',
  errorRed:           '#BB0000',
  borderRadius:       '8px',
  spacing:            '8px',
};

// ── Custom theme: Fiori-aligned sidebar highlight ─────────────────────────────
registerAppTheme({
  name: 'kiosk',
  sidebar: {
    selectedBackground: FIORI.sidebarSelectedBg,
    selectedColor:      FIORI.sidebarSelectedFg,
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
function forceDefaultNamespace() {
  try {
    const match = window.location.pathname.match(/^\/c\/([^/]+)/);
    const cluster = match ? match[1] : null;
    if (!cluster) return;
    const key = `headlamp-selected-namespace_${cluster}`;
    const saved = localStorage.getItem(key);
    const current: string[] = saved ? JSON.parse(saved) : [];
    if (current.length === 0) {
      localStorage.setItem(key, JSON.stringify(['default']));
    }
  } catch (_) {}
}

// ── Force sidebar into collapsed (icon-only) state ───────────────────────────
function forceSidebarCollapsed() {
  try {
    localStorage.setItem('sidebar', JSON.stringify({ shrink: true }));
  } catch (_) {}

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

// ── CSS: hide AppBar, error banners; Fiori styling ────────────────────────────
function applyKioskStyles() {
  const styleId = 'kiosk-mode-styles';
  document.getElementById(styleId)?.remove();

  const style = document.createElement('style');
  style.id = styleId;
  style.innerHTML = `
    /* ── Fiori Horizon design tokens ── */
    :root {
      --kiosk-primary:   ${FIORI.primaryBlue};
      --kiosk-page-bg:   ${FIORI.pageBackground};
      --kiosk-card-bg:   ${FIORI.cardBackground};
      --kiosk-body-text: ${FIORI.bodyText};
      --kiosk-muted:     ${FIORI.mutedText};
      --kiosk-success:   ${FIORI.successGreen};
      --kiosk-warning:   ${FIORI.warningAmber};
      --kiosk-error:     ${FIORI.errorRed};
      --kiosk-radius:    ${FIORI.borderRadius};
    }

    /* ── Page & body background ── */
    body, #root {
      background-color: var(--kiosk-page-bg) !important;
    }

    /* ── Hide the Headlamp AppBar (top bar with logo, search, user) ── */
    header[class*="MuiAppBar"],
    nav[class*="MuiAppBar"],
    [class*="MuiAppBar-root"],
    nav[aria-label="Appbar Tools"] {
      display: none !important;
    }

    /* ── Remove AppBar top-padding; make root a plain flex row ── */
    #root > div[class*="MuiBox"] {
      padding-top: 0 !important;
      flex-direction: row !important;
    }

    /* ── Main content fills the viewport ── */
    main {
      margin-left: 0 !important;
      padding: 16px !important;
      width: 100% !important;
      max-width: 100% !important;
      flex: 1 !important;
      background-color: var(--kiosk-page-bg) !important;
    }

    /* ── Row wrapper fills full height ── */
    #root > div[class*="MuiBox"] > div[class*="MuiBox"] {
      width: 100% !important;
    }

    /* ── Sidebar selected-item highlight (Fiori blue) ── */
    /* registerAppTheme does not auto-activate — CSS is the reliable path. */
    nav [class*="MuiListItemButton-root"][class*="Mui-selected"],
    nav [class*="MuiListItemButton-root"][class*="Mui-selected"]:hover {
      background-color: ${FIORI.sidebarSelectedBg} !important;
      color: ${FIORI.sidebarSelectedFg} !important;
    }
    nav [class*="MuiListItemButton-root"][class*="Mui-selected"] [class*="MuiListItemText-primary"],
    nav [class*="MuiListItemButton-root"][class*="Mui-selected"] [class*="MuiSvgIcon-root"] {
      color: ${FIORI.sidebarSelectedFg} !important;
    }

    /* ── Hide specific built-in sidebar entries by aria-label ── */
    nav a[aria-label="Storage"],
    nav a[aria-label="Network"],
    nav a[aria-label="Gateway (beta)"] {
      display: none !important;
    }

    /* ── Hide all alerts / error banners ── */
    [role="alert"],
    [class*="MuiAlert-root"],
    [class*="MuiAlert-standard"],
    [class*="MuiAlert-filled"],
    [class*="MuiAlert-outlined"],
    [class*="clusterError"],
    [class*="ClusterGroupError"] {
      display: none !important;
    }

    /* ── Hide structural cluster-error box inside <main> ── */
    main > [class*="MuiBox-root"]:not(:has([class*="MuiPaper"])):not(:has(h1)):not(:has(table)):not(:has(nav)) {
      display: none !important;
    }

    /* ── Fiori-aligned card radius & background ── */
    [class*="MuiPaper-root"][class*="MuiCard-root"],
    [class*="MuiPaper-elevation"] {
      border-radius: var(--kiosk-radius) !important;
      background-color: var(--kiosk-card-bg) !important;
    }

    /* ── Body text colour ── */
    body, [class*="MuiTypography-body"] {
      color: var(--kiosk-body-text) !important;
    }

    /* ── Primary buttons ── */
    [class*="MuiButton-containedPrimary"] {
      background-color: var(--kiosk-primary) !important;
      border-radius: 4px !important;
    }
    [class*="MuiButton-containedPrimary"]:hover {
      background-color: #0057C2 !important;
    }

    /* ── Links ── */
    a:not([class*="MuiButton"]) {
      color: var(--kiosk-primary) !important;
    }
  `;

  document.head.appendChild(style);

  // Belt-and-suspenders: imperatively suppress any alerts that win specificity
  document.querySelectorAll('[role="alert"], [class*="MuiAlert-root"]').forEach((el) => {
    (el as HTMLElement).style.setProperty('display', 'none', 'important');
  });

  // Suppress text-matched cluster-error banners inside <main>
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
