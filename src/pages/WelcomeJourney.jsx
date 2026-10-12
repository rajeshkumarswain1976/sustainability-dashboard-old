import React, { useState } from 'react';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  Compass,
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
  Sun,
  Trees,
  UserRound,
  UsersRound,
} from 'lucide-react';
import LivingYggdrasil from '../components/LivingYggdrasil';
import { useDashboard } from '../context/DashboardContext';

const worlds = [
  {
    id: 'campus',
    name: 'Campus A',
    descriptor: 'Learning landscapes',
    detail: 'Energy, water, buildings and campus life',
    icon: Trees,
    color: '#76B58F',
    initials: 'CA',
  },
  {
    id: 'enterprise',
    name: 'Company / Municipality',
    descriptor: 'Civic & enterprise systems',
    detail: 'Operations for business or public infrastructure',
    icon: Building2,
    color: '#D8A35D',
    initials: 'CE',
  },
  {
    id: 'hospital',
    name: 'Hospital Network',
    descriptor: 'Care environments',
    detail: 'Resilient, efficient and healthy care facilities',
    icon: HeartPulse,
    color: '#62B8C4',
    initials: 'HN',
  },
];

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
  { name: 'Rajesh Kumar Swain', role: 'Development team' },
  { name: 'Abankita Behera', role: 'Development team' },
  { name: 'Mohammad Jazbi', role: 'Development team' },
  { name: 'Harshvardhan Praharaj', role: 'Development team' },
  { name: 'Stiti Prgyna Sahu', role: 'Development team' },
];

const worldDetails = {
  campus: {
    eyebrow: 'Learning landscapes',
    title: 'A clearer view of campus life.',
    text: 'Coordinate energy, water, buildings, mobility and wellbeing across the places where people learn and work.',
    signals: ['Campus resources', 'Buildings & assets', 'Student and staff wellbeing'],
  },
  enterprise: {
    eyebrow: 'Civic & enterprise systems',
    title: 'One operational picture for complex places.',
    text: 'Connect facilities, infrastructure, field teams and sustainability performance across a company or municipality.',
    signals: ['Facilities & infrastructure', 'Field operations', 'Performance & compliance'],
  },
  hospital: {
    eyebrow: 'Care environments',
    title: 'Stewardship that supports care.',
    text: 'Bring critical facilities, environmental conditions, safety and resource performance into one resilient view.',
    signals: ['Critical facilities', 'Care environment', 'Resilience & safety'],
  },
};

function WelcomeLanding({ isLight, selectedWorld, onSelectWorld, onEnter }) {
  const [contact, setContact] = useState({ name: '', email: '', message: '' });
  const [contactSent, setContactSent] = useState(false);
  const currentWorld = worlds.find(world => world.id === selectedWorld) || worlds[0];
  const detail = worldDetails[currentWorld.id];

  const selectWorld = (worldId) => {
    onSelectWorld(worldId);
    window.requestAnimationFrame(() => document.getElementById('world-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const submitContact = (event) => {
    event.preventDefault();
    setContactSent(true);
  };

  return (
    <div className="welcome-site">
      <section className="landing-hero" id="home">
        <div className="landing-hero-copy">
          <div className="journey-kicker"><span /> Stewardship for living systems</div>
          <h1>Better operations.<br /><em>A world in balance.</em></h1>
          <p>One connected platform for the places people depend on, from campuses to cities to care environments.</p>
        </div>

        <div className="landing-tree-frame" aria-label="Animated Yggdrasil world tree with three operational sectors">
          <div className="landing-nebula nebula-one" />
          <div className="landing-nebula nebula-two" />
          <LivingYggdrasil className="landing-tree-canvas" light={isLight} view="welcome" />
          <button className={`tree-sector-pin pin-campus ${selectedWorld === 'campus' ? 'is-active' : ''}`} onClick={() => selectWorld('campus')}>
            <span /><strong>Campus A</strong><small>Learning landscapes</small>
          </button>
          <button className={`tree-sector-pin pin-enterprise ${selectedWorld === 'enterprise' ? 'is-active' : ''}`} onClick={() => selectWorld('enterprise')}>
            <span /><strong>Company · Municipality</strong><small>Civic & enterprise</small>
          </button>
          <button className={`tree-sector-pin pin-hospital ${selectedWorld === 'hospital' ? 'is-active' : ''}`} onClick={() => selectWorld('hospital')}>
            <span /><strong>Hospital Network</strong><small>Care environments</small>
          </button>
          <div className="tree-coordinate" aria-hidden="true">YGGDRASIL · THREE CONNECTED WORLDS · 01—03</div>
        </div>

        <div className="landing-hero-actions">
          <span><i /> Living systems, seen together</span>
          <button className="journey-primary" onClick={onEnter}><span>Enter the world tree</span><ArrowRight size={16} /></button>
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
        <div className="section-index">02 / Why Yggdrasil</div>
        <div className="landing-about-grid">
          <h2>Places are connected.<br /><em>Operations should be too.</em></h2>
          <div>
            <p>Teams often work across separate systems for buildings, resources, risks and service requests. That makes it harder to spot what needs attention and coordinate the response.</p>
            <p>Yggdrasil brings those signals into a shared operational workspace, helping institutions understand their places, prioritize work and make progress visible.</p>
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
        <div className="team-list">
          {people.map((person, index) => (
            <div className="team-member" key={person.name}>
              <span className="team-number">0{index + 1}</span>
              <span className="team-monogram">{person.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span>
              <strong>{person.name}</strong>
              <span>{person.role}</span>
              <ArrowUpRight size={16} />
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
          {contactSent ? (
            <div className="contact-success"><CheckCircle2 size={25} /><strong>Thanks, {contact.name || 'we have your note'}.</strong><span>Your message was accepted in this preview. Connect an email or form service to deliver enquiries.</span></div>
          ) : (
            <>
              <label><span>Your name</span><input required value={contact.name} onChange={event => setContact({ ...contact, name: event.target.value })} placeholder="Name" /></label>
              <label><span>Work email</span><input required type="email" value={contact.email} onChange={event => setContact({ ...contact, email: event.target.value })} placeholder="you@organization.org" /></label>
              <label><span>What would you like to solve?</span><textarea required rows="3" value={contact.message} onChange={event => setContact({ ...contact, message: event.target.value })} placeholder="Tell us a little about your place and your goals" /></label>
              <button type="submit" className="journey-primary"><span>Send a message</span><Send size={15} /></button>
            </>
          )}
        </form>
      </section>

      <footer className="landing-footer">
        <a className="journey-brand" href="#home"><span className="journey-brand-mark"><Leaf size={17} /></span><span><strong>YGGDRASIL</strong><small>Stewardship systems</small></span></a>
        <span>Connected places. Considered action.</span>
        <div><a href="#about">About</a><a href="#platform">Platform</a><a href="#team">Team</a><a href="#contact">Contact</a></div>
        <small>© 2026 Yggdrasil Stewardship Systems · Illustrative demonstration</small>
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
  } = useDashboard();
  const [stage, setStage] = useState('welcome');
  const [selectedRole, setSelectedRole] = useState('admin');
  const [email, setEmail] = useState(PRESET_USERS.admin.email);
  const [password, setPassword] = useState(PRESET_USERS.admin.password);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeNav, setActiveNav] = useState(false);

  const activeWorld = worlds.find(world => world.id === selectedWorld) || worlds[0];
  const isLight = theme === 'light';
  const worldName = selectedWorld === 'enterprise'
    ? institutionType === 'public' ? 'Municipality' : 'Company'
    : selectedWorld === 'hospital' ? 'Hospital Network' : 'Campus A';

  const goTo = (nextStage) => {
    setErrorMessage('');
    setStage(nextStage);
  };

  const chooseWorld = (worldId) => {
    setSelectedWorld(worldId);
    updateFilter('sector', worldId === 'campus' ? 'College' : worldId === 'hospital' ? 'Medical Center' : institutionType === 'public' ? 'Municipality' : 'Company');
    setStage('sector');
  };

  const previewWorld = (worldId) => {
    setSelectedWorld(worldId);
    updateFilter('sector', worldId === 'campus' ? 'College' : worldId === 'hospital' ? 'Medical Center' : institutionType === 'public' ? 'Municipality' : 'Company');
  };

  const chooseRole = (roleId) => {
    setSelectedRole(roleId);
    setEmail(PRESET_USERS[roleId].email);
    setPassword(PRESET_USERS[roleId].password);
    setErrorMessage('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    window.setTimeout(() => {
      const success = login(email, password);
      setIsSubmitting(false);
      if (!success) setErrorMessage('The email or password does not match this demo account.');
    }, 350);
  };

  const stageIndex = ['welcome', 'institution', 'worlds', 'sector', 'login'].indexOf(stage);
  const activeWorldDetails = worldDetails[selectedWorld] || worldDetails.campus;

  return (
    <main
      className={`journey-shell ${stage === 'welcome' ? 'has-landing' : ''} ${isLight ? 'journey-light' : 'journey-dark'}`}
      style={{ '--world-accent': activeWorld.color }}
    >
      <div className="journey-grid" aria-hidden="true" />
      <div className="journey-vignette" aria-hidden="true" />

      <header className="journey-header">
        <button className="journey-brand" onClick={() => goTo('welcome')} aria-label="Return to welcome">
          <span className="journey-brand-mark"><Leaf size={17} /></span>
          <span>
            <strong>YGGDRASIL</strong>
            <small>Stewardship systems</small>
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
        <WelcomeLanding isLight={isLight} selectedWorld={selectedWorld} onSelectWorld={previewWorld} onEnter={() => goTo('institution')} />
      ) : (
        <>
        <div className="journey-progress" aria-label={`Step ${stageIndex} of 4`}>
          {['Institution', 'World', 'Sector', 'Sign in'].map((label, index) => (
            <span key={label} className={stageIndex >= index + 1 ? 'is-reached' : ''}>
              <i>{stageIndex > index + 1 ? <Check size={11} /> : index + 1}</i>
              {label}
            </span>
          ))}
        </div>

      <section className={`journey-content stage-${stage}`}>
        <div className="tree-stage-art" aria-hidden="true">
          <LivingYggdrasil light={isLight} view={stage === 'sector' ? `sector-${selectedWorld}` : stage} />
        </div>

        {stage === 'institution' && (
          <div className="choice-panel root-panel journey-enter">
            <button className="journey-back" onClick={() => goTo('welcome')}><ArrowLeft size={15} /> Back to the tree</button>
            <div className="journey-kicker"><span /> At the roots</div>
            <h1>Who do your roots serve?</h1>
            <p className="journey-intro">Start with the institution type. You can change worlds on the next branch.</p>
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
              <div><span className="journey-kicker"><span /> Below the surface</span><small>Distributed node clusters · live signal paths</small></div>
              <div className="root-node-list">
                {sensorSystems.map(system => <span key={system.name} style={{ '--node-color': system.color }}><i />{system.name}</span>)}
              </div>
            </div>
            <div className="root-annotation"><span /> Public benefit <b>·</b> Shared responsibility <b>·</b> Long-term care</div>
          </div>
        )}

        {stage === 'worlds' && (
          <div className="choice-panel canopy-panel journey-enter">
            <button className="journey-back" onClick={() => goTo('institution')}><ArrowLeft size={15} /> Back to roots</button>
            <div className="journey-kicker"><span /> At the canopy · {institutionType === 'public' ? 'Public institution' : 'Private institution'}</div>
            <h1>Choose your world.</h1>
            <p className="journey-intro">Each branch shares the same operating tools, tuned to its own environment.</p>
            <div className="world-options">
              {worlds.map((world, index) => {
                const Icon = world.icon;
                const description = world.id === 'enterprise'
                  ? institutionType === 'public' ? 'Municipal systems and public infrastructure' : 'Company operations and facilities'
                  : world.detail;
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
          <div className="choice-panel sector-focus-panel journey-enter" style={{ '--world-accent': activeWorld.color }}>
            <button className="journey-back" onClick={() => goTo('worlds')}><ArrowLeft size={15} /> Choose another world</button>
            <div className="journey-kicker"><span /> Selected branch · {activeWorldDetails.eyebrow}</div>
            <h1>{worldName}</h1>
            <p className="journey-intro">{activeWorldDetails.text}</p>
            <div className="sector-focus-signals">
              {activeWorldDetails.signals.map(signal => <span key={signal}>{signal}</span>)}
            </div>
            <button className="journey-primary" onClick={() => goTo('login')}><span>Continue to sign in</span><ArrowRight size={16} /></button>
          </div>
        )}

        {stage === 'login' && (
          <div className="login-stage journey-enter">
            <div className="login-world-heading">
              <button className="journey-back" onClick={() => goTo('worlds')}><ArrowLeft size={15} /> Change world</button>
              <div className="journey-kicker"><span /> At the trunk · {institutionType === 'public' ? 'Government / Public' : 'Private institution'}</div>
              <h1>{worldName}</h1>
              <p className="journey-intro">Sign in to your stewardship workspace.</p>
            </div>

            <form className="journey-login-form" onSubmit={handleSubmit}>
              <div className="journey-role-label">Choose an access role</div>
              <div className="journey-roles">
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
              <p className="journey-demo-note">Demo access · choose a role to fill its sample credentials</p>
            </form>
          </div>
        )}
      </section>
        </>
      )}

      {stage !== 'welcome' && (
        <footer className="journey-footer">
          <span><Globe2 size={13} /> A shared platform for living systems</span>
          <span><i /> {stage === 'login' ? `${worldName} workspace` : 'Connected worlds · 03'}</span>
        </footer>
      )}
    </main>
  );
}