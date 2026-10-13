import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { fetchDashboardData } from '../services/api';
import { api, USE_MOCK, DEMO_MODE, setApiRole } from '../services/client';
import { snapshotLabel, istDate, snapshotAsOf } from '../services/dates';

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
    canAccessCopilot: true,
  }
};

export const DEFAULT_FILTERS = {
  sector: 'College',
  role: 'Administrator',
  location: 'Main Campus',
  node: 'F01',
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
  const [demoMode,setDemoMode]=useState(DEMO_MODE);
  const [currentUser, setCurrentUser] = useState(PRESET_USERS.admin);
  const [institutionType, setInstitutionType] = useState('public');
  const [selectedWorld, setSelectedWorld] = useState('campus');
  const [theme, setTheme] = useState(() => window.localStorage.getItem('campus-theme') || 'dark');
  const organizationName = selectedWorld === 'enterprise'
    ? institutionType === 'public' ? 'Municipality' : 'Company'
    : selectedWorld === 'hospital' ? 'Hospital' : selectedWorld === 'intelligence' ? 'Intelligence' : 'College';

  const [currentPage, setCurrentPage] = useState('overview');
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS, snapshotDate: snapshotLabel() });
  const [locations, setLocations] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const refreshDashboard = () => setRefreshVersion(value => value + 1);
  const node = filters.node || 'F01';
  const [replayState, setReplayState] = useState(null);
  const [actions, setActions] = useState([]);
  const [decisionQueue, setDecisionQueue] = useState([]);
  const lastAlertAt = useRef(null);
  const lastTickAt = useRef(null);
  const announcedStreamAlerts = useRef(new Set());
  const loadedWindow = useRef(null);
  const requestsInFlight = useRef(0);
  const [streamVersion, setStreamVersion] = useState(0);
  const streamRefreshPending = useRef(false);
  const [forecastScope, setForecastScope] = useState({ node, as_of: new Date().toISOString() });
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    if (USE_MOCK || !isAuthenticated) return;
    let active = true;
    api.locations().then(result => {
      if (active) {
        setLocations(result.locations);
        setFilters(previous => {
          const label = result.locations.find(item => item.node_id === previous.node)?.label;
          return label && previous.location !== label ? { ...previous, location: label } : previous;
        });
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [refreshVersion,isAuthenticated,currentUser.key]);

  useEffect(() => {
    let previousToday = snapshotLabel();
    const timer = setInterval(() => {
      const today = snapshotLabel();
      if (today !== previousToday) setFilters(previous => previous.snapshotDate === previousToday ? { ...previous, snapshotDate: today } : previous);
      previousToday = today;
      if (!requestsInFlight.current) refreshDashboard();
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const palette = {
      campus: { accent: '#76B58F', deep: '#3E8061', glow: 'rgba(118, 181, 143, 0.18)' },
      enterprise: { accent: '#D8A35D', deep: '#A96E31', glow: 'rgba(216, 163, 93, 0.18)' },
      hospital: { accent: '#62B8C4', deep: '#348894', glow: 'rgba(98, 184, 196, 0.18)' },
    };
    const activePalette = palette[selectedWorld] || palette.campus;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.world = selectedWorld;
    document.title = `Agenexus · ${organizationName}`;
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

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const alertToNotification = alert => ({
    id: alert.alert_key, type: (alert.level || 'Info').toLowerCase(),
    alertId: alert.alert_id,
    title: `${alert.type.replace(/_/g, ' ')} · ${alert.node}`,
    meta: `${alert.domain} · ${alert.status}`, badge: alert.level || 'Needs review',
    status: alert.status, page: alert.domain, confidence: alert.confidence,
    leadTime: alert.lead_time_hours ?? alert.facts?.observations?.lead_time_hours,
  });
  const refreshOperational = async cutoff => {
    if (USE_MOCK) return;
    const as_of = typeof cutoff === 'string' ? cutoff : forecastScope.as_of;
    const [alertResponse, actionResponse, queueResponse, stateResponse] = await Promise.all([
      api.alerts({ node, as_of }), api.actions({ node, as_of }), api.decisionQueue({ node, as_of }), api.replayState(),
    ]);
    setNotifications(alertResponse.alerts.filter(item => ['open', 'needs_review', 'pending_agent'].includes(item.status)).map(alertToNotification));
    if (alertResponse.alerts.length) lastAlertAt.current = alertResponse.alerts.at(-1).created_at;
    setActions(actionResponse.actions);
    setDecisionQueue(queueResponse.items);
    setReplayState(stateResponse);
  };

  const applySession = response => {
    const user=response.user;
    setDemoMode(response.demo_mode);
    if(!user)return;
    const resolved={...PRESET_USERS[user.key],...user,canAccessCopilot:user.key!=='staff'};
    setApiRole(user.key==='staff'?'staff':'head');
    setCurrentUser(resolved);
    setFilters(previous=>({...previous,role:user.role,node:user.nodes[0],location:user.nodes[0]}));
    setIsAuthenticated(true);
    setDashboardData(null);setActions([]);setDecisionQueue([]);setNotifications([]);
  };
  useEffect(()=>{if(!USE_MOCK)api.authMe().then(applySession).catch(()=>{});},[]);

  useEffect(() => {
    if (USE_MOCK || !isAuthenticated) return;
    let active = true;
    api.replayState().then(state => { if (active) setReplayState(state); }).catch(() => {});
    return () => { active = false; };
  }, [isAuthenticated]);

  useEffect(() => {
    if (USE_MOCK || !replayState?.running || !isAuthenticated) return;
    let source, timer, stopped = false;
    const connect = () => {
      if (stopped) return;
      source = new EventSource(api.streamUrl({ node }),{withCredentials:true});
      source.addEventListener('tick', event => {
        if (stopped) return;
        const tick = JSON.parse(event.data);
        lastTickAt.current = tick.as_of;
        setForecastScope(previous=>({...previous,node,as_of:tick.as_of}));
        setReplayState(previous => ({ ...previous, cursor: tick.as_of }));
        if (requestsInFlight.current) streamRefreshPending.current = true;
        else setStreamVersion(value => value + 1);
        refreshOperational(tick.as_of).catch(() => {});
        const fresh = tick.new_alerts?.filter(item => {
          if (!['open', 'needs_review', 'pending_agent'].includes(item.status)) return false;
          const identity = `${item.alert_id || item.alert_key}|${item.alert_key}|${item.status}`;
          if (announcedStreamAlerts.current.has(identity)) return false;
          announcedStreamAlerts.current.add(identity);
          return true;
        }) || [];
        if (fresh.length) showToast(`${fresh.length} new alert${fresh.length === 1 ? '' : 's'}`);
      });
      source.onerror = () => {
        source.close();
        api.alerts({ node, since: lastAlertAt.current || undefined, as_of: lastTickAt.current || replayState.cursor }).then(result => {
          if (stopped) return;
          setNotifications(previous => {
            const byId = new Map(previous.map(item => [item.alertId || item.id, item]));
            result.alerts.filter(item => ['open', 'needs_review', 'pending_agent'].includes(item.status)).forEach(item => byId.set(item.alert_id, alertToNotification(item)));
            return [...byId.values()];
          });
          if (result.alerts.length) lastAlertAt.current = result.alerts.at(-1).created_at;
        }).catch(() => {});
        timer = setTimeout(connect, 2500);
      };
    };
    connect();
    return () => { stopped = true; source?.close(); clearTimeout(timer); };
  }, [node, replayState?.running, isAuthenticated]);

  // Login handler
  const login = async (emailOrKey, password) => {
    if(!USE_MOCK){
      try{applySession(await api.login(emailOrKey,password));return true;}
      catch(error){showToast(error.message);return false;}
    }
    let matchedUser = null;

    if (PRESET_USERS[emailOrKey]) {
      matchedUser = PRESET_USERS[emailOrKey];
    } else {
      matchedUser = Object.values(PRESET_USERS).find(u => 
        u.email.toLowerCase() === emailOrKey.toLowerCase()
      );
    }

    if (matchedUser && matchedUser.password === password) {
      setApiRole(matchedUser.key === 'staff' ? 'staff' : 'head');
      setCurrentUser(matchedUser);
      setIsAuthenticated(true);
      setFilters(prev => ({
        ...prev,
        role: matchedUser.role,
        location: matchedUser.assignedLocations[0]
        , node: 'F01'
      }));
      showToast(`Welcome back, ${matchedUser.name} (${matchedUser.role})`);
      return true;
    }

    return false;
  };

  const logout = async () => {
    if(!USE_MOCK)await api.logout().catch(()=>{});
    setApiRole('staff');
    setIsAuthenticated(false);
    showToast('Logged out successfully.');
  };

  const switchDemoRole = async key => {
    if(!demoMode)return;
    if(!USE_MOCK){try{applySession(await api.demoRole(key));}catch(error){showToast(error.message);}return;}
    const user = PRESET_USERS[key];
    if (!user) return;
    setApiRole(key === 'staff' ? 'staff' : 'head');
    setCurrentUser(user);
    setFilters(previous => ({...previous,role:user.role}));
  };

  // Re-fetch / calculate dashboard data whenever filters change
  useEffect(() => {
    if(!isAuthenticated)return;
    let isMounted = true;
    requestsInFlight.current++;
    setIsLoading(true);
    setLoadError(null);
    const windowKey = JSON.stringify([node, filters.snapshotDate, filters.period]);
    if (loadedWindow.current !== windowKey) setDashboardData(null);

    fetchDashboardData({ ...filters, node, as_of: replayState?.running ? replayState.cursor : undefined })
      .then((data) => {
        if (isMounted) {
          setDashboardData(data);
          loadedWindow.current = windowKey;
          setForecastScope({ node, as_of: data.window?.as_of || new Date().toISOString(), start: data.window?.start, end: data.window?.effective_end || data.window?.end });
          if (!USE_MOCK) {
            refreshOperational(data.window?.as_of).catch(() => {});
          }
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load dashboard data:', err);
        if (isMounted) {
          setIsLoading(false);
          setLoadError(err.message || 'Could not reach the dashboard API');
        }
      }).finally(() => {
        requestsInFlight.current--;
        if (!requestsInFlight.current && streamRefreshPending.current) {
          streamRefreshPending.current = false;
          setStreamVersion(value => value + 1);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [filters, node, refreshVersion, replayState?.running, streamVersion,isAuthenticated]);

  const updateFilter = (key, value) => {
    setFilters(prev => key === 'node' ? { ...prev, node: value, location: locations.find(item => item.node_id === value)?.label || value } : { ...prev, [key]: value });
    showToast(`Updated ${key}: ${value}`);
  };

  const resetFilters = () => {
    setFilters({
      ...DEFAULT_FILTERS,
      snapshotDate: snapshotLabel(),
      node:currentUser.nodes?.[0]||'F01',
      role: currentUser?.role || 'Administrator',
      location: currentUser?.assignedLocations?.[0] || 'Main Campus'
    });
    showToast('Filters reset to default values.');
  };

  // Active unacknowledged notifications
  const activeNotifications = notifications.filter(n => n.status !== 'acknowledged' && n.status !== 'snoozed');
  const notificationCount = activeNotifications.length;

  const acknowledgeNotification = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'acknowledged' } : n));
    showToast('Notification acknowledged');
  };

  const acknowledgeAllNotifications = () => {
    setNotifications(prev => prev.map(n => ({ ...n, status: 'acknowledged' })));
    showToast('All notifications acknowledged');
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
        demoMode,
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
        switchDemoRole,
        canAccessPage,
        currentPage,
        setCurrentPage,
        filters,
        updateFilter,
        resetFilters,
        dashboardData,
        forecastScope,
        replayState,
        setReplayState,
        actions,
        decisionQueue,
        refreshOperational,
        locations,
        loadError,
        refreshDashboard,
        isLoading,
        toastMessage,
        showToast,
        notifications,
        activeNotifications,
        notificationCount,
        acknowledgeNotification,
        acknowledgeAllNotifications,
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
        FILTER_OPTIONS: {
          ...FILTER_OPTIONS,
          locations: locations.length ? locations.map(item => item.label) : FILTER_OPTIONS.locations,
          snapshotDates: Array.from({ length: 7 }, (_, index) => snapshotLabel(-index)),
          periods: ['This week', 'Last week', 'This month', 'Last month', 'This quarter', `Year to date (${istDate().slice(0, 4)})`],
        },
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
