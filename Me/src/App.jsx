import { useState } from 'react'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Boxes,
  Eye,
  EyeOff,
  Menu,
  Route,
  ShieldCheck,
  TrendingUp,
  Waves,
  X,
} from 'lucide-react'
import './App.css'

const nodes = [
  { name: 'JNPT PORT', code: 'JNP', x: 122, y: 272, value: '82%' },
  { name: 'BHIWANDI', code: 'BWD', x: 290, y: 212, value: '64%' },
  { name: 'THANE HUB', code: 'THN', x: 435, y: 244, value: '71%' },
  { name: 'NASHIK DC', code: 'NSK', x: 600, y: 138, value: '48%' },
  { name: 'PUNE CENTER', code: 'PUN', x: 577, y: 337, value: '91%' },
]

function CorridorMap() {
  return (
    <div className="corridor-map" aria-label="Western India logistics corridor map">
      <div className="map-topline">
        <div className="map-live"><span /> LIVE CORRIDOR</div>
        <span className="map-time">UPDATED JUST NOW</span>
      </div>
      <svg className="map-art" viewBox="0 0 720 420" role="img" aria-label="Route network connecting JNPT, Bhiwandi, Thane, Nashik, and Pune">
        <defs>
          <pattern id="map-grid" width="34" height="34" patternUnits="userSpaceOnUse">
            <path d="M 34 0 L 0 0 0 34" fill="none" stroke="currentColor" strokeWidth="0.7" />
          </pattern>
          <linearGradient id="route-glow" x1="0" x2="1">
            <stop offset="0" stopColor="#e36b39" />
            <stop offset="1" stopColor="#d9a64b" />
          </linearGradient>
        </defs>
        <rect width="720" height="420" fill="url(#map-grid)" />
        <path className="waterway" d="M18 295 C77 258 84 231 105 196 C125 164 118 121 149 85 M18 333 C71 300 107 278 126 242 C145 207 155 178 189 160" />
        <path className="terrain-line" d="M236 76 C293 48 345 84 392 57 S495 57 539 78 S639 62 696 95 M209 111 C260 87 303 120 350 96 S458 103 502 88 S613 96 679 125 M228 365 C273 334 327 368 376 340 S473 351 520 325 S632 356 695 327" />
        <path className="route-base" d="M122 272 C177 248 231 224 290 212 L435 244 L600 138 M435 244 C486 273 525 306 577 337" />
        <path className="route-active" d="M122 272 C177 248 231 224 290 212 L435 244 L600 138" />
        <path className="route-alt" d="M435 244 C486 273 525 306 577 337" />
        <circle className="radar-ring" cx="122" cy="272" r="28" />
        <circle className="radar-ring radar-ring-two" cx="435" cy="244" r="22" />
        {nodes.map((node, index) => (
          <g className="map-node" key={node.code} transform={`translate(${node.x} ${node.y})`}>
            <circle className={index === 0 || index === 2 ? 'node-pulse' : 'node-halo'} r="13" />
            <circle className="node-core" r="5" />
            <text className="node-name" x="15" y="-7">{node.name}</text>
            <text className="node-data" x="15" y="9">CAPACITY {node.value}</text>
          </g>
        ))}
        <g className="truck-marker" transform="translate(352 225)">
          <circle r="12" />
          <path d="M-5 -4h6v7h-6z M1 -2h3l2 2v3H1z M-3 4a1.4 1.4 0 1 0 0 .1 M3 4a1.4 1.4 0 1 0 0 .1" />
        </g>
        <text className="map-label" x="44" y="385">ARABIAN SEA</text>
        <text className="map-coordinate" x="601" y="397">19.0760° N / 72.8777° E</text>
      </svg>
      <div className="map-footer">
        <span><i className="legend-dot legend-active" /> Active corridor</span>
        <span><i className="legend-dot legend-alt" /> Alternate route</span>
        <span className="map-distance">5 HUBS <b>·</b> 418 KM</span>
      </div>
    </div>
  )
}

function App() {
  const [page, setPage] = useState('home')
  const [menuOpen, setMenuOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loginMessage, setLoginMessage] = useState('')

  function openLogin() {
    setPage('login')
    setMenuOpen(false)
    setLoginMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function returnHome() {
    setPage('home')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (page === 'login') {
    return (
      <main className="login-screen">
        <section className="login-story">
          <button className="brand brand-light" onClick={returnHome} aria-label="Return to home">
            <span className="brand-mark"><Route size={19} strokeWidth={2.3} /></span>
            <span>waypoint<span className="brand-period">.</span></span>
          </button>
          <div className="login-story-copy">
            <div className="eyebrow eyebrow-light"><span className="eyebrow-line" /> WESTERN INDIA CONTROL TOWER</div>
            <h1>Every move,<br />in <em>clear view.</em></h1>
            <p>One operational picture for every shipment, facility, and decision across your corridor.</p>
          </div>
          <div className="login-story-foot"><Activity size={15} /> SYSTEMS NOMINAL <span>·</span> MUMBAI REGION</div>
          <div className="story-contour" aria-hidden="true" />
        </section>
        <section className="login-panel">
          <div className="login-panel-top"><button className="back-link" onClick={returnHome}><ArrowLeft size={16} /> Back to overview</button><span>NEED ACCESS? <a href="mailto:access@waypoint.local">CONTACT ADMIN</a></span></div>
          <div className="login-form-wrap">
            <div className="login-kicker">CONTROL TOWER ACCESS</div>
            <h2>Welcome back</h2>
            <p className="login-intro">Sign in to continue to your operations workspace.</p>
            <form className="login-form" onSubmit={(event) => { event.preventDefault(); setLoginMessage('Authentication is not connected yet. Your account details were not submitted.') }}>
              <label htmlFor="email">Work email</label>
              <input id="email" name="email" type="email" autoComplete="username" placeholder="you@company.com" required />
              <div className="password-label"><label htmlFor="password">Password</label><a href="mailto:access@waypoint.local?subject=Password%20reset">Forgot password?</a></div>
              <div className="password-field"><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" required /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
              <label className="remember-row"><input type="checkbox" name="remember" /> <span>Keep me signed in</span></label>
              <button className="button button-primary login-submit" type="submit">Sign in <ArrowRight size={17} /></button>
              {loginMessage && <p className="form-notice" role="status">{loginMessage}</p>}
            </form>
            <div className="secure-note"><ShieldCheck size={16} /> Protected workspace <span>·</span> Role-based access</div>
          </div>
          <footer className="login-footer"><span>© 2026 WAYPOINT LOGISTICS</span><span>PRIVACY <i /> SECURITY</span></footer>
        </section>
      </main>
    )
  }

  return (
    <main className="site-shell">
      <div className="announcement"><span className="announcement-status"><i /> CORRIDOR STATUS: OPERATIONAL</span><span>Western India network <b>·</b> Live overview</span><ArrowRight size={14} /></div>
      <header className="site-header">
        <button className="brand" onClick={returnHome} aria-label="Waypoint home"><span className="brand-mark"><Route size={19} strokeWidth={2.3} /></span><span>waypoint<span className="brand-period">.</span></span></button>
        <button className="mobile-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
        <nav className={menuOpen ? 'main-nav nav-open' : 'main-nav'} aria-label="Main navigation">
          <a href="#platform" onClick={() => setMenuOpen(false)}>Platform</a>
          <a href="#network" onClick={() => setMenuOpen(false)}>Network</a>
          <a href="#capabilities" onClick={() => setMenuOpen(false)}>Capabilities</a>
          <button className="nav-mobile-login" onClick={openLogin}>Sign in <ArrowRight size={16} /></button>
        </nav>
        <button className="header-login" onClick={openLogin}>Sign in <ArrowRight size={15} /></button>
      </header>

      <section className="hero-section" id="platform">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> THE INTELLIGENCE LAYER FOR LOGISTICS</div>
          <h1>Move your network<br />with <em>knowing.</em></h1>
          <p className="hero-description">See around corners. Make every handoff count. Waypoint brings demand, fleet, trade, and infrastructure into one living picture.</p>
          <div className="hero-actions"><button className="button button-primary" onClick={openLogin}>Enter control tower <ArrowRight size={17} /></button><a className="text-link" href="#capabilities">Explore the platform <span>↓</span></a></div>
          <div className="hero-proof"><div className="proof-avatars"><span>SC</span><span>FD</span><span>CO</span></div><p>One corridor. <strong>Every team in sync.</strong></p></div>
        </div>
        <div className="hero-visual">
          <CorridorMap />
          <div className="floating-stat stat-top"><span className="stat-icon"><TrendingUp size={16} /></span><span className="stat-copy"><small>ON-TIME DELIVERY</small><strong>98.4<span>%</span></strong></span><span className="stat-change">+2.1%</span></div>
          <div className="floating-stat stat-bottom"><span className="stat-icon stat-icon-green"><Boxes size={16} /></span><span className="stat-copy"><small>ACTIVE SHIPMENTS</small><strong>1,284</strong></span><span className="live-indicator"><i /> LIVE</span></div>
        </div>
      </section>

      <section className="network-strip" id="network">
        <div className="network-title"><span>OPERATING FOOTPRINT</span><strong>Western India Economic Corridor</strong></div>
        <div className="network-route"><span>JNPT PORT</span><i /><span>BHIWANDI</span><i /><span>THANE</span><i /><span>NASHIK</span><i /><span>PUNE</span></div>
        <div className="network-distance">418 <small>KM CONNECTED</small></div>
      </section>

      <section className="capabilities-section" id="capabilities">
        <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> ONE SHARED OPERATIONAL PICTURE</div><h2>Complexity, brought<br />into <em>focus.</em></h2></div><p>From the first forecast to the final mile, intelligence flows across your operation instead of getting stuck in silos.</p></div>
        <div className="capability-grid">
          <article className="capability-item"><span className="capability-number">01 / PLAN</span><span className="capability-icon"><TrendingUp size={21} /></span><h3>Know what’s next.</h3><p>Neural demand forecasts help teams plan stock, capacity, and service levels with confidence.</p><a href="#platform" aria-label="Learn about demand forecasting"><ArrowRight size={17} /></a></article>
          <article className="capability-item"><span className="capability-number">02 / MOVE</span><span className="capability-icon icon-amber"><Route size={21} /></span><h3>Make every mile work.</h3><p>Route intelligence balances capacity, time windows, traffic, and backhaul opportunities.</p><a href="#platform" aria-label="Learn about route optimization"><ArrowRight size={17} /></a></article>
          <article className="capability-item"><span className="capability-number">03 / CLEAR</span><span className="capability-icon icon-blue"><ShieldCheck size={21} /></span><h3>Trade with clarity.</h3><p>Document intelligence flags classification gaps and compliance risks before they delay cargo.</p><a href="#platform" aria-label="Learn about trade compliance"><ArrowRight size={17} /></a></article>
          <article className="capability-item"><span className="capability-number">04 / ADAPT</span><span className="capability-icon icon-green"><Waves size={21} /></span><h3>See the ripple early.</h3><p>A living digital twin tests disruptions and makes mitigation decisions tangible.</p><a href="#platform" aria-label="Learn about digital twin"><ArrowRight size={17} /></a></article>
        </div>
      </section>

      <section className="closing-band"><div className="closing-symbol"><Activity size={22} /></div><div><span>YOUR CORRIDOR. IN CONTEXT.</span><h2>Better decisions travel.</h2></div><button className="button button-light" onClick={openLogin}>Open control tower <ArrowRight size={16} /></button></section>
      <footer className="site-footer"><button className="brand" onClick={returnHome}><span className="brand-mark"><Route size={17} /></span><span>waypoint<span className="brand-period">.</span></span></button><span>COGNITIVE LOGISTICS ORCHESTRATION</span><span>© 2026 WAYPOINT</span></footer>
    </main>
  )
}

export default App
