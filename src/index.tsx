import {
  registerAppBarAction,
  registerAppTheme,
} from '@kinvolk/headlamp-plugin/lib';

// ── Fiori Horizon design tokens ───────────────────────────────────────────────
const FIORI = {
  primaryBlue:    '#0070F2',
  pageBackground: '#F5F6F7',
  cardBackground: '#FFFFFF',
  bodyText:       '#1D2D3E',
  mutedText:      '#6B7280',
  successGreen:   '#107E3E',
  warningAmber:   '#E9730C',
  errorRed:       '#BB0000',
  borderRadius:   '8px',
  spacing:        '8px',
};

// ── Theme registration (kept for completeness, CSS overrides are authoritative) ─
registerAppTheme({ name: 'kiosk', sidebar: {} });

// ── Strip all app-bar actions so they're not keyboard-accessible ──────────────
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

// ── Force redirect to Flux overview — the kiosk landing view ─────────────────
//
// Any path that is not under /flux/ (and is not a login/auth page) gets
// redirected to /flux/overview so users always land on the Flux dashboard
// and cannot navigate away via the (now-hidden) sidebar.
function enforceFluxView() {
  const base = window.location.pathname.replace(/\/$/, '');
  // Extract the sub-path after the cluster prefix /c/<cluster>
  const clusterMatch = base.match(/^(\/[^/]+\/[^/]+)(\/.*)?$/);
  const subPath = clusterMatch ? (clusterMatch[2] || '') : base;

  // Leave auth/login pages alone
  if (subPath.startsWith('/login') || subPath.startsWith('/auth')) return;

  // If already on a flux route, do nothing
  if (subPath.startsWith('/flux')) return;

  // Redirect to flux overview
  const fluxPath = base.replace(/([^/]+)(\/.*)?$/, '$1/flux/overview');
  window.history.replaceState(null, '', fluxPath);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

// ── CSS: full kiosk layout ────────────────────────────────────────────────────
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

    /* ── Hide the entire sidebar (icon rail + drawer) ── */
    nav[aria-label="Navigation"],
    [class*="Navigation-module"],
    [class*="sidebar"],
    [class*="Sidebar"],
    aside {
      display: none !important;
    }

    /* ── Remove AppBar top-padding and make root a plain flex row ── */
    #root > div[class*="MuiBox"] {
      padding-top: 0 !important;
      flex-direction: row !important;
    }

    /* ── Main content fills the full viewport ── */
    main {
      margin-left: 0 !important;
      padding: 16px !important;
      width: 100vw !important;
      max-width: 100vw !important;
      flex: 1 !important;
      background-color: var(--kiosk-page-bg) !important;
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

  // Imperatively suppress alerts that win the specificity battle
  document.querySelectorAll('[role="alert"], [class*="MuiAlert-root"]').forEach((el) => {
    (el as HTMLElement).style.setProperty('display', 'none', 'important');
  });

  // Suppress text-matched cluster-error banners
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
  forceDefaultNamespace();
  applyKioskStyles();
  enforceFluxView();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyKioskStyles();
      enforceFluxView();
    });
  }

  // Re-apply styles after React hydration
  setTimeout(() => { applyKioskStyles(); enforceFluxView(); }, 100);
  setTimeout(() => { applyKioskStyles(); enforceFluxView(); }, 500);
  setTimeout(() => { applyKioskStyles(); enforceFluxView(); }, 1500);

  // Re-apply on every SPA navigation and enforce Flux view
  const observer = new MutationObserver(() => {
    applyKioskStyles();
    enforceFluxView();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('popstate', () => {
    applyKioskStyles();
    enforceFluxView();
  });
}
