import React, { useEffect, useState } from 'react';
import {
  registerRoute,
  registerSidebarEntry,
  registerSidebarEntryFilter,
  registerAppBarAction,
  registerAppTheme,
  K8s,
} from '@kinvolk/headlamp-plugin/lib';

const { Chip } = (window as any).pluginLib?.MuiCore ?? {};

function conditionChip(healthy: boolean | null) {
  const color = healthy === true ? '#4caf50' : healthy === false ? '#f44336' : '#9e9e9e';
  const label = healthy === true ? 'Healthy' : healthy === false ? 'Unhealthy' : '—';
  if (Chip) {
    return React.createElement(Chip, {
      label,
      size: 'small',
      style: { background: color, color: '#fff', fontWeight: 600 },
    });
  }
  return React.createElement('span', {
    style: { padding: '2px 8px', borderRadius: 10, background: color, color: '#fff', fontSize: 11, fontWeight: 600 },
  }, label);
}

// ── Fiori Horizon design tokens ───────────────────────────────────────────────
const FIORI = {
  primaryBlue:        '#0070F2',
  sidebarSelectedBg:  '#b3d9f7',
  sidebarSelectedFg:  '#0a3d6b',
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

// ── Sidebar entries to remove completely ──────────────────────────────────────
const HIDDEN_SIDEBAR_ENTRIES = new Set([
  'home',
  'storage',
  'network',
  'gatewayapi',
]);

registerSidebarEntryFilter(entry =>
  HIDDEN_SIDEBAR_ENTRIES.has(entry.name) ? null : entry
);

// ── Remove all app-bar actions ────────────────────────────────────────────────
registerAppBarAction({
  id: 'kiosk-strip-appbar-actions',
  processor: () => [],
});

// ── Component detection ───────────────────────────────────────────────────────
//
// Each component is detected by probing its own API on the MCP cluster.
//
// MCP v1 spec.components → probe endpoint:
//   crossplane              → /apis/pkg.crossplane.io/v1/providers
//   flux                    → /apis/kustomize.toolkit.fluxcd.io/v1/kustomizations
//   btpServiceOperator      → /apis/services.cloud.sap.com/v1/servicebindings
//   externalSecretsOperator → /apis/external-secrets.io/v1beta1/externalsecrets
//   kyverno                 → /apis/kyverno.io/v1/policies

function getApiProxy(): any {
  return (K8s as any).ApiProxy ?? (window as any).pluginLib?.ApiProxy;
}

async function apiExists(path: string): Promise<boolean> {
  try {
    await getApiProxy().request(path, { isJSON: true });
    return true;
  } catch {
    return false;
  }
}

export interface ComponentStatus {
  name: string;
  label: string;
  installed: boolean | null;
}

export function useInstalledComponents(): ComponentStatus[] {
  const [crossplane, setCrossplane] = useState<boolean | null>(null);
  const [flux, setFlux] = useState<boolean | null>(null);
  const [btp, setBtp] = useState<boolean | null>(null);
  const [eso, setEso] = useState<boolean | null>(null);
  const [kyverno, setKyverno] = useState<boolean | null>(null);

  useEffect(() => {
    apiExists('/apis/pkg.crossplane.io/v1/providers').then(setCrossplane);
    apiExists('/apis/kustomize.toolkit.fluxcd.io/v1/kustomizations').then(setFlux);
    apiExists('/apis/services.cloud.sap.com/v1/servicebindings').then(setBtp);
    apiExists('/apis/external-secrets.io/v1beta1/externalsecrets').then(setEso);
    apiExists('/apis/kyverno.io/v1/policies').then(setKyverno);
  }, []);

  return [
    { name: 'crossplane',              label: 'Crossplane',                installed: crossplane },
    { name: 'flux',                    label: 'Flux',                      installed: flux },
    { name: 'btpServiceOperator',      label: 'BTP Service Operator',      installed: btp },
    { name: 'externalSecretsOperator', label: 'External Secrets Operator', installed: eso },
    { name: 'kyverno',                 label: 'Kyverno',                   installed: kyverno },
    // v2 placeholders — uncomment when needed:
    // { name: 'certManager',          label: 'cert-manager',              installed: null },
  ];
}

// ── Overview page ─────────────────────────────────────────────────────────────

interface Provider {
  name: string;
  version: string;
  healthy: boolean | null;
}

function useProviders(): { providers: Provider[] | null; error: boolean } {
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getApiProxy()
      .request('/apis/pkg.crossplane.io/v1/providers', { isJSON: true })
      .then((res: any) => {
        setProviders(
          (res?.items ?? []).map((item: any) => {
            const conditions: any[] = item.status?.conditions ?? [];
            const healthy = conditions.find((c: any) => c.type === 'Healthy');
            return {
              name: item.metadata?.name ?? '',
              version: item.status?.currentRevision ?? '—',
              healthy: healthy ? healthy.status === 'True' : null,
            };
          })
        );
      })
      .catch(() => setError(true));
  }, []);

  return { providers, error };
}

function StatusChip({ installed }: { installed: boolean | null }) {
  if (installed === null) {
    return React.createElement('span', { style: { color: '#888', fontSize: 12 } }, 'Loading…');
  }
  return React.createElement(
    'span',
    {
      style: {
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 12,
        background: installed ? '#4caf50' : 'rgba(128,128,128,0.2)',
        color: installed ? '#fff' : '#888',
        fontSize: 12,
        fontWeight: 600,
      },
    },
    installed ? 'Installed' : 'Not installed'
  );
}

function HealthChip({ healthy }: { healthy: boolean | null }) {
  return conditionChip(healthy);
}

function OverviewPage() {
  const components = useInstalledComponents();
  const { providers, error: providersError } = useProviders();

  const crossplaneInstalled = components.find(c => c.name === 'crossplane')?.installed ?? null;

  const sectionStyle: React.CSSProperties = { marginBottom: 32 };
  const headingStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 12,
    borderBottom: '1px solid rgba(128,128,128,0.2)',
    paddingBottom: 8,
  };
  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '8px 12px',
    fontWeight: 600,
    fontSize: 13,
    opacity: 0.6,
    borderBottom: '1px solid rgba(128,128,128,0.15)',
  };
  const tdStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: '1px solid rgba(128,128,128,0.1)',
    fontSize: 14,
  };

  return React.createElement(
    'div',
    { style: { padding: 24, maxWidth: 800 } },
    React.createElement('h1', { style: { fontSize: 24, fontWeight: 700, marginBottom: 24 } }, 'Control Plane Overview'),

    // ── Installed Components ────────────────────────────────────────────────
    React.createElement(
      'div',
      { style: sectionStyle },
      React.createElement('div', { style: headingStyle }, 'Components'),
      React.createElement(
        'table',
        { style: tableStyle },
        React.createElement(
          'thead',
          null,
          React.createElement(
            'tr',
            null,
            React.createElement('th', { style: thStyle }, 'Component'),
            React.createElement('th', { style: thStyle }, 'Status')
          )
        ),
        React.createElement(
          'tbody',
          null,
          components.map((c) =>
            React.createElement(
              'tr',
              { key: c.name },
              React.createElement('td', { style: tdStyle }, c.label),
              React.createElement(
                'td',
                { style: tdStyle },
                React.createElement(StatusChip, { installed: c.installed })
              )
            )
          )
        )
      )
    ),

    // ── Crossplane Providers ────────────────────────────────────────────────
    crossplaneInstalled === false
      ? null
      : React.createElement(
          'div',
          { style: sectionStyle },
          React.createElement('div', { style: headingStyle }, 'Crossplane Providers'),
          providersError
            ? React.createElement('span', { style: { color: '#888', fontSize: 14 } }, 'Crossplane not installed')
            : providers === null
            ? React.createElement('span', { style: { color: '#888', fontSize: 14 } }, 'Loading…')
            : providers.length === 0
            ? React.createElement('span', { style: { color: '#888', fontSize: 14 } }, 'No providers installed')
            : React.createElement(
                'table',
                { style: tableStyle },
                React.createElement(
                  'thead',
                  null,
                  React.createElement(
                    'tr',
                    null,
                    React.createElement('th', { style: thStyle }, 'Name'),
                    React.createElement('th', { style: thStyle }, 'Version'),
                    React.createElement('th', { style: thStyle }, 'Health')
                  )
                ),
                React.createElement(
                  'tbody',
                  null,
                  providers.map((p) =>
                    React.createElement(
                      'tr',
                      { key: p.name },
                      React.createElement('td', { style: tdStyle }, p.name),
                      React.createElement('td', { style: { ...tdStyle, fontFamily: 'monospace', fontSize: 13 } }, p.version),
                      React.createElement('td', { style: tdStyle }, React.createElement(HealthChip, { healthy: p.healthy }))
                    )
                  )
                )
              )
        )
  );
}

// ── Default namespace filter to "default" ─────────────────────────────────────
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

// ── Force sidebar into collapsed (icon-only) state ────────────────────────────
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

// ── CSS: kiosk chrome removal + Fiori styling + OCP sidebar ordering ──────────
function applyKioskStyles() {
  const gradient = 'linear-gradient(180deg, transparent 0%, rgba(240,253,250,0.35) 50%, transparent 100%)';
  [document.documentElement, document.body].forEach((el) => {
    el.style.setProperty('background-color', '#ffffff', 'important');
    el.style.setProperty('background-image', gradient, 'important');
    el.style.setProperty('min-height', '100vh', 'important');
  });

  const mainEl = document.querySelector('main');
  if (mainEl) mainEl.style.setProperty('background', 'transparent', 'important');

  const root = document.getElementById('root');
  if (root) root.style.setProperty('background', 'transparent', 'important');

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
    /* Applied imperatively in JS to beat MUI CssBaseline */

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
      background-color: transparent !important;
    }

    /* ── Strip MUI box backgrounds so gradient shows through ── */
    #root > div[class*="MuiBox"],
    #root > div[class*="MuiBox"] > div[class*="MuiBox"] {
      background-color: transparent !important;
    }

    /* ── Sidebar selected-item highlight (Fiori blue) ── */
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

    /* ── Hide "Create / Apply" button ── */
    button[aria-label="Create / Apply"],
    button[aria-label="Create/Apply"] {
      display: none !important;
    }

    /* ── OCP sidebar ordering: Overview → Crossplane → Flux → rest ── */
    ul.MuiList-padding {
      display: flex !important;
      flex-direction: column !important;
    }
    ul.MuiList-padding > li:has(a[href*="/ocp/overview"]) { order: -300 !important; }
    ul.MuiList-padding > li:has(a[href*="/crossplane"])   { order: -200 !important; }
    ul.MuiList-padding > li:has(a[href*="/flux"])         { order: -100 !important; }

    ul.MuiList-padding > li:has(a[href*="/flux"]) {
      border-bottom: 1px solid rgba(128,128,128,0.3) !important;
      margin-bottom: 4px !important;
      padding-bottom: 4px !important;
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

// ── OCP: sidebar entry + route ────────────────────────────────────────────────

registerSidebarEntry({
  parent: null,
  name: 'ocp-overview',
  label: 'Overview',
  url: '/ocp/overview',
  icon: 'mdi:view-dashboard-outline',
});

registerRoute({
  path: '/ocp/overview',
  sidebar: 'ocp-overview',
  name: 'ocpOverview',
  exact: true,
  component: OverviewPage,
});
