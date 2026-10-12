/**
 * Centralized API & Data Service for Campus A Sustainability Operations
 * 
 * To connect to a live backend (Node.js, Express, FastAPI, Django, Spring Boot):
 * 1. Define VITE_API_BASE_URL in your .env file (e.g., VITE_API_BASE_URL=http://localhost:5000/api)
 * 2. Set USE_MOCK_DATA = false below or implement fetch() calls.
 */

import { api, API_BASE_URL, USE_MOCK } from './client';

export { API_BASE_URL };
export const USE_MOCK_DATA = USE_MOCK;

// Helper to calculate dynamic multipliers based on sector, location, and period
const getMultipliers = (filters) => {
  let periodMultiplier = 1.0;
  if (filters.period === 'Last week') periodMultiplier = 1.04;
  else if (filters.period === 'This month') periodMultiplier = 4.2;
  else if (filters.period === 'Last month') periodMultiplier = 4.35;
  else if (filters.period === 'This quarter') periodMultiplier = 12.8;
  else if (filters.period === 'Year to date (2026)') periodMultiplier = 41.5;

  let locationFactor = 1.0;
  if (filters.location === 'North Research Park') locationFactor = 1.25;
  else if (filters.location === 'South Residential Zone') locationFactor = 0.85;
  else if (filters.location === 'East Innovation Hub') locationFactor = 1.15;

  let sectorFactor = 1.0;
  if (filters.sector === 'Engineering Institute') sectorFactor = 1.35;
  else if (filters.sector === 'Medical Center') sectorFactor = 1.5;
  else if (filters.sector === 'Business School') sectorFactor = 0.75;
  else if (filters.sector === 'Arts & Media') sectorFactor = 0.65;

  return { periodMultiplier, locationFactor, sectorFactor };
};

export const fetchDashboardData = async (filters) => {
  if (!USE_MOCK_DATA) {
    const node = filters.node || 'F01';
    const day = filters.snapshotDate ? new Date(`${filters.snapshotDate.replace(/^[A-Za-z]{3} /, '')} 23:00:00 GMT+0530`) : new Date('2026-10-09T23:00:00+05:30');
    const asOf = filters.as_of || (Number.isNaN(day.getTime()) ? '2026-10-09T23:00:00+05:30' : day.toISOString());
    const cutoff = new Date(asOf);
    const dayMs = 86400000;
    let start = new Date(cutoff.getTime() - 7 * dayMs);
    let end = cutoff;
    if (filters.period === 'Last week') {
      start = new Date(cutoff.getTime() - 14 * dayMs);
      end = new Date(cutoff.getTime() - 7 * dayMs);
    } else if (filters.period === 'This month') {
      start = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth(), 1));
    } else if (filters.period === 'Last month') {
      start = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() - 1, 1));
      end = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth(), 1) - 1);
    } else if (filters.period === 'This quarter') {
      start = new Date(Date.UTC(cutoff.getUTCFullYear(), Math.floor(cutoff.getUTCMonth() / 3) * 3, 1));
    } else if (filters.period === 'Year to date (2026)') {
      start = new Date('2026-01-01T00:00:00+05:30');
    }
    return api.dashboard({ node, start: start.toISOString(), end: end.toISOString(), as_of: asOf });
  }

  // Realistic mock data engine that adapts smoothly to all filters
  const { periodMultiplier, locationFactor, sectorFactor } = getMultipliers(filters);
  const factor = locationFactor * sectorFactor;

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      filters,
    },
    overview: {
      score: +(78.4 * (sectorFactor > 1 ? 0.98 : 1.02)).toFixed(1),
      delta: 3.4,
      trend: 'Improving',
      factors: [
        { name: 'Energy', score: Math.round(81 * (sectorFactor > 1 ? 0.95 : 1.02)), status: 'On track', color: 'emerald', page: 'energy' },
        { name: 'Water', score: Math.round(74 * (locationFactor > 1 ? 0.96 : 1.01)), status: 'Monitor', color: 'amber', page: 'water' },
        { name: 'Waste', score: Math.round(88 * factor * 0.98), status: 'On track', color: 'emerald', page: 'waste' },
        { name: 'Air · AQI', score: 42, status: 'On track', color: 'emerald', page: 'air' },
        { name: 'Mobility', score: Math.round(67 * locationFactor), status: 'Monitor', color: 'amber', page: 'mobility' },
        { name: 'Assets', score: '12 due', status: 'Action needed', color: 'orange', page: 'assets' },
        { name: 'Safety', score: 94, status: 'On track', color: 'emerald', page: 'safety' },
        { name: 'Climate', score: 68, status: 'Elevated', color: 'amber', page: 'climate' },
      ],
      complaints: {
        open: Math.round(14 * factor),
        overdue: Math.max(1, Math.round(3 * factor)),
      },
      utilization: {
        classrooms: Math.round(64 * sectorFactor),
        labs: Math.round(71 * sectorFactor),
        hostels: Math.round(88 * (filters.location === 'South Residential Zone' ? 1.05 : 0.95)),
      }
    },
    energy: {
      currentDemandKw: Math.round(482 * factor),
      deltaVsPrevWeek: -6.8,
      electricityMwh: +(68.4 * periodMultiplier * factor).toFixed(1),
      peakDemandKw: Math.round(612 * factor),
      estimatedEmissionsTco2e: +(21.7 * periodMultiplier * factor).toFixed(1),
      avoidedTco2e: +(1.6 * periodMultiplier).toFixed(1),
      buildings: [
        { name: 'Science & Engineering', kw: Math.round(184 * factor), percent: 38 },
        { name: 'Main Library', kw: Math.round(96 * factor), percent: 20 },
        { name: 'Residence halls', kw: Math.round(83 * factor), percent: 17 },
        { name: 'Student Center', kw: Math.round(71 * factor), percent: 15 },
        { name: 'Other buildings', kw: Math.round(48 * factor), percent: 10 },
      ],
      monthlySavingRs: Math.round(92800 * factor),
      savingMwh: +(11.6 * periodMultiplier).toFixed(1)
    },
    water: {
      useTodayM3: Math.round(1323 * factor),
      deltaAvg: -3.6,
      dailySupplyM3: Math.round(1540 * factor),
      storedReservePercent: 68,
      intensityLPerPerson: +(42.8 * (sectorFactor > 1 ? 1.1 : 0.95)).toFixed(1),
      leakAnomalyDelta: '+18.7%',
      weeklySavingRs: Math.round(2300 * factor),
      tanks: [
        { name: 'North reservoir · 480 kL', percent: 82 },
        { name: 'Central tank · 320 kL', percent: 64 },
        { name: 'South cistern · 210 kL', percent: 38 },
      ]
    },
    waste: {
      generatedTonnes: +(52.6 * periodMultiplier * factor).toFixed(1),
      deltaVsLastWeek: -4.8,
      collectedOnSchedulePercent: 94.2,
      overflowIncidents: Math.round(7 * factor),
      diversionRatePercent: 61.8,
      streams: [
        { name: 'General', tonnage: +(20.1 * periodMultiplier * factor).toFixed(1), width: '38%' },
        { name: 'Organics', tonnage: +(16.4 * periodMultiplier * factor).toFixed(1), width: '31%' },
        { name: 'Recycling', tonnage: +(12.2 * periodMultiplier * factor).toFixed(1), width: '23%' },
        { name: 'Other', tonnage: +(3.9 * periodMultiplier * factor).toFixed(1), width: '8%' },
      ],
      routeSavingRsWeekly: Math.round(1840 * factor)
    },
    air: {
      aqi: 42,
      status: 'Good',
      weeklyMeanAqi: 46,
      pm25Mean: +(9.7 * (filters.location === 'North Research Park' ? 1.2 : 1.0)).toFixed(1),
      wind: 'NW 2.4 m/s',
      outlook: 'Stable'
    },
    assets: {
      conditionScore: 82,
      maintenanceDueCount: Math.round(18 * factor),
      unresolvedCount: Math.round(12 * factor),
      criticalTracked: 7,
      failuresTrendPer100: 16,
      calloutSavingRs: Math.round(46000 * factor)
    },
    mobility: {
      dailyEntries: Math.round(8420 * factor),
      typicalDelayMin: 6.4,
      parkingOccupiedPercent: 74,
      openCapacitySpaces: Math.round(318 / factor),
      garages: [
        { name: 'North Garage', percent: 88, status: 'high pressure' },
        { name: 'Library Court', percent: 81, status: 'filling' },
        { name: 'East Field', percent: 52, status: 'room' },
      ]
    },
    safety: {
      openReports: Math.round(18 * factor),
      highRiskZones: 3,
      inspectionsPercent: 82,
      anomaliesCount: 2,
      periodReportedIssues: Math.round(59 * periodMultiplier * factor)
    },
    climate: {
      preparednessIndex: 68,
      heatIndexC: 38,
      coolingLoadMw: +(1.84 * factor).toFixed(2),
      rainAlertMm: 46,
      rainAlertDuration: '6 hr'
    },
    sustainability: {
      score: 78.4,
      grade: 'B+',
      ghgEmissionsYearly: Math.round(1284 * factor),
      renewableElectricityPercent: 34.6,
      wasteDivertedPercent: 61.8,
      openImprovementActions: 12
    },
    actions: {
      openCount: 3,
      inProgressCount: 1,
      resolvedCount: 7,
      policyChecks: '4 / 4'
    },
    insights: {
      dailySavingRs: Math.round(5600 * factor),
      energyVariancePercent: '+4.8%'
    }
  };
};
