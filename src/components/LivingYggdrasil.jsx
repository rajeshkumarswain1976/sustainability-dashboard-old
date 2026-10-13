import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Brain,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Compass,
  Cpu,
  Database,
  ExternalLink,
  Eye,
  Filter,
  Flame,
  Globe2,
  HeartPulse,
  Info,
  Layers,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trees,
  UserCheck,
  Users,
  Workflow,
  X,
  Zap
} from 'lucide-react';
import KnowledgeBase3D from './KnowledgeBase3D';
import { SECTORS } from '../data/sectorFeatures';

// =========================================================================
// 1. DATA ONTOLOGY & HIERARCHY (4 SECTORS · LIVING SYSTEMS AGENTIC MIND TREE)
// Theme Palette:
// Canvas: #141D18 | Background: #101713 | Elevated: #202A23 | Secondary: #29352D
// Text Primary: #F2F0E7 | Text Secondary: #A5B1A5 | KB Core: #B83A2F
// Campus: #69B88A | Civic: #D7A34B | Hospital: #54B8C1 | Intelligence: #A58AD6
// =========================================================================

export { SECTORS } from '../data/sectorFeatures';

export const ALL_NODES = Object.values(SECTORS).flatMap(s => s.nodes);
export const DOMAINS = SECTORS;

// =========================================================================
// 2. MAIN COMPONENT: LIVING SYSTEMS AGENTIC MIND TREE V3.0
// =========================================================================

export default function LivingAgenticCore({
  className = '',
  view = 'welcome',
  activeWorld = null,
  onboardingStage = null,
  focusedSector = null,
  heroBelowHeader = null,
  onSelectAgent,
  onSelectSectorNode,
  onGoToDashboards,
  onReturnToWelcome
}) {
  const containerRef = useRef(null);

  const normalizeSectorId = useCallback((id) => {
    if (!id) return null;
    if (id === 'enterprise' || id === 'civic') return 'enterprise';
    return SECTORS[id] ? id : null;
  }, []);

  const isCoreAndSectorsOnly = onboardingStage === 'institution' || onboardingStage === 'worlds';
  const isWorldsStage = false;
  const isSectorOnboarding = onboardingStage === 'sector' || onboardingStage === 'login';
  const mappedFocusedSector = normalizeSectorId(focusedSector) || 'campus';

  // Dynamic Sector Selection (Starts unselected (null) for pure resting state)
  const [selectedSector, setSelectedSector] = useState(null);

  // Activation sequence: luminous energy pulse travelling from KB outward
  const [isActivating, setIsActivating] = useState(false);
  const [activatedSector, setActivatedSector] = useState(null);
  const activationTimerRef = useRef(null);

  // Selected & Hovered Node
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);

  // Filter state
  const [sectorFilter, setSectorFilter] = useState('all');

  // Search dialog
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Expanded sub-feature index in details panel
  const [expandedSubfeature, setExpandedSubfeature] = useState(null);

  // Camera Pan & Zoom state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.85);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  // Restore active sector/node when returning from dashboard
  useEffect(() => {
    if (onboardingStage) return;
    try {
      const savedSector = normalizeSectorId(sessionStorage.getItem('mindtree_active_sector'));
      const savedNodeId = sessionStorage.getItem('mindtree_active_node');
      if (savedSector && SECTORS[savedSector]) {
        setSelectedSector(savedSector);
        setSectorFilter(savedSector);
        setActivatedSector(savedSector);
        if (savedNodeId) {
          const found = ALL_NODES.find(n => n.id === savedNodeId);
          if (found) setSelectedNode(found);
        }
        sessionStorage.removeItem('mindtree_active_sector');
        sessionStorage.removeItem('mindtree_active_node');
      }
    } catch {}
  }, [onboardingStage, normalizeSectorId]);

  // =========================================================================
  // SECTOR SELECTION WITH LUMINOUS KNOWLEDGE BASE ENERGY ROUTING (SECTION 4)
  // =========================================================================
  const handleSelectSector = useCallback((rawSectorId, keepNode = null) => {
    if (activationTimerRef.current) {
      clearTimeout(activationTimerRef.current);
    }

    const sectorId = normalizeSectorId(rawSectorId);

    if (!sectorId) {
      // Deselect and restore calm resting state
      setSelectedSector(null);
      setActivatedSector(null);
      setIsActivating(false);
      setSelectedNode(null);
      setSectorFilter('all');
      return;
    }

    setSelectedSector(sectorId);
    setSectorFilter(sectorId);
    if (keepNode) {
      setSelectedNode(keepNode);
    }
    setIsActivating(true);
    setActivatedSector(sectorId); // Immediate signal activation to subnodes

    activationTimerRef.current = setTimeout(() => {
      setIsActivating(false);
      setActivatedSector(sectorId);
    }, 600);
  }, [normalizeSectorId]);

  // Sync activeWorld prop when selected on Welcome page or dedicated sector view
  useEffect(() => {
    const mapped = normalizeSectorId(activeWorld);
    if (view && view.startsWith('sector-') && mapped) {
      handleSelectSector(mapped);
    }
  }, [view, activeWorld, normalizeSectorId, handleSelectSector]);

  // =========================================================================
  // RESPONSIVE SCREEN UTILISATION & DYNAMIC AUTO-FIT (SECTION 6 & 8)
  // Calculates bounding box of visible network so it occupies 80-88% of canvas
  // =========================================================================
  const recalculateFit = useCallback(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth || window.innerWidth;
    const h = containerRef.current.clientHeight || window.innerHeight;

    if (isCoreAndSectorsOnly) {
      // Zoom into Knowledge Base + 4 Sector Roots and frame them on the LEFT side (Selection Box is on the RIGHT)
      const coreZoom = Math.min(Math.max(Math.min((w * 0.56) / 920, h / 560), 0.72), 1.02);
      setZoom(coreZoom);
      setPan({ x: -w * 0.21, y: 0 });
      setSelectedSector(null);
      setActivatedSector(null);
      setIsActivating(false);
      return;
    }

    if (isSectorOnboarding && mappedFocusedSector && SECTORS[mappedFocusedSector]) {
      const targetS = SECTORS[mappedFocusedSector];
      const isLeftSector = targetS.hubX < 0;

      // Compute exact bounding box of Knowledge Base (0,0), Sector Hub, and all 6 Sub-Nodes
      const xs = [0, targetS.hubX, ...targetS.nodes.map(n => n.x)];
      const ys = [0, targetS.hubY, ...targetS.nodes.map(n => n.y)];
      const minX = Math.min(...xs) - 140;
      const maxX = Math.max(...xs) + 150;
      const minY = Math.min(...ys) - 65;
      const maxY = Math.max(...ys) + 85;

      const boxW = Math.max(maxX - minX, 720);
      const boxH = Math.max(maxY - minY, 480);
      const clusterCenterX = (minX + maxX) / 2;
      const clusterCenterY = (minY + maxY) / 2;

      const availableW = w * 0.50;
      const availableH = h * 0.80;
      const sectorZoom = Math.min(Math.max(Math.min(availableW / boxW, availableH / boxH), 0.56), 0.88);

      // Frame the active sector + KB + 6 sub-nodes on the LEFT half of the screen (-0.25*w),
      // while the "Active Mind-Tree Sector" box sits cleanly on the RIGHT side of the screen with zero overlap!
      const targetScreenOffsetX = isLeftSector ? -w * 0.24 : -w * 0.23;

      setZoom(sectorZoom);
      setPan({
        x: targetScreenOffsetX - clusterCenterX * sectorZoom,
        y: -clusterCenterY * sectorZoom
      });
      setSelectedSector(mappedFocusedSector);
      setSectorFilter(mappedFocusedSector);
      setActivatedSector(mappedFocusedSector);
      setIsActivating(false);
      return;
    }

    // Calculate visible bounds so all 24 nodes and 4 sectors fit cleanly
    const spanX = 1620;
    const spanY = 980;

    const scaleX = w / spanX;
    const scaleY = h / spanY;
    const autoZoom = Math.min(Math.max(Math.min(scaleX, scaleY) * 0.94, 0.62), 1.0);

    setZoom(autoZoom);
    setPan({ x: 0, y: 0 });
  }, [isCoreAndSectorsOnly, isWorldsStage, isSectorOnboarding, mappedFocusedSector, focusedSector, normalizeSectorId]);

  useEffect(() => {
    recalculateFit();
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => recalculateFit());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [recalculateFit, selectedNode, onboardingStage, focusedSector]);

  // Keyboard shortcut for search (/) and Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && !searchOpen && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
        if (selectedNode) setSelectedNode(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen, selectedNode]);

  const handleDeselectAll = useCallback(() => {
    handleSelectSector(null);
  }, [handleSelectSector]);

  // Camera Pan & Drag
  const handlePointerDown = (e) => {
    if (e.target.closest('button') || e.target.closest('.inspector-drawer') || e.target.closest('.search-modal')) {
      return;
    }
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y };
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom(prev => Math.min(2.2, Math.max(0.45, prev * factor)));
  };

  const handleCenterKB = () => {
    setPan({ x: 0, y: 0 });
  };

  // Search results (includes all 24 operational job nodes and sector matching)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return ALL_NODES.slice(0, 12);
    const q = searchQuery.toLowerCase();
    return ALL_NODES.filter(n =>
      n.name.toLowerCase().includes(q) ||
      n.code.toLowerCase().includes(q) ||
      n.description.toLowerCase().includes(q) ||
      (SECTORS[n.sectorId]?.name || '').toLowerCase().includes(q) ||
      n.tools.some(t => t.toLowerCase().includes(q)) ||
      n.subskills.some(s => s.name.toLowerCase().includes(q))
    ).slice(0, 14);
  }, [searchQuery]);

  return (
    <div className={`relative w-full h-full flex flex-col overflow-hidden select-none bg-[#09090b] text-[#F4F4F5] ${className}`}>
      {/* =========================================================================
          TOP CHROME (BRAND, SECTOR FILTERS, SEARCH, PORTAL NAVIGATION)
          ========================================================================= */}
      {!onboardingStage && (
      <header className="h-16 px-6 shrink-0 z-30 flex items-center justify-between gap-4 border-b border-[#18181b] bg-[#09090b]/95 backdrop-blur-md">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#B83A2F] text-white shadow-md shadow-[#B83A2F]/30 border border-[#F16B4F]/50">
            <Brain size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-widest uppercase text-[#F2F0E7]">
                Agenexus
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#202A23] text-[#69B88A] font-mono border border-[#2E3D32]">
                Mind Tree v3.0
              </span>
            </div>
            <div className="text-[11px] text-[#A5B1A5] font-medium hidden sm:block">
              Facility intelligence & sustainability
            </div>
          </div>
        </div>

        {/* Center: Sector Filters (Synchronized with graph state) */}
        <div className="hidden lg:flex items-center gap-1.5 bg-[#141D18] border border-[#202A23] p-1.5 rounded-2xl shadow-inner">
          <button
            onClick={() => handleSelectSector(null)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
              selectedSector === null
                ? 'bg-[#202A23] text-[#F2F0E7] border border-[#2E3D32] shadow-sm'
                : 'text-[#A5B1A5] hover:text-[#F2F0E7] hover:bg-[#202A23]/50'
            }`}
          >
            All Sectors (Resting)
          </button>
          {Object.values(SECTORS).map(s => {
            const isSelected = selectedSector === s.id;
            return (
              <button
                key={s.id}
                onClick={() => handleSelectSector(isSelected ? null : s.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'text-white shadow-sm font-bold border'
                    : 'text-[#A5B1A5] hover:text-[#F2F0E7] hover:bg-[#202A23]/50'
                }`}
                style={{
                  backgroundColor: isSelected ? s.color : 'transparent',
                  borderColor: isSelected ? s.borderColor : 'transparent'
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: isSelected ? '#FFFFFF' : s.color }}
                />
                <span>{s.name}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Search, Dashboards Jump, Intro Return */}
        <div className="flex items-center gap-2">
          {/* Search Trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 bg-[#141D18] hover:bg-[#202A23] border border-[#202A23] hover:border-[#2E3D32] px-3.5 py-2 rounded-xl text-xs text-[#A5B1A5] hover:text-[#F2F0E7] shadow-sm transition-all"
            title="Search features, data & solutions (/)"
          >
            <Search size={14} className="text-[#69B88A]" />
            <span className="hidden sm:inline">Search features...</span>
            <kbd className="px-1.5 py-0.5 rounded bg-[#202A23] border border-[#2E3D32] text-[10px] font-mono text-[#A5B1A5]">
              /
            </kbd>
          </button>

          {/* Jump to Dashboards */}
          {onGoToDashboards && (
            <button
              onClick={() => onGoToDashboards(selectedNode || selectedSector)}
              className="flex items-center gap-1.5 bg-[#202A23] hover:bg-[#29352D] text-[#F2F0E7] border border-[#2E3D32] px-3.5 py-2 rounded-xl text-xs font-bold tracking-wider uppercase transition-all shadow-sm"
            >
              <span>Dashboards</span>
              <ArrowRight size={13} className="text-[#69B88A]" />
            </button>
          )}

          {/* Return to Intro Landing */}
          {onReturnToWelcome && (
            <button
              onClick={onReturnToWelcome}
              className="hidden sm:flex items-center gap-1 bg-[#141D18] hover:bg-[#202A23] border border-[#202A23] px-3 py-2 rounded-xl text-xs text-[#A5B1A5] hover:text-[#F2F0E7] transition-all"
              title="Return to Welcome Portal"
            >
              <span>Intro</span>
            </button>
          )}
        </div>
      </header>
      )}

      {!onboardingStage && heroBelowHeader && (
        <div className="shrink-0 z-20 border-b border-[#18181b] bg-[#070908]/95">
          {heroBelowHeader}
        </div>
      )}

      {/* =========================================================================
          MAIN APPLICATION AREA: DEDICATED GRAPH CANVAS + DETAILS PANEL SPLIT
          Desktop: Graph Canvas (68-70%) | Details Panel (30-32%) (SECTION 8)
          ========================================================================= */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {/* GRAPH CANVAS COLUMN WITH SUBTLE AMBIENT RADIAL DEPTH */}
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
          className="flex-1 h-full relative overflow-hidden cursor-grab active:cursor-grabbing bg-[#08090A] transition-all duration-300"
          style={{
            backgroundImage: `
              radial-gradient(circle at 50% 50%, rgba(184, 58, 47, 0.12) 0%, transparent 350px),
              radial-gradient(circle at 25% 30%, rgba(105, 184, 138, 0.08) 0%, transparent 320px),
              radial-gradient(circle at 75% 30%, rgba(215, 163, 75, 0.08) 0%, transparent 320px),
              radial-gradient(circle at 75% 70%, rgba(84, 184, 193, 0.08) 0%, transparent 320px),
              radial-gradient(circle at 25% 70%, rgba(165, 138, 214, 0.08) 0%, transparent 320px),
              radial-gradient(circle, rgba(255, 255, 255, 0.06) 1px, transparent 1px)
            `,
            backgroundSize: '100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%, 28px 28px'
          }}
        >
          {/* CONSTELLATION CONTAINER (ANCHORED AT EXACT 50%, 50%) */}
          <div
            className="absolute left-1/2 top-1/2 w-0 h-0 origin-center transition-transform duration-300 pointer-events-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
            }}
          >
            {/* SVG ORGANIC BEZIER CONNECTION LINES & ENERGY ANIMATION */}
            <svg
              className="absolute pointer-events-none overflow-visible"
              style={{ left: 0, top: 0, width: 1, height: 1 }}
            >
              <defs>
                {/* Luminous energy pulse glow filter */}
                <filter id="energy-beam-glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="4.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="bright-pulse-dot" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3.0" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* 1. CONNECTIONS FROM KNOWLEDGE BASE (0,0) TO 4 SECTOR ROOT HUBS */}
              {Object.values(SECTORS).map((s, sIdx) => {
                const effectiveSelected = isSectorOnboarding ? mappedFocusedSector : selectedSector;
                const effectiveActivated = isSectorOnboarding ? mappedFocusedSector : activatedSector;
                const isThisSelected = effectiveSelected === s.id;
                const isThisActivated = effectiveActivated === s.id;

                if (isSectorOnboarding && !isThisSelected) return null;

                // Organic cubic Bézier spline connecting KB (0,0) to Sector Hub
                const cp1X = s.hubX * 0.45;
                const cp1Y = s.hubY * 0.15;
                const cp2X = s.hubX * 0.65;
                const cp2Y = s.hubY * 0.85;
                const pathD = `M 0 0 C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${s.hubX} ${s.hubY}`;

                return (
                  <g key={`kb-branch-${s.id}`}>
                    {/* Structural connection line */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={isThisSelected ? s.borderColor : s.borderColor}
                      strokeWidth={isThisSelected ? '3.5' : '2.2'}
                      strokeLinecap="round"
                      opacity={effectiveSelected === null ? 0.65 : isThisSelected ? 1.0 : 0.22}
                      className="transition-all duration-300"
                    />

                    {/* Illuminated energy artery when selected */}
                    {isThisSelected && isThisActivated && (
                      <g>
                        <path
                          d={pathD}
                          fill="none"
                          stroke={s.color}
                          strokeWidth="4"
                          strokeLinecap="round"
                          filter="url(#energy-beam-glow)"
                          opacity="0.9"
                        />
                        <path
                          d={pathD}
                          fill="none"
                          stroke="#FFF"
                          strokeWidth="2"
                          strokeLinecap="round"
                          opacity="0.95"
                        />
                      </g>
                    )}

                    {/* CONTINUOUS LIVELY ENERGY FLOW FROM KNOWLEDGE BASE TO SECTORS */}
                    {(effectiveSelected === null || isThisSelected || isCoreAndSectorsOnly || isWorldsStage) && (
                      <g>
                        <path
                          d={pathD}
                          fill="none"
                          stroke={isThisSelected ? '#F16B4F' : s.color}
                          strokeWidth={isThisSelected ? '4.5' : '3.2'}
                          strokeLinecap="round"
                          strokeDasharray="55 305"
                          filter="url(#energy-beam-glow)"
                          opacity={isThisSelected ? '0.95' : '0.85'}
                        >
                          <animate
                            attributeName="stroke-dashoffset"
                            from="360"
                            to="0"
                            dur={isThisSelected ? '1.2s' : `${2.0 + sIdx * 0.25}s`}
                            repeatCount="indefinite"
                          />
                        </path>
                        <circle
                          r={isThisSelected ? '7' : '5.5'}
                          fill="#FFF"
                          stroke={isThisSelected ? '#F16B4F' : s.color}
                          strokeWidth="2.5"
                          filter="url(#bright-pulse-dot)"
                        >
                          <animateMotion
                            path={pathD}
                            dur={isThisSelected ? '1.2s' : `${2.0 + sIdx * 0.25}s`}
                            repeatCount="indefinite"
                          />
                        </circle>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* 2. FEEDER LINES & CONTINUOUS ENERGY FLOW FROM SECTOR HUBS TO ALL 24 OPERATIONAL JOB NODES */}
              {!isCoreAndSectorsOnly && Object.values(SECTORS).map(s => {
                const effectiveSelected = isSectorOnboarding ? mappedFocusedSector : selectedSector;
                const effectiveActivated = isSectorOnboarding ? mappedFocusedSector : activatedSector;
                const isThisSelected = effectiveSelected === s.id;
                const isThisActivated = effectiveActivated === s.id;

                if (isSectorOnboarding && !isThisSelected) return null;

                return s.nodes.map((node, idx) => {
                  const isNodeSelected = selectedNode?.id === node.id;
                  const isParentSectorSelected = isThisSelected;

                  // Organic curved Bézier spline
                  const dx = node.x - s.hubX;
                  const dy = node.y - s.hubY;
                  const cpX = s.hubX + dx * 0.5 - dy * 0.12;
                  const cpY = s.hubY + dy * 0.5 + dx * 0.12;
                  const pathD = `M ${s.hubX} ${s.hubY} Q ${cpX} ${cpY}, ${node.x} ${node.y}`;

                  return (
                    <g key={`job-feeder-${node.id}`}>
                      {/* Continuous visible relationship line */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke={isNodeSelected ? '#FFFFFF' : isParentSectorSelected ? s.color : s.borderColor}
                        strokeWidth={isNodeSelected ? '2.8' : isParentSectorSelected ? '2.2' : '1.4'}
                        strokeDasharray={isNodeSelected || isThisActivated || isParentSectorSelected ? 'none' : '4 3'}
                        opacity={isNodeSelected ? 1.0 : isParentSectorSelected ? 0.92 : effectiveSelected === null ? 0.58 : 0.28}
                        strokeLinecap="round"
                        className="transition-all duration-300"
                      />

                      {/* Animated Energy Beam when sector is selected */}
                      {isParentSectorSelected && (
                        <path
                          d={pathD}
                          fill="none"
                          stroke={s.color}
                          strokeWidth="3.2"
                          strokeLinecap="round"
                          strokeDasharray="36 220"
                          filter="url(#energy-beam-glow)"
                          opacity="0.9"
                        >
                          <animate
                            attributeName="stroke-dashoffset"
                            from="256"
                            to="0"
                            dur={`${1.1 + idx * 0.12}s`}
                            repeatCount="indefinite"
                          />
                        </path>
                      )}

                      {/* Continuous Energy Flow Animation from Sector Hub to Job Nodes */}
                      {(effectiveSelected === null || isParentSectorSelected || isNodeSelected || isWorldsStage) && (
                        <circle
                          r={isNodeSelected ? 5.0 : isParentSectorSelected ? 4.5 : 3.2}
                          fill={isNodeSelected || isParentSectorSelected ? '#FFFFFF' : s.color}
                          stroke={s.color}
                          strokeWidth={isParentSectorSelected ? '1.8' : '0'}
                          filter="url(#bright-pulse-dot)"
                          opacity={isNodeSelected || isParentSectorSelected ? 1.0 : 0.85}
                        >
                          <animateMotion
                            path={pathD}
                            dur={isNodeSelected ? '0.7s' : isParentSectorSelected ? `${1.0 + idx * 0.14}s` : `${2.2 + (idx % 3) * 0.45}s`}
                            repeatCount="indefinite"
                          />
                        </circle>
                      )}
                    </g>
                  );
                });
              })}
            </svg>

            {/* =====================================================================
                CENTRAL KNOWLEDGE BASE (SUPPLIED IMAGE AS CENTRAL ASSET · PART 3)
                Dominant terracotta/crimson anchor with outer activation rings
                ===================================================================== */}
            <div
              onClick={handleDeselectAll}
              className="absolute pointer-events-auto flex flex-col items-center justify-center cursor-pointer group z-30 transition-transform duration-200 hover:scale-105"
              style={{ transform: 'translate(-50%, -50%)' }}
              title="Central Knowledge Base · Click to view initial resting network"
            >
              {/* Outer Activation & Glow Rings */}
              <div className="relative flex items-center justify-center">
                {/* Secondary outer activation ring */}
                <div
                  className={`absolute w-36 h-36 rounded-full border border-[#B83A2F]/40 transition-all duration-500 pointer-events-none ${
                    isActivating ? 'scale-110 border-[#F16B4F] shadow-[0_0_35px_#F16B4F]' : 'scale-100 opacity-60'
                  }`}
                />

                {/* Concentric red aura ring */}
                <div
                  className={`absolute w-32 h-32 rounded-full border border-[#B83A2F]/30 transition-all duration-300 pointer-events-none ${
                    isActivating ? 'scale-105 border-[#F16B4F]/70' : 'scale-100 opacity-40'
                  }`}
                />

                {/* Central Knowledge Base Disc with LIVE CONTINUOUS 3D THREE.JS STRUCTURE */}
                <div
                  className="relative flex items-center justify-center w-28 h-28 rounded-full shadow-2xl overflow-hidden transition-all"
                  style={{
                    background: 'radial-gradient(circle at 45% 40%, #202A23 0%, #151D18 70%, #0E1410 100%)',
                    border: '2.5px solid #F16B4F',
                    boxShadow: '0 0 45px rgba(184, 58, 47, 0.45), 0 12px 28px rgba(0, 0, 0, 0.7)'
                  }}
                >
                  {/* Live 3D continuous wireframe structure using Three.js from user image */}
                  <KnowledgeBase3D size={112} className="w-full h-full" />

                  {/* Subtle red core overlay ring */}
                  <div className="absolute inset-0 rounded-full border border-[#F16B4F]/40 pointer-events-none" />
                </div>
              </div>

              {/* Permanent Label: KNOWLEDGE BASE · Connected Data & Operational Context */}
              <div className="mt-3.5 text-center whitespace-nowrap pointer-events-none">
                <span className="text-[11px] font-black tracking-widest uppercase px-3.5 py-1 rounded-full shadow-lg bg-[#202A23] text-[#F2F0E7] border border-[#B83A2F]/70 inline-block">
                  KNOWLEDGE BASE
                </span>
                <div className="text-[10px] text-[#A5B1A5] font-semibold mt-1 tracking-wide">
                  Connected Data & Operational Context
                </div>
              </div>
            </div>

            {/* =====================================================================
                THE FOUR SECTOR ROOT HUBS (COLLEGE, MUNICIPALITY, HOSPITAL, INTELLIGENCE)
                ===================================================================== */}
            {Object.values(SECTORS).map(s => {
              const effectiveSelected = isSectorOnboarding ? mappedFocusedSector : selectedSector;
              const effectiveActivated = isSectorOnboarding ? mappedFocusedSector : activatedSector;
              const isSelected = effectiveSelected === s.id;
              const isActivated = effectiveActivated === s.id;
              const Icon = s.icon;

              if (isSectorOnboarding && !isSelected) return null;

              return (
                <div
                  key={s.id}
                  onClick={() => {
                    if (isSectorOnboarding) {
                      handleSelectSector(s.id);
                    } else if (isWorldsStage && onSelectSectorNode) {
                      handleSelectSector(s.id);
                      onSelectSectorNode(s.id === 'civic' ? 'enterprise' : s.id);
                    } else {
                      handleSelectSector(isSelected ? null : s.id);
                      if (onSelectSectorNode) {
                        onSelectSectorNode(s.id === 'civic' ? 'enterprise' : s.id);
                      }
                    }
                  }}
                  className={`absolute pointer-events-auto flex flex-col items-center cursor-pointer transition-all duration-300 ${
                    effectiveSelected === null
                      ? 'opacity-95 hover:opacity-100 hover:scale-105'
                      : isSelected
                      ? 'opacity-100 scale-110'
                      : 'opacity-25 hover:opacity-60'
                  }`}
                  style={{
                    width: '74px',
                    height: '74px',
                    transform: `translate(${s.hubX}px, ${s.hubY}px) translate(-50%, -50%)`,
                    zIndex: isSelected ? 35 : 20
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Explore ${s.name} features`}
                  onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
                  title={`Explore ${s.name} features`}
                >
                  {/* Sector Root Circle Badge - centered directly at (s.hubX, s.hubY) */}
                  <div
                    className="relative flex items-center justify-center shrink-0 rounded-full transition-all shadow-md group mx-auto"
                    style={{
                      width: '74px',
                      height: '74px',
                      backgroundColor: isSelected ? s.color : '#202A23',
                      border: `2.5px solid ${s.color}`,
                      boxShadow: isSelected
                        ? `0 10px 30px ${s.glow}`
                        : '0 4px 14px rgba(0, 0, 0, 0.4)'
                    }}
                  >
                    <Icon
                      size={28}
                      style={{ color: isSelected ? '#101713' : s.color }}
                      className="transition-colors"
                    />

                    {/* Job Count Pip */}
                    <span
                      className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black shadow-sm font-mono"
                      style={{
                        backgroundColor: isSelected ? '#101713' : s.color,
                        color: isSelected ? s.color : '#101713'
                      }}
                    >
                      {s.badgeCount}
                    </span>
                  </div>

                  {/* SECTOR LABELS: Positioned directly below the 74x74 circle without shifting its center */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 text-center mt-2.5 whitespace-nowrap transition-all duration-300">
                    <div
                      className="text-xs font-bold tracking-wider uppercase px-2.5 py-1 rounded-full inline-block bg-[#202A23] shadow-md border"
                      style={{
                        color: s.color,
                        borderColor: isSelected ? s.color : '#2E3D32'
                      }}
                    >
                      {s.name}
                    </div>
                    <div className="text-[9px] text-[#A5B1A5] font-semibold mt-0.5">
                      {isActivated ? '● Branch Active' : `${s.badgeCount} Features & Solutions`}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* =====================================================================
                OPERATIONAL JOB NODES: HIERARCHICAL MIND-TREE BRANCHES
                ALL 24 EXISTING JOB NODES REMAIN VISIBLE AT ALL TIMES
                ===================================================================== */}
            {!isCoreAndSectorsOnly && Object.values(SECTORS).map(s => {
              const effectiveSelected = isSectorOnboarding ? mappedFocusedSector : selectedSector;
              const effectiveActivated = isSectorOnboarding ? mappedFocusedSector : activatedSector;
              const isSectorSelected = effectiveSelected === s.id;
              const isSectorActivated = effectiveActivated === s.id;

              if (isSectorOnboarding && !isSectorSelected) return null;

              return s.nodes.map((node, idx) => {
                const isNodeSelected = selectedNode?.id === node.id;
                const isNodeHovered = hoveredNode?.id === node.id;

                return (
                  <div
                    key={node.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNode(node);
                      if (onSelectAgent) onSelectAgent(node);
                      if (!isSectorSelected) {
                        handleSelectSector(s.id, node);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Explore ${node.name}`}
                    title={`${node.name}: ${node.summary}`}
                    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                    className={`absolute pointer-events-auto cursor-pointer transition-all duration-300 ${
                      isNodeSelected
                        ? 'opacity-100 scale-105'
                        : isSectorSelected
                        ? 'opacity-100 hover:scale-105'
                        : effectiveSelected === null
                        ? 'opacity-90 hover:opacity-100 hover:scale-105'
                        : 'opacity-40 hover:opacity-85'
                    }`}
                    style={{
                      transform: `translate(${node.x}px, ${node.y}px) translate(-50%, -50%)`,
                      zIndex: isNodeSelected ? 40 : isNodeHovered ? 35 : 22
                    }}
                  >
                    {/* Node Capsule Card with Real Full Name */}
                    <div
                      className={`relative flex items-center gap-2 px-3 py-1.5 rounded-2xl transition-all shadow-md ${isSectorOnboarding ? 'animate-pulse' : ''}`}
                      style={{
                        backgroundColor: isNodeSelected ? s.accentBg : '#121415',
                        border: `1.5px solid ${isNodeSelected ? '#FFFFFF' : isSectorSelected ? s.color : s.borderColor}`,
                        boxShadow: isNodeSelected
                          ? `0 0 25px ${s.color}, 0 4px 14px rgba(0,0,0,0.8)`
                          : isSectorActivated
                          ? `0 0 18px ${s.glow}`
                          : '0 2px 8px rgba(0, 0, 0, 0.6)',
                        animationDuration: isSectorOnboarding ? `${1.8 + (idx % 3) * 0.45}s` : undefined
                      }}
                    >
                      {/* Status Indicator Pip */}
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            node.status === 'deployed'
                              ? '#48BB78'
                              : '#ECC94B'
                        }}
                        title={`Status: ${node.statusLabel}`}
                      />

                      {/* Node Code */}
                      <span
                        className="text-[9px] font-mono font-bold tracking-tight"
                        style={{ color: isNodeSelected ? '#FFFFFF' : s.color }}
                      >
                        {node.code}
                      </span>

                      {/* Full Real Job Name */}
                      <span className="flex flex-col pr-1 whitespace-nowrap">
                        <span className="text-[11px] font-semibold text-[#F4F4F5]">{node.name}</span>
                        <span className="text-[9px] text-[#A5B1A5] mt-0.5">{node.summary}</span>
                      </span>
                    </div>
                  </div>
                );
              });
            })}
          </div>

          {/* BOTTOM FLOATING DOCK (SECTOR QUICK SELECT & CAMERA CONTROLS) */}
          {!onboardingStage && (
          <footer className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between gap-3 pointer-events-none">
            {/* Sector Quick Select Dock */}
            <nav
              className="flex items-center gap-1.5 bg-[#09090b]/90 backdrop-blur-md border border-[#1f2023] p-1.5 rounded-2xl shadow-lg pointer-events-auto"
              aria-label="Sector quick select"
            >
              {Object.values(SECTORS).map(s => {
                const isSelected = selectedSector === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleSelectSector(isSelected ? null : s.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'text-white shadow-sm font-bold border'
                        : 'text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#18181B]'
                    }`}
                    style={{
                      backgroundColor: isSelected ? s.color : 'transparent',
                      borderColor: isSelected ? s.borderColor : 'transparent'
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: isSelected ? '#FFFFFF' : s.color }}
                    />
                    <span className="hidden sm:inline">{s.name}</span>
                    <span className="sm:hidden">{s.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </nav>

            {/* Camera Zoom, Center & Fit Controls (PART 10) */}
            <div className="flex items-center gap-1 bg-[#09090b]/90 backdrop-blur-md border border-[#1f2023] p-1 rounded-2xl shadow-lg pointer-events-auto">
              <button
                onClick={() => setZoom(prev => Math.max(0.45, prev - 0.15))}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#18181B] font-bold text-sm transition-colors"
                title="Zoom Out"
              >
                −
              </button>
              <span className="text-xs font-mono font-bold text-[#F4F4F5] px-1.5 min-w-[44px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(prev => Math.min(2.2, prev + 0.15))}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#18181B] font-bold text-sm transition-colors"
                title="Zoom In"
              >
                +
              </button>
              <button
                onClick={recalculateFit}
                className="px-2.5 py-1 text-xs font-bold rounded-xl text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#18181B] transition-colors"
                title="Fit graph to visible bounds"
              >
                Fit
              </button>
              <button
                onClick={handleCenterKB}
                className="px-2.5 py-1 text-xs font-bold rounded-xl text-white bg-[#B83A2F]/80 hover:bg-[#B83A2F] transition-colors"
                title="Center Knowledge Base"
              >
                KB
              </button>
            </div>
          </footer>
          )}
        </div>

        {/* =====================================================================
            DEDICATED DETAILS PANEL COLUMN (DESKTOP: 30-32% · MOBILE: SHEET) (PART 8)
            ===================================================================== */}
        {selectedNode && (
          <aside aria-label="Feature details" className="absolute inset-x-0 bottom-0 max-h-[65%] sm:static sm:max-h-none w-full sm:w-[380px] lg:w-[420px] shrink-0 h-full bg-[#0a0a0c] border-l border-[#1f2023] shadow-2xl flex flex-col p-6 overflow-y-auto z-40 animate-in slide-in-from-right duration-300">
            {/* Header & Close Button */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: SECTORS[selectedNode.sectorId]?.color || '#69B88A' }}
                  >
                    {selectedNode.code}
                  </span>
                  <span className="text-[10px] font-semibold text-[#A5B1A5] bg-[#202A23] px-2.5 py-0.5 rounded-full border border-[#2E3D32]">
                    {selectedNode.statusLabel}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-[#F2F0E7] mt-2 leading-tight">
                  {selectedNode.name}
                </h3>
                <div className="text-[11px] text-[#A5B1A5] mt-0.5">
                  Sector: <strong>{SECTORS[selectedNode.sectorId]?.name}</strong>
                </div>
              </div>

              <button
                onClick={() => setSelectedNode(null)}
                className="p-1.5 rounded-full text-[#A5B1A5] hover:text-[#F2F0E7] hover:bg-[#202A23] transition-colors"
                title="Close inspection panel (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Description */}
            <div className="text-xs text-[#F2F0E7]/90 leading-relaxed bg-[#202A23] p-4 rounded-2xl border border-[#2E3D32] mt-4">
              {selectedNode.description}
            </div>

            {/* Replaces Comparison Box */}
            {selectedNode.solution && (
              <div className="p-3.5 rounded-2xl bg-[#2B2314] border border-[#5C451E] mt-3">
                <div className="text-[10px] font-bold tracking-wider uppercase text-[#D7A34B] mb-1 flex items-center gap-1.5">
                  <Zap size={13} />
                  Solution we provide:
                </div>
                <div className="text-xs text-[#F2F0E7]/90 font-medium leading-relaxed">
                  {selectedNode.solution}
                </div>
              </div>
            )}

            {/* Interactive Specific features Accordion */}
            {selectedNode.subskills && (
              <div className="mt-4">
                <div className="text-[10px] font-bold tracking-wider uppercase text-[#A5B1A5] mb-2">
                  Specific features ({selectedNode.subskills.length})
                </div>
                <div className="space-y-2">
                  {selectedNode.subskills.map((sub, idx) => {
                    const isExpanded = expandedSubfeature === idx;
                    return (
                      <div
                        key={idx}
                        onClick={() => setExpandedSubfeature(isExpanded ? null : idx)}
                        className="p-3 rounded-xl bg-[#202A23] border border-[#2E3D32] hover:border-[#69B88A]/50 cursor-pointer transition-all"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-[#F2F0E7]">
                          <span className="flex items-center gap-2">
                            <CheckCircle2 size={13} className="text-[#69B88A]" />
                            {sub.name}
                          </span>
                          <ChevronRight
                            size={14}
                            className={`text-[#A5B1A5] transition-transform ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          />
                        </div>
                        {isExpanded && (
                          <div className="text-[11px] text-[#A5B1A5] mt-2 pt-2 border-t border-[#2E3D32] leading-relaxed">
                            {sub.detail}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Connected Tool Protocols */}
            {selectedNode.tools && (
              <div className="mt-4">
                <div className="text-[10px] font-bold tracking-wider uppercase text-[#A5B1A5] mb-2">
                  Data used by this feature
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedNode.tools.map((t, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-[#202A23] border border-[#2E3D32] text-[#A5B1A5] font-mono"
                    >
                      ⚡ {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Button: Navigate directly to the corresponding operational dashboard */}
            <div className="pt-4 mt-auto">
              <button
                onClick={() => {
                  if (onGoToDashboards) {
                    onGoToDashboards(selectedNode);
                  }
                }}
                className="w-full py-3.5 rounded-2xl bg-[#181920] hover:bg-[#22242F] text-[#F4F4F5] border font-bold text-xs tracking-wider uppercase shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                style={{
                  borderColor: SECTORS[selectedNode.sectorId]?.color || '#69B88A',
                  boxShadow: `0 0 20px ${SECTORS[selectedNode.sectorId]?.glow || 'rgba(105, 184, 138, 0.3)'}`
                }}
              >
                <Activity size={15} style={{ color: SECTORS[selectedNode.sectorId]?.color || '#69B88A' }} />
                <span>Open {selectedNode.name} Dashboard</span>
                <ArrowRight size={14} style={{ color: SECTORS[selectedNode.sectorId]?.color || '#69B88A' }} />
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* =========================================================================
          GLOBAL SEARCH MODAL (PART 10)
          ========================================================================= */}
      {searchOpen && (
        <div
          onClick={() => setSearchOpen(false)}
          className="search-modal fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-[#1A241E] border border-[#2E3D32] rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="relative border-b border-[#2E3D32] p-3.5">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#69B88A]" />
              <input
                autoFocus
                type="text"
                placeholder="Search sectors, features, data or solutions..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && searchResults.length > 0) {
                    const topNode = searchResults[0];
                    setSearchOpen(false);
                    handleSelectSector(topNode.sectorId, topNode);
                    if (onGoToDashboards) onGoToDashboards(topNode);
                  }
                }}
                className="w-full pl-9 pr-8 py-2 bg-transparent text-sm text-[#F2F0E7] placeholder:text-[#A5B1A5]/60 focus:outline-none"
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A5B1A5] hover:text-[#F2F0E7]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Sector Redirect Pills inside Search Modal */}
            <div className="px-3.5 pt-2.5 pb-1.5 border-b border-[#2E3D32]/60 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#A5B1A5] mr-1">Sectors:</span>
              {Object.values(SECTORS).map(s => (
                <button
                  key={`search-sector-${s.id}`}
                  onClick={() => {
                    setSearchOpen(false);
                    handleSelectSector(s.id);
                    if (onGoToDashboards) onGoToDashboards(s.id);
                  }}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-xl border transition-all hover:scale-105 flex items-center gap-1.5"
                  style={{
                    backgroundColor: '#141D18',
                    borderColor: s.color,
                    color: s.color
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span>{s.name}</span>
                  <ArrowRight size={11} />
                </button>
              ))}
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {searchResults.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#A5B1A5]">
                  No matching features found
                </div>
              ) : (
                searchResults.map(node => (
                  <div
                    key={node.id}
                    onClick={() => {
                      setSearchOpen(false);
                      handleSelectSector(node.sectorId, node);
                      if (onGoToDashboards) {
                        onGoToDashboards(node);
                      }
                    }}
                    className="flex items-center justify-between p-3 rounded-2xl hover:bg-[#202A23] cursor-pointer transition-colors group"
                  >
                    <div>
                      <div className="text-xs font-bold text-[#F2F0E7] group-hover:text-white flex items-center gap-1.5">
                        <span>{node.name}</span>
                        <ArrowRight size={12} className="opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" style={{ color: SECTORS[node.sectorId]?.color }} />
                      </div>
                      <div className="text-[10px] text-[#A5B1A5]">
                        {SECTORS[node.sectorId]?.name} · {node.code}
                      </div>
                    </div>
                    <span
                      className="text-[10px] font-mono px-2.5 py-1 rounded-full text-white flex items-center gap-1"
                      style={{
                        backgroundColor: SECTORS[node.sectorId]?.color || '#48BB78'
                      }}
                    >
                      <span>Open</span>
                      <ArrowRight size={10} />
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
