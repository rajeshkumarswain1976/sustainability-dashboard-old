import React, { useState, useEffect } from 'react';
import ThreeCanvas from '../components/ThreeCanvas';
import { useDashboard } from '../context/DashboardContext';
import {USE_MOCK} from '../services/client';
import { 
  Flame, 
  ShieldCheck, 
  UserCheck, 
  Wrench, 
  ArrowRight, 
  Lock, 
  Mail, 
  Key, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';

export default function LoginPage() {
  const { login, PRESET_USERS } = useDashboard();
  
  // Animation intro phase state: 'intro' -> 'login'
  const [phase, setPhase] = useState('intro');
  const [selectedRoleKey, setSelectedRoleKey] = useState('admin');
  const [email, setEmail] = useState('admin@campusa.edu');
  const [password, setPassword] = useState(PRESET_USERS.admin.password);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync credentials when selecting a preset role card
  const handleSelectPreset = (key) => {
    setSelectedRoleKey(key);
    setErrorMsg('');
    const user = PRESET_USERS[key];
    if (user) {
      setEmail(user.email);
      setPassword(user.password);
    }
  };

  const handleLoginSubmit = (e) => {
    e?.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    setTimeout(() => {
      const success = login(email, password);
      setIsSubmitting(false);
      if (!success) {
        setErrorMsg('Invalid credentials. Please select one of the authorized campus roles.');
      }
    }, 600);
  };

  // Intro Splash View
  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-[#07080B] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden select-none">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-orange/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* 3D Three.js Animation in Center */}
        <div className="w-80 h-80 md:w-96 md:h-96 relative flex items-center justify-center">
          <ThreeCanvas className="w-full h-full" interactive={true} />
        </div>

        {/* Intro Meta & Headline */}
        <div className="text-center z-10 max-w-lg mt-2 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#171922] border border-[#272B3B] text-xs font-mono text-brand-orange">
            <span className="w-2 h-2 rounded-full bg-brand-orange animate-ping" />
            <span>Agenexus · Facility intelligence</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            Decarbonization & Operations Portal
          </h1>
          <p className="text-sm text-dark-300 leading-relaxed">
            Hourly dataset replay · Campus operations analytics · Demo role access.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => setPhase('login')}
              className="w-full sm:w-auto px-7 py-3 rounded-xl bg-gradient-to-r from-[#FF5500] to-[#FF3D00] text-white font-bold text-sm shadow-xl shadow-orange-500/30 hover:brightness-110 transition flex items-center justify-center gap-2 cursor-pointer group"
            >
              <span>Enter Secure Portal</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="absolute bottom-6 text-[11px] font-mono text-dark-500 text-center">
          Interactive WebGL 3D Powered by Three.js · Click & drag to rotate orbital nodes
        </div>
      </div>
    );
  }

  // Login View
  return (
    <div className="min-h-screen bg-[#0A0B0E] text-white flex flex-col lg:flex-row">
      
      {/* Left Column: Interactive 3D Canvas & Campus Information */}
      <div className="lg:w-1/2 p-8 lg:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#1F212C] bg-[#0E0F14] relative overflow-hidden">
        {/* Top Logo */}
        <div className="flex items-center gap-3 z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FF5500] to-[#FF3D00] flex items-center justify-center shadow-lg shadow-orange-500/25">
            <Flame className="w-5 h-5 fill-white" />
          </div>
          <div>
            <div className="text-lg font-bold text-white flex items-center gap-1.5">
              Agenexus <span className="text-[10px] bg-[#22242E] text-brand-orange px-1.5 py-0.5 rounded font-mono font-medium">OS</span>
            </div>
            <div className="text-xs text-dark-400">Sustainability & Facilities Operations</div>
          </div>
        </div>

        {/* Center 3D Globe with floating stats */}
        <div className="my-8 relative h-72 lg:h-96 flex items-center justify-center">
          <ThreeCanvas className="w-full h-full" interactive={true} />
          
          {/* Floating Pill Top Left */}
          <div className="absolute top-4 left-4 bg-[#14161E]/80 backdrop-blur-md border border-[#252838] p-3 rounded-xl text-xs space-y-1 shadow-lg pointer-events-none">
            <div className="text-dark-400 text-[10px] uppercase font-bold tracking-wider">Campus Health</div>
            <div className="text-white font-bold flex items-center gap-2">
              <span className="text-emerald-400">{USE_MOCK?'78.4 / 100':'Available after sign-in'}</span>
            </div>
          </div>

          {/* Floating Pill Bottom Right */}
          <div className="absolute bottom-4 right-4 bg-[#14161E]/80 backdrop-blur-md border border-[#252838] p-3 rounded-xl text-xs space-y-1 shadow-lg pointer-events-none">
            <div className="text-dark-400 text-[10px] uppercase font-bold tracking-wider">Live Load</div>
            <div className="text-white font-bold flex items-center gap-2">
              <span className="text-brand-orange font-mono">{USE_MOCK?'482 kW':'Available after sign-in'}</span>
              {USE_MOCK&&<span className="text-[10px] text-dark-300">(-6.8% vs prev)</span>}
            </div>
          </div>
        </div>

        {/* Bottom Banner */}
        <div className="z-10 p-4 bg-[#14151C] border border-[#232533] rounded-2xl flex items-center justify-between">
          <div className="text-xs text-dark-300">
            <strong className="text-white">Role-Based Access Governance:</strong> Permissions, location scopes, and action buttons adapt strictly to your login identity.
          </div>
          <button 
            onClick={() => setPhase('intro')}
            className="text-[11px] text-brand-orange hover:underline font-mono ml-4 shrink-0 cursor-pointer"
          >
            Replay 3D Intro ↺
          </button>
        </div>
      </div>

      {/* Right Column: Role Selection & Login Form */}
      <div className="lg:w-1/2 p-8 lg:p-12 flex flex-col justify-center max-w-xl mx-auto w-full">
        <div className="space-y-6">
          
          {/* Header */}
          <div>
            <span className="text-xs font-mono text-brand-orange uppercase font-bold tracking-wider">
              Secure Access Portal
            </span>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-white mt-1">Sign in to your account</h2>
            <p className="text-xs text-dark-400 mt-1">
              Select your role preset below or enter your campus credentials.
            </p>
          </div>

          {/* Quick Preset Role Selection Cards (Per PDF Roles & Permissions) */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-dark-400 uppercase tracking-wider flex items-center justify-between">
              <span>Authorized Campus Roles:</span>
              <span className="text-[10px] text-emerald-400 font-mono">1-Click Fast Select</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              
              {/* Role 1: Administrator */}
              <div
                onClick={() => handleSelectPreset('admin')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                  selectedRoleKey === 'admin'
                    ? 'bg-gradient-to-br from-[#1F1916] to-[#1C1818] border-brand-orange shadow-md shadow-orange-500/10'
                    : 'bg-[#14151C] hover:bg-[#1A1C24] border-[#222430]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <ShieldCheck className={`w-4 h-4 ${selectedRoleKey === 'admin' ? 'text-brand-orange' : 'text-dark-400'}`} />
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-brand-orange/20 text-brand-orange">
                    Full
                  </span>
                </div>
                <div className="text-xs font-bold text-white">Administrator</div>
                <div className="text-[10px] text-dark-400 mt-0.5 leading-snug">All dashboard pages & every location</div>
              </div>

              {/* Role 2: Department Head */}
              <div
                onClick={() => handleSelectPreset('head')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                  selectedRoleKey === 'head'
                    ? 'bg-gradient-to-br from-[#171E1C] to-[#131B18] border-emerald-500 shadow-md shadow-emerald-500/10'
                    : 'bg-[#14151C] hover:bg-[#1A1C24] border-[#222430]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <UserCheck className={`w-4 h-4 ${selectedRoleKey === 'head' ? 'text-emerald-400' : 'text-dark-400'}`} />
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                    Dept
                  </span>
                </div>
                <div className="text-xs font-bold text-white">Dept Head</div>
                <div className="text-[10px] text-dark-400 mt-0.5 leading-snug">Science & Academic zone</div>
              </div>

              {/* Role 3: Staff */}
              <div
                onClick={() => handleSelectPreset('staff')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                  selectedRoleKey === 'staff'
                    ? 'bg-gradient-to-br from-[#161B24] to-[#121620] border-sky-400 shadow-md shadow-sky-500/10'
                    : 'bg-[#14151C] hover:bg-[#1A1C24] border-[#222430]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Wrench className={`w-4 h-4 ${selectedRoleKey === 'staff' ? 'text-sky-400' : 'text-dark-400'}`} />
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400">
                    Tasks
                  </span>
                </div>
                <div className="text-xs font-bold text-white">Staff</div>
                <div className="text-[10px] text-dark-400 mt-0.5 leading-snug">Assigned tasks & location only</div>
              </div>

            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-dark-300 mb-1.5">Campus Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-dark-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@campusa.edu"
                  className="w-full bg-[#14151C] border border-[#232634] focus:border-brand-orange rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-dark-500 focus:outline-none transition"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-dark-300">Password</label>
                <button
                  type="button"
                  onClick={() => setErrorMsg('Password resets are managed by Campus IT; password recovery is not available in this demo.')}
                  className="text-[11px] text-dark-400 hover:text-white transition cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Key className="w-4 h-4 text-dark-400 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-[#14151C] border border-[#232634] focus:border-brand-orange rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-dark-500 focus:outline-none transition font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-dark-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-dark-400 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded accent-brand-orange bg-[#181A24]" />
                <span>Remember session for 12 hours</span>
              </label>
              <span className="font-mono text-[10px]">TLS 1.3 Encrypted</span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#FF5500] to-[#FF3D00] hover:brightness-110 text-white font-bold text-xs shadow-xl shadow-orange-500/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Authenticating...' : `Sign In as ${PRESET_USERS[selectedRoleKey]?.role || 'User'}`}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* PDF Permissions Summary Card */}
          <div className="p-3.5 bg-[#121319] border border-[#20222D] rounded-xl text-xs space-y-1.5">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-brand-orange" />
              <span>Active Role Scope: {PRESET_USERS[selectedRoleKey]?.name}</span>
            </div>
            <p className="text-[11px] text-dark-400 leading-relaxed">
              {selectedRoleKey === 'admin' && '• Administrator has full view and operational rights across all 12 modules, all campus zones, and can assign leads, verify work orders, and export full PDF audits.'}
              {selectedRoleKey === 'head' && '• Department Head has full control within Academic & Science blocks, can assign leads and submit actions, but cannot modify global campus sustainability roadmap targets.'}
              {selectedRoleKey === 'staff' && '• Staff sees assigned tasks only, can mark tasks In Progress/Done, can suggest actions (cannot direct-approve), and cannot access the strategic Sustainability governance page.'}
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
