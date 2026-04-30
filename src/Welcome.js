// src/Welcome.js
import React, { useEffect, useMemo, useState } from "react";

// Stitching Supervisor specific navigation (same data, enhanced)
const STITCHING_SUPERVISOR_OPTIONS = [
  {
    id: "daily-report",
    label: "Daily Report",
    emoji: "📊",
    component: "DailyReport",
    description: "View and submit daily stitching reports with production metrics",
    color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    accentColor: "#667eea",
    instructions: [
      "Track daily production output",
      "Monitor quality metrics",
      "Submit end-of-day reports"
    ]
  },
  {
    id: "issue",
    label: "Issue to Stitching",
    emoji: "🚚",
    component: "IssueToStitching",
    description: "Manage fabric and accessory issues to stitching lines",
    color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    accentColor: "#f5576c",
    instructions: [
      "Issue raw materials to lines",
      "Track material consumption",
      "Manage inventory levels"
    ]
  },
  {
    id: "rate-list",
    label: "Rate List",
    emoji: "💰",
    component: "RateList",
    description: "Maintain and review stitching rate list and pricing",
    color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    accentColor: "#4facfe",
    instructions: [
      "Update operation rates",
      "Review pricing structures",
      "Manage operator payments"
    ]
  },
  {
    id: "material-stitching-order",
    label: "Material Stitching Order",
    emoji: "🧵",
    component: "MaterialStitchingOrder",
    description: "Create and track material orders for stitching operations",
    color: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    accentColor: "#43e97b",
    instructions: [
      "Create material requests",
      "Track order status",
      "Manage delivery schedules"
    ]
  },
  {
    id: "zip",
    label: "Zip Management",
    emoji: "🤐",
    component: "ZipManagement",
    description: "Manage zip inventory, orders and consumption tracking",
    color: "linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)",
    accentColor: "#FF6B6B",
    instructions: [
      "Track zip inventory levels",
      "Place zip orders with suppliers",
      "Monitor zip consumption per style",
      "Manage zip quality control"
    ]
  },
  {
    id: "dori",
    label: "Dori Management",
    emoji: "🎀",
    component: "DoriManagement",
    description: "Manage dori (drawstring) inventory and order processing",
    color: "linear-gradient(135deg, #A8E6CF 0%, #3EDBF0 100%)",
    accentColor: "#3EDBF0",
    instructions: [
      "Monitor dori stock levels",
      "Process dori material orders",
      "Track dori usage per garment",
      "Manage dori color and size variants"
    ]
  },
  {
    id: "daily-updation",
    label: "Daily Updation System",
    emoji: "🔄",
    component: "DailyUpdationSystem",
    description: "Real-time production tracking and daily progress updates",
    color: "linear-gradient(135deg, #FF9A8B 0%, #FF6A88 100%)",
    accentColor: "#FF6A88",
    instructions: [
      "Update real-time production progress",
      "Track hourly output targets",
      "Monitor line efficiency metrics",
      "Generate shift-wise performance reports"
    ]
  },
  {
    id: "alter-job-order",
    label: "Alter Job Order",
    emoji: "✂️",
    component: "AlterJobOrder",
    description: "Manage alteration job orders and track modification requests",
    color: "linear-gradient(135deg, #8A2BE2 0%, #4B0082 100%)",
    accentColor: "#8A2BE2",
    instructions: [
      "Create alteration job orders",
      "Track modification requests",
      "Monitor alteration progress",
      "Manage customer alteration requirements"
    ]
  },
  {
    id: "palla-job-order",
    label: "Palla Job Order",
    emoji: "🧣",
    component: "PallaJobOrder",
    description: "Create and manage palla job orders for specialized stitching and finishing operations",
    color: "linear-gradient(135deg, #FFB347 0%, #FF8C00 100%)",
    accentColor: "#FF8C00",
    instructions: [
      "Create new palla job orders with specific requirements",
      "Assign palla work to karigars with appropriate skills",
      "Track palla production progress and quality checks",
      "Manage palla inventory and material requirements",
      "Monitor palla completion status and delivery schedules"
    ]
  },
  {
    id: "extra-pcs",
    label: "Extra Pcs",
    emoji: "➕",
    component: "Extrapcs",
    description: "Manage and track extra piece production, adjustments, and inventory corrections",
    color: "linear-gradient(135deg, #FF6B35 0%, #F08A5D 100%)",
    accentColor: "#FF6B35",
    instructions: [
      "Track extra piece production beyond planned orders",
      "Manage adjustment entries for inventory corrections",
      "Record damage replacements and quality adjustments",
      "Monitor excess production for reporting",
      "Handle special requests and sample piece management"
    ]
  },
  {
    id: "create-karigar-profile",
    label: "Create Karigar Profile",
    emoji: "👤",
    component: "CreateKarigarProfile",
    description: "Create and manage artisan (karigar) profiles with skills and expertise details",
    color: "linear-gradient(135deg, #FF512F 0%, #DD2476 100%)",
    accentColor: "#DD2476",
    instructions: [
      "Register new karigar profiles",
      "Capture skill sets and specializations",
      "Store contact information and addresses",
      "Track experience and expertise levels"
    ]
  },
  {
    id: "enter-karigar-details",
    label: "Enter Karigar Details",
    emoji: "✍️",
    component: "EnterKarigarDetails",
    description: "Record daily work details, attendance, and production entries for karigars",
    color: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
    accentColor: "#38ef7d",
    instructions: [
      "Record daily production entries",
      "Track work hours and attendance",
      "Enter piece-rate calculations",
      "Monitor individual karigar performance"
    ]
  },
  {
    id: "update-lot-completion",
    label: "Update Lot Completion",
    emoji: "✅",
    component: "UpdateLotCompletion",
    description: "Update and track lot completion status based on karigar work progress",
    color: "linear-gradient(135deg, #00b09b 0%, #96c93d 100%)",
    accentColor: "#00b09b",
    instructions: [
      "Update lot completion status per karigar",
      "Track completed vs pending lots",
      "Monitor individual karigar lot progress",
      "Generate lot completion reports"
    ]
  },
  {
    id: "create-payable",
    label: "Create Payable",
    emoji: "💵",
    component: "CreatePayable",
    description: "Manage and create payable entries for karigars, suppliers, and operational expenses",
    color: "linear-gradient(135deg, #00b4db 0%, #0083b0 100%)",
    accentColor: "#0083b0",
    instructions: [
      "Create payable entries for karigar wages",
      "Manage supplier payment schedules",
      "Track operational expenses and bills",
      "Generate payment vouchers and receipts",
      "Monitor pending and completed payments"
    ]
  }
];

// Google Sheets configuration for stitching supervisors
const GOOGLE_SHEETS_CONFIG = {
  API_KEY: "AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk",
  SPREADSHEET_ID: "1iBDfsxA9XEC9nhQE-ALBYlyGRZWOaCYvWsnGfYYbr1I",
  RANGE: "StitchingSupervisors!A:D",
};

export default function Welcome({ onNavigate }) {
  const [stitchingSupervisors, setStitchingSupervisors] = useState([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sheetLoading, setSheetLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState(null);

  // Load supervisors from Google Sheets
  useEffect(() => {
    const load = async () => {
      try {
        setSheetLoading(true);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_CONFIG.SPREADSHEET_ID}/values/${GOOGLE_SHEETS_CONFIG.RANGE}?key=${GOOGLE_SHEETS_CONFIG.API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch data");
        const data = await response.json();

        if (!data.values || data.values.length === 0)
          throw new Error("No data found");

        const supervisors = data.values.slice(1).map((row, index) => ({
          id: row[0] || `supervisor-${index}`,
          username: row[1] || "",
          password: row[2] || "",
          name: row[3] || "Stitching Supervisor",
          role: "Stitching Supervisor",
          emoji: "👨‍💼",
          avatarColor: `linear-gradient(135deg, ${getColorGradient(index)})`,
        }));

        setStitchingSupervisors(supervisors);
      } catch (err) {
        console.error("Error fetching supervisors:", err);
        setStitchingSupervisors([
          {
            id: "ss1",
            username: "supervisor",
            password: "stitch123",
            name: "Stitching Supervisor",
            role: "Stitching Supervisor",
            emoji: "👨‍💼",
            avatarColor: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          },
          {
            id: "ss2",
            username: "manager",
            password: "stitch456",
            name: "Line Manager",
            role: "Stitching Supervisor",
            emoji: "👔",
            avatarColor: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
          },
        ]);
      } finally {
        setSheetLoading(false);
      }
    };

    load();
  }, []);

  // Restore authentication
  useEffect(() => {
    if (!stitchingSupervisors.length) return;
    const isAuth = localStorage.getItem("stitching:authenticated") === "true";
    const authUser = localStorage.getItem("stitching:authenticatedUser");
    if (isAuth && authUser) {
      const user = stitchingSupervisors.find((s) => s.username === authUser);
      if (user) {
        setUsername(user.username);
        setIsAuthenticated(true);
      }
    }
  }, [stitchingSupervisors]);

  const currentSupervisor = useMemo(
    () => stitchingSupervisors.find((s) => s.username === username),
    [stitchingSupervisors, username]
  );

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    setIsLoading(true);

    if (!username) {
      setAuthError("Please select your username");
      setIsLoading(false);
      return;
    }
    if (!password) {
      setAuthError("Please enter your password");
      setIsLoading(false);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 800));

    if (currentSupervisor && password === currentSupervisor.password) {
      setIsAuthenticated(true);
      setAuthError("");
      localStorage.setItem("stitching:authenticated", "true");
      localStorage.setItem("stitching:authenticatedUser", username);
    } else {
      setAuthError("Invalid username or password");
      setPassword("");
    }
    setIsLoading(false);
  };

  const handleLogout = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsAuthenticated(false);
      setUsername("");
      setPassword("");
      setAuthError("");
      setIsExiting(false);
      setSelectedFeature(null);
      localStorage.removeItem("stitching:authenticated");
      localStorage.removeItem("stitching:authenticatedUser");
    }, 300);
  };

  const handleNavigation = (option) => {
    setIsExiting(true);
    setTimeout(() => {
      if (onNavigate) {
        onNavigate(option.component, currentSupervisor);
      } else {
        console.log(`Navigating to: ${option.label}`);
      }
    }, 400);
  };

  const handleFeatureHover = (feature) => {
    setSelectedFeature(feature);
  };

  const handleFeatureLeave = () => {
    setSelectedFeature(null);
  };

  return (
    <div style={styles.page}>
      <div style={styles.orbBackground}>
        <div style={styles.orb1}></div>
        <div style={styles.orb2}></div>
        <div style={styles.orb3}></div>
      </div>

      <div style={{
        ...styles.container,
        ...(isExiting ? styles.containerExiting : {})
      }}>
        <header style={styles.header}>
          <div style={styles.headerContent}>
            <div style={styles.logo}>
              <div style={styles.logoMark}>
                <span style={styles.logoIcon}>🧵</span>
              </div>
              <div>
                <h1 style={styles.logoText}>MH Stitching</h1>
                <p style={styles.logoSub}>Supervisor Portal</p>
              </div>
            </div>
            
            {isAuthenticated && (
              <div style={styles.userMenu}>
                <div style={styles.userProfile}>
                  <div style={styles.avatarWrapper}>
                    <div style={{...styles.avatar, background: currentSupervisor?.avatarColor}}>
                      {currentSupervisor?.emoji || "👨‍💼"}
                    </div>
                    <div style={styles.statusDot}></div>
                  </div>
                  <div style={styles.userMeta}>
                    <span style={styles.userName}>{currentSupervisor?.name}</span>
                    <span style={styles.userRole}>Stitching Supervisor</span>
                  </div>
                </div>
                <button onClick={handleLogout} style={styles.logoutBtn}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Exit</span>
                </button>
              </div>
            )}
          </div>
        </header>

        <main style={styles.main}>
          {!isAuthenticated ? (
            <div style={styles.authContainer}>
              {sheetLoading ? (
                <div style={styles.loadingCard}>
                  <div style={styles.loadingRing}></div>
                  <p style={styles.loadingText}>Loading secure workspace...</p>
                </div>
              ) : (
                <div style={styles.authCard}>
                  <div style={styles.authBadge}>
                    <span>🔐 Secure Access</span>
                  </div>
                  <h2 style={styles.authTitle}>Welcome back</h2>
                  <p style={styles.authDesc}>Sign in to manage your stitching operations</p>

                  <form onSubmit={handleLogin} style={styles.form}>
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Username</label>
                      <div style={styles.inputWrapper}>
                        <span style={styles.inputIcon}>👤</span>
                        <select
                          style={styles.select}
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                        >
                          <option value="">Select your name</option>
                          {stitchingSupervisors.map((s) => (
                            <option key={s.id} value={s.username}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Password</label>
                      <div style={styles.inputWrapper}>
                        <span style={styles.inputIcon}>🔒</span>
                        <input
                          type={showPassword ? "text" : "password"}
                          style={styles.input}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={styles.eyeBtn}
                        >
                          {showPassword ? "🙈" : "👁️"}
                        </button>
                      </div>
                    </div>

                    {authError && (
                      <div style={styles.errorAlert}>
                        <span>⚠️</span> {authError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading}
                      style={{...styles.loginBtn, ...(isLoading ? styles.loginBtnLoading : {})}}
                    >
                      {isLoading ? (
                        <span style={styles.btnSpinner}></span>
                      ) : (
                        "Sign in →"
                      )}
                    </button>
                  </form>

                  <div style={styles.authFooter}>
                    <span style={styles.authFooterText}>Authorized personnel only</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={styles.dashboard}>
              {/* Hero Banner */}
              <div style={styles.heroBanner}>
                <div style={styles.heroContent}>
                  <div>
                    <span style={styles.heroGreeting}>Good {getTimeBasedGreeting()},</span>
                    <h1 style={styles.heroName}>{currentSupervisor?.name}</h1>
                    <p style={styles.heroDesc}>Your stitching production dashboard is ready</p>
                  </div>
                  <div style={styles.heroStats}>
                    <div style={styles.statPill}>
                      <span>📋</span> {STITCHING_SUPERVISOR_OPTIONS.length} Tools
                    </div>
                    <div style={styles.statPill}>
                      <span>✅</span> Active Session
                    </div>
                  </div>
                </div>
                <div style={styles.heroPattern}></div>
              </div>

              {/* Two Column Layout */}
              <div style={styles.twoColumn}>
                {/* Tools Grid */}
                <div style={styles.toolsColumn}>
                  <div style={styles.sectionTitleBar}>
                    <h3>Production Tools</h3>
                    <span style={styles.sectionBadge}>Interactive</span>
                  </div>
                  <div style={styles.grid}>
                    {STITCHING_SUPERVISOR_OPTIONS.map((option, idx) => (
                      <div
                        key={option.id}
                        style={styles.card}
                        onClick={() => handleNavigation(option)}
                        onMouseEnter={() => handleFeatureHover(option)}
                        onMouseLeave={handleFeatureLeave}
                      >
                        <div style={{...styles.cardGradient, background: option.color}}></div>
                        <div style={styles.cardContent}>
                          <div style={styles.cardTop}>
                            <span style={styles.cardEmoji}>{option.emoji}</span>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={styles.cardArrow}>
                              <path d="M5 12h14M12 5l7 7-7 7" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                          </div>
                          <h4 style={styles.cardTitle}>{option.label}</h4>
                          <p style={styles.cardDesc}>{option.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Panel - Instructions + Status */}
                <div style={styles.rightColumn}>
                  <div style={styles.instructionCard}>
                    <div style={styles.instructionHeader}>
                      <span style={styles.instructionIcon}>💡</span>
                      <span style={styles.instructionTitle}>
                        {selectedFeature ? selectedFeature.label : "Quick Guide"}
                      </span>
                    </div>
                    <div style={styles.instructionBody}>
                      {selectedFeature ? (
                        <>
                          <p style={styles.featureDesc}>{selectedFeature.description}</p>
                          <div style={styles.instructionList}>
                            <strong>What you can do:</strong>
                            <ul>
                              {selectedFeature.instructions.map((inst, i) => (
                                <li key={i}>{inst}</li>
                              ))}
                            </ul>
                          </div>
                        </>
                      ) : (
                        <div style={styles.emptyInstruction}>
                          <span style={styles.hintIcon}>✨</span>
                          <p>Hover over any tool to see detailed instructions and features.</p>
                          <div style={styles.tipBlock}>
                            <strong>Pro tips:</strong>
                            <ul>
                              <li>Keep daily reports updated</li>
                              <li>Track material consumption regularly</li>
                              <li>Monitor production rates weekly</li>
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={styles.statusCard}>
                    <div style={styles.statusHeader}>
                      <span>🟢 System Status</span>
                      <span style={styles.statusBadge}>Operational</span>
                    </div>
                    <div style={styles.statusRow}>
                      <span>Last Sync</span>
                      <span>Just now</span>
                    </div>
                    <div style={styles.statusRow}>
                      <span>Database</span>
                      <span>Connected</span>
                    </div>
                    <div style={styles.statusRow}>
                      <span>Session</span>
                      <span>Active</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        <footer style={styles.footer}>
          <span>© 2025 MH Stitching — Supervisor Portal v2.1</span>
          <div style={styles.footerLinks}>
            <a href="#">Help</a>
            <a href="#">Support</a>
            <a href="#">Privacy</a>
          </div>
        </footer>
      </div>
    </div>
  );
}

// Helper functions
function getTimeBasedGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function getColorGradient(index) {
  const gradients = [
    "#667eea, #764ba2",
    "#f093fb, #f5576c", 
    "#4facfe, #00f2fe",
    "#43e97b, #38f9d7",
    "#fa709a, #fee140"
  ];
  return gradients[index % gradients.length];
}

// ===== ENHANCED ELEGANT STYLES =====
const styles = {
  page: {
    minHeight: "100vh",
    background: "#ffffff",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    position: "relative",
    overflowX: "hidden",
  },
  orbBackground: {
    position: "fixed",
    inset: 0,
    zIndex: 0,
    overflow: "hidden",
  },
  orb1: {
    position: "absolute",
    top: "-20%",
    right: "-10%",
    width: "500px",
    height: "500px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(102,126,234,0.12) 0%, rgba(102,126,234,0) 70%)",
    filter: "blur(60px)",
  },
  orb2: {
    position: "absolute",
    bottom: "-15%",
    left: "-5%",
    width: "450px",
    height: "450px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(245,87,108,0.1) 0%, rgba(245,87,108,0) 70%)",
    filter: "blur(60px)",
  },
  orb3: {
    position: "absolute",
    top: "40%",
    left: "30%",
    width: "300px",
    height: "300px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(67,233,123,0.08) 0%, rgba(67,233,123,0) 70%)",
    filter: "blur(50px)",
  },
  container: {
    position: "relative",
    zIndex: 2,
    maxWidth: 2400,
    margin: "0 auto",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    transition: "all 0.35s cubic-bezier(0.2, 0.9, 0.4, 1.1)",
    backdropFilter: "blur(2px)",
  },
  containerExiting: {
    opacity: 0,
    transform: "translateY(12px)",
  },
  header: {
    background: "rgba(255,255,255,0.96)",
    backdropFilter: "blur(20px)",
    borderBottom: "1px solid rgba(226,232,240,0.8)",
    position: "sticky",
    top: 0,
    zIndex: 50,
  },
  headerContent: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 32px",
    maxWidth: 2400,
    margin: "0 auto",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  logoMark: {
    width: 44,
    height: 44,
    background: "linear-gradient(135deg, #1e293b, #0f172a)",
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
  },
  logoIcon: {
    fontSize: 24,
  },
  logoText: {
    fontSize: 22,
    fontWeight: 700,
    color: "#0f172a",
    letterSpacing: "-0.3px",
    margin: 0,
    lineHeight: 1.2,
  },
  logoSub: {
    fontSize: 11,
    color: "#5b6e8c",
    fontWeight: 500,
    margin: 0,
  },
  userMenu: {
    display: "flex",
    alignItems: "center",
    gap: 24,
  },
  userProfile: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "6px 16px 6px 8px",
    background: "#ffffff",
    borderRadius: 48,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    border: "1px solid #e9eef3",
  },
  avatarWrapper: {
    position: "relative",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    color: "white",
  },
  statusDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    background: "#10b981",
    borderRadius: 10,
    border: "2px solid white",
  },
  userMeta: {
    display: "flex",
    flexDirection: "column",
  },
  userName: {
    fontSize: 13,
    fontWeight: 600,
    color: "#0f172a",
  },
  userRole: {
    fontSize: 10,
    color: "#001e4e",
  },
  logoutBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "transparent",
    border: "1px solid #e2e8f0",
    padding: "8px 16px",
    borderRadius: 40,
    fontSize: 13,
    fontWeight: 500,
    color: "#475569",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  main: {
    flex: 1,
    padding: "32px",
  },
  authContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "70vh",
  },
  loadingCard: {
    background: "white",
    padding: "48px",
    borderRadius: 32,
    textAlign: "center",
    boxShadow: "0 20px 35px -12px rgba(0,0,0,0.08)",
  },
  loadingRing: {
    width: 40,
    height: 40,
    border: "3px solid #e2e8f0",
    borderTop: "3px solid #667eea",
    borderRadius: "50%",
    margin: "0 auto 16px",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    color: "#475569",
  },
  authCard: {
    background: "white",
    borderRadius: 36,
    padding: "40px 36px",
    width: "100%",
    maxWidth: 440,
    boxShadow: "0 25px 45px -12px rgba(0,0,0,0.15)",
    border: "1px solid rgba(255,255,255,0.5)",
    transition: "transform 0.2s",
  },
  authBadge: {
    display: "inline-block",
    background: "#f1f5f9",
    padding: "4px 12px",
    borderRadius: 40,
    fontSize: 12,
    fontWeight: 500,
    color: "#1e293b",
    marginBottom: 20,
  },
  authTitle: {
    fontSize: 32,
    fontWeight: 700,
    color: "#0f172a",
    margin: "0 0 8px 0",
    letterSpacing: "-0.5px",
  },
  authDesc: {
    color: "#5b6e8c",
    marginBottom: 32,
    fontSize: 15,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "#1e293b",
  },
  inputWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  inputIcon: {
    position: "absolute",
    left: 14,
    fontSize: 16,
    opacity: 0.7,
  },
  select: {
    width: "100%",
    padding: "14px 14px 14px 40px",
    borderRadius: 20,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    background: "#ffffff",
    fontFamily: "inherit",
    transition: "all 0.2s",
  },
  input: {
    width: "100%",
    padding: "14px 14px 14px 40px",
    borderRadius: 20,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    fontFamily: "inherit",
  },
  eyeBtn: {
    position: "absolute",
    right: 14,
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
  },
  errorAlert: {
    background: "#fef2f2",
    padding: "12px 16px",
    borderRadius: 24,
    fontSize: 13,
    color: "#dc2626",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  loginBtn: {
    background: "#0f172a",
    color: "white",
    border: "none",
    padding: "14px",
    borderRadius: 32,
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
    transition: "all 0.2s",
    marginTop: 8,
  },
  loginBtnLoading: {
    opacity: 0.7,
    cursor: "wait",
  },
  btnSpinner: {
    display: "inline-block",
    width: 18,
    height: 18,
    border: "2px solid rgba(255,255,255,0.3)",
    borderTop: "2px solid white",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  authFooter: {
    marginTop: 24,
    textAlign: "center",
  },
  authFooterText: {
    fontSize: 11,
    color: "#94a3b8",
  },
  dashboard: {
    animation: "fadeInUp 0.5s ease-out",
  },
  heroBanner: {
    background: "linear-gradient(115deg, #ffffff 0%, #f8fafc 100%)",
    borderRadius: 32,
    padding: "28px 32px",
    marginBottom: 32,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 4px 12px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.03)",
    border: "1px solid rgba(0, 55, 122, 0.5)",
    position: "relative",
    overflow: "hidden",
  },
  heroPattern: {
    position: "absolute",
    right: -40,
    top: -40,
    width: 200,
    height: 200,
    background: "radial-gradient(circle, rgba(102,126,234,0.05) 0%, transparent 70%)",
    borderRadius: "50%",
  },
  heroContent: {
    display: "flex",
    justifyContent: "space-between",
    width: "100%",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 20,
  },
  heroGreeting: {
    fontSize: 14,
    fontWeight: 500,
    color: "#d8213a",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  heroName: {
    fontSize: 28,
    fontWeight: 800,
    color: "#0f172a",
    margin: "6px 0 8px 0",
    letterSpacing: "-0.3px",
  },
  heroDesc: {
    color: "#5b6e8c",
    fontSize: 14,
  },
  heroStats: {
    display: "flex",
    gap: 12,
  },
  statPill: {
    background: "white",
    borderRadius: 40,
    padding: "8px 18px",
    fontSize: 13,
    fontWeight: 500,
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
    border: "1px solid #eef3fa",
  },
  twoColumn: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: 28,
  },
  toolsColumn: {
    background: "transparent",
  },
  sectionTitleBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  sectionBadge: {
    background: "#eef2ff",
    padding: "4px 12px",
    borderRadius: 60,
    fontSize: 12,
    fontWeight: 500,
    color: "#4f46e5",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 20,
  },
  card: {
    background: "white",
    borderRadius: 24,
    padding: 0,
    cursor: "pointer",
    position: "relative",
    overflow: "hidden",
    transition: "all 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1)",
    boxShadow: "0 5px 15px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.05)",
    border: "1px solid #edf2f7",
  },
  cardGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: 4,
  },
  cardContent: {
    padding: "20px 20px 22px",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cardEmoji: {
    fontSize: 32,
  },
  cardArrow: {
    opacity: 0.5,
    transition: "transform 0.2s",
    stroke: "#c430b0",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#002a8b",
    margin: "0 0 6px 0",
  },
  cardDesc: {
    fontSize: 12,
    color: "#000000",
    lineHeight: 1.45,
    margin: 0,
  },
  rightColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  instructionCard: {
    background: "white",
    borderRadius: 28,
    padding: "24px",
    border: "1px solid #edf2f7",
    boxShadow: "0 8px 20px rgba(0,0,0,0.02)",
  },
  instructionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
    paddingBottom: 12,
    borderBottom: "2px solid #f1f5f9",
  },
  instructionIcon: {
    fontSize: 24,
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: "#0f172a",
  },
  instructionBody: {
    minHeight: 220,
  },
  featureDesc: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 1.5,
    marginBottom: 16,
  },
  instructionList: {
    fontSize: 13,
    color: "#b83c3c",
  },
  emptyInstruction: {
    textAlign: "center",
  },
  hintIcon: {
    fontSize: 42,
    display: "block",
    marginBottom: 12,
  },
  tipBlock: {
    marginTop: 20,
    textAlign: "left",
    background: "#f8fafc",
    padding: 16,
    borderRadius: 20,
  },
  statusCard: {
    background: "#ffffff",
    borderRadius: 28,
    padding: "20px 24px",
    border: "1px solid #ecf3fa",
  },
  statusHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 16,
    fontWeight: 600,
  },
  statusBadge: {
    fontSize: 12,
    background: "#dcfce7",
    padding: "4px 10px",
    borderRadius: 40,
    color: "#15803d",
  },
  statusRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 0",
    fontSize: 13,
    borderBottom: "1px solid #f1f5f9",
  },
  footer: {
    borderTop: "1px solid #e2e8f0",
    padding: "20px 32px",
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    color: "#5b6e8c",
    background: "rgba(255,255,255,0.7)",
    backdropFilter: "blur(8px)",
  },
  footerLinks: {
    display: "flex",
    gap: 20,
  },
};

// Inject keyframes into document (for animations)
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .feature-card:hover { transform: translateY(-4px) scale(1.01); box-shadow: 0 20px 30px -12px rgba(0,0,0,0.12); border-color: #cbd5e1; }
  .feature-card:hover .card-arrow { opacity: 1; transform: translateX(4px); }
  select:focus, input:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
  button { transition: all 0.2s; }
`;
document.head.appendChild(styleSheet);