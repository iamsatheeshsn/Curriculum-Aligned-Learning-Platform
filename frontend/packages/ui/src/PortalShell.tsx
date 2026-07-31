import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BrandMark } from './Brand';
import { useFeedbackOptional } from './Feedback';

export type PortalNavItem = {
  /** Stable id for React keys (unique within a submenu) */
  id?: string;
  to: string;
  label: string;
  end?: boolean;
  /** Short mark shown when the sidebar is collapsed */
  icon?: string;
  /** Nested links under this item (e.g. Reports submenu) */
  children?: PortalNavItem[];
};

const defaultIcons: Record<string, string> = {
  Overview: '⌂',
  Tenants: '▦',
  Subscription: '◈',
  Plans: '◈',
  'School home': '⌂',
  'Teacher workspace': '✎',
  Reports: '▦',
  'Student home': '⌂',
  'Parent view': '☺',
  'Student report': '·',
  'Teacher report': '·',
  'Tutor performance': '·',
  'School analytics': '·',
  'Curriculum completion': '·',
  'Learning outcomes': '·',
  'Change password': '⚿',
};

function storageKey(portal: string) {
  return `stemora.sidebar.collapsed.${portal}`;
}

function navScrollKey(portal: string) {
  return `stemora.sidebar.navScroll.${portal}`;
}

function navGroupsKey(portal: string) {
  return `stemora.sidebar.navGroups.${portal}`;
}

/** Survives PortalShell remounts within the same tab session (pages remount the shell per route). */
const navScrollMemory: Record<string, number> = {};
const navGroupsMemory: Record<string, Record<string, boolean>> = {};

function readNavScroll(portal: string): number {
  if (navScrollMemory[portal] != null) return navScrollMemory[portal]!;
  if (typeof sessionStorage === 'undefined') return 0;
  const y = Number(sessionStorage.getItem(navScrollKey(portal)) || '0');
  return Number.isFinite(y) ? y : 0;
}

function writeNavScroll(portal: string, y: number) {
  navScrollMemory[portal] = y;
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(navScrollKey(portal), String(y));
}

function readNavGroups(portal: string): Record<string, boolean> {
  if (navGroupsMemory[portal]) return { ...navGroupsMemory[portal] };
  if (typeof sessionStorage === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(navGroupsKey(portal));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeNavGroups(portal: string, groups: Record<string, boolean>) {
  navGroupsMemory[portal] = groups;
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(navGroupsKey(portal), JSON.stringify(groups));
}

function initialsFrom(label?: string) {
  if (!label) return 'S';
  const parts = label.replace(/@.*/, '').split(/[.\s_-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return label.slice(0, 1).toUpperCase();
}

/** Exact match when `end` is set; otherwise prefix match for nested routes. */
function isPathActive(pathname: string, to: string, end?: boolean): boolean {
  if (pathname === to) return true;
  if (end) return false;
  return pathname.startsWith(`${to}/`);
}

/** Accordion state: at most one menu group open. */
function onlyGroup(key: string | null): Record<string, boolean> {
  return key ? { [key]: true } : {};
}

export function PortalShell({
  portal,
  title,
  subtitle,
  nav,
  userLabel,
  userName,
  children,
  onLogout,
  brandCaption,
  brandName,
  headerActions,
  collapsible = true,
  changePasswordTo,
  showSidebarPasswordLink = false,
}: {
  portal: 'control' | 'institution' | 'learner';
  title: string;
  subtitle?: string;
  nav: PortalNavItem[];
  userLabel?: string;
  /** Display name shown above email in the top bar */
  userName?: string;
  children: ReactNode;
  onLogout?: () => void;
  /** Fixed sidebar / top eyebrow caption */
  brandCaption?: string;
  /** Sidebar brand label (defaults to Stemora). Parent/Tutor portals pass the tenant name. */
  brandName?: string;
  /** Extra controls on the right side of the top section */
  headerActions?: ReactNode;
  collapsible?: boolean;
  /** Route to the change-password page (header + optional sidebar footer shortcut) */
  changePasswordTo?: string;
  /** When false (default), hide the sidebar footer Password link. Header Change password link still shown when changePasswordTo is set. */
  showSidebarPasswordLink?: boolean;
}) {
  const feedback = useFeedbackOptional();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined' || !collapsible) return false;
    return localStorage.getItem(storageKey(portal)) === '1';
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    let activeKey: string | null = null;
    for (const item of nav) {
      if (!item.children?.length) continue;
      if (item.children.some((child) => isPathActive(location.pathname, child.to, child.end))) {
        activeKey = item.to;
        break;
      }
    }
    if (activeKey) return onlyGroup(activeKey);
    const stored = readNavGroups(portal);
    const openKeys = Object.keys(stored).filter((k) => stored[k]);
    return openKeys.length === 1 ? onlyGroup(openKeys[0]!) : {};
  });
  const navRef = useRef<HTMLElement | null>(null);
  const restoringScrollRef = useRef(false);

  function persistNavScroll() {
    const el = navRef.current;
    if (!el || restoringScrollRef.current) return;
    writeNavScroll(portal, el.scrollTop);
  }

  function restoreNavScroll() {
    const el = navRef.current;
    if (!el) return;
    const y = readNavScroll(portal);
    if (el.scrollTop === y) return;
    restoringScrollRef.current = true;
    el.scrollTop = y;
    window.requestAnimationFrame(() => {
      restoringScrollRef.current = false;
    });
  }

  const setNavRef = (el: HTMLElement | null) => {
    navRef.current = el;
    if (el) {
      restoringScrollRef.current = true;
      el.scrollTop = readNavScroll(portal);
      window.requestAnimationFrame(() => {
        restoringScrollRef.current = false;
      });
    }
  };

  useEffect(() => {
    if (!collapsible) return;
    localStorage.setItem(storageKey(portal), collapsed ? '1' : '0');
  }, [collapsed, portal, collapsible]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 900) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    writeNavGroups(portal, openGroups);
  }, [portal, openGroups]);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const onScroll = () => {
      if (restoringScrollRef.current) return;
      writeNavScroll(portal, el.scrollTop);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [portal]);

  /**
   * Pages remount PortalShell on every route change. Re-apply the saved sidebar
   * scroll after mount and after group expand/collapse so bottom menus stay in view.
   */
  useLayoutEffect(() => {
    restoreNavScroll();
    const id = window.requestAnimationFrame(() => {
      restoreNavScroll();
      window.requestAnimationFrame(restoreNavScroll);
    });
    const t = window.setTimeout(restoreNavScroll, 50);
    return () => {
      window.cancelAnimationFrame(id);
      window.clearTimeout(t);
    };
  }, [portal, location.pathname, openGroups, collapsed]);

  useEffect(() => {
    let activeKey: string | null = null;
    for (const item of nav) {
      if (!item.children?.length) continue;
      const active = item.children.some((child) =>
        isPathActive(location.pathname, child.to, child.end),
      );
      if (active) {
        activeKey = item.to;
        break;
      }
    }
    setOpenGroups(onlyGroup(activeKey));
  }, [location.pathname, nav]);

  async function requestLogout() {
    if (!onLogout) return;
    const ok = await feedback.confirm({
      title: 'Sign out?',
      message: 'You will need to sign in again to access this portal.',
      confirmLabel: 'Sign out',
      cancelLabel: 'Stay signed in',
      tone: 'warn',
    });
    if (ok) onLogout();
  }

  const caption =
    brandCaption ??
    (portal === 'control' ? 'Control portal' : portal === 'institution' ? 'Institution portal' : 'Learner portal');

  const brandLabel = (brandName || 'Stemora').trim() || 'Stemora';
  const brandInitial = brandLabel.charAt(0).toUpperCase() || 'S';

  const displayName = userName || (userLabel ? userLabel.split('@')[0] : undefined);

  const navNodes = useMemo(() => {
    return nav.map((item) => {
      const icon = item.icon ?? defaultIcons[item.label] ?? item.label.slice(0, 1).toUpperCase();
      const hasChildren = Boolean(item.children?.length);
      const childActive = item.children?.some((child) =>
        isPathActive(location.pathname, child.to, child.end),
      );
      const expanded = Boolean(openGroups[item.to]);

      if (!hasChildren) {
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={item.label}
            className={({ isActive }) => `stem-shell-link ${isActive ? 'is-active' : ''}`}
            onClick={() => {
              persistNavScroll();
              setOpenGroups({});
              setMobileOpen(false);
            }}
          >
            <span className="stem-shell-link-icon" aria-hidden>
              {icon}
            </span>
            <span className="stem-shell-link-label">{item.label}</span>
          </NavLink>
        );
      }

      return (
        <div
          key={item.to}
          className={`stem-shell-group ${expanded ? 'is-open' : ''} ${childActive ? 'is-child-active' : ''}`}
        >
          <div className="stem-shell-group-row">
            <button
              type="button"
              className={`stem-shell-link stem-shell-group-btn ${childActive ? 'is-active' : ''}`}
              title={item.label}
              aria-expanded={expanded}
              onClick={() => {
                persistNavScroll();
                if (collapsed) {
                  setCollapsed(false);
                  setOpenGroups(onlyGroup(item.to));
                  return;
                }
                setOpenGroups(expanded ? {} : onlyGroup(item.to));
              }}
            >
              <span className="stem-shell-link-icon" aria-hidden>
                {icon}
              </span>
              <span className="stem-shell-link-label">{item.label}</span>
              {!collapsed ? (
                <span className={`stem-shell-chevron ${expanded ? 'is-open' : ''}`} aria-hidden>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              ) : null}
            </button>
          </div>
          {expanded && !collapsed ? (
            <div className="stem-shell-subnav" role="group" aria-label={`${item.label} submenu`}>
              {item.children!.map((child) => (
                <NavLink
                  key={child.id ?? `${child.to}:${child.label}`}
                  to={child.to}
                  end={child.end}
                  title={child.label}
                  className={({ isActive }) => `stem-shell-sublink ${isActive ? 'is-active' : ''}`}
                  onClick={() => {
                    persistNavScroll();
                    setOpenGroups(onlyGroup(item.to));
                    setMobileOpen(false);
                  }}
                >
                  <span className="stem-shell-subdot" aria-hidden />
                  <span>{child.label}</span>
                </NavLink>
              ))}
            </div>
          ) : null}
        </div>
      );
    });
  }, [nav, location.pathname, openGroups, collapsed]);

  return (
    <div
      data-portal={portal}
      className={`stem-shell ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}
    >
      {mobileOpen ? (
        <button type="button" className="stem-shell-backdrop" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
      ) : null}

      <aside className="stem-shell-aside" aria-label="Main navigation">
        <div className="stem-shell-brand">
          {collapsed ? (
            <span className="stem-shell-mark" title={brandLabel} aria-label={brandLabel}>
              {brandInitial}
            </span>
          ) : (
            <div className="stem-shell-brand-copy">
              <BrandMark inverted size="sm" name={brandLabel} />
              <p className="stem-shell-caption">{caption}</p>
            </div>
          )}
          {collapsible ? (
            <button
              type="button"
              className="stem-shell-collapse"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                {collapsed ? (
                  <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
            </button>
          ) : null}
        </div>

        {!collapsed ? <p className="stem-shell-nav-label">Menu</p> : null}

        <nav ref={setNavRef} className="stem-shell-nav">
          {navNodes}
        </nav>

        <div className="stem-shell-footer">
          {userLabel ? (
            <div className={`stem-shell-user-card ${collapsed ? 'is-collapsed' : ''}`} title={userLabel}>
              <span className="stem-shell-user-avatar" aria-hidden>
                {initialsFrom(displayName || userLabel)}
              </span>
              {!collapsed ? (
                <div className="stem-shell-user-text">
                  <strong>{displayName}</strong>
                  <span>{userLabel}</span>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className={`stem-shell-footer-actions ${collapsed ? 'is-collapsed' : ''}`}>
            {changePasswordTo && showSidebarPasswordLink ? (
              <NavLink
                to={changePasswordTo}
                className={({ isActive }) => `stem-shell-account-link ${isActive ? 'is-active' : ''}`}
                title="Change password"
                onClick={() => setMobileOpen(false)}
              >
                <span className="stem-shell-footer-ico" aria-hidden>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="2.5" y="6" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </span>
                {!collapsed ? <span>Password</span> : null}
              </NavLink>
            ) : null}
            {onLogout ? (
              <button
                type="button"
                className="stem-shell-logout"
                onClick={requestLogout}
                title="Sign out"
                aria-label="Sign out"
              >
                <span className="stem-shell-footer-ico" aria-hidden>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M6 2.5H3.5A1.5 1.5 0 0 0 2 4v6a1.5 1.5 0 0 0 1.5 1.5H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    <path d="M6 7h6m0 0-2-2m2 2-2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {!collapsed ? <span>Sign out</span> : null}
              </button>
            ) : null}
          </div>
        </div>
      </aside>

      <div className="stem-shell-main">
        <header className="stem-shell-header" role="banner">
          <div className="stem-shell-top">
            <div className="stem-shell-header-left">
              <button
                type="button"
                className="stem-shell-mobile-toggle"
                onClick={() => {
                  setMobileOpen((v) => {
                    const next = !v;
                    if (next) setCollapsed(false);
                    return next;
                  });
                }}
                aria-label="Open menu"
              >
                ☰
              </button>
              {collapsible ? (
                <button
                  type="button"
                  className="stem-shell-header-collapse"
                  onClick={() => setCollapsed((v) => !v)}
                  aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  {collapsed ? '☰' : '«'}
                </button>
              ) : null}

              <div className="stem-shell-titleblock">
                <div className="stem-shell-eyebrow-row">
                  <span className="stem-shell-eyebrow">{caption}</span>
                  <span className="stem-shell-eyebrow-dot" aria-hidden />
                  <span className="stem-shell-live">Live</span>
                </div>
                <h1>{title}</h1>
                {subtitle ? <p className="stem-shell-subtitle">{subtitle}</p> : null}
              </div>
            </div>

            <div className="stem-shell-header-right">
              {headerActions ? <div className="stem-shell-header-actions">{headerActions}</div> : null}

              {userLabel ? (
                <>
                  <div className="stem-shell-header-user" title={`${displayName}\n${userLabel}`}>
                    <span className="stem-shell-avatar" aria-hidden>
                      {initialsFrom(displayName || userLabel)}
                    </span>
                    <div className="stem-shell-user-meta">
                      <span className="stem-shell-user-name">{displayName}</span>
                      <span className="stem-shell-header-email">{userLabel}</span>
                    </div>
                  </div>
                  {changePasswordTo ? (
                    <NavLink to={changePasswordTo} className="stem-shell-header-account">
                      Change password
                    </NavLink>
                  ) : null}
                  {onLogout ? (
                    <button type="button" className="stem-shell-header-signout" onClick={requestLogout}>
                      Sign out
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
          <div className="stem-shell-top-accent" aria-hidden />
        </header>

        <main className="stem-shell-content">{children}</main>
      </div>

      <style>{shellStyles}</style>
    </div>
  );
}

const shellStyles = `
.stem-shell {
  --shell-width: 264px;
  --shell-collapsed: 76px;
  min-height: 100vh;
  display: grid;
  grid-template-columns: var(--shell-width) 1fr;
  background:
    radial-gradient(ellipse 60% 40% at 100% 0%, rgba(20, 145, 155, 0.08), transparent 50%),
    var(--stem-surface);
  transition: grid-template-columns 0.22s ease;
}
.stem-shell.is-collapsed {
  grid-template-columns: var(--shell-collapsed) 1fr;
}
.stem-shell-aside {
  background:
    linear-gradient(165deg, rgba(255,255,255,0.06) 0%, transparent 42%),
    linear-gradient(180deg, var(--portal-sidebar) 0%, color-mix(in srgb, var(--portal-sidebar) 82%, #000) 100%);
  color: var(--portal-sidebar-text);
  padding: 0.95rem 0.7rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  border-right: 1px solid color-mix(in srgb, var(--portal-rail) 55%, transparent);
  position: sticky;
  top: 0;
  height: 100vh;
  z-index: 30;
  overflow: hidden;
  box-shadow: inset -1px 0 0 rgba(255,255,255,0.04);
}
.stem-shell-brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
  min-height: 48px;
  padding: 0.15rem 0.35rem 0.55rem;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  margin-bottom: 0.15rem;
}
.stem-shell-brand-copy {
  min-width: 0;
  flex: 1;
}
.stem-shell-caption {
  margin: 0.4rem 0 0;
  opacity: 0.62;
  font-size: var(--stem-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 600;
}
.stem-shell-mark {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: var(--stem-text-lg);
  background: linear-gradient(145deg, var(--stem-teal-bright), var(--stem-teal-deep));
  color: #fff;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.22);
}
.stem-shell-collapse,
.stem-shell-header-collapse,
.stem-shell-mobile-toggle {
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.88);
  width: 32px;
  height: 32px;
  border-radius: 9px;
  cursor: pointer;
  font-size: var(--stem-text-base);
  flex-shrink: 0;
  display: inline-grid;
  place-items: center;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.stem-shell-collapse:hover {
  background: rgba(255,255,255,0.14);
  border-color: rgba(255,255,255,0.22);
}
.stem-shell-header-collapse,
.stem-shell-mobile-toggle {
  border-color: var(--stem-line);
  background: #fff;
  color: var(--stem-ink);
  box-shadow: 0 4px 12px rgba(5, 84, 86, 0.06);
}
.stem-shell-mobile-toggle { display: none; }
.stem-shell.is-collapsed .stem-shell-collapse {
  margin: 0 auto;
}
.stem-shell.is-collapsed .stem-shell-brand {
  flex-direction: column;
  align-items: center;
  padding-left: 0;
  padding-right: 0;
}
.stem-shell-nav-label {
  margin: 0.35rem 0.55rem 0.15rem;
  font-size: var(--stem-text-xs);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.45;
}
.stem-shell-nav {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overflow-anchor: none;
  padding: 0.15rem 0.2rem 0.5rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.22) transparent;
}
.stem-shell-nav::-webkit-scrollbar { width: 4px; }
.stem-shell-nav::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.22);
  border-radius: 999px;
}
.stem-shell-group { display: grid; gap: 0.15rem; }
.stem-shell-group-row { display: grid; }
.stem-shell-group-btn {
  width: 100%;
  text-align: left;
  cursor: pointer;
  font: inherit;
  background: transparent;
}
.stem-shell-chevron {
  margin-left: auto;
  display: inline-grid;
  place-items: center;
  opacity: 0.55;
  transition: transform 0.18s ease, opacity 0.15s ease;
  flex-shrink: 0;
}
.stem-shell-chevron.is-open {
  transform: rotate(0deg);
  opacity: 0.85;
}
.stem-shell-group:not(.is-open) .stem-shell-chevron {
  transform: rotate(-90deg);
}
.stem-shell-subnav {
  display: grid;
  gap: 0.1rem;
  margin: 0.1rem 0 0.25rem 1.15rem;
  padding: 0.2rem 0 0.15rem 0.75rem;
  border-left: 2px solid rgba(255,255,255,0.12);
}
.stem-shell-sublink {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.42rem 0.65rem;
  border-radius: 8px;
  font-size: var(--stem-text-sm);
  font-weight: 500;
  color: rgba(255,255,255,0.72);
  text-decoration: none;
  transition: background 0.15s ease, color 0.15s ease;
}
.stem-shell-sublink:hover {
  background: rgba(255,255,255,0.07);
  color: #fff;
}
.stem-shell-sublink.is-active {
  background: rgba(255,255,255,0.12);
  color: #fff;
  font-weight: 600;
}
.stem-shell-subdot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(255,255,255,0.35);
  flex-shrink: 0;
}
.stem-shell-sublink.is-active .stem-shell-subdot {
  background: var(--portal-rail);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--portal-rail) 28%, transparent);
}
.stem-shell-link {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.52rem 0.65rem;
  border-radius: 10px;
  font-size: var(--stem-text-md);
  font-weight: 500;
  color: rgba(255,255,255,0.88);
  text-decoration: none;
  border: 1px solid transparent;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  position: relative;
}
.stem-shell-link:hover {
  background: rgba(255,255,255,0.08);
  color: #fff;
}
.stem-shell-link.is-active {
  background: rgba(255,255,255,0.12);
  color: #fff;
  font-weight: 600;
  border-color: rgba(255,255,255,0.06);
  box-shadow: inset 3px 0 0 var(--portal-rail);
}
.stem-shell-link-icon {
  width: 1.85rem;
  height: 1.85rem;
  display: inline-grid;
  place-items: center;
  border-radius: 8px;
  background: rgba(255,255,255,0.08);
  font-size: var(--stem-text-md);
  line-height: 1;
  flex-shrink: 0;
  transition: background 0.15s ease;
}
.stem-shell-link:hover .stem-shell-link-icon,
.stem-shell-link.is-active .stem-shell-link-icon {
  background: color-mix(in srgb, var(--portal-rail) 35%, rgba(255,255,255,0.12));
}
.stem-shell-link-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stem-shell.is-collapsed .stem-shell-link {
  justify-content: center;
  padding: 0.55rem 0.35rem;
}
.stem-shell.is-collapsed .stem-shell-link-label,
.stem-shell.is-collapsed .stem-shell-caption,
.stem-shell.is-collapsed .stem-shell-nav-label {
  display: none;
}
.stem-shell.is-collapsed .stem-shell-link-icon {
  width: 2.1rem;
  height: 2.1rem;
  font-size: var(--stem-text-base);
}
.stem-shell-footer {
  border-top: 1px solid rgba(255,255,255,0.1);
  padding: 0.75rem 0.35rem 0.2rem;
  display: grid;
  gap: 0.55rem;
  flex-shrink: 0;
}
.stem-shell-user-card {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.55rem;
  border-radius: 12px;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.08);
  min-width: 0;
}
.stem-shell-user-card.is-collapsed {
  justify-content: center;
  padding: 0.45rem;
}
.stem-shell-user-avatar {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: linear-gradient(145deg, var(--stem-teal-bright), var(--portal-accent));
  color: #fff;
  font-size: var(--stem-text-xs);
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.2);
}
.stem-shell-user-text {
  min-width: 0;
  display: grid;
  gap: 0.08rem;
}
.stem-shell-user-text strong {
  font-size: var(--stem-text-sm);
  font-weight: 700;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stem-shell-user-text span {
  font-size: var(--stem-text-xs);
  opacity: 0.65;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stem-shell-footer-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
}
.stem-shell-footer-actions.is-collapsed {
  grid-template-columns: 1fr;
}
.stem-shell-account-link,
.stem-shell-logout {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
  min-height: 2.15rem;
  padding: 0.45rem 0.55rem;
  border-radius: 9px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.9);
  text-decoration: none;
  font: inherit;
  font-weight: 600;
  font-size: var(--stem-text-xs);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.stem-shell-account-link:hover,
.stem-shell-logout:hover {
  background: rgba(255,255,255,0.11);
  border-color: rgba(255,255,255,0.2);
  color: #fff;
}
.stem-shell-account-link.is-active {
  background: rgba(255,255,255,0.14);
  border-color: rgba(255,255,255,0.18);
}
.stem-shell-footer-ico {
  display: inline-grid;
  place-items: center;
  opacity: 0.9;
}
.stem-shell-main {
  min-width: 0;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  overflow-x: hidden;
}

/* —— Top section —— */
.stem-shell-header {
  position: sticky;
  top: 0;
  z-index: 20;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(238,248,246,0.92) 100%);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--stem-line);
  box-shadow: 0 10px 28px rgba(5, 84, 86, 0.04);
}
.stem-shell-top {
  padding: 1.05rem 1.5rem 0.95rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.25rem;
}
.stem-shell-top-accent {
  height: 3px;
  background: linear-gradient(90deg, var(--portal-accent), var(--portal-rail), rgba(233, 137, 69, 0.65));
  opacity: 0.9;
}
.stem-shell-header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  flex: 1;
}
.stem-shell-titleblock {
  min-width: 0;
}
.stem-shell-eyebrow-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.28rem;
}
.stem-shell-eyebrow {
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  background: var(--portal-accent-soft);
  color: var(--portal-accent);
  font-size: var(--stem-text-xs);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.stem-shell-eyebrow-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--stem-line);
}
.stem-shell-live {
  font-size: var(--stem-text-xs);
  font-weight: 600;
  color: var(--stem-success);
  letter-spacing: 0.02em;
}
.stem-shell-header h1 {
  margin: 0;
  font-size: clamp(1.35rem, 1.8vw, 1.55rem);
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--stem-ink);
}
.stem-shell-subtitle {
  margin: 0.28rem 0 0;
  color: var(--stem-ink-soft);
  font-size: var(--stem-text-base);
  line-height: 1.4;
  max-width: 52ch;
}
.stem-shell-header-right {
  display: flex;
  align-items: stretch;
  gap: 0.55rem;
  flex-shrink: 0;
  max-width: min(100%, 48rem);
  flex-wrap: wrap;
  justify-content: flex-end;
}
.stem-shell-header-actions {
  display: flex;
  align-items: stretch;
  gap: 0.55rem;
}
.stem-shell-header-actions > a,
.stem-shell-header-actions > button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-height: 2.75rem;
  padding: 0 0.95rem;
  border-radius: 12px;
  font-size: var(--stem-text-md);
  font-weight: 600;
  white-space: nowrap;
}
.stem-shell-header-user {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 1rem 0.4rem 0.4rem;
  border-radius: 12px;
  background: #fff;
  border: 1px solid var(--stem-line);
  box-shadow: 0 8px 20px rgba(5, 84, 86, 0.05);
  min-width: 0;
  min-height: 2.75rem;
  max-width: min(100%, 32rem);
  box-sizing: border-box;
}
.stem-shell-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: linear-gradient(145deg, var(--stem-teal-bright), var(--portal-accent));
  color: #fff;
  font-size: var(--stem-text-md);
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.2);
}
.stem-shell-user-meta {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
  flex: 1;
}
.stem-shell-user-name {
  font-size: var(--stem-text-base);
  font-weight: 700;
  line-height: 1.25;
  color: var(--stem-ink);
  word-break: break-word;
}
.stem-shell-header-email {
  font-size: var(--stem-text-md);
  line-height: 1.3;
  color: var(--stem-ink-soft);
  word-break: break-word;
  overflow-wrap: anywhere;
}
.stem-shell-header-account,
.stem-shell-header-signout {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-height: 2.75rem;
  height: auto;
  align-self: stretch;
  padding: 0 1rem;
  border-radius: 12px;
  border: 1px solid var(--stem-line);
  font: inherit;
  font-size: var(--stem-text-md);
  font-weight: 600;
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
}
.stem-shell-header-account {
  background: #fff;
  color: var(--stem-ink);
}
.stem-shell-header-account:hover {
  border-color: rgba(46, 125, 98, 0.35);
  color: var(--stem-teal-deep);
}
.stem-shell-header-signout {
  background: var(--stem-mint-soft);
  color: var(--stem-teal-deep);
}
.stem-shell-header-signout:hover {
  background: var(--portal-accent-soft);
}

.stem-shell-content {
  padding: 1.35rem 1.5rem 2.25rem;
  flex: 1;
  min-width: 0;
  max-width: 100%;
  overflow-x: hidden;
}
.stem-shell-backdrop {
  display: none;
}
@media (max-width: 900px) {
  .stem-shell,
  .stem-shell.is-collapsed {
    grid-template-columns: 1fr;
  }
  .stem-shell-aside {
    position: fixed;
    left: 0;
    top: 0;
    width: min(288px, 88vw);
    transform: translateX(-105%);
    transition: transform 0.22s ease;
    box-shadow: 0 24px 56px rgba(4, 30, 36, 0.45);
  }
  .stem-shell.is-mobile-open .stem-shell-aside {
    transform: translateX(0);
  }
  .stem-shell.is-collapsed .stem-shell-link-label,
  .stem-shell.is-collapsed .stem-shell-caption,
  .stem-shell.is-collapsed .stem-shell-nav-label,
  .stem-shell.is-collapsed .stem-shell-user-text {
    display: initial;
  }
  .stem-shell.is-collapsed .stem-shell-user-card.is-collapsed {
    justify-content: flex-start;
    padding: 0.55rem;
  }
  .stem-shell.is-collapsed .stem-shell-footer-actions.is-collapsed {
    grid-template-columns: 1fr 1fr;
  }
  .stem-shell.is-collapsed .stem-shell-link {
    justify-content: flex-start;
    padding: 0.52rem 0.65rem;
  }
  .stem-shell-mobile-toggle { display: inline-grid; place-items: center; }
  .stem-shell-header-collapse { display: none; }
  .stem-shell-collapse { display: none; }
  .stem-shell-top {
    padding: 0.9rem 1rem;
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .stem-shell-header-user {
    max-width: 100%;
    flex: 1 1 auto;
  }
  .stem-shell-header-right {
    width: 100%;
    max-width: none;
    justify-content: stretch;
  }
  .stem-shell-header-signout {
    display: none;
  }
  .stem-shell-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    border: none;
    background: rgba(11, 36, 49, 0.45);
    z-index: 25;
  }
}
`;

export function StatStrip({
  items,
}: {
  items: { label: string; value: string; hint?: string }[];
}) {
  return (
    <div className="stem-stat-strip">
      {items.map((item) => (
        <div key={item.label} className="stem-stat-card">
          <div className="stem-stat-label">{item.label}</div>
          <div className="stem-stat-value">{item.value}</div>
          {item.hint ? <div className="stem-stat-hint">{item.hint}</div> : null}
        </div>
      ))}
      <style>{statStyles}</style>
    </div>
  );
}

const statStyles = `
.stem-stat-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.9rem;
  margin-bottom: 1.35rem;
}
.stem-stat-card {
  position: relative;
  padding: 1.05rem 1.15rem 1.05rem 1.2rem;
  border-radius: var(--stem-radius);
  background: linear-gradient(165deg, #fff 0%, var(--stem-mint-soft) 100%);
  border: 1px solid var(--stem-line);
  box-shadow: 0 10px 26px rgba(6, 90, 94, 0.05);
  overflow: hidden;
}
.stem-stat-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, var(--portal-accent, var(--stem-teal)), var(--portal-rail, var(--stem-sky)));
}
.stem-stat-label {
  font-size: var(--stem-text-sm);
  color: var(--stem-ink-soft);
  margin-bottom: 0.35rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.stem-stat-value {
  font-family: var(--stem-font-display);
  font-size: var(--stem-text-2xl);
  font-weight: 700;
  color: var(--stem-ink);
  line-height: 1.1;
}
.stem-stat-hint {
  margin-top: 0.35rem;
  font-size: var(--stem-text-sm);
  color: var(--stem-ink-soft);
}
`;

export function Panel({
  title,
  children,
  action,
  description,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  description?: string;
}) {
  return (
    <section className="stem-panel">
      <div className="stem-panel-head">
        <div className="stem-panel-titles">
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div className="stem-panel-action">{action}</div> : null}
      </div>
      <div className="stem-panel-body">{children}</div>
      <style>{panelStyles}</style>
    </section>
  );
}

const panelStyles = `
.stem-panel {
  background: var(--stem-white);
  border: 1px solid var(--stem-line);
  border-radius: var(--stem-radius);
  margin-bottom: 1rem;
  box-shadow: 0 10px 28px rgba(6, 90, 94, 0.045);
  overflow: hidden;
  min-width: 0;
  max-width: 100%;
}
.stem-panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--stem-line);
  background:
    linear-gradient(90deg, var(--portal-accent-soft, var(--stem-mint-soft)) 0%, #fff 42%);
}
.stem-panel-titles h2 {
  margin: 0;
  font-size: var(--stem-text-xl);
  letter-spacing: -0.01em;
}
.stem-panel-titles p {
  margin: 0.3rem 0 0;
  color: var(--stem-ink-soft);
  font-size: var(--stem-text-md);
}
.stem-panel-action {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  justify-content: flex-end;
}
.stem-panel-body {
  padding: 1.15rem 1.25rem 1.25rem;
}
`;
