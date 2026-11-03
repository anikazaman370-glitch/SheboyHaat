import React, { useEffect, useRef, useState } from "react";
import { api, refreshSession, getToken, setToken, setStoredUser } from "./api";
import { Routes, Route, Link, NavLink, useNavigate, useLocation, useSearchParams, Navigate } from "react-router-dom";
import { LangContext, translations, translateService, translateArea, localizeNumber, useLang } from "./i18n";

const homeFor = (role) => role === "admin" ? "/admin" : role === "worker" ? "/worker-dashboard" : "/";

const services = [
  { id:"plumbing", icon:"🔧", name:"Plumbing", bn:"প্লাম্বিং", desc:"Leaks, pipes, taps & bathroom repairs", descBn:"পানি লিক, পাইপ, কল ও বাথরুম মেরামত", price:"৳500+" },
  { id:"electrical", icon:"⚡", name:"Electrical", bn:"ইলেকট্রিক", desc:"Wiring, switches, fans & electrical repairs", descBn:"ওয়্যারিং, সুইচ, ফ্যান ও ইলেকট্রিক মেরামত", price:"৳400+" },
  { id:"cleaning", icon:"🧹", name:"Cleaning", bn:"পরিষ্কার", desc:"Home, kitchen & deep cleaning", descBn:"ঘর, রান্নাঘর ও গভীর পরিষ্কার", price:"৳700+" },
  { id:"ac", icon:"❄️", name:"AC Service", bn:"এসি সার্ভিস", desc:"AC servicing, gas & installation", descBn:"এসি সার্ভিসিং, গ্যাস ও ইনস্টলেশন", price:"৳800+" },
  { id:"appliance", icon:"🔌", name:"Appliance Repair", bn:"যন্ত্রপাতি", desc:"Fridge, washing machine & appliances", descBn:"ফ্রিজ, ওয়াশিং মেশিন ও যন্ত্রপাতি", price:"৳600+" },
  { id:"painting", icon:"🎨", name:"Painting", bn:"রং করা", desc:"Room painting and wall touch-ups", descBn:"ঘর রং করা ও দেয়ালের টাচ-আপ", price:"৳1,200+" }
];

const serviceIdToKeyword = { plumbing:"plumb", electrical:"electr", cleaning:"clean", ac:"ac", appliance:"appliance", painting:"paint" };

const workers = [
  {id:1,name:"Md. Rahim Uddin",service:"Plumber",area:"Mirpur",rating:4.9,reviews:128,price:"৳500",verified:true,avatar:"RU",jobs:312},
  {id:2,name:"Abdul Karim",service:"Electrician",area:"Uttara",rating:4.8,reviews:96,price:"৳450",verified:true,avatar:"AK",jobs:241},
  {id:3,name:"Shila Akter",service:"Home Cleaner",area:"Dhanmondi",rating:4.9,reviews:84,price:"৳700",verified:true,avatar:"SA",jobs:198},
  {id:4,name:"Hasan Mahmud",service:"AC Technician",area:"Mohammadpur",rating:4.7,reviews:73,price:"৳800",verified:true,avatar:"HM",jobs:176},
  {id:5,name:"Rashed Mia",service:"Electrician",area:"Mirpur",rating:4.8,reviews:64,price:"৳500",verified:true,avatar:"RM",jobs:154},
  {id:6,name:"Nusrat Jahan",service:"Home Cleaner",area:"Banani",rating:4.9,reviews:55,price:"৳750",verified:true,avatar:"NJ",jobs:143}
];

function App(){
  const [lang,setLang] = useState(() => localStorage.getItem("sheboyhaat_lang") || "EN");
  const [bookings,setBookings] = useState([]);
  const [user,setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sheboyhaat_user")) || null; } catch { return null; }
  });
  const [authReady,setAuthReady] = useState(false);

  useEffect(() => { localStorage.setItem("sheboyhaat_lang", lang); document.documentElement.lang = lang === "বাংলা" ? "bn" : "en"; }, [lang]);

  const saveBookings = (next) => { setBookings(next); };
  const login = (u) => { setUser(u); setStoredUser(u); };
  const navigate = useNavigate();
  const logout = async () => {
    try { await api("/auth/logout", { method: "POST" }); } catch { /* ignore */ }
    setUser(null); setToken(null); setStoredUser(null); navigate("/");
  };

  const T = translations[lang] || translations.EN;
  const n = (value) => localizeNumber(lang, value);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (getToken()) {
          try {
            const d = await api("/auth/me");
            if (active) { setUser(d.user); setStoredUser(d.user); }
            return;
          } catch { /* access token invalid or expired, try refresh cookie below */ }
        }
        try {
          const d = await refreshSession();
          if (!active) return;
          if (d?.user) { setUser(d.user); setStoredUser(d.user); }
          else { setUser(null); setStoredUser(null); }
        } catch {
          if (active) { setUser(null); setStoredUser(null); }
        }
      } finally {
        if (active) setAuthReady(true);
      }
    })();
    return () => { active = false; };
  }, []);

  return <LangContext.Provider value={{ lang, setLang, T, n }}>
    <div className={"app" + (lang === "বাংলা" ? " lang-bn" : "")}>
    <Header user={user} logout={logout}/>
    <Routes>
      <Route path="/" element={<Home user={user}/>}/>
      <Route path="/services" element={<Services/>}/>
      <Route path="/workers" element={<Workers user={user}/>}/>
      <Route path="/worker/:id" element={<WorkerDetails user={user} bookings={bookings} saveBookings={saveBookings}/>}/>
      <Route path="/book/:workerId" element={<Booking user={user} bookings={bookings} saveBookings={saveBookings}/>}/>
      <Route path="/bookings" element={<RequireAuth user={user} ready={authReady}><Bookings bookings={bookings} user={user}/></RequireAuth>}/>
      <Route path="/chat/:code" element={<RequireAuth user={user} ready={authReady}><Chat user={user}/></RequireAuth>}/>
  <Route path="/login" element={user?<Navigate to={homeFor(user.role)} replace/>:<Login login={login}/>}/>
  <Route path="/register" element={user?<Navigate to={homeFor(user.role)} replace/>:<Register login={login}/>}/>
      <Route path="/verify-otp" element={<VerifyOtp login={login}/>}/>
      <Route path="/worker-dashboard" element={<RequireAuth user={user} role="worker" ready={authReady}><WorkerDashboard bookings={bookings} saveBookings={saveBookings}/></RequireAuth>}/>
  <Route path="/worker-earnings" element={<RequireAuth user={user} role="worker" ready={authReady}><WorkerEarnings/></RequireAuth>}/>
      <Route path="/admin" element={<RequireAuth user={user} role="admin" ready={authReady}><Admin bookings={bookings} saveBookings={saveBookings}/></RequireAuth>}/>
      <Route path="/dashboard" element={<RequireAuth user={user} role="customer" ready={authReady}><Dashboard user={user} bookings={bookings} logout={logout}/></RequireAuth>}/>
      <Route path="/profile" element={<RequireAuth user={user} ready={authReady}><ProfileInfo user={user}/></RequireAuth>}/>
      <Route path="/settings" element={<RequireAuth user={user} ready={authReady}><Settings user={user} updateUser={login} logout={logout}/></RequireAuth>}/>
  <Route path="/spending" element={<RequireAuth user={user} ready={authReady}><Spending/></RequireAuth>}/>
      <Route path="/how-it-works" element={<HowItWorks/>}/>
      <Route path="/notes" element={<ImportantNotes user={user}/>}/>
      <Route path="/help" element={<NeedHelp/>}/>
      <Route path="*" element={<NotFound/>}/>
    </Routes>
    <Footer/>
    </div>
  </LangContext.Provider>
}

function RequireAuth({user,role,ready,children}){
  const {T}=useLang();
  const location = useLocation();
  if(!ready) return <main className="page"><div className="container empty"><p>{T.restore}</p></div></main>;
  if(!user) return <Navigate to="/login" replace state={{from:location.pathname}}/>;
  if(role && user.role!==role) return <Navigate to={homeFor(user.role)} replace/>;
  return children;
}

function LogoutIcon(){return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>}

function LangToggle(){
  const {lang,setLang}=useLang();
  return <div className="lang-toggle" role="group" aria-label="Language">
    <button type="button" className={lang==="EN"?"active":""} onClick={()=>setLang("EN")}>EN</button>
    <button type="button" className={lang==="বাংলা"?"active":""} onClick={()=>setLang("বাংলা")}>বাংলা</button>
  </div>
}

function MenuIcon({name}){
  const p={width:18,height:18,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true"};
  if(name==="dashboard")return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
  if(name==="profile")return <svg {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
  if(name==="how")return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4"/><line x1="12" y1="17" x2="12" y2="17.01"/></svg>;
  if(name==="notes")return <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="14" y2="17"/></svg>;
  if(name==="help")return <svg {...p}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/></svg>;
  if(name==="share")return <svg {...p}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.5" x2="15.4" y2="6.5"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/></svg>;
  if(name==="settings")return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 8.96 4.6H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 8.9c.14.4.5.7.95.83H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.27z"/></svg>;
  if(name==="logout")return <LogoutIcon/>;
  return null;
}

function Header({user,logout}){
  const {T}=useLang();
  const navigate=useNavigate();
  const [open,setOpen]=useState(false);
  const [menu,setMenu]=useState(false);
  useEffect(()=>{
    if(!menu)return;
    const onKey=e=>{if(e.key==="Escape")setMenu(false);};
    document.addEventListener("keydown",onKey);
    const prev=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return ()=>{document.removeEventListener("keydown",onKey);document.body.style.overflow=prev;};
  },[menu]);
  const nav = [
    ["/",T.nav.home],["/services",T.nav.services],["/workers",T.nav.workers],["/bookings",T.nav.bookings]
  ];
  const close=()=>setMenu(false);
  const dashboardPath=user?.role==="admin"?"/admin":user?.role==="worker"?"/worker-dashboard":"/dashboard";
  const roleLabel=user?.role==="worker"?T.profile.worker:user?.role==="admin"?T.profile.admin:T.profile.customer;
  const go=(path,hash)=>{close();navigate(hash?`${path}#${hash}`:path);if(hash)setTimeout(()=>{const el=document.getElementById(hash);if(el)el.scrollIntoView({behavior:"smooth",block:"start"});},160);};
  const share=async()=>{close();const url=window.location.origin;try{if(navigator.share){await navigator.share({title:"SheboyHaat",text:T.menu.shareText,url});}else{await navigator.clipboard.writeText(url);alert(T.menu.copied);}}catch(err){if(err?.name!=="AbortError"){try{await navigator.clipboard.writeText(url);alert(T.menu.copied);}catch{alert(T.menu.shareFailed);}}}};
  return <>
    <header className="header">
      <div className="container nav-wrap">
        <Link to="/" className="logo"><span className="logo-mark">শ</span><span>Sheboy<span>Haat</span></span></Link>
        <button className="mobile-menu" onClick={()=>setOpen(!open)}>☰</button>
        <nav className={open?"nav open":"nav"}>
          {nav.map(([path,label])=><NavLink key={path} to={path} end={path==="/"} onClick={()=>setOpen(false)}>{label}</NavLink>)}
        </nav>
        <div className="nav-actions">
          <LangToggle/>
          {user ? <div className="user-menu">
            <button type="button" className="user-chip" onClick={()=>setMenu(true)} title={T.menu.open} aria-label={T.menu.open} aria-expanded={menu}>
              <span className="avatar small">{user.name?.slice(0,1) || "U"}</span>
              <span className="user-chip-name">{user.name}</span>
              <span className="user-chip-caret" aria-hidden="true">▾</span>
            </button>
          </div> : <><Link to="/login" className="login-link">{T.header.login}</Link><Link to="/register" className="btn btn-primary btn-sm">{T.header.getStarted}</Link></>}
        </div>
      </div>
    </header>
    {menu&&user&&<div className="sidebar-overlay" onClick={close}>
      <aside className="sidebar" role="dialog" aria-modal="true" aria-label={T.menu.title} onClick={e=>e.stopPropagation()}>
        <div className="sidebar-head">
          <div className="avatar">{user.name?.slice(0,2).toUpperCase()||"U"}</div>
          <div className="sidebar-user"><b>{user.name}</b><span>{user.email}</span><span className="role-pill">{roleLabel}</span></div>
          <button type="button" className="sidebar-close" onClick={close} aria-label={T.menu.close}>×</button>
        </div>
        <nav className="sidebar-nav">
          <button type="button" onClick={()=>go(dashboardPath)}><MenuIcon name="dashboard"/><span>{T.menu.dashboard}</span></button>
          <button type="button" onClick={()=>go("/profile")}><MenuIcon name="profile"/><span>{T.menu.profile}</span></button>
          <button type="button" onClick={()=>go("/how-it-works")}><MenuIcon name="how"/><span>{T.menu.howItWorks}</span></button>
          <button type="button" onClick={()=>go("/notes")}><MenuIcon name="notes"/><span>{T.menu.importantNotes}</span></button>
          <button type="button" onClick={()=>go("/help")}><MenuIcon name="help"/><span>{T.menu.needHelp}</span></button>
          <button type="button" onClick={share}><MenuIcon name="share"/><span>{T.menu.shareApp}</span></button>
          <button type="button" onClick={()=>go("/settings")}><MenuIcon name="settings"/><span>{T.menu.settings}</span></button>
          <button type="button" className="sidebar-logout" onClick={()=>{close();logout();}}><MenuIcon name="logout"/><span>{T.menu.logout}</span></button>
        </nav>
      </aside>
    </div>}
  </>;
}

function Home({user}){
  const {lang,T,n}=useLang();
  const navigate=useNavigate();
  return <>
    <section className="hero">
      <div className="container hero-grid">
        <div className="hero-copy">
          <div className="eyebrow"><span>✓</span> {T.home.eyebrow}</div>
          <h1>{T.home.title}</h1>
          <p>{T.home.subtitle}</p>
          <div className="hero-search">
            <div className="search-icon">⌕</div>
            <input placeholder={T.home.searchPlaceholder}/>
            <button onClick={()=>navigate("/workers")} className="btn btn-primary">{T.home.findWorker}</button>
          </div>
          <div className="popular"><span>{T.home.popular}</span> {services.map(s=>lang==="বাংলা"?s.bn:s.name).join(" · ")}</div>
        </div>
        <div className="hero-card">
          <div className="hero-illustration">
            <div className="sun"></div><div className="house">⌂</div>
            <div className="person p1">👨‍🔧</div><div className="person p2">👩‍🔧</div>
            <div className="tool t1">🔧</div><div className="tool t2">⚡</div>
          </div>
          <div className="trust-card"><span className="trust-icon">✓</span><div><b>{T.home.trustTitle}</b><small>{T.home.trustSub}</small></div></div>
        </div>
      </div>
    </section>

    <section className="stats">
      <div className="container stats-grid">
        <Stat n={n("2,500+")} label={T.home.stats.verifiedWorkers}/>
        <Stat n={n("15,000+")} label={T.home.stats.completedJobs}/>
        <Stat n={n("4.8/5")} label={T.home.stats.avgRating}/>
        <Stat n={n("12")} label={T.home.stats.serviceAreas}/>
      </div>
    </section>

    <section className="section">
      <div className="container">
        <SectionTitle kicker={T.home.servicesKicker} title={T.home.servicesTitle} text={T.home.servicesText}/>
        <div className="service-grid">{services.map(s=><ServiceCard key={s.id} s={s}/>)}</div>
        <div className="center"><Link to="/services" className="btn btn-outline">{T.home.viewAll}</Link></div>
      </div>
    </section>

    <section className="section soft">
      <div className="container">
        <SectionTitle kicker={T.home.howKicker} title={T.home.howTitle} text={T.home.howText}/>
        <div className="steps">
          <Step n="01" icon="🔎" title={T.home.step1t} text={T.home.step1d}/>
          <Step n="02" icon="📅" title={T.home.step2t} text={T.home.step2d}/>
          <Step n="03" icon="⭐" title={T.home.step3t} text={T.home.step3d}/>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container">
        <SectionTitle kicker={T.home.topKicker} title={T.home.topTitle} text={T.home.topText}/>
        <div className="worker-grid">{workers.slice(0,3).map(w=><WorkerCard key={w.id} w={w} locked={!user}/>)}</div>
        <div className="center"><Link to="/workers" className="btn btn-outline">{T.home.explore}</Link></div>
      </div>
    </section>

    <section className="cta">
      <div className="container cta-inner">
        <div><span className="eyebrow light">{T.home.ctaKicker}</span><h2>{T.home.ctaTitle}</h2><p>{T.home.ctaText}</p></div>
        <Link to="/register" className="btn btn-white">{T.home.ctaJoin}</Link>
      </div>
    </section>
  </>
}

function SectionTitle({kicker,title,text}){return <div className="section-title"><span>{kicker}</span><h2>{title}</h2><p>{text}</p></div>}
function StatIcon({name}){
  const p={width:18,height:18,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true"};
  if(name==="calendar")return <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
  if(name==="clock")return <svg {...p}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>;
  if(name==="check")return <svg {...p}><path d="M20 6 9 17l-5-5"/></svg>;
  if(name==="wallet")return <svg {...p}><path d="M20 7H6a2 2 0 0 1 0-4h12v4"/><path d="M4 5v14a2 2 0 0 0 2 2h14V7H6"/><circle cx="16" cy="14" r="1"/></svg>;
  if(name==="star")return <svg {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
  if(name==="inbox")return <svg {...p}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>;
  return null;
}
function Stat({n,label,onClick,active,icon,tone,hint}){
  const cls="dash-card"+(icon?" with-icon":"")+(onClick?" stat-clickable":"")+(active?" active":"");
  const inner=<>{icon&&<span className={"stat-icon "+(tone||"")}><StatIcon name={icon}/></span>}<div className="stat-body"><strong>{n}</strong><span>{label}</span>{hint&&<small>{hint}</small>}</div></>;
  if(!onClick) return <div className={cls}>{inner}</div>;
  return <div role="button" tabIndex={0} aria-pressed={!!active} onClick={onClick} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onClick();}}} className={cls}>{inner}</div>;
}
function Step({n,icon,title,text}){return <div className="step"><div className="step-top"><span>{n}</span><div>{icon}</div></div><h3>{title}</h3><p>{text}</p></div>}
function ServiceCard({s}){
  const {lang,T,n}=useLang();
  return <Link to={`/workers?service=${s.id}`} className="service-card"><div className="service-icon">{s.icon}</div><div><h3>{lang==="বাংলা"?s.bn:s.name}</h3><small>{lang==="বাংলা"?s.name:s.bn}</small><p>{lang==="বাংলা"?s.descBn:s.desc}</p><b>{T.home.from} {n(s.price)}</b></div><span className="arrow">→</span></Link>
}

function Workers({user}){
  const {lang,T,n}=useLang();
  const serviceOptions = [
    { label:T.findServices.all, value:"" },
    { label:T.findServices.plumber, value:"plumb" },
    { label:T.findServices.electrician, value:"electr" },
    { label:T.findServices.cleaner, value:"clean" },
    { label:T.findServices.ac, value:"ac" },
    { label:T.findServices.appliance, value:"appliance" },
    { label:T.findServices.painting, value:"paint" }
  ];
  const areaList = ["Mirpur","Uttara","Dhanmondi","Mohammadpur","Banani"];
  const [searchParams]=useSearchParams();
  const requestedService=(searchParams.get("service")||"").toLowerCase();
  const [query,setQuery]=useState("");
  const [apiWorkers,setApiWorkers]=useState([]);
  const [locked,setLocked]=useState(!user);
  const [service,setService]=useState(serviceIdToKeyword[requestedService] ?? "");
  const [area,setArea]=useState("All areas");
  useEffect(()=>{
    let active=true;
    api("/workers").then(d=>{ if(!active)return; setApiWorkers(d.workers||[]); setLocked(typeof d.locked==="boolean"?d.locked:!user); })
      .catch(()=>{ if(active){ setApiWorkers([]); setLocked(!user); } });
    return ()=>{ active=false; };
  },[user]);
  useEffect(()=>{ setService(serviceIdToKeyword[requestedService] ?? ""); },[requestedService]);
  const filtered=apiWorkers.filter(w=>(!service||w.service.toLowerCase().includes(service))&&(locked||area==="All areas"||w.area===area)&&(w.name.toLowerCase().includes(query.toLowerCase())||w.service.toLowerCase().includes(query.toLowerCase())));
  return <main className="page">
    <div className="container">
      <div className="page-heading"><div><span className="eyebrow">{T.workers.eyebrow}</span><h1>{T.workers.title}</h1><p>{locked?T.workers.textLocked:T.workers.text}</p></div></div>
      <div className="filters">
        <div className="filter-search">⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder={T.workers.searchPlaceholder}/></div>
        <select value={service} onChange={e=>setService(e.target.value)}>{serviceOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
        {!locked&&<select value={area} onChange={e=>setArea(e.target.value)}><option value="All areas">{T.workers.allAreas}</option>{areaList.map(a=><option key={a} value={a}>{translateArea(lang,a)}</option>)}</select>}
      </div>
      <div className="results-bar"><b>{n(filtered.length)} {T.workers.foundMany}</b>{locked?<span>🔒 <Link to="/login">{T.header.login}</Link> — {T.workers.lockNote}</span>:<span>✓ {T.workers.verifiedNote}</span>}</div>
      <div className="worker-grid">{filtered.map(w=><WorkerCard key={w.id} w={w} locked={locked}/>)} </div>
      {!filtered.length && <div className="empty"><div>🔎</div><h3>{T.workers.none}</h3><p>{T.workers.noneText}</p></div>}
    </div>
  </main>
}

function WorkerCard({w,locked}){
  const {lang,T,n}=useLang();
  if(locked) return <div className="worker-card">
    <div className="worker-head"><div className="avatar">{w.avatar}</div>{w.verified&&<span className="verified">✓ {T.workerCard.verified}</span>}</div>
    <h3>{w.name}</h3><p className="role">{translateService(lang,w.service)}</p>
    <div className="rating"><span>🔒 {T.workerCard.lockedNote}</span></div>
    <div className="worker-bottom"><Link to={`/worker/${w.id}`} className="btn btn-primary btn-sm">{T.workerCard.viewProfile}</Link></div>
  </div>;
  return <div className="worker-card">
    <div className="worker-head"><div className="avatar">{w.avatar}</div><span className="verified">✓ {T.workerCard.verified}</span></div>
    <h3>{w.name}</h3><p className="role">{translateService(lang,w.service)} · {translateArea(lang,w.area)}</p>
    <div className="rating">{w.reviews > 0 ? <><b>★ {n(w.rating)}</b><span>({n(w.reviews)} {T.workerCard.reviews})</span></> : <span>{T.workerCard.newWorker}</span>}<span>· {n(w.jobs)} {T.workerCard.jobs}</span></div>
    <div className="worker-bottom"><div><small>{T.workerCard.starting}</small><strong>{n(w.price)}</strong></div><Link to={`/worker/${w.id}`} className="btn btn-primary btn-sm">{T.workerCard.viewProfile}</Link></div>
  </div>
}

function WorkerDetails({user}){
  const {lang,T,n}=useLang();
  const {id}=useParamsCompat();
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;
    setLoading(true);
    api(`/workers/${id}`)
      .then(d=>{ if(active){ setData(d); setLoading(false); } })
      .catch(()=>{ if(active){ setData(null); setLoading(false); } });
    return ()=>{ active=false; };
  },[id,user]);

  const sample=workers.find(x=>x.id===Number(id))||workers[0];
  const w=data?.worker||sample;
  const locked=data?data.locked:!user;

  if(loading&&!data) return <main className="page"><div className="container narrow"><div className="empty"><p>{T.workerDetails.loading}</p></div></div></main>;

  if(locked) return <main className="page"><div className="container narrow">
    <Link to="/workers" className="back">{T.workerDetails.back}</Link>
    <div className="profile-card">
      <div className="profile-top"><div className="avatar xl">{w.avatar}</div><div>{w.verified&&<div className="verified">✓ {T.workerDetails.nidVerified}</div>}<h1>{w.name}</h1><p>{translateService(lang,w.service)}</p></div></div>
      <div className="profile-body">
        <h2>{T.workerDetails.privateTitle}</h2>
        <p>{T.workerDetails.privateText}</p>
        <div className="notice">🔒 {T.workerDetails.privateNotice}</div>
      </div>
      <div className="profile-action"><Link to="/login" state={{from:`/worker/${id}`}} className="btn btn-primary btn-lg">{T.workerDetails.loginView}</Link><Link to="/register" className="btn btn-outline">{T.workerDetails.createAccount}</Link></div>
    </div>
  </div></main>;

  return <main className="page"><div className="container narrow">
    <Link to="/workers" className="back">{T.workerDetails.back}</Link>
    <div className="profile-card">
      <div className="profile-top"><div className="avatar xl">{w.avatar}</div><div>{w.verified?<div className="verified">✓ {T.workerDetails.nidVerified}</div>:<div className="pending">⏳ {T.workerDash.nidPending}</div>}<h1>{w.name}</h1><p>{translateService(lang,w.service)} · {translateArea(lang,w.area)}</p><div className="rating">{w.reviews > 0 ? <><b>★ {n(w.rating)}</b><span>{n(w.reviews)} {T.workerCard.reviews}</span></> : <span>{T.workerCard.newWorker}</span>}</div></div><div className="profile-price"><small>{T.workerCard.starting}</small><strong>{n(w.price)}</strong></div></div>
      <div className="profile-stats"><div><b>{n(w.jobs)}</b><span>{T.workerDetails.jobsCompleted}</span></div><div><b>{w.reviews > 0 ? n(w.rating) : "—"}</b><span>{T.workerDetails.avgRating}</span></div><div><b>{n(w.experience||"—")}</b><span>{T.workerDetails.yearsExp}</span></div><div><b>{w.phone||T.workerDetails.private}</b><span>{T.workerDetails.contact}</span></div></div>
      <div className="profile-body"><h2>{T.workerDetails.about}</h2><p>{data?.bio||w.bio||T.workerDetails.bio}</p><h2>{T.workerDetails.recentReviews}</h2>{data?.reviews?.length?data.reviews.map((rv,i)=><Review key={i} name={rv.customerName} text={rv.comment||T.workerDetails.noComment} stars={"★".repeat(rv.rating)}/>):<p>{T.workerDetails.noReviews}</p>}</div>
      <div className="profile-action"><Link to={`/book/${w.id}`} className="btn btn-primary btn-lg">{T.workerDetails.bookWorker}</Link></div>
    </div>
  </div></main>;
}
function Review({name,text,stars}){return <div className="review"><div className="avatar mini">{name.slice(0,1)}</div><div><b>{name}</b><span className="stars">{stars}</span><p>{text}</p></div></div>}
function Stars({value}){const v=Math.max(0,Math.min(5,Math.round(Number(value)||0)));return <span className="stars">{"★".repeat(v)}{"☆".repeat(5-v)}</span>;}
function useParamsCompat(){ const loc=useLocation(); return {id:loc.pathname.split("/").pop()}; }

function Booking({user,bookings,saveBookings}){
  const {lang,T,n}=useLang();
  const {id}=useParamsCompat(); const navigate=useNavigate();
  const [w,setW]=useState(null);
  const [loading,setLoading]=useState(true);
  const [form,setForm]=useState({date:"",time:"",address:"",note:""});
  const [done,setDone]=useState(false);
  useEffect(()=>{
    let active=true;
    setLoading(true);
    api(`/workers/${id}`)
      .then(d=>{ if(active){ setW(d.worker||null); setLoading(false); } })
      .catch(()=>{ if(active){ setW(null); setLoading(false); } });
    return ()=>{ active=false; };
  },[id]);
  const submit=async(e)=>{e.preventDefault(); if(!w) return; try { const d=await api("/bookings",{method:"POST",body:JSON.stringify({workerId:w.id,service:w.service,date:form.date,time:form.time,address:form.address,note:form.note})}); saveBookings([d.booking,...bookings]); setDone(true); } catch(err) { alert(T.booking.demoAlert + " " + err.message); }};
  if(loading) return <main className="page"><div className="container narrow"><div className="empty"><p>{T.workerDetails.loading}</p></div></div></main>;
  if(!w) return <main className="page"><div className="container narrow"><div className="empty"><div>🔎</div><h3>{T.workers.none}</h3><p>{T.workers.noneText}</p><Link to="/workers" className="btn btn-primary">{T.booking.findAnother}</Link></div></div></main>;
  if(done) return <main className="page"><div className="container narrow"><div className="success-card"><div className="success-icon">✓</div><h1>{T.booking.sentTitle}</h1><p>{T.booking.sent(w.name)}</p><div className="success-actions"><Link to="/bookings" className="btn btn-primary">{T.booking.viewBookings}</Link><Link to="/workers" className="btn btn-outline">{T.booking.findAnother}</Link></div></div></div></main>;
  return <main className="page"><div className="container narrow">
    <Link to={`/worker/${w.id}`} className="back">{T.booking.backProfile}</Link>
    <div className="booking-layout">
      <form className="form-card" onSubmit={submit}><span className="eyebrow">{T.booking.eyebrow}</span><h1>{T.booking.titlePrefix} {w.name}</h1><p className="muted">{T.booking.subtitle}</p>
        <label>{T.booking.date}<input required type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label>
        <label>{T.booking.time}<select required value={form.time} onChange={e=>setForm({...form,time:e.target.value})}><option value="">{T.booking.selectTime}</option><option value="09:00 AM">{n("09:00 AM")}</option><option value="10:00 AM">{n("10:00 AM")}</option><option value="12:00 PM">{n("12:00 PM")}</option><option value="02:00 PM">{n("02:00 PM")}</option><option value="04:00 PM">{n("04:00 PM")}</option><option value="06:00 PM">{n("06:00 PM")}</option></select></label>
        <label>{T.booking.address}<input required value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder={T.booking.addressPlaceholder}/></label>
        <label>{T.booking.note} <span>{T.booking.optional}</span><textarea value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder={T.booking.notePlaceholder}/></label>
        <button className="btn btn-primary btn-lg full">{T.booking.send}</button>
        <small className="form-note">{T.booking.formNote}</small>
      </form>
      <div className="summary-card"><div className="summary-worker"><div className="avatar">{w.avatar}</div><div><b>{w.name}</b><span>{translateService(lang,w.service)}</span><span>{w.reviews>0?`★ ${n(w.rating)} · ${n(w.reviews)} ${T.workerCard.reviews}`:T.workerCard.newWorker}</span></div></div><hr/><div className="summary-row"><span>{T.booking.startingPrice}</span><b>{n(w.price)}</b></div><div className="info-box">🛡️ <span>{T.booking.secure}</span></div></div>
    </div>
  </div></main>
}

function Bookings({bookings,user}){
  const {lang,T,n}=useLang();
  const [remoteBookings,setRemoteBookings]=useState([]);
  const [reviewFor,setReviewFor]=useState(null);
  const [rating,setRating]=useState(5);
  const [comment,setComment]=useState("");
  const [reviewBusy,setReviewBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [searchParams,setSearchParams]=useSearchParams();
  const filter=searchParams.get("filter")||"all";
  const load=()=>api("/bookings").then(d=>setRemoteBookings(d.bookings||[])).catch(()=>setRemoteBookings([]));
  useEffect(()=>{load();},[]);
  const shownBookings=remoteBookings.filter(b=>filter==="completed"?b.status==="Completed":filter==="upcoming"?b.status!=="Completed"&&b.status!=="Cancelled":true);
  const openReview=(b)=>{setRating(5);setComment("");setNotice("");setReviewFor(b);};
  const complete=async(b)=>{try{await api(`/bookings/${b.id}/status`,{method:"PATCH",body:JSON.stringify({status:"Completed"})});await load();openReview(b);}catch(err){alert(err.message);}};
  const submitReview=async e=>{e.preventDefault();if(!reviewFor)return;setReviewBusy(true);try{await api(`/bookings/${reviewFor.id}/review`,{method:"POST",body:JSON.stringify({rating,comment})});setReviewFor(null);await load();setNotice(T.bookings.reviewThanks);}catch(err){alert(err.message);}finally{setReviewBusy(false);}};
  return <main className="page"><div className="container"><div className="page-heading"><div><span className="eyebrow">{T.bookings.eyebrow}</span><h1>{T.bookings.title}</h1><p>{T.bookings.text}</p></div><Link to="/workers" className="btn btn-primary">{T.bookings.new}</Link></div>
    {notice&&<div className="notice">{notice}</div>}
    <div className="booking-filters">{[["all",T.bookings.filterAll],["upcoming",T.bookings.filterUpcoming],["completed",T.bookings.filterCompleted]].map(([key,label])=><button key={key} type="button" className={"filter-tab"+(filter===key?" active":"")} onClick={()=>setSearchParams(key==="all"?{}:{filter:key})}>{label}</button>)}</div>
    {!shownBookings.length?<div className="empty"><div>📅</div><h3>{remoteBookings.length?T.bookings.noMatch:T.bookings.empty}</h3><p>{remoteBookings.length?T.bookings.noMatchText:T.bookings.emptyText}</p>{!remoteBookings.length&&<Link to="/workers" className="btn btn-primary">{T.bookings.findWorker}</Link>}</div>:
    <div className="booking-list">{shownBookings.map(b=><div className="booking-row" key={b.id}><div className="booking-id">{n(b.id)}</div><div className="booking-main"><h3>{translateService(lang,b.service)}</h3><p>{b.worker} · {translateArea(lang,b.area)}</p><Link to={`/chat/${b.id}`} className="btn btn-outline btn-sm">{T.chat.title}</Link></div><div><b>{n(b.date)}</b><span>{n(b.time)}</span></div><Status s={b.status}/><strong>{n(b.amount)}</strong><div className="booking-actions">{(b.status==="Accepted"||b.status==="Work Done")&&<button type="button" onClick={()=>complete(b)} className="btn btn-primary btn-sm">{b.status==="Work Done"?T.bookings.confirmWorkDone:T.bookings.workDone}</button>}{b.status==="Completed"&&(b.reviewed?<span className="reviewed-tag">{T.bookings.reviewed}</span>:<button type="button" onClick={()=>openReview(b)} className="btn btn-outline btn-sm">{T.bookings.rateWork}</button>)}</div></div>)}</div>}
    {reviewFor&&<div className="modal-overlay" onClick={()=>setReviewFor(null)}><form className="modal-card" onClick={e=>e.stopPropagation()} onSubmit={submitReview}><h2>{T.bookings.reviewTitle}</h2><p>{T.bookings.reviewSubtitle} <b>{reviewFor.worker}</b></p><div className="star-picker">{[1,2,3,4,5].map(s=><button type="button" key={s} className={"star"+(s<=rating?" active":"")} onClick={()=>setRating(s)} aria-label={String(s)}>★</button>)}</div><label>{T.bookings.comment}<textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder={T.bookings.commentPlaceholder} maxLength={500}/></label><div className="modal-actions"><button type="button" className="btn btn-outline" onClick={()=>setReviewFor(null)}>{T.bookings.cancel}</button><button type="submit" className="btn btn-primary" disabled={reviewBusy}>{reviewBusy?T.bookings.submitting:T.bookings.submitReview}</button></div></form></div>}
  </div></main>
}
function Chat({user}){
  const {lang,T,n}=useLang();
  const {id:code}=useParamsCompat();
  const [booking,setBooking]=useState(null);
  const [messages,setMessages]=useState([]);
  const [text,setText]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const listRef=useRef(null);
  const load=async()=>{
    try{
      const d=await api(`/bookings/${encodeURIComponent(code)}/messages`);
      setBooking(d.booking||null);
      setMessages(prev=>{
        const merged=new Map(prev.map(m=>[m.id,m]));
        for(const m of (d.messages||[])) merged.set(m.id,m);
        return [...merged.values()].sort((a,b)=>a.id-b.id);
      });
      setError("");
    }catch(err){ setError(err.message||T.chat.loadFailed); }
    finally{ setLoading(false); }
  };
  useEffect(()=>{
    let active=true;
    setLoading(true);
    setMessages([]);
    setBooking(null);
    load();
    const timer=setInterval(()=>{ if(active) load(); },3000);
    return ()=>{ active=false; clearInterval(timer); };
  },[code]);
  useEffect(()=>{ const el=listRef.current; if(el) el.scrollTop=el.scrollHeight; },[messages.length]);
  const send=async e=>{
    e.preventDefault();
    const body=text.trim();
    if(!body||busy) return;
    setBusy(true); setError("");
    try{
      const d=await api(`/bookings/${encodeURIComponent(code)}/messages`,{method:"POST",body:JSON.stringify({body})});
      setMessages(prev=>[...prev,d.message]);
      setText("");
    }catch(err){ setError(err.message); }
    finally{ setBusy(false); }
  };
  const counterpart=user?.role==="worker"?(booking?.customer||""):(booking?.worker||"");
  const back=user?.role==="worker"?"/worker-dashboard":"/bookings";
  return <main className="page"><div className="container narrow">
    <Link to={back} className="back">← {T.chat.back}</Link>
    <div className="chat-card">
      <div className="chat-head"><div className="avatar mini">{(counterpart||T.chat.title).slice(0,1)}</div><div><b>{T.chat.with} {counterpart||T.chat.title}</b><span>{booking?translateService(lang,booking.service)+" · "+booking.code:code}</span></div>{booking&&<Status s={booking.status}/>}</div>
      <div className="chat-messages" ref={listRef}>
        {loading&&!messages.length?<div className="empty small-empty"><p>…</p></div>:!messages.length?<div className="empty small-empty"><div>💬</div><p>{T.chat.empty}</p></div>:messages.map(m=><div key={m.id} className={"chat-bubble "+(m.mine?"mine":"theirs")}><div>{m.body}</div><small>{m.senderName} · {n(new Date(m.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}))}</small></div>)}
      </div>
      {error&&<div className="notice">{error}</div>}
      <form className="chat-form" onSubmit={send}><input value={text} onChange={e=>setText(e.target.value)} placeholder={T.chat.placeholder} maxLength={2000}/><button className="btn btn-primary" disabled={busy||!text.trim()}>{busy?T.chat.sending:T.chat.send}</button></form>
    </div>
  </div></main>;
}
function Status({s}){
  const {T}=useLang();
  const label=(T.status && T.status[s]) || s;
  return <span className={"status "+String(s).toLowerCase().replace(/\s+/g,"-")}>{label}</span>
}
function isNidImage(w){ return /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(w?.nidFileName||"") || /^data:image\//i.test(w?.nidUrl||""); }

function Login({login}){
  const {T}=useLang();
  const navigate=useNavigate(); const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const submit=async e=>{e.preventDefault(); try { const d=await api("/auth/login",{method:"POST",body:JSON.stringify({email,password})}); setToken(d.token||d.accessToken); login(d.user); navigate(homeFor(d.user.role)); } catch(err) { if(err.data?.requiresOtp){ navigate("/verify-otp",{state:{email:err.data.email||email,devOtp:err.data.devOtp||"",message:err.message}}); return; } alert(err.message+T.login.fail); }};
  return <main className="auth-page"><div className="auth-card"><Link to="/" className="logo center-logo"><span className="logo-mark">শ</span><span>Sheboy<span>Haat</span></span></Link><h1>{T.login.title}</h1><p>{T.login.subtitle}</p><form onSubmit={submit}><label>{T.login.email}<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={T.register.emailPlaceholder}/></label><label>{T.login.password}<input required type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></label><button className="btn btn-primary btn-lg full">{T.login.button}</button></form><div className="divider">{T.login.or}</div><Link to="/register" className="btn btn-outline full">{T.login.create}</Link><small className="demo-note">{T.login.note}</small></div></main>
}

const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const BD_PHONE_RE=/^01[3-9]\d{8}$/;

function Register({login}){
  const {T}=useLang();
  const navigate=useNavigate();
  const [role,setRole]=useState("customer"),[name,setName]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState("");
  const [phone,setPhone]=useState(""),[service,setService]=useState(""),[area,setArea]=useState(""),[experience,setExperience]=useState(""),[price,setPrice]=useState("500"),[nid,setNid]=useState(null),[busy,setBusy]=useState(false);
  const submit=async e=>{e.preventDefault();const cleanEmail=email.trim();if(!EMAIL_RE.test(cleanEmail)){alert(T.register.emailInvalid);return;}if(!BD_PHONE_RE.test(phone)){alert(T.register.phoneInvalid);return;}if(role==="worker"&&nid&&nid.size>5*1024*1024){alert(T.register.nidTooLarge);return;}setBusy(true);try{const d=await api("/auth/register",{method:"POST",body:JSON.stringify({name,email:cleanEmail,password,role,phone,service,area,experience,price,nidFileName:nid?.name||"",nidData:nid?await fileToDataUrl(nid):""})});if(d.requiresOtp){navigate("/verify-otp",{state:{email:d.email||cleanEmail,devOtp:d.devOtp||"",message:d.message}});return;}setToken(d.token||d.accessToken);login(d.user);navigate(homeFor(d.user?.role||role));}catch(err){alert(err.message);}finally{setBusy(false);}};
  return <main className="auth-page"><div className="auth-card wide"><Link to="/" className="logo center-logo"><span className="logo-mark">শ</span><span>Sheboy<span>Haat</span></span></Link><h1>{T.register.title}</h1><p>{T.register.subtitle}</p><div className="role-toggle"><button type="button" className={role==="customer"?"active":""} onClick={()=>setRole("customer")}>{T.register.customer}</button><button type="button" className={role==="worker"?"active":""} onClick={()=>setRole("worker")}>{T.register.worker}</button></div>
  <form onSubmit={submit}><label>{T.register.fullName}<input required value={name} onChange={e=>setName(e.target.value)} placeholder={T.register.namePlaceholder}/></label><label>{T.register.email}<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={T.register.emailPlaceholder}/><small className="field-hint">{T.register.emailHint}</small></label><label>{T.register.password}<input required type="password" minLength="6" value={password} onChange={e=>setPassword(e.target.value)} placeholder={T.register.passwordPlaceholder}/></label><label>{T.register.phone}<input required type="tel" inputMode="tel" autoComplete="tel" maxLength="11" value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,"").slice(0,11))} placeholder={T.register.phonePlaceholder}/><small className="field-hint">{T.register.phoneHint}</small></label>
  {role==="worker"&&<><label>{T.register.category}<input required value={service} onChange={e=>setService(e.target.value)} placeholder={T.register.categoryPlaceholder}/></label><label>{T.register.area}<input required value={area} onChange={e=>setArea(e.target.value)} placeholder={T.register.areaPlaceholder}/></label><label>{T.register.experience}<input required type="number" min="0" value={experience} onChange={e=>setExperience(e.target.value)}/></label><label>{T.register.price}<input required type="number" min="0" value={price} onChange={e=>setPrice(e.target.value)}/></label><label>{T.register.nid}<input type="file" accept="image/*,application/pdf" onChange={e=>setNid(e.target.files?.[0]||null)}/></label><div className="notice">{T.register.notice}</div></>}
  <button disabled={busy} className="btn btn-primary btn-lg full">{busy?T.register.creating:T.register.createBtn}</button></form><p className="auth-switch">{T.register.switch} <Link to="/login">{T.register.login}</Link></p></div></main>
}
function fileToDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);})}

function VerifyOtp({login}){
  const {T}=useLang();
  const navigate=useNavigate();
  const location=useLocation();
  const state=location.state||{};
  const [phone,setPhone]=useState(state.phone||"");
  const [email,setEmail]=useState(state.email||"");
  const [otp,setOtp]=useState("");
  const [devOtp,setDevOtp]=useState(state.devOtp||"");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState(state.message||state.smsError||"");
  const [error,setError]=useState("");
  const usingPhone=Boolean(phone)&&!email;
  const identifier=usingPhone?{phone}:{email};
  const submit=async e=>{e.preventDefault();setBusy(true);setError("");setNotice("");try{const d=await api("/auth/verify-otp",{method:"POST",body:JSON.stringify({...identifier,otp})});setToken(d.token||d.accessToken);login(d.user);navigate(homeFor(d.user.role));}catch(err){setError(err.message);}finally{setBusy(false);}};
  const resend=async()=>{setError("");setNotice("");try{const d=await api("/auth/resend-otp",{method:"POST",body:JSON.stringify(identifier)});if(d.devOtp)setDevOtp(d.devOtp);if(d.phone)setPhone(d.phone);setNotice(d.message||T.otp.resent);}catch(err){setError(err.message);}};
  const identifierValue=usingPhone?phone:email;
  return <main className="auth-page"><div className="auth-card"><Link to="/" className="logo center-logo"><span className="logo-mark">শ</span><span>Sheboy<span>Haat</span></span></Link><h1>{T.otp.title}</h1><p>{T.otp.subtitle} {identifierValue&&<b>{identifierValue}</b>}</p><form onSubmit={submit}>{usingPhone?<label>{T.otp.phone}<input required type="tel" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="01XXXXXXXXX"/></label>:<label>{T.otp.email}<input required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>}<label>{T.otp.code}<input className={error?"invalid":""} required inputMode="numeric" autoComplete="one-time-code" maxLength="6" value={otp} onChange={e=>{setOtp(e.target.value.replace(/\D/g,"").slice(0,6));if(error)setError("");}} placeholder="123456"/></label>{devOtp&&<div className="notice">{T.otp.devHint} <b>{devOtp}</b></div>}{error&&<p className="form-error" role="alert">{error}</p>}<button disabled={busy} className="btn btn-primary btn-lg full">{busy?T.otp.verifying:T.otp.verify}</button></form>{notice&&<p className="auth-switch">{notice}</p>}<button type="button" className="btn btn-outline full" onClick={resend} disabled={!identifierValue}>{T.otp.resend}</button><p className="auth-switch"><Link to="/login">{T.otp.back}</Link></p></div></main>;
}

function WorkerDashboard(){
  const {lang,T,n}=useLang();
  const navigate=useNavigate();
  const user=JSON.parse(localStorage.getItem("sheboyhaat_user")||"null");
  const [myBookings,setMyBookings]=useState([]);
  const [me,setMe]=useState(null);
  const [reviews,setReviews]=useState([]);
  const [nid,setNid]=useState(null);
  const [form,setForm]=useState({phone:"",service:"",area:"",experience:"",price:""});
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const loadBookings=()=>api("/bookings").then(d=>setMyBookings(d.bookings||[])).catch(()=>setMyBookings([]));
  const loadMe=()=>api("/workers/me").then(async d=>{const w=d.worker;setMe(w);setForm({phone:w.phone||"",service:w.service||"",area:w.area||"",experience:w.experience||"",price:String(w.price||"").replace(/[^0-9]/g,"")});if(w?.id){try{const det=await api(`/workers/${w.id}`);setReviews(det.reviews||[]);}catch{setReviews([]);}}else setReviews([]);}).catch(()=>{setMe(null);setReviews([]);});
  useEffect(()=>{loadBookings();loadMe();},[]);
  const requests=myBookings.filter(b=>b.status==="Requested");
  const approvedWorks=myBookings.filter(b=>b.status==="Accepted"||b.status==="Work Done"||b.status==="Completed");
  const approveWork=async(id)=>{try{await api(`/bookings/${id}/status`,{method:"PATCH",body:JSON.stringify({status:"Accepted"})});await loadBookings();}catch(err){alert(err.message);}};
  const completeWork=async(id)=>{try{await api(`/bookings/${id}/status`,{method:"PATCH",body:JSON.stringify({status:"Work Done"})});await loadBookings();}catch(err){alert(err.message);}};
  const verified=!!me?.verified;
  const rejected=!!me?.rejected;
  const needsNid=!!me&&!verified&&!rejected&&!me.hasNid;
  const completion=Number(me?.profileCompletion ?? (verified?100:85));
  const initials=(me?.avatar||user?.name||"W").slice(0,2).toUpperCase();
  const rating=Number(me?.rating||0);
  const reviewCount=Number(me?.reviews||0);
  const scrollTo=id=>{const el=document.getElementById(id);if(el)el.scrollIntoView({behavior:"smooth",block:"start"});};
  const setF=(k,v)=>setForm(f=>({...f,[k]:v}));
  const resubmit=async e=>{e.preventDefault();if(nid&&nid.size>5*1024*1024){alert(T.register.nidTooLarge);return;}setBusy(true);setNotice("");try{const d=await api("/workers/me/resubmit",{method:"POST",body:JSON.stringify({...form,nidFileName:nid?.name||"",nidData:nid?await fileToDataUrl(nid):""})});setMe(d.worker);setNid(null);setNotice(T.workerDash.resubmitted);}catch(err){setNotice(err.message);}finally{setBusy(false);}};
  return <main className="page"><div className="container">
    <section className="profile-hero">
      <div className="profile-hero-left">
        <div className="profile-avatar">{initials}</div>
        <div>
          <span className="eyebrow">{T.workerDash.eyebrow}</span>
          <h1>{T.workerDash.welcome} {user?.name||T.workerDash.fallback}</h1>
          <p>{me?translateService(lang,me.service):T.workerDash.registered}{me?.area?" · "+translateArea(lang,me.area):""}</p>
          <div className="hero-badges">
            {me&&(verified?<span className="verified">{T.workerDash.nidVerified}</span>:rejected?<span className="rejected">{T.workerDash.rejected}</span>:<span className="pending">{T.workerDash.nidPending}</span>)}
            <span className="rating-badge"><StatIcon name="star"/>{reviewCount?n(rating.toFixed(1)):"—"} ({n(reviewCount)})</span>
          </div>
        </div>
      </div>
      <div className="profile-hero-actions">
        {me?.id&&<Link to={`/worker/${me.id}`} className="btn btn-outline">{T.workerDash.publicProfile}</Link>}
        <Link to="/profile" className="btn btn-primary">{T.workerDash.profilePreview}</Link>
      </div>
    </section>
    {me&&!verified&&!rejected&&<div className="notice">{T.workerDash.pendingNote}</div>}
    {me&&(rejected||needsNid)&&<>
      <div className="notice">{rejected?T.workerDash.rejectedNote:T.register.notice}</div>
      {rejected&&(me.rejectionReasonEn||me.rejectionReasonBn)&&<div className="reason-card"><h4>{T.workerDash.adminComment}</h4>{me.rejectionReasonEn&&<p><b>EN:</b> {me.rejectionReasonEn}</p>}{me.rejectionReasonBn&&<p><b>বাংলা:</b> {me.rejectionReasonBn}</p>}</div>}
      <section className="panel resubmit-card"><div className="panel-title"><h2>{T.workerDash.resubmitTitle}</h2><span>{T.workerDash.adminManaged}</span></div><p>{T.workerDash.resubmitText}</p>
        <form onSubmit={resubmit}>
          <label>{T.workerDash.newNid}<input type="file" accept="image/*,application/pdf" onChange={e=>setNid(e.target.files?.[0]||null)}/></label>
          <div className="field-grid">
            <div><label>{T.register.phone}</label><input value={form.phone} onChange={e=>setF("phone",e.target.value)}/></div>
            <div><label>{T.register.category}</label><input value={form.service} onChange={e=>setF("service",e.target.value)}/></div>
            <div><label>{T.register.area}</label><input value={form.area} onChange={e=>setF("area",e.target.value)}/></div>
            <div><label>{T.register.experience}</label><input type="number" min="0" value={form.experience} onChange={e=>setF("experience",e.target.value)}/></div>
            <div><label>{T.register.price}</label><input type="number" min="0" value={form.price} onChange={e=>setF("price",e.target.value)}/></div>
          </div>
          <p><small>{T.workerDash.keepNote}</small></p>
          <button disabled={busy} className="btn btn-primary">{busy?T.workerDash.resubmitting:T.workerDash.submitResubmit}</button>
        </form>
      </section>
    </>}
    {notice&&<div className="notice">{notice}</div>}
    <div className="dash-stats">
      <Stat icon="wallet" tone="tone-wallet" n={n("৳"+Number(me?.earnings||0).toLocaleString("en-US"))} label={T.workerDash.totalEarned} hint={T.workerDash.viewEarnings} onClick={()=>navigate("/worker-earnings")}/>
      <Stat icon="check" tone="tone-check" n={n(me?.jobs ?? 0)} label={T.workerDash.jobsCompleted} hint={T.workerDash.viewJobs} onClick={()=>navigate("/worker-earnings")}/>
      <Stat icon="star" tone="tone-star" n={reviewCount?n(rating.toFixed(1)):"—"} label={T.workerDash.rating} hint={n(reviewCount)+" "+T.workerDash.reviewsLabel} onClick={()=>scrollTo("worker-reviews")}/>
      <Stat icon="inbox" tone="tone-inbox" n={n(requests.length)} label={T.workerDash.requests} hint={T.workerDash.pending} onClick={()=>scrollTo("worker-requests")}/>
    </div>
    <div className="dashboard-grid">
      <section className="panel" id="worker-requests"><div className="panel-title"><h2>{T.workerDash.requests}</h2><span>{n(requests.length)} {T.workerDash.pending}</span></div>{requests.length?requests.map(b=><div className="request" key={b.id}><div className="avatar mini">{(b.customer||"C")[0]}</div><div><b>{b.customer||T.workerDash.customer}</b><span>{translateService(lang,b.service)} · {n(b.date)} · {n(b.time)} · {n(b.amount)}</span><small>📍 {translateArea(lang,b.area)}</small>{b.note?<small>📍 {b.note}</small>:null}</div><Link to={`/chat/${b.id}`} className="btn btn-outline btn-sm">{T.chat.title}</Link><button onClick={()=>approveWork(b.id)} className="btn btn-primary btn-sm">{T.workerDash.approveWork}</button></div>):<div className="empty small-empty"><div>✓</div><p>{T.workerDash.noRequests}</p></div>}</section>
      <section className="panel"><div className="panel-title"><h2>{T.workerDash.profileDetails}</h2>{me?.id&&<Link to={`/worker/${me.id}`}>{T.workerDash.publicProfile}</Link>}</div><div className="worker-preview"><div className="avatar">{me?.avatar||initials}</div><div><h3>{me?.name||user?.name||T.workerDash.yourProfile}</h3><p>{me?translateService(lang,me.service):T.workerDash.registered}</p><div className="rating"><Stars value={reviewCount?rating:0}/><b>{reviewCount?n(rating.toFixed(1)):T.workerDash.ratingLater}</b>{reviewCount>0&&<span>({n(reviewCount)})</span>}</div></div></div><div className="worker-meta"><div><span>{T.workerDash.phone}</span><b>{me?.phone||"—"}</b></div><div><span>{T.workerDash.area}</span><b>{me?.area?translateArea(lang,me.area):"—"}</b></div><div><span>{T.workerDash.experienceLabel}</span><b>{me?.experience?n(me.experience)+" "+T.admin.years:"—"}</b></div><div><span>{T.workerDash.startingPrice}</span><b>{me?.price?n(me.price):"—"}</b></div></div><div className="profile-progress"><div><span>{T.workerDash.completion}</span><b>{n(completion+"%")}</b></div><div className="progress"><i style={{width:completion+"%"}}></i></div></div></section>
    </div>
    
    <div className="dashboard-grid">
      <section className="panel approved-works"><div className="panel-title"><h2>{T.workerDash.approvedWorks}</h2><span>{n(approvedWorks.length)} {T.workerDash.approved}</span></div>{approvedWorks.length?approvedWorks.map(b=><div className="request" key={b.id}><div className="avatar mini">{(b.customer||"C")[0]}</div><div><b>{b.customer||T.workerDash.customer}</b><span>{translateService(lang,b.service)} · {n(b.date)} · {n(b.time)} · {n(b.amount)}</span><small>📍 {translateArea(lang,b.area)}</small>{b.status==="Work Done"&&<small>{T.workerDash.awaitingCustomer}</small>}</div><Link to={`/chat/${b.id}`} className="btn btn-outline btn-sm">{T.chat.title}</Link>{b.status==="Accepted"&&<button onClick={()=>completeWork(b.id)} className="btn btn-primary btn-sm">{T.workerDash.workDone}</button>}<Status s={b.status}/></div>):<div className="empty small-empty"><div>✓</div><p>{T.workerDash.noApproved}</p></div>}</section>
      <section className="panel" id="worker-reviews"><div className="panel-title"><h2>{T.workerDash.reviewsTitle}</h2><span>{n(reviewCount)} {T.workerDash.reviewsLabel}</span></div><div className="reviews-summary"><b>{reviewCount?n(rating.toFixed(1)):"—"}</b><div><Stars value={reviewCount?rating:0}/><span>{n(reviewCount)} {T.workerDash.reviewsLabel}</span></div></div>{reviews.length?reviews.map((rv,i)=><Review key={i} name={rv.customerName} text={rv.comment||T.workerDetails.noComment} stars={"★".repeat(rv.rating)}/>):<div className="empty small-empty"><div>★</div><p>{T.workerDash.noReviews}</p></div>}</section>
    </div>
  </div></main>
}

function WorkerEarnings(){
  const {lang,T,n}=useLang();
  const [me,setMe]=useState(null);
  const [list,setList]=useState([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{Promise.all([api("/workers/me").then(d=>d.worker).catch(()=>null),api("/bookings").then(d=>(d.bookings||[]).filter(b=>b.status==="Completed")).catch(()=>[])]).then(([w,b])=>{setMe(w);setList(b);}).finally(()=>setLoading(false));},[]);
  const toAmount=b=>{const v=parseInt(String(b.amount||"").replace(/[^0-9]/g,""),10);return isNaN(v)?0:v;};
  const total=list.reduce((s,b)=>s+toAmount(b),0);
  const avg=list.length?Math.round(total/list.length):0;
  const earned=Number(me?.earnings??total);
  const rating=Number(me?.rating||0);
  const reviewCount=Number(me?.reviews||0);
  return <main className="page"><div className="container">
    <div className="page-heading"><div><span className="eyebrow">{T.earnings.eyebrow}</span><h1>{T.earnings.title}</h1><p>{T.earnings.text}</p></div><Link to="/worker-dashboard" className="btn btn-outline">{T.earnings.back}</Link></div>
    <div className="dash-stats">
      <Stat icon="wallet" tone="tone-wallet" n={n("৳"+earned.toLocaleString("en-US"))} label={T.earnings.totalEarned}/>
      <Stat icon="check" tone="tone-check" n={n(list.length)} label={T.earnings.jobsCompleted}/>
      <Stat icon="calendar" tone="tone-clock" n={n("৳"+avg.toLocaleString("en-US"))} label={T.earnings.avgPerJob}/>
      <Stat icon="star" tone="tone-star" n={reviewCount?n(rating.toFixed(1)):"—"} label={T.earnings.rating} hint={n(reviewCount)+" "+T.workerDash.reviewsLabel}/>
    </div>
    <section className="panel">
      <div className="panel-title"><h2>{T.earnings.history}</h2><span>{n(list.length)} {T.earnings.entries}</span></div>
      {loading?<p className="muted">{T.earnings.loading}</p>:list.length?<div className="spend-list">{list.map(b=><div className="spend-row" key={b.id}><span className="stat-icon tone-check"><StatIcon name="check"/></span><div className="spend-main"><b>{translateService(lang,b.service)}</b><span>{b.customer||T.workerDash.customer} · {translateArea(lang,b.area)}</span><small>{n(b.date)} · {n(b.time)} · {b.id}</small></div><div className="spend-amount"><strong>{n(b.amount)}</strong><span>{T.earnings.earned}</span></div></div>)}</div>:<div className="empty"><div>৳</div><h3>{T.earnings.empty}</h3><p>{T.earnings.emptyText}</p><Link to="/worker-dashboard" className="btn btn-primary">{T.earnings.back}</Link></div>}
    </section>
  </div></main>
}

function Admin({bookings,saveBookings}){
  const {lang,T,n}=useLang();
  const [overview,setOverview]=useState({workers:6,pendingVerification:0,bookings:bookings.length,openReports:0});
  const [pending,setPending]=useState([]);
  const [rejected,setRejected]=useState([]);
  const [dbData,setDbData]=useState(null);
  const [error,setError]=useState("");
  const [openReject,setOpenReject]=useState(null);
  const [reasonEn,setReasonEn]=useState("");
  const [reasonBn,setReasonBn]=useState("");
  const load=()=>Promise.all([api("/admin/overview"),api("/admin/workers"),api("/admin/database")]).then(([o,w,d])=>{const all=w.workers||[];setOverview(o);setPending(all.filter(x=>x.hasNid&&!x.verified&&!x.rejected));setRejected(all.filter(x=>x.rejected));setDbData(d);setError("");}).catch(e=>setError(e.message));
  useEffect(()=>{load();},[]);
  const verify=async(id)=>{try{await api(`/admin/workers/${id}/verify`,{method:"PATCH"});setOpenReject(null);await load();}catch(e){setError(e.message);}};
  const openRejectFor=(id)=>{setOpenReject(id);setReasonEn("");setReasonBn("");};
  const sendReject=async(id)=>{if(!reasonEn.trim()&&!reasonBn.trim()){setError(T.admin.reasonRequired);return;}try{await api(`/admin/workers/${id}/reject`,{method:"PATCH",body:JSON.stringify({reasonEn,reasonBn})});setOpenReject(null);await load();}catch(e){setError(e.message);}};
  const nidLink=(w)=>w.nidUrl?(isNidImage(w)?<a className="nid-preview" href={w.nidUrl} target="_blank" rel="noreferrer" title={T.admin.viewNid}><img src={w.nidUrl} alt={T.admin.viewNid}/><span>📄 {T.admin.viewNid}</span></a>:<a className="nid-link" href={w.nidUrl} target="_blank" rel="noreferrer">📄 {T.admin.viewNid}{w.nidFileName?` · ${w.nidFileName}`:""}</a>):<small>{T.admin.nidNotAvailable}</small>;
  const workerInfo=(w)=><div><b>{w.name}</b><span>{w.email||T.admin.noEmail}</span><span>{translateService(lang,w.service)} · {translateArea(lang,w.area)}</span><small>{w.phone||T.admin.noPhone} · {w.experience?n(w.experience):T.admin.expNotGiven} {T.admin.years} · {w.price||T.admin.priceNotGiven}</small><small>{T.admin.profileCompletion}: {n(w.profileCompletion ?? 0)}% · {w.accountVerified?T.admin.otpVerified:T.admin.otpPending}</small>{nidLink(w)}</div>;
  return <main className="page"><div className="container"><div className="dashboard-head"><div><span className="eyebrow">{T.admin.eyebrow}</span><h1>{T.admin.title}</h1><p>{T.admin.subtitle}</p></div><span className="admin-badge">{T.admin.badge}</span></div>
    {error&&<div className="notice">{error} {T.admin.errorNote}</div>}
    <div className="dash-stats"><Stat n={n(overview.workers)} label={T.admin.workers}/><Stat n={n(overview.pendingVerification)} label={T.admin.pendingVerification}/><Stat n={n(overview.bookings)} label={T.admin.totalBookings}/><Stat n={n(overview.openReports)} label={T.admin.openReports}/></div>
    <div className="dashboard-grid"><section className="panel"><div className="panel-title"><h2>{T.admin.verification}</h2><span>{n(pending.length)} {T.admin.pending}</span></div>{pending.length?pending.map(w=><div className="request-wrap" key={w.id}><div className="request"><div className="avatar mini">{w.avatar}</div>{workerInfo(w)}<button onClick={()=>verify(w.id)} disabled={!w.accountVerified} title={!w.accountVerified?T.admin.otpRequired:""} className="btn btn-primary btn-sm">{T.admin.approve}</button><button onClick={()=>openRejectFor(w.id)} className="btn btn-outline btn-sm">{T.admin.reject}</button></div>{openReject===w.id&&<div className="reject-box"><label>{T.admin.reasonEnLabel}<textarea rows="2" value={reasonEn} onChange={e=>setReasonEn(e.target.value)} placeholder={T.admin.reasonEnPlaceholder}/></label><label>{T.admin.reasonBnLabel}<textarea rows="2" value={reasonBn} onChange={e=>setReasonBn(e.target.value)} placeholder={T.admin.reasonBnPlaceholder}/></label><div className="reject-actions"><button onClick={()=>sendReject(w.id)} className="btn btn-primary btn-sm">{T.admin.sendReject}</button><button onClick={()=>setOpenReject(null)} className="btn btn-outline btn-sm">{T.admin.cancel}</button></div></div>}</div>):<div className="empty small-empty"><div>✓</div><p>{T.admin.noPending}</p></div>}</section>
    <section className="panel"><div className="panel-title"><h2>{T.admin.quickActions}</h2></div><div className="admin-actions"><button onClick={()=>api("/admin/reports").then(d=>alert(T.admin.reportFound(n((d.reports||[]).length)))).catch(e=>alert(e.message))}>{T.admin.reviewReports}</button><button onClick={()=>alert(T.admin.mapMsg)}>{T.admin.map}</button><button onClick={()=>alert(T.admin.settingsMsg)}>{T.admin.settings}</button><button onClick={()=>alert(T.admin.analyticsMsg(n(overview.workers),n(overview.bookings)))}>{T.admin.analytics}</button></div></section></div>
    {rejected.length>0&&<section className="panel" style={{marginTop:24}}><div className="panel-title"><h2>{T.admin.rejectedWorkers}</h2><span>{n(rejected.length)} {T.admin.rejected}</span></div>{rejected.map(w=><div className="request" key={w.id}><div className="avatar mini">{w.avatar}</div><div><b>{w.name}</b><span>{w.email||T.admin.noEmail}</span><span>{translateService(lang,w.service)} · {translateArea(lang,w.area)}</span>{w.rejectionReasonEn&&<small>EN · {w.rejectionReasonEn}</small>}{w.rejectionReasonBn&&<small>BN · {w.rejectionReasonBn}</small>}{nidLink(w)}</div><button onClick={()=>verify(w.id)} className="btn btn-outline btn-sm">{T.admin.reapprove}</button></div>)}</section>}
    <section className="panel" style={{marginTop:24}}><div className="panel-title"><h2>{T.admin.dbRecords}</h2><button className="btn btn-outline btn-sm" onClick={load}>{T.admin.refresh}</button></div>{dbData?<><p>{T.admin.dbText}</p>{Object.entries(dbData).map(([table,rows])=><details key={table} style={{margin:"12px 0"}}><summary style={{cursor:"pointer",fontWeight:700,textTransform:"capitalize"}}>{table} ({n(rows.length)})</summary><div style={{overflowX:"auto",marginTop:10}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>{rows.length ? <><thead><tr>{Object.keys(rows[0]).map(k=><th key={k} style={{textAlign:"left",padding:8,borderBottom:"1px solid #ddd"}}>{k}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{Object.values(row).map((v,j)=><td key={j} style={{padding:8,borderBottom:"1px solid #eee"}}>{n(String(v??""))}</td>)}</tr>)}</tbody></> : <tbody><tr><td>{T.admin.noRecords}</td></tr></tbody>}</table></div></details>)}</>:<p>{T.admin.dbFail}</p>}</section>
  </div></main>
}

function ProfileInfo({user}){
  const {lang,T,n}=useLang();
  const [me,setMe]=useState(null);
  const [list,setList]=useState([]);
  useEffect(()=>{
    if(user?.role==="worker")api("/workers/me").then(d=>setMe(d.worker)).catch(()=>setMe(null));
    api("/bookings").then(d=>setList(d.bookings||[])).catch(()=>setList([]));
  },[user?.role]);
  const roleLabel=user?.role==="worker"?T.profile.worker:user?.role==="admin"?T.profile.admin:T.profile.customer;
  const initials=(user?.name||"U").trim().split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase();
  const completed=list.filter(b=>b.status==="Completed");
  const spent=completed.reduce((sum,b)=>{const v=parseInt(String(b.amount||"").replace(/[^0-9]/g,""),10);return sum+(isNaN(v)?0:v);},0);
  const reviewCount=Number(me?.reviews||0);
  return <main className="page"><div className="container">
    <div className="page-heading"><div><span className="eyebrow">{T.profileInfo.eyebrow}</span><h1>{T.profileInfo.title}</h1><p>{T.profileInfo.text}</p></div><Link to="/settings" className="btn btn-primary">{T.profileInfo.edit}</Link></div>
    <section className="profile-hero">
      <div className="profile-hero-left">
        <div className="profile-avatar">{initials}</div>
        <div><h1>{user?.name||T.profile.titleFallback}</h1><p>{user?.email||T.profile.emailFallback}</p><span className="role-pill">{roleLabel}</span></div>
      </div>
      <div className="profile-hero-actions"><Link to="/settings" className="btn btn-outline">{T.profileInfo.edit}</Link></div>
    </section>
    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-title"><h2>{T.profileInfo.details}</h2></div>
        <div className="settings-row"><span>{T.profileInfo.name}</span><b>{user?.name||"—"}</b></div>
        <div className="settings-row"><span>{T.profileInfo.email}</span><b>{user?.email||"—"}</b></div>
        <div className="settings-row"><span>{T.profileInfo.phone}</span><b>{user?.phone||T.profileInfo.noPhone}</b></div>
        <div className="settings-row"><span>{T.profileInfo.role}</span><b>{roleLabel}</b></div>
      </section>
      <section className="panel">
        <div className="panel-title"><h2>{T.profileInfo.activity}</h2></div>
        <div className="settings-row"><span>{T.profileInfo.totalBookings}</span><b>{n(list.length)}</b></div>
        <div className="settings-row"><span>{T.profileInfo.completed}</span><b>{n(completed.length)}</b></div>
        {user?.role==="worker"
          ? <>
              <div className="settings-row"><span>{T.workerDash.totalEarned}</span><b>{n("৳"+Number(me?.earnings||0).toLocaleString("en-US"))}</b></div>
              <div className="settings-row"><span>{T.workerDash.rating}</span><b>{reviewCount?n(Number(me.rating).toFixed(1)):"—"}</b></div>
            </>
          : <div className="settings-row"><span>{T.profileInfo.spent}</span><b>{n("৳"+spent.toLocaleString("en-US"))}</b></div>}
      </section>
    </div>
    {user?.role==="worker"&&<section className="panel info-panel">
      <div className="panel-title"><h2>{T.profileInfo.workerDetails}</h2></div>
      <div className="settings-row"><span>{T.profileInfo.service}</span><b>{me?translateService(lang,me.service):"—"}</b></div>
      <div className="settings-row"><span>{T.profileInfo.area}</span><b>{me?.area?translateArea(lang,me.area):"—"}</b></div>
      <div className="settings-row"><span>{T.profileInfo.experience}</span><b>{me?.experience?n(me.experience)+" "+T.admin.years:"—"}</b></div>
      <div className="settings-row"><span>{T.profileInfo.startingPrice}</span><b>{me?.price?n(me.price):"—"}</b></div>
      <div className="settings-row"><span>{T.profileInfo.nidStatus}</span>{me?(me.verified?<span className="verified">{T.workerDash.nidVerified}</span>:me.rejected?<span className="rejected">✕ {T.workerDash.rejected}</span>:<span className="pending">⏳ {T.workerDash.nidPending}</span>):<b>…</b>}</div>
      {me?.rejected&&(me.rejectionReasonEn||me.rejectionReasonBn)&&<div className="reason-card"><h4>{T.workerDash.adminComment}</h4>{me.rejectionReasonEn&&<p><b>EN:</b> {me.rejectionReasonEn}</p>}{me.rejectionReasonBn&&<p><b>বাংলা:</b> {me.rejectionReasonBn}</p>}</div>}
    </section>}
  </div></main>
}

function Settings({user,updateUser,logout}){
  const {T}=useLang();
  const [form,setForm]=useState({name:"",email:"",phone:""});
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [confirmOpen,setConfirmOpen]=useState(false);
  const [password,setPassword]=useState("");
  const [deleting,setDeleting]=useState(false);
  useEffect(()=>{
    const digits=String(user?.phone||"").replace(/\D/g,"");
    setForm({name:user?.name||"",email:user?.email||"",phone:digits.startsWith("880")?"0"+digits.slice(3):digits});
  },[user?.id,user?.name,user?.email,user?.phone]);
  const setF=(k,v)=>setForm(f=>({...f,[k]:v}));
  const save=async e=>{
    e.preventDefault();setBusy(true);setError("");setNotice("");
    try{const d=await api("/auth/profile",{method:"PATCH",body:JSON.stringify(form)});updateUser(d.user);setNotice(T.accountSettings.saved);}
    catch(err){setError(err.message||T.accountSettings.updateFailed);}
    finally{setBusy(false);}
  };
  const remove=async e=>{
    e.preventDefault();setDeleting(true);setError("");
    try{await api("/auth/account",{method:"DELETE",body:JSON.stringify({password})});logout();}
    catch(err){setError(err.message||T.accountSettings.deleteFailed);setDeleting(false);}
  };
  return <main className="page"><div className="container narrow">
    <div className="page-heading"><div><span className="eyebrow">{T.accountSettings.eyebrow}</span><h1>{T.accountSettings.title}</h1><p>{T.accountSettings.text}</p></div></div>
    {notice&&<div className="notice">{notice}</div>}
    {error&&<div className="notice error-notice">{error}</div>}
    <section className="panel">
      <div className="panel-title"><h2>{T.accountSettings.updateTitle}</h2></div>
      <p>{T.accountSettings.updateText}</p>
      <form className="settings-form" onSubmit={save}>
        <label>{T.accountSettings.name}<input required value={form.name} onChange={e=>setF("name",e.target.value)}/></label>
        <label>{T.accountSettings.email}<input required type="email" value={form.email} onChange={e=>setF("email",e.target.value)}/></label>
        <label>{T.accountSettings.phone}<input required inputMode="tel" maxLength="11" value={form.phone} onChange={e=>setF("phone",e.target.value.replace(/\D/g,"").slice(0,11))} placeholder="01XXXXXXXXX"/></label>
        <button disabled={busy} className="btn btn-primary">{busy?T.accountSettings.saving:T.accountSettings.save}</button>
      </form>
    </section>
    {user?.role!=="admin"&&<section className="panel danger-zone">
      <div className="panel-title"><h2>{T.accountSettings.deleteTitle}</h2></div>
      <p>{T.accountSettings.deleteText}</p>
      <button type="button" className="btn btn-logout" onClick={()=>{setPassword("");setError("");setConfirmOpen(true);}}>{T.accountSettings.deleteButton}</button>
    </section>}
    {confirmOpen&&<div className="modal-overlay" onClick={()=>!deleting&&setConfirmOpen(false)}>
      <form className="modal-card" onClick={e=>e.stopPropagation()} onSubmit={remove}>
        <h2>{T.accountSettings.deleteConfirmTitle}</h2>
        <p>{T.accountSettings.deleteConfirmText}</p>
        <label>{T.accountSettings.password}<input required type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></label>
        <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={()=>setConfirmOpen(false)} disabled={deleting}>{T.accountSettings.cancel}</button><button type="submit" className="btn btn-logout" disabled={deleting||!password}>{deleting?T.accountSettings.deleting:T.accountSettings.confirmDelete}</button></div>
      </form>
    </div>}
  </div></main>
}

function Dashboard({user,logout}){
  const {lang,T,n}=useLang();
  const navigate=useNavigate();
  const [me,setMe]=useState(null);
  const [list,setList]=useState([]);
  useEffect(()=>{
    if(user?.role==="worker")api("/workers/me").then(d=>setMe(d.worker)).catch(()=>setMe(null));
    api("/bookings").then(d=>setList(d.bookings||[])).catch(()=>setList([]));
  },[user?.role]);
  const total=list.length;
  const completed=list.filter(b=>b.status==="Completed");
  const upcoming=list.filter(b=>b.status!=="Completed"&&b.status!=="Cancelled").length;
  const spent=completed.reduce((sum,b)=>{const v=parseInt(String(b.amount||"").replace(/[^0-9]/g,""),10);return sum+(isNaN(v)?0:v);},0);
  const roleLabel=user?.role==="worker"?T.profile.worker:user?.role==="admin"?T.profile.admin:T.profile.customer;
  const recent=list.slice(0,4);
  const initials=(user?.name||"U").trim().split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase();
  return <main className="page"><div className="container">
    <section className="profile-hero">
      <div className="profile-hero-left">
        <div className="profile-avatar">{initials}</div>
        <div>
          <span className="eyebrow">{T.profile.eyebrow}</span>
          <h1>{T.profile.welcome} {user?.name||T.profile.titleFallback}</h1>
          <span className="role-pill">{roleLabel}</span>
        </div>
      </div>
      <div className="profile-hero-actions">
        <Link to="/workers" className="btn btn-primary">{T.profile.newBooking}</Link>
        <Link to="/bookings" className="btn btn-outline">{T.profile.viewAll}</Link>
      </div>
    </section>
    <div className="dash-stats">
      <Stat icon="calendar" n={n(total)} label={T.profile.stats.total} onClick={()=>navigate("/bookings")}/>
      <Stat icon="clock" tone="tone-clock" n={n(upcoming)} label={T.profile.stats.upcoming} onClick={()=>navigate("/bookings?filter=upcoming")}/>
      <Stat icon="check" tone="tone-check" n={n(completed.length)} label={T.profile.stats.completed} onClick={()=>navigate("/bookings?filter=completed")}/>
      {user?.role==="worker"?<Stat icon="wallet" tone="tone-wallet" n={n("৳"+Number(me?.earnings||0).toLocaleString("en-US"))} label={T.profile.stats.earned} onClick={()=>navigate("/worker-dashboard")}/>:<Stat icon="wallet" tone="tone-wallet" n={n("৳"+spent.toLocaleString("en-US"))} label={T.profile.stats.spent} hint={T.profile.viewHistory} onClick={()=>navigate("/spending")}/>}
    </div>
    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-title"><h2>{T.profile.recent}</h2><Link to="/bookings">{T.profile.viewAll}</Link></div>
        {recent.length?recent.map(b=><div className="request" key={b.id}><div className="avatar mini">{(b.service||"?")[0]}</div><div><b>{translateService(lang,b.service)}</b><span>{n(b.date)} · {n(b.time)}</span><small>{b.worker} · {translateArea(lang,b.area)}</small></div><Status s={b.status}/></div>):<div className="empty small-empty"><div>📅</div><p>{T.profile.noBookings}</p></div>}
        <div className="profile-actions"><Link to="/workers" className="btn btn-primary btn-sm">{T.profile.newBooking}</Link><Link to="/bookings" className="btn btn-outline btn-sm">{T.profile.viewAll}</Link></div>
      </section>
      <section className="panel">
        <div className="panel-title"><h2>{T.profile.settings}</h2><Link to="/profile">{T.profileInfo.edit}</Link></div>
        <div className="settings-row"><span>{T.profile.language}</span><LangToggle/></div>
        <div className="settings-row"><span>{T.profile.notifications}</span><b>{T.profile.enabled}</b></div>
        <div className="settings-row"><span>{T.profileInfo.details}</span><Link to="/profile">{T.menu.profile}</Link></div>
        <button onClick={logout} className="btn btn-logout btn-lg full profile-logout"><LogoutIcon/> {T.profile.logout}</button>
      </section>
    </div>
  </div></main>
}

function Spending(){
  const {lang,T,n}=useLang();
  const [list,setList]=useState([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{api("/bookings").then(d=>setList((d.bookings||[]).filter(b=>b.status==="Completed"))).catch(()=>setList([])).finally(()=>setLoading(false));},[]);
  const toAmount=b=>{const v=parseInt(String(b.amount||"").replace(/[^0-9]/g,""),10);return isNaN(v)?0:v;};
  const total=list.reduce((s,b)=>s+toAmount(b),0);
  const avg=list.length?Math.round(total/list.length):0;
  return <main className="page"><div className="container">
    <div className="page-heading"><div><span className="eyebrow">{T.spending.eyebrow}</span><h1>{T.spending.title}</h1><p>{T.spending.text}</p></div><Link to="/workers" className="btn btn-primary">{T.spending.findWorker}</Link></div>
    <div className="dash-stats">
      <Stat icon="wallet" tone="tone-wallet" n={n("৳"+total.toLocaleString("en-US"))} label={T.spending.totalSpent}/>
      <Stat icon="check" tone="tone-check" n={n(list.length)} label={T.spending.jobsPaid}/>
      <Stat icon="calendar" tone="tone-clock" n={n("৳"+avg.toLocaleString("en-US"))} label={T.spending.avgCost}/>
    </div>
    <section className="panel">
      <div className="panel-title"><h2>{T.spending.history}</h2><span>{n(list.length)} {T.spending.entries}</span></div>
      {loading?<p className="muted">{T.spending.loading}</p>:list.length?<div className="spend-list">{list.map(b=><div className="spend-row" key={b.id}><span className="stat-icon tone-check"><StatIcon name="check"/></span><div className="spend-main"><b>{translateService(lang,b.service)}</b><span>{b.worker} · {translateArea(lang,b.area)}</span><small>{n(b.date)} · {n(b.time)} · {b.id}</small></div><div className="spend-amount"><strong>{n(b.amount)}</strong><span>{T.spending.paid}</span></div></div>)}</div>:<div className="empty"><div>৳</div><h3>{T.spending.empty}</h3><p>{T.spending.emptyText}</p><Link to="/workers" className="btn btn-primary">{T.spending.findWorker}</Link></div>}
    </section>
  </div></main>
}

function HowItWorks(){
  const {T,n}=useLang();
  const p=T.pages.how;
  const StepList=({items})=><div className="info-steps">{items.map((s,i)=><div className="info-step" key={i}><span className="info-step-num">{n(i+1)}</span><div><h3>{s.t}</h3><p>{s.d}</p></div></div>)}</div>;
  return <main className="page"><div className="container narrow">
    <div className="page-heading"><div><span className="eyebrow">{p.eyebrow}</span><h1>{p.title}</h1><p>{p.text}</p></div></div>
    <section className="panel info-panel"><div className="panel-title"><h2>{p.customer}</h2></div><StepList items={p.custSteps}/></section>
    <section className="panel info-panel"><div className="panel-title"><h2>{p.worker}</h2></div><StepList items={p.workSteps}/></section>
    <div className="center info-cta"><Link to="/workers" className="btn btn-primary">{p.cta}</Link></div>
  </div></main>
}

function ImportantNotes({user}){
  const {T}=useLang();
  const p=T.pages.notes;
  const isWorker=user?.role==="worker";
  const title=isWorker?p.workerTitle:p.title;
  const text=isWorker?p.workerText:p.text;
  const notes=isWorker?(p.workerNotes||p.notes):p.notes;
  const cta=isWorker?(p.workerCta||p.cta):p.cta;
  const ctaTo=isWorker?"/worker-dashboard":"/workers";
  return <main className="page"><div className="container narrow">
    <div className="page-heading"><div><span className="eyebrow">{p.eyebrow}</span><h1>{title}</h1><p>{text}</p></div></div>
    <div className="notes-grid">{notes.map((note,i)=><div className="note-card" key={i}><h3>{note.t}</h3><p>{note.d}</p></div>)}</div>
    <div className="center info-cta"><Link to={ctaTo} className="btn btn-primary">{cta}</Link></div>
  </div></main>
}

function NeedHelp(){
  const {T}=useLang();
  const p=T.pages.help;
  return <main className="page"><div className="container narrow">
    <div className="page-heading"><div><span className="eyebrow">{p.eyebrow}</span><h1>{p.title}</h1><p>{p.text}</p></div></div>
    <div className="faq-list">{p.faqs.map((f,i)=><div className="faq-item" key={i}><h3>{f.q}</h3><p>{f.a}</p></div>)}</div>
    <div className="contact-card"><div><h2>{p.contactTitle}</h2><p>{p.contactText}</p></div><div className="contact-links"><a href={`mailto:${p.email}`}>{p.email}</a><a href={`tel:${p.phone.replace(/\s/g,"")}`}>{p.phone}</a></div></div>
  </div></main>
}

function NotFound(){const {T}=useLang();return <main className="page"><div className="container empty"><div>404</div><h1>{T.notFound.title}</h1><Link to="/" className="btn btn-primary">{T.notFound.home}</Link></div></main>}
function Footer(){const {T}=useLang();return <footer><div className="container footer-grid"><div><Link to="/" className="logo"><span className="logo-mark">শ</span><span>Sheboy<span>Haat</span></span></Link><p>{T.footer.tagline}<br/>{T.footer.tagline2}</p></div><div><b>{T.footer.platform}</b><Link to="/services">{T.nav.services}</Link><Link to="/workers">{T.nav.workers}</Link><Link to="/bookings">{T.nav.bookings}</Link></div><div><b>{T.footer.forWorkers}</b><Link to="/register">{T.footer.join}</Link><Link to="/worker-dashboard">{T.footer.workerDashboard}</Link></div><div><b>{T.footer.demoAdmin}</b><Link to="/admin">{T.footer.adminPanel}</Link><span>support@sheboyhaat.demo</span></div></div><div className="footer-bottom"><div className="container">{T.footer.copyright}</div></div></footer>}

function Services(){const {T}=useLang();return <main className="page"><div className="container"><div className="page-heading"><div><span className="eyebrow">{T.services.eyebrow}</span><h1>{T.services.title}</h1><p>{T.services.text}</p></div></div><div className="service-grid large">{services.map(s=><ServiceCard key={s.id} s={s}/>)}</div></div></main>}
function ServicesDummy(){return null}

export default App;






