import React, { useEffect } from 'react';
import { DashboardProvider, useDashboard } from './context/DashboardContext';
import WelcomeJourney from './pages/WelcomeJourney';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Footer from './components/Footer';
import GlobalModals from './components/GlobalModals';

// 12 Exact Pages from the PDF
import OverviewPage from './pages/OverviewPage';
import EnergyPage from './pages/EnergyPage';
import WaterPage from './pages/WaterPage';
import WastePage from './pages/WastePage';
import AirPage from './pages/AirPage';
import AssetsPage from './pages/AssetsPage';
import MobilityPage from './pages/MobilityPage';
import SafetyPage from './pages/SafetyPage';
import ClimatePage from './pages/ClimatePage';
import SustainabilityPage from './pages/SustainabilityPage';
import ActionsPage from './pages/ActionsPage';
import AlertsPage from './pages/AlertsPage';
import InsightsPage from './pages/InsightsPage';

import { ShieldAlert, ArrowLeft } from 'lucide-react';

function RestrictedAccessBanner({ pageName }) {
  const { setCurrentPage, currentUser } = useDashboard();
  return (
    <div className="bg-[#14151C] border border-[#262835] rounded-2xl p-8 max-w-2xl mx-auto my-12 text-center space-y-4 shadow-xl">
      <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
        <ShieldAlert className="w-7 h-7" />
      </div>
      <div>
        <h3 className="text-xl font-bold text-white">Access Restricted: {pageName}</h3>
        <p className="text-xs text-dark-300 mt-2 leading-relaxed">
          Under Campus A Security & Governance policy, strategic sustainability goal-setting and long-range roadmap adjustments are restricted to <strong>Administrators</strong> and <strong>Department Heads</strong>.
        </p>
        <p className="text-[11px] text-dark-400 mt-1 font-mono">
          Your current session is logged in as: <strong>{currentUser.name} ({currentUser.role})</strong>.
        </p>
      </div>
      <div className="pt-2">
        <button
          onClick={() => setCurrentPage('overview')}
          className="px-4 py-2 bg-gradient-to-r from-[#FF5500] to-[#FF3D00] text-white text-xs font-bold rounded-xl shadow-lg shadow-orange-500/25 hover:brightness-110 transition inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Operations Overview</span>
        </button>
      </div>
    </div>
  );
}

function DashboardContent() {
  const { currentPage, setCurrentPage, setSearchModalOpen, isLoading, canAccessPage } = useDashboard();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSearchModalOpen]);

  const pages = [
    { id: 'overview', number: 1, name: 'Overview' },
    { id: 'energy', number: 2, name: 'Energy' },
    { id: 'water', number: 3, name: 'Water' },
    { id: 'waste', number: 4, name: 'Waste' },
    { id: 'air', number: 5, name: 'Air' },
    { id: 'assets', number: 6, name: 'Assets' },
    { id: 'mobility', number: 7, name: 'Mobility' },
    { id: 'safety', number: 8, name: 'Safety' },
    { id: 'climate', number: 9, name: 'Climate' },
    { id: 'sustainability', number: 10, name: 'Sustainability' },
    { id: 'actions', number: 11, name: 'Actions' },
    { id: 'alerts', number: 12, name: 'Alerts' },
    { id: 'insights', number: 13, name: 'Insights' },
  ];

  const renderActivePage = () => {
    if (!canAccessPage(currentPage)) {
      return <RestrictedAccessBanner pageName={currentPage.toUpperCase()} />;
    }

    switch (currentPage) {
      case 'overview': return <OverviewPage />;
      case 'energy': return <EnergyPage />;
      case 'water': return <WaterPage />;
      case 'waste': return <WastePage />;
      case 'air': return <AirPage />;
      case 'assets': return <AssetsPage />;
      case 'mobility': return <MobilityPage />;
      case 'safety': return <SafetyPage />;
      case 'climate': return <ClimatePage />;
      case 'sustainability': return <SustainabilityPage />;
      case 'actions': return <ActionsPage />;
      case 'alerts': return <AlertsPage />;
      case 'insights': return <InsightsPage />;
      default: return <OverviewPage />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0A0B0E] text-[#D8DCED] font-sans antialiased selection:bg-brand-orange selection:text-white">
      {/* Sleek Fintrixity Dark Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        {/* 12 Slides / Pages Quick Switcher Bar */}
        <div className="bg-[#111216] border-b border-[#1E202A] px-6 py-2 overflow-x-auto flex items-center justify-between gap-3 scrollbar-thin">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-semibold text-dark-400 mr-2 uppercase tracking-wider shrink-0">
              Slide / Page:
            </span>
            {pages.map((p) => {
              const isActive = currentPage === p.id;
              const hasAccess = canAccessPage(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => setCurrentPage(p.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-[#FF5500] to-[#FF3D00] text-white shadow-md shadow-orange-500/25 font-semibold'
                      : !hasAccess
                      ? 'bg-[#14151C] text-dark-500 border border-[#222430] opacity-60'
                      : 'bg-[#171821] hover:bg-[#20222E] text-dark-300 hover:text-white border border-[#242735]'
                  }`}
                >
                  <span className="opacity-70 text-[10px] font-mono">P{p.number}.</span>
                  <span>{p.name}</span>
                  {!hasAccess && <span className="text-[9px] text-rose-400 font-mono">🔒</span>}
                </button>
              );
            })}
          </div>

          <div className="hidden xl:flex items-center gap-2 text-[11px] font-mono text-dark-400 shrink-0">
            <span className={`w-2 h-2 rounded-full ${isLoading ? 'bg-amber-400 animate-spin' : 'bg-emerald-400 animate-pulse'}`} />
            <span>{isLoading ? 'Recalculating telemetry...' : 'Backend sync: Live (1.4k nodes)'}</span>
          </div>
        </div>

        {/* Page Content Viewport */}
        <main className={`flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto transition-opacity duration-200 ${isLoading ? 'opacity-70' : 'opacity-100'}`}>
          {renderActivePage()}
          <Footer />
        </main>
      </div>

      {/* Global Modals */}
      <GlobalModals />
    </div>
  );
}

function MainApp() {
  const { isAuthenticated } = useDashboard();
  return isAuthenticated ? <DashboardContent /> : <WelcomeJourney />;
}

export default function App() {
  return (
    <DashboardProvider>
      <MainApp />
    </DashboardProvider>
  );
}
