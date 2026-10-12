import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { fetchDashboardData } from '../services/api';
import { api, USE_MOCK } from '../services/client';
import { snapshotLabel, snapshotAsOf, istDate } from '../services/dates';

const DashboardContext = createContext();

export const PRESET_USERS = {
  admin: {
    key: 'admin',
    name: 'Dr. Eleanor Vance',
    title: 'Dean & Chief Administrator',
    email: 'admin@campusa.edu',
    password: 'admin',
    role: 'Administrator',
    avatarInitials: 'EV',
    assignedLocations: ['Main Campus', 'North Research Park', 'South Residential Zone', 'East Innovation Hub'],
    canEditTargets: true,
    canAssignLead: true,
    canScheduleInspection: true,
    canSendAdvisory: true,
    canUseWorkOrder: true,
    canAccessSustainabilityPage: true,
    canAccessCopilot: true,
  },
  head: {
    key: 'head',
    name: 'Prof. Rajesh Sharma',
    title: 'Head of Science & Engineering',
    email: 'head.science@campusa.edu',
    password: 'head',
    role: 'Department Head',
    avatarInitials: 'RS',
    assignedLocations: ['Main Campus', 'North Research Park'],
    canEditTargets: false,
    canAssignLead: true,
    canScheduleInspection: true,
    canSendAdvisory: true,
    canUseWorkOrder: true,
    canAccessSustainabilityPage: true,
    canAccessCopilot: true,
  },
  staff: {
    key: 'staff',
    name: 'Michael Chen',
    title: 'Facilities Technician (HVAC & Water)',
    email: 'staff.facilities@campusa.edu',
    password: 'staff',
    role: 'Staff',
    avatarInitials: 'MC',
    assignedLocations: ['Main Campus'],
    canEditTargets: false,
    canAssignLead: false,
    canScheduleInspection: false,
    canSendAdvisory: false,
    canUseWorkOrder: false,
    canAccessSustainabilityPage: false,
    canAccessCopilot: false,
  }
};

export const DEFAULT_FILTERS = {
  sector: 'College',
  role: 'Administrator',
  location: 'Main Campus',
  period: 'This week',
  snapshotDate: snapshotLabel(),
};

export const FILTER_OPTIONS = {
  sectors: ['College', 'Engineering Institute', 'Medical Center', 'Business School', 'Arts & Media'],
  roles: ['Administrator', 'Department Head', 'Staff'],
  locations: ['Main Campus', 'North Research Park', 'South Residential Zone', 'East Innovation Hub'],
  periods: ['This week', 'Last week', 'This month', 'Last month', 'This quarter', `Year to date (${istDate().slice(0, 4)})`],
  snapshotDates: Array.from({ length: 7 }, (_, index) => snapshotLabel(-index))
};

export function DashboardProvider({ children }) {
  // Authentication & Session
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(PRESET_USERS.admin);
  const [institutionType, setInstitutionType] = useState('public');
  const [selectedWorld, setSelectedWorld] = useState('campus');
  const [theme, setTheme] = useState(() => window.localStorage.getItem('campus-theme') || 'dark');
  const organizationName = selectedWorld === 'enterprise'
    ? institutionType === 'public' ? 'Municipality' : 'Company'
    : selectedWorld === 'hospital' ? 'Hospital Network' : 'Campus A';

  const [currentPage, setCurrentPage] = useState('overview');
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_FILTERS, snapshotDate: snapshotLabel() }));
  const [clockNow, setClockNow] = useState(() => new Date());
  const todayLabel = useRef(snapshotLabel());
  useEffect(() => {
    const timer = setInterval(() => {
      const current = new Date();
      const label = snapshotLabel(0, current);
      const previous = todayLabel.current;
      todayLabel.current = label;
      if (label !== previous) setFilters(value => value.snapshotDate === previous ? { ...value, snapshotDate: label } : value);
      setClockNow(current);
    }, 60000);
    return () => clearInterval(timer);
  }, []);
  const [dashboardData, setDashboardData] = useState(null);
  const [locations, setLocations] = useState([]);
  const [replayState, setReplayState] = useState(null);
  const [actions, setActions] = useState([]);
  const [decisionQueue, setDecisionQueue] = useState([]);
  const lastAlertAt = useRef(null);
  const lastTickAt = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    const palette = {
      campus: { accent: '#76B58F', deep: '#3E8061', glow: 'rgba(118, 181, 143, 0.18)' },
      enterprise: { accent: '#D8A35D', deep: '#A96E31', glow: 'rgba(216, 163, 93, 0.18)' },
      hospital: { accent: '#62B8C4', deep: '#348894', glow: 'rgba(98, 184, 196, 0.18)' },
    };
    const activePalette = palette[selectedWorld] || palette.campus;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.world = selectedWorld;
    document.title = `${organizationName} · Stewardship Systems`;
    document.documentElement.style.setProperty('--sector-accent', activePalette.accent);
    document.documentElement.style.setProperty('--sector-accent-deep', activePalette.deep);
    document.documentElement.style.setProperty('--sector-glow', activePalette.glow);
    window.localStorage.setItem('campus-theme', theme);
  }, [selectedWorld, theme, organizationName]);

  // Modals & Drawers
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState(USE_MOCK ? [
    {
      id: 'n1',
      type: 'critical',
      title: 'Heavy rain 46 mm/6 h',
      meta: 'Climate · 08:15 · New',
      badge: 'Critical',
      status: 'new',
      page: 'climate'
    },
    {
      id: 'n2',
      type: 'warning',
      title: 'Overnight load +18% · Science south wing',
      meta: 'Energy · 07:10 · Acknowledged',
      badge: 'Warning',
      status: 'acknowledged',
      page: 'energy'
    },
    {
      id: 'n3',
      type: 'info',
      title: 'Weekly AQI steady at 42',
      meta: 'Air · 06:00 · Snoozed',
      badge: 'Info',
      status: 'snoozed',
      page: 'air'
    }
  ] : []);

  useEffect(() => {
    if (USE_MOCK) return;
    api.locations().then(({ locations: nodes }) => setLocations(nodes)).catch(() => setLocations([]));
    api.replayState().then(setReplayState).catch(() => {});
  }, []);

  const node = locations.find(item => item.label === filters.location)?.node_id || 'F01';
  const selectedAsOf = snapshotAsOf(filters.snapshotDate, clockNow);
  const effectiveAsOf = replayState?.running ? replayState.cursor : selectedAsOf;
  const alertToNotification = (alert) => ({
    id: alert.alert_key, type: (alert.level || 'Info').toLowerCase(),
    title: alert.type.replace(/_/g, ' ') + ' · ' + alert.node,
    meta: `${alert.domain} · ${new Date(alert.created_at).toLocaleString()} · ${alert.status}`,
    badge: alert.level || 'Needs review', status: alert.status, page: alert.domain === 'mobility' ? 'mobility' : alert.domain,
    confidence: alert.confidence,
  });

  const refreshOperational = async (asOfOverride) => {
    if (USE_MOCK) return;
    const cutoff = typeof asOfOverride === 'string' ? asOfOverride : effectiveAsOf;
    const [alertResponse, actionResponse, queueResponse, stateResponse] = await Promise.all([
      api.alerts({ node, as_of: cutoff }), api.actions({ node, as_of: cutoff }),
      api.decisionQueue({ node, as_of: cutoff }), api.replayState(),
    ]);
    setNotifications(alertResponse.alerts.filter(item => ['open', 'needs_review', 'pending_agent'].includes(item.status)).map(alertToNotification));
    if (alertResponse.alerts.length) lastAlertAt.current = alertResponse.alerts[alertResponse.alerts.length - 1].created_at;
    setActions(actionResponse.actions);
    setDecisionQueue(queueResponse.items);
    setReplayState(stateResponse);
  };

  useEffect(() => {
    if (USE_MOCK) return;
    refreshOperational().catch(() => {});
  }, [node, effectiveAsOf]);

  useEffect(() => {
    if (USE_MOCK || !replayState?.running) return;
    let source;
    let timer;
    let stopped = false;
    const connect = () => {
      if (stopped) return;
      source = new EventSource(api.streamUrl({ node }));
      source.addEventListener('tick', event => {
        const tick = JSON.parse(event.data);
        lastTickAt.current = tick.as_of;
        if (tick.new_alerts?.length) {
          lastAlertAt.current = tick.new_alerts[tick.new_alerts.length - 1].created_at;
          const visible = tick.new_alerts.filter(item => ['open', 'needs_review', 'pending_agent'].includes(item.status));
          setNotifications(previous => {
            const known = new Set(previous.map(item => item.id));
            return [...visible.filter(item => !known.has(item.alert_key)).map(alertToNotification), ...previous];
          });
          if (visible.length) showToast(`${visible.length} new alert${visible.length === 1 ? '' : 's'}`);
        }
        refreshOperational(tick.as_of).catch(() => {});
      });
      source.onerror = () => {
        source.close();
        api.alerts({ node, since: lastAlertAt.current || undefined, as_of: lastTickAt.current || selectedAsOf }).then(result => {
          setNotifications(previous => {
            const known = new Set(previous.map(item => item.id));
            return [...result.alerts.filter(item => ['open', 'needs_review', 'pending_agent'].includes(item.status) && !known.has(item.alert_key)).map(alertToNotification), ...previous];
          });
        }).catch(() => {});
        timer = setTimeout(connect, 2500);
      };
    };
    connect();
    return () => { stopped = true; clearTimeout(timer); source?.close(); };
  }, [replayState?.running, node, selectedAsOf]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Login handler
  const login = (emailOrKey, password) => {
    let matchedUser = null;

    if (PRESET_USERS[emailOrKey]) {
      matchedUser = PRESET_USERS[emailOrKey];
    } else {
      matchedUser = Object.values(PRESET_USERS).find(u => 
        u.email.toLowerCase() === emailOrKey.toLowerCase()
      );
    }

    if (matchedUser && matchedUser.password === password) {
      setCurrentUser(matchedUser);
      setIsAuthenticated(true);
      setFilters(prev => ({
        ...prev,
        role: matchedUser.role,
        location: matchedUser.assignedLocations[0]
      }));
      showToast(`Welcome back, ${matchedUser.name} (${matchedUser.role})`);
      return true;
    }

    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    showToast('Logged out successfully.');
  };

  // Re-fetch / calculate dashboard data whenever filters change
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetchDashboardData({ ...filters, node, as_of: effectiveAsOf })
      .then((data) => {
        if (isMounted) {
          setDashboardData(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load dashboard data:', err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [filters, node, effectiveAsOf]);

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    showToast(`Updated ${key}: ${value}`);
  };

  const resetFilters = () => {
    setFilters({
      ...DEFAULT_FILTERS,
      snapshotDate: snapshotLabel(),
      role: currentUser?.role || 'Administrator',
      location: currentUser?.assignedLocations?.[0] || 'Main Campus'
    });
    showToast('Filters reset to default values.');
  };

  const acknowledgeNotification = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'acknowledged' } : n));
    showToast('Notification acknowledged');
  };

  const snoozeNotification = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'snoozed' } : n));
    showToast('Notification snoozed for 4 hours');
  };

  const dismissNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    showToast('Notification dismissed');
  };

  // Check page permission based on PDF roles
  const canAccessPage = (pageId) => {
    if (pageId === 'sustainability' && currentUser.role === 'Staff') {
      return false; // Per PDF Page 4: "Staff: No access to this page."
    }
    return true;
  };

  return (
    <DashboardContext.Provider
      value={{
        isAuthenticated,
        currentUser,
        institutionType,
        setInstitutionType,
        selectedWorld,
        setSelectedWorld,
        organizationName,
        theme,
        setTheme,
        login,
        logout,
        canAccessPage,
        currentPage,
        setCurrentPage,
        filters,
        updateFilter,
        resetFilters,
        dashboardData,
        forecastScope: { node, as_of: effectiveAsOf },
        locations,
        replayState,
        setReplayState,
        actions,
        setActions,
        decisionQueue,
        refreshOperational,
        isLoading,
        toastMessage,
        showToast,
        notifications,
        acknowledgeNotification,
        snoozeNotification,
        dismissNotification,
        notificationDrawerOpen,
        setNotificationDrawerOpen,
        searchModalOpen,
        setSearchModalOpen,
        shareModalOpen,
        setShareModalOpen,
        datePickerOpen,
        setDatePickerOpen,
        FILTER_OPTIONS: { ...FILTER_OPTIONS, snapshotDates: Array.from({ length: 7 }, (_, index) => snapshotLabel(-index, clockNow)) },
        PRESET_USERS
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
