import React, { useState, useEffect } from 'react';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  CheckCheck,
  Compass,
  Copy,
  ExternalLink,
  Factory,
  Eye,
  EyeOff,
  Globe2,
  HeartPulse,
  Landmark,
  Leaf,
  LockKeyhole,
  Mail,
  Moon,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
  Trees,
  UserRound,
  UsersRound,
  Volume2,
  VolumeX,
} from 'lucide-react';
import LivingYggdrasil, { DOMAINS } from '../components/LivingYggdrasil';
import { useDashboard } from '../context/DashboardContext';
import { sound } from '../services/sound';

function LinkedinIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
    </svg>
  );
}

const worlds = Object.values(DOMAINS).map(sector => ({
  id: sector.id,
  name: sector.name,
  descriptor: sector.subtitle,
  detail: sector.subtitle,
  icon: sector.icon,
  color: sector.color,
}));

const roles = [
  { id: 'admin', title: 'Administrator', summary: 'All modules and locations', icon: Landmark },
  { id: 'head', title: 'Department Head', summary: 'Manage your assigned division', icon: UsersRound },
  { id: 'staff', title: 'Staff', summary: 'Assigned work and locations', icon: UserRound },
];

const sensorSystems = [
  { name: 'Energy & climate', color: '#8BC9A0' },
  { name: 'Water & ground', color: '#72C6D1' },
  { name: 'Facilities & assets', color: '#E0B66F' },
  { name: 'Air & environment', color: '#C4A6D8' },
  { name: 'Safety & mobility', color: '#D1816D' },
  { name: 'Operations signals', color: '#D5CF85' },
];

const platformFeatures = [
  { title: 'Resource intelligence', text: 'Bring energy, water, waste and air signals into one operational view.', icon: Compass, world: 'campus' },
  { title: 'Places & assets', text: 'Understand building performance, maintenance needs and critical infrastructure.', icon: Building2, world: 'enterprise' },
  { title: 'Resilient environments', text: 'Connect climate, safety, mobility and occupant wellbeing signals.', icon: ShieldCheck, world: 'hospital' },
  { title: 'Action workflows', text: 'Turn verified signals into assigned, trackable work with clear ownership.', icon: CheckCircle2, world: 'campus' },
  { title: 'Live operations', text: 'Coordinate teams around the same location-aware operational picture.', icon: Factory, world: 'enterprise' },
  { title: 'Evidence & insight', text: 'Explore trends, compare baselines and make decisions with context.', icon: ArrowUpRight, world: 'hospital' },
];

const people = [
  {
    name: 'Rajesh Kumar Swain',
    role: 'Development team',
    email: 'rajeshkumarswain1976@gmail.com',
    linkedin: 'https://www.linkedin.com/search/results/all/?keywords=Rajesh%20Kumar%20Swain',
  },
  {
    name: 'Abankita Behera',
    role: 'Development team',
    email: 'abankita.behera@yggdrasil.systems',
    linkedin: 'https://www.linkedin.com/search/results/all/?keywords=Abankita%20Behera',
  },
  {
    name: 'Mohammad Jazbi',
    role: 'Development team',
    email: 'mohammad.jazbi@yggdrasil.systems',
    linkedin: 'https://www.linkedin.com/search/results/all/?keywords=Mohammad%20Jazbi',
  },
  {
    name: 'Harshvardhan Praharaj',
    role: 'Development team',
    email: 'harshvardhan.praharaj@yggdrasil.systems',
    linkedin: 'https://www.linkedin.com/search/results/all/?keywords=Harshvardhan%20Praharaj',
  },
  {
    name: 'Stiti Prgyna Sahu',
    role: 'Development team',
    email: 'stitiprgyna.sahu@yggdrasil.systems',
    linkedin: 'https://www.linkedin.com/search/results/all/?keywords=Stiti%20Prgyna%20Sahu',
  },
];

const worldDetails = {
  campus: {
    eyebrow: 'College operations',
    title: 'Make campus resources work better.',
    text: 'Connect classroom, lab and hostel utilisation with energy, water, waste, parking and campus risk. Identify capacity gaps, resource losses and work that needs attention.',
    signals: ['Classroom, lab & hostel use', 'Energy, water & waste', 'Parking, safety & climate'],
  },
  enterprise: {
    eyebrow: 'Municipal services',
    title: 'Keep public services moving.',
    text: 'Bring waste routes, collection schedules, civic water infrastructure, public traffic and asset condition into one service-area view. Plan maintenance and climate readiness with evidence.',
    signals: ['Waste routes & pickups', 'Water & civic assets', 'Traffic & flood readiness'],
  },
  hospital: {
    eyebrow: 'Hospital operations',
    title: 'Understand the facilities behind care.',
    text: 'Connect bed, ICU and operating-theatre utilisation with diagnostic equipment, critical power, water, air and biomedical waste. Highlight capacity pressure and facilities requiring attention.',
    signals: ['Bed, ICU & theatre use', 'Critical power & water', 'Equipment & biomedical waste'],
  },
  intelligence: {
    eyebrow: 'Shared facility intelligence',
    title: 'Turn connected data into useful action.',
    text: 'Normalise source data, replay historical readings, forecast demand and flag anomalies. Connect evidence to reviewed decisions, assigned work and explainable sustainability indicators.',
    signals: ['Historical data replay', 'Forecasts & alert evidence', 'Tracked actions & scores'],
  },
};

function WelcomeLanding({ isLight, selectedWorld, onSelectWorld, onEnter, onGoToDashboards }) {
  const [contact, setContact] = useState({ name: '', email: '', sector: 'campus', topic: 'Campus & Learning', message: '' });
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [contactResult, setContactResult] = useState(null);
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  const currentWorld = worlds.find(world => world.id === selectedWorld) || worlds[0];
  const detail = worldDetails[currentWorld.id];

  const contactTopics = [
    'Campus & Learning',
    'Municipal & Civic',
    'Healthcare Resilience',
    'Custom Integration',
  ];

  const selectWorld = (worldId) => {
    onSelectWorld(worldId);
    const index = worlds.findIndex(w => w.id === worldId);
    sound.playBranchSelect(index >= 0 ? index : 0);
    window.requestAnimationFrame(() => document.getElementById('world-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const submitContact = async (event) => {
    event.preventDefault();
    setIsSubmittingContact(true);

    const refCode = `YGG-${Math.floor(1000 + Math.random() * 9000)}-${contact.sector.toUpperCase()}`;
    const endpoint = import.meta.env.VITE_CONTACT_ENDPOINT;

    let deliveredLive = false;
    if (endpoint) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...contact, refCode, timestamp: new Date().toISOString() }),
        });
        if (response.ok) deliveredLive = true;
      } catch (err) {
        console.warn('Endpoint error, fallback to simulated delivery:', err);
      }
    } else {
      await new Promise(r => setTimeout(r, 600));
    }

    setContactResult({
      refCode,
      name: contact.name,
      email: contact.email,
      topic: contact.topic,
      message: contact.message,
      deliveredLive,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    setIsSubmittingContact(false);
    sound.playFormSuccess();
  };

  const copyReceipt = () => {
    if (!contactResult) return;
    const text = `Agenexus — Enquiry Receipt\nReference: ${contactResult.refCode}\nContact: ${contactResult.name} <${contactResult.email}>\nTopic: ${contactResult.topic}\nMessage: ${contactResult.message}\nReceived: ${contactResult.timestamp}`;
    navigator.clipboard?.writeText(text);
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2200);
  };

  return (
    <div className="welcome-site">
      <section className="landing-hero" id="home" style={{ paddingTop: '1rem' }}>
        <div className="landing-tree-frame relative w-full" style={{ height: 'clamp(920px, 102vh, 1180px)' }} aria-label="Agenexus sector features and solutions">
          <LivingYggdrasil
            className="w-full h-full"
            activeWorld={selectedWorld}
            onSelectSectorNode={onSelectWorld}
            heroBelowHeader={
              <div className="landing-hero-copy" style={{ padding: '1.35rem 1.5rem 1.15rem', margin: '0 auto' }}>
                <div className="journey-kicker"><span /> Stewardship for living systems</div>
                <h1>Better operations.<br /><em>A world in balance.</em></h1>
                <p>One connected platform for the places people depend on, for colleges, hospitals and municipalities.</p>
              </div>
            }
            onGoToDashboards={onGoToDashboards}
            onReturnToWelcome={() => {
              document.getElementById('world-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          />
        </div>

        <div className="landing-hero-actions">
          <span><i /> Living systems, seen together</span>
          <button className="journey-primary" onClick={onEnter}><span>Enter Agenexus</span><ArrowRight size={16} /></button>
          <span>Scroll to explore <ArrowDownRight size={14} /></span>
        </div>
      </section>

      <section className="landing-world-detail landing-section" id="world-detail" style={{ '--world-accent': currentWorld.color }}>
        <div className="section-index">01 / Choose a world</div>
        <div className="world-detail-grid">
          <div>
            <div className="journey-kicker"><span /> {detail.eyebrow}</div>
            <h2>{detail.title}</h2>
            <p>{detail.text}</p>
            <button className="journey-primary" onClick={onEnter}><span>Continue to access</span><ArrowRight size={16} /></button>
          </div>
          <div className="world-selector-list" aria-label="Select an operational sector">
            {worlds.map((world, index) => {
              const Icon = world.icon;
              return (
                <button
                  key={world.id}
                  className={`world-selector ${selectedWorld === world.id ? 'is-active' : ''}`}
                  style={{ '--choice-accent': world.color }}
                  onClick={() => selectWorld(world.id)}
                >
                  <span className="world-selector-number">0{index + 1}</span>
                  <Icon size={19} />
                  <span><strong>{world.name}</strong><small>{worldDetails[world.id].eyebrow}</small></span>
                  <ArrowUpRight size={16} />
                </button>
              );
            })}
            <div className="sector-signals">
              {detail.signals.map(signal => <span key={signal}>{signal}</span>)}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-about landing-section" id="about">
        <div className="section-index">02 / Why Agenexus</div>
        <div className="landing-about-grid">
          <h2>Places are connected.<br /><em>Operations should be too.</em></h2>
          <div>
            <p>Teams often work across separate systems for buildings, resources, risks and service requests. That makes it harder to spot what needs attention and coordinate the response.</p>
            <p>Agenexus brings those signals into a shared operational workspace, helping institutions understand their places, prioritize work and make progress visible.</p>
          </div>
        </div>
        <div className="problem-ribbon">
          <span><b>01</b> Fragmented operational data</span>
          <span><b>02</b> Reactive maintenance</span>
          <span><b>03</b> Unclear ownership</span>
          <span><b>04</b> Hard-to-measure progress</span>
        </div>
      </section>

      <section className="landing-features landing-section" id="platform">
        <div className="section-index">03 / One platform, many environments</div>
        <div className="section-heading-row">
          <div><div className="journey-kicker"><span /> Shared operational toolkit</div><h2>From signal to action.</h2></div>
          <p>The same connected features adapt to each institution and its operating context.</p>
        </div>
        <div className="feature-grid">
          {platformFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="feature-item" style={{ '--feature-accent': worlds.find(world => world.id === feature.world).color }}>
                <div className="feature-topline"><span>0{index + 1}</span><Icon size={19} /></div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            );
          })}
        </div>
        <div className="module-ribbon"><span>Energy</span><span>Water</span><span>Waste</span><span>Air</span><span>Assets</span><span>Mobility</span><span>Safety</span><span>Climate</span><span>Actions</span><span>Insights</span></div>
      </section>

      <section className="landing-team landing-section" id="team">
        <div className="section-index">04 / The people behind the platform</div>
        <div className="section-heading-row">
          <div><div className="journey-kicker"><span /> Built with care</div><h2>Meet the team.</h2></div>
          <p>Five collaborators bringing product thinking, engineering and care for the places we share.</p>
        </div>
        <div className="team-vertical-grid">
          {people.map((person, index) => (
            <div className="team-vertical-card" key={person.name}>
              <div className="team-card-top">
                <span className="team-number">0{index + 1}</span>
                <span className="team-monogram">
                  {person.name.split(' ').map(part => part[0]).slice(0, 2).join('')}
                </span>
              </div>
              <div className="team-card-info">
                <strong className="team-name">{person.name}</strong>
                <span className="team-role">{person.role}</span>
                <div className="team-social-row">
                  <a
                    href={`mailto:${person.email}`}
                    className="team-icon-btn"
                    title={`Email ${person.name} (${person.email})`}
                    aria-label={`Email ${person.name}`}
                  >
                    <Mail size={15} />
                    <span>Email</span>
                  </a>
                  <a
                    href={person.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="team-icon-btn"
                    title={`View ${person.name} on LinkedIn`}
                    aria-label={`${person.name} LinkedIn Profile`}
                  >
                    <LinkedinIcon size={15} />
                    <span>LinkedIn</span>
                  </a>
                </div>
                <a href={`mailto:${person.email}`} className="team-email" title={`Send email to ${person.name}`}>
                  <Mail size={12} />
                  <span>{person.email}</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-contact-section" id="contact">
        <div className="landing-contact-copy">
          <div className="journey-kicker"><span /> Let’s make places work better</div>
          <h2>Still have a question?</h2>
          <p>Tell us what your institution is working on. We’ll help you find the right path through the tree.</p>
          <span className="contact-email-cue"><Mail size={15} /> Contact the development team</span>
        </div>
        <form className="landing-contact-form" onSubmit={submitContact}>
          {contactResult ? (
            <div className="contact-receipt-card">
              <div className="contact-receipt-header">
                <span className="contact-receipt-code">{contactResult.refCode}</span>
                <span className="contact-receipt-status">
                  <CheckCircle2 size={14} />
                  <span>{contactResult.deliveredLive ? 'Live API Dispatched' : 'Enquiry Recorded (Preview)'}</span>
                </span>
              </div>
              <div className="contact-receipt-grid">
                <div>
                  <small style={{ color: '#8c9688', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sender & Organization</small>
                  <p><strong>{contactResult.name}</strong> · {contactResult.email}</p>
                </div>
                <div>
                  <small style={{ color: '#8c9688', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Institutional Scope</small>
                  <p>{contactResult.topic}</p>
                </div>
                <div>
                  <small style={{ color: '#8c9688', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Brief</small>
                  <p style={{ fontStyle: 'italic', color: '#b9c1b6' }}>“{contactResult.message}”</p>
                </div>
              </div>
              <div className="contact-receipt-actions">
                <button type="button" className="contact-receipt-btn" onClick={copyReceipt}>
                  {copiedReceipt ? <CheckCheck size={13} style={{ color: '#76B58F' }} /> : <Copy size={13} />}
                  <span>{copiedReceipt ? 'Receipt Copied' : 'Copy Confirmation'}</span>
                </button>
                <a
                  className="contact-receipt-btn"
                  href={`mailto:admin@campusa.edu?subject=Enquiry%20${contactResult.refCode}%20-%20${encodeURIComponent(contactResult.topic)}&body=${encodeURIComponent(`Hello Agenexus Team,\n\n${contactResult.message}\n\nFrom: ${contactResult.name} (${contactResult.email})\nRef: ${contactResult.refCode}`)}`}
                >
                  <ExternalLink size={13} />
                  <span>Send via Mail Client</span>
                </a>
                <button
                  type="button"
                  className="contact-receipt-btn"
                  onClick={() => {
                    setContactResult(null);
                    setContact({ name: '', email: '', sector: 'campus', topic: 'Campus & Learning', message: '' });
                  }}
                  style={{ marginLeft: 'auto' }}
                >
                  <span>New Note</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <span style={{ fontSize: '9px', color: '#aeb5ac', display: 'block', marginBottom: '6px' }}>What area does your enquiry relate to?</span>
                <div className="contact-topics">
                  {contactTopics.map(topic => (
                    <button
                      key={topic}
                      type="button"
                      className={`contact-topic-pill ${contact.topic === topic ? 'is-active' : ''}`}
                      onClick={() => setContact({ ...contact, topic })}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
              <label>
                <span>Your name</span>
                <input required value={contact.name} onChange={event => setContact({ ...contact, name: event.target.value })} placeholder="Dr. / Prof. / Full Name" />
              </label>
              <label>
                <span>Work email</span>
                <input required type="email" value={contact.email} onChange={event => setContact({ ...contact, email: event.target.value })} placeholder="you@organization.edu" />
              </label>
              <label>
                <span>What would you like to solve?</span>
                <textarea required rows="3" value={contact.message} onChange={event => setContact({ ...contact, message: event.target.value })} placeholder="Tell us a little about your places, challenges and operational priorities…" />
              </label>
              <button type="submit" className="journey-primary" disabled={isSubmittingContact}>
                <Send size={15} />
                <span>{isSubmittingContact ? 'Transmitting enquiry…' : 'Send message to stewards'}</span>
              </button>
            </>
          )}
        </form>
      </section>

      <footer className="landing-footer">
        <a className="journey-brand" href="#home"><span className="journey-brand-mark"><Leaf size={17} /></span><span><strong>Agenexus</strong><small>Facility intelligence</small></span></a>
        <span>Connected places. Considered action.</span>
        <div><a href="#about">About</a><a href="#platform">Platform</a><a href="#team">Team</a><a href="#contact">Contact</a></div>
        <small>© 2026 Agenexus · Campus A Sustainable Intelligence Platform</small>
      </footer>
    </div>
  );
}

export default function WelcomeJourney() {
  const {
    login,
    PRESET_USERS,
    institutionType,
    setInstitutionType,
    selectedWorld,
    setSelectedWorld,
    theme,
    setTheme,
    updateFilter,
    setCurrentPage,
  } = useDashboard();
  const [stage, setStage] = useState('welcome');
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setSplashFading(true), 2100);
    const hideTimer = window.setTimeout(() => setShowSplash(false), 2650);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  const handleGoToDashboards = (nodeOrSector) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (nodeOrSector && typeof nodeOrSector === 'string') {
      const targetWorld = nodeOrSector === 'campus' ? 'campus' : nodeOrSector === 'hospital' ? 'hospital' : nodeOrSector === 'intelligence' ? 'intelligence' : 'enterprise';
      setSelectedWorld(targetWorld);
      setCurrentPage(nodeOrSector === 'intelligence' ? 'insights' : 'overview');
      try {
        sessionStorage.setItem('mindtree_active_sector', nodeOrSector);
        sessionStorage.removeItem('mindtree_active_node');
      } catch {}
      sound.playStageAdvance();
      setStage('login');
      return;
    }
    if (nodeOrSector && typeof nodeOrSector === 'object' && nodeOrSector.sectorId) {
      const targetWorld = nodeOrSector.sectorId === 'campus' ? 'campus' : nodeOrSector.sectorId === 'hospital' ? 'hospital' : nodeOrSector.sectorId === 'intelligence' ? 'intelligence' : 'enterprise';
      setSelectedWorld(targetWorld);
      setCurrentPage(nodeOrSector.dashboardPage || 'overview');
      try {
        sessionStorage.setItem('mindtree_active_sector', nodeOrSector.sectorId);
        sessionStorage.setItem('mindtree_active_node', nodeOrSector.id);
      } catch {}
      sound.playStageAdvance();
      setStage('login');
      return;
    }
    sound.playStageAdvance();
    setStage('institution');
  };

  const [selectedRole, setSelectedRole] = useState('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeNav, setActiveNav] = useState(false);
  const [soundActive, setSoundActive] = useState(!sound.isMuted);
  const {demoMode}=useDashboard();
  useEffect(()=>{if(demoMode){setEmail(PRESET_USERS.admin.email);setPassword(PRESET_USERS.admin.password);}},[demoMode]);

  const activeWorld = worlds.find(world => world.id === selectedWorld) || worlds[0];
  const isLight = theme === 'light';
  const worldName = activeWorld.name;

  const activeSectorKey = selectedWorld === 'civic' ? 'enterprise' : (DOMAINS[selectedWorld] ? selectedWorld : 'campus');
  const activeSectorNodes = DOMAINS[activeSectorKey]?.nodes || [];

  const toggleSound = () => {
    const active = sound.toggleMute();
    setSoundActive(active);
  };

  const goTo = (nextStage) => {
    sound.playStageAdvance();
    setErrorMessage('');
    setStage(nextStage);
  };

  const chooseWorld = (worldId) => {
    setSelectedWorld(worldId);
    const index = worlds.findIndex(w => w.id === worldId);
    sound.playBranchSelect(index >= 0 ? index : 0);
    updateFilter('sector', worldId === 'campus' ? 'College' : worldId === 'hospital' ? 'Medical Center' : institutionType === 'public' ? 'Municipality' : 'Company');
    setStage('sector');
  };

  const previewWorld = (worldId) => {
    setSelectedWorld(worldId);
    const index = worlds.findIndex(w => w.id === worldId);
    sound.playBranchSelect(index >= 0 ? index : 0);
    updateFilter('sector', worldId === 'campus' ? 'College' : worldId === 'hospital' ? 'Medical Center' : institutionType === 'public' ? 'Municipality' : 'Company');
  };

  const chooseRole = (roleId) => {
    setSelectedRole(roleId);
    setEmail(PRESET_USERS[roleId].email);
    setPassword(PRESET_USERS[roleId].password);
    setErrorMessage('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
      if (selectedWorld === 'intelligence') {
        setCurrentPage('insights');
      }
      const success = await login(email, password);
      setIsSubmitting(false);
      if (!success) setErrorMessage('Sign-in failed. Check your email and password.');
  };

  const stageIndex = ['welcome', 'institution', 'worlds', 'sector', 'login'].indexOf(stage);
  const activeWorldDetails = worldDetails[selectedWorld] || worldDetails.campus;

  return (
    <main
      className={`journey-shell ${stage === 'welcome' ? 'has-landing' : ''} ${isLight ? 'journey-light' : 'journey-dark'}`}
      style={{ '--world-accent': activeWorld.color }}
    >
      {showSplash && (
        <div
          className={`company-welcome-splash ${splashFading ? 'is-fading' : ''}`}
          onClick={() => setShowSplash(false)}
          role="dialog"
          aria-label="Welcome to Agenexus"
        >
          <div className="company-welcome-inner">
            <div className="company-welcome-badge">
              <Leaf size={22} />
            </div>
            <span className="company-welcome-eyebrow">WELCOME TO</span>
            <h1 className="company-welcome-title">Agenexus</h1>
            <p className="company-welcome-subtitle">Facility intelligence & sustainability</p>
            <div className="company-welcome-progress">
              <span />
            </div>
          </div>
        </div>
      )}

      <div className="journey-grid" aria-hidden="true" />
      <div className="journey-vignette" aria-hidden="true" />

      <header className="journey-header">
        <button className="journey-brand" onClick={() => goTo('welcome')} aria-label="Return to welcome">
          <span className="journey-brand-mark"><Leaf size={17} /></span>
          <span>
            <strong>Agenexus</strong>
            <small>Facility intelligence</small>
          </span>
        </button>
        {stage === 'welcome' && (
          <nav className={`journey-nav ${activeNav ? 'is-open' : ''}`} aria-label="Main navigation">
            <a href="#about" onClick={() => setActiveNav(false)}>About</a>
            <a href="#platform" onClick={() => setActiveNav(false)}>Platform</a>
            <a href="#team" onClick={() => setActiveNav(false)}>Team</a>
            <a href="#contact" onClick={() => setActiveNav(false)}>Contact</a>
            <button onClick={() => { setActiveNav(false); goTo('institution'); }}>Enter portal <ArrowRight size={14} /></button>
          </nav>
        )}
        <div className="journey-header-right">
          <span className="journey-live"><i /> Living systems · {activeWorld.name}</span>
          {stage === 'welcome' && <button className="journey-mobile-menu" aria-label="Toggle navigation" onClick={() => setActiveNav(!activeNav)}>Menu</button>}
          <button
            type="button"
            className={`journey-sound-toggle ${soundActive ? 'is-active' : ''}`}
            onClick={toggleSound}
            aria-label={soundActive ? 'Mute ambient soundscape' : 'Enable ambient soundscape'}
            title={soundActive ? 'Ambient sound: Active (click to mute)' : 'Ambient sound: Muted (click to enable)'}
          >
            {soundActive ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span className="sound-bars" aria-hidden="true">
              <i /><i /><i />
            </span>
          </button>
          <button
            type="button"
            className="journey-theme-toggle"
            onClick={() => setTheme(isLight ? 'dark' : 'light')}
            aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
            title={`Switch to ${isLight ? 'dark' : 'light'} mode`}
          >
            {isLight ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>
      </header>

      {stage === 'welcome' ? (
        <WelcomeLanding
          isLight={isLight}
          selectedWorld={selectedWorld}
          onSelectWorld={previewWorld}
          onEnter={() => goTo('institution')}
          onGoToDashboards={handleGoToDashboards}
        />
      ) : (
        <>
        {/* Live Mind-Tree Stage: Zooms to KB + 4 Sectors on steps 1-2, and to the selected sector + 6 moving job nodes on steps 3-4 */}
        <div className="fixed inset-0 z-0 pointer-events-auto">
          <LivingYggdrasil
            className="w-full h-full"
            onboardingStage={stage}
            focusedSector={selectedWorld}
            onSelectSectorNode={chooseWorld}
          />
        </div>

        <div className="journey-progress relative z-10" aria-label={`Step ${stageIndex} of 4`}>
          {['Institution', 'Sector', 'Capabilities', 'Sign in'].map((label, index) => (
            <span key={label} className={stageIndex >= index + 1 ? 'is-reached' : ''}>
              <i>{stageIndex > index + 1 ? <Check size={11} /> : index + 1}</i>
              {label}
            </span>
          ))}
        </div>

      <section
        className={`journey-content stage-${stage} relative z-10 pointer-events-none`}
        style={{
          width: '100%',
          maxWidth: '100%',
          padding: '0 3vw',
          justifyContent: 'flex-end'
        }}
      >
        {stage === 'institution' && (
          <div className="choice-panel root-panel journey-enter pointer-events-auto" style={{ width: 'min(580px, 46vw)', padding: '32px 34px', margin: 0 }}>
            <button className="journey-back" onClick={() => goTo('welcome')}><ArrowLeft size={15} /> Back to the system</button>
            <div className="journey-kicker"><span /> Knowledge Base Core</div>
            <h1 style={{ fontSize: 'clamp(34px, 3.4vw, 48px)' }}>Who does your network serve?</h1>
            <p className="journey-intro">Start with the institution type. The central Knowledge Base will route signals to your operational sector.</p>
            <div className="institution-options">
              <button
                className={`institution-choice ${institutionType === 'public' ? 'is-selected' : ''}`}
                onClick={() => { setInstitutionType('public'); goTo('worlds'); }}
              >
                <span className="choice-icon"><Landmark size={21} /></span>
                <span className="choice-copy"><strong>Government / Public</strong><small>Public institutions and civic services</small></span>
                <ArrowDownRight size={16} />
              </button>
              <button
                className={`institution-choice ${institutionType === 'private' ? 'is-selected' : ''}`}
                onClick={() => { setInstitutionType('private'); goTo('worlds'); }}
              >
                <span className="choice-icon"><Building2 size={21} /></span>
                <span className="choice-copy"><strong>Private institution</strong><small>Independent organizations and operators</small></span>
                <ArrowDownRight size={16} />
              </button>
            </div>
            <div className="root-network-key">
              <div><span className="journey-kicker"><span /> Knowledge Base Signal Mesh</span><small>Connected domains · shared location context</small></div>
              <div className="root-node-list">
                {sensorSystems.map(system => <span key={system.name} style={{ '--node-color': system.color }}><i />{system.name}</span>)}
              </div>
            </div>
            <div className="root-annotation"><span /> Shared operational context <b>·</b> Cross-sector data <b>·</b> Historical data replay</div>
          </div>
        )}

        {stage === 'worlds' && (
          <div className="choice-panel canopy-panel journey-enter pointer-events-auto" style={{ width: 'min(580px, 46vw)', padding: '32px 34px', margin: 0 }}>
            <button className="journey-back" onClick={() => goTo('institution')}><ArrowLeft size={15} /> Back to Knowledge Base</button>
            <div className="journey-kicker"><span /> Sector Nodes · {institutionType === 'public' ? 'Public institution' : 'Private institution'}</div>
            <h1 style={{ fontSize: 'clamp(34px, 3.4vw, 48px)' }}>Choose your sector.</h1>
            <p className="journey-intro">Select a sector to explore its specific features and the solutions Agenexus provides.</p>
            <div className="world-options">
              {worlds.map((world, index) => {
                const Icon = world.icon;
                const description = world.detail;
                return (
                  <button
                    key={world.id}
                    className="world-choice"
                    style={{ '--choice-accent': world.color, '--choice-order': index }}
                    onClick={() => chooseWorld(world.id)}
                  >
                    <span className="world-orbit"><i /><Icon size={21} /></span>
                    <span className="world-copy">
                      <small>{world.descriptor}</small>
                      <strong>{world.name}</strong>
                      <span>{description}</span>
                    </span>
                    <ArrowRight className="world-arrow" size={17} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {stage === 'sector' && (
          <div
            className="choice-panel sector-focus-panel journey-enter pointer-events-auto"
            style={{
              '--world-accent': activeWorld.color,
              width: 'min(560px, 45vw)',
              padding: '32px 34px',
              margin: 0
            }}
          >
            <button className="journey-back" onClick={() => goTo('worlds')}><ArrowLeft size={15} /> Choose another sector</button>
            <div className="journey-kicker"><span /> Agenexus Sector · {activeWorldDetails.eyebrow}</div>
            <h1 style={{ fontSize: 'clamp(34px, 3.4vw, 48px)' }}>{worldName}</h1>
            <p className="journey-intro">{activeWorldDetails.text}</p>
            <div className="sector-focus-signals">
              {activeWorldDetails.signals.map(signal => <span key={signal}>{signal}</span>)}
            </div>

            {/* Continuously Moving Autonomous Features Ticker for the Selected Sector */}
            <div className="mt-5 pt-4 border-t border-white/10 overflow-hidden">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#A5B1A5] mb-2.5 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: activeWorld.color }} />
                <span>Features & Solutions · {activeSectorNodes.length} Features</span>
              </div>
              <div className="sector-marquee-wrap">
                <div className="sector-marquee-track">
                  {[...activeSectorNodes, ...activeSectorNodes].map((node, i) => (
                    <div
                      key={`${node.id}-${i}`}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#121815] border mr-3 shrink-0"
                      style={{ borderColor: `${activeWorld.color}66` }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeWorld.color }} />
                      <span className="text-[10px] font-mono font-bold" style={{ color: activeWorld.color }}>{node.code}</span>
                      <span className="text-xs font-semibold text-[#F4F4F5]">{node.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button className="journey-primary mt-6" onClick={() => goTo('login')}><span>Continue to sign in</span><ArrowRight size={16} /></button>
          </div>
        )}

        {stage === 'login' && (
          <div
            className="choice-panel journey-enter pointer-events-auto"
            style={{
              '--world-accent': activeWorld.color,
              width: 'min(560px, 45vw)',
              padding: '28px 32px',
              margin: 0
            }}
          >
            <div className="mb-4">
              <button className="journey-back mb-3" onClick={() => goTo('worlds')}><ArrowLeft size={15} /> Change sector</button>
              <div className="journey-kicker"><span /> Sector Access · {institutionType === 'public' ? 'Government / Public' : 'Private institution'}</div>
              <h1 style={{ fontSize: 'clamp(30px, 3vw, 42px)', margin: '8px 0 4px' }}>{worldName}</h1>
              <p className="journey-intro" style={{ margin: 0 }}>Sign in to your Agenexus workspace to explore these features and solutions.</p>
            </div>

            {/* Continuously Moving Sector Features Stream during Sign-In */}
            <div className="mb-4 py-2.5 px-3 rounded-lg bg-[#0d1310]/90 border border-white/10 overflow-hidden">
              <div className="text-[9px] font-mono uppercase tracking-wider text-[#A5B1A5] mb-1.5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: activeWorld.color }} />
                <span>{worldName} Features & Solutions</span>
              </div>
              <div className="sector-marquee-wrap">
                <div className="sector-marquee-track">
                  {[...activeSectorNodes, ...activeSectorNodes].map((node, i) => (
                    <div
                      key={`login-${node.id}-${i}`}
                      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#151D18] border mr-2.5 shrink-0"
                      style={{ borderColor: `${activeWorld.color}55` }}
                    >
                      <span className="text-[9px] font-mono font-bold" style={{ color: activeWorld.color }}>{node.code}</span>
                      <span className="text-[11px] font-medium text-[#F2F0E7]">{node.name}</span>
                      <span className="text-[9px] text-[#A5B1A5]">· {node.metrics?.accuracy}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <form className="journey-login-form" style={{ padding: '16px', background: 'rgba(14, 20, 17, 0.75)' }} onSubmit={handleSubmit}>
              {demoMode&&<div className="journey-role-label">Choose a demo access role</div>}
              <div className="journey-roles" style={demoMode ? undefined : {display:'none'}} hidden={!demoMode}>
                {roles.map((role) => {
                  const Icon = role.icon;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      className={`journey-role ${selectedRole === role.id ? 'is-selected' : ''}`}
                      onClick={() => chooseRole(role.id)}
                    >
                      <Icon size={17} />
                      <span><strong>{role.title}</strong><small>{role.summary}</small></span>
                      {selectedRole === role.id && <Check size={14} />}
                    </button>
                  );
                })}
              </div>

              {errorMessage && <p className="journey-error" role="alert">{errorMessage}</p>}
              <label className="journey-field">
                <span>Institution email</span>
                <input type="email" value={email} onChange={event => setEmail(event.target.value)} required />
              </label>
              <label className="journey-field">
                <span>Password</span>
                <span className="password-input-wrap">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </span>
              </label>
              <button className="journey-primary sign-in-button" type="submit" disabled={isSubmitting}>
                <LockKeyhole size={15} /><span>{isSubmitting ? 'Opening your world…' : `Enter ${worldName}`}</span><ArrowRight size={16} />
              </button>
              <p className="journey-demo-note">{demoMode?'Demo access · choose a role to fill its sample credentials':'Your assigned role and locations are applied after sign-in.'}</p>
            </form>
          </div>
        )}
      </section>
        </>
      )}

      {stage !== 'welcome' && (
        <footer className="journey-footer relative z-10">
          <span><Globe2 size={13} /> A shared platform for living systems</span>
          <span><i /> {stage === 'login' ? `${worldName} workspace` : 'Connected sectors · 04'}</span>
        </footer>
      )}
    </main>
  );
}
