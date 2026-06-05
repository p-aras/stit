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
    color: "#667eea",
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
    color: "#f5576c",
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
    color: "#4facfe",
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
    color: "#43e97b",
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
    color: "#FF6B6B",
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
    color: "#3EDBF0",
    instructions: [
      "Monitor dori stock levels",
      "Process dori material orders",
      "Track dori usage per garment",
      "Manage dori color and size variants"
    ]
  },
  {
    id: "daily-updation",
    label: "Daily Updation",
    emoji: "🔄",
    component: "DailyUpdationSystem",
    description: "Real-time production tracking and daily progress updates",
    color: "#FF6A88",
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
    color: "#8A2BE2",
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
    description: "Create and manage palla job orders for specialized stitching",
    color: "#FF8C00",
    instructions: [
      "Create new palla job orders",
      "Assign palla work to karigars",
      "Track palla production progress",
      "Manage palla material requirements"
    ]
  },
  {
    id: "extra-pcs",
    label: "Extra Pcs",
    emoji: "➕",
    component: "Extrapcs",
    description: "Manage extra piece production and inventory corrections",
    color: "#FF6B35",
    instructions: [
      "Track extra piece production",
      "Manage adjustment entries",
      "Record damage replacements",
      "Handle special requests"
    ]
  },
  {
    id: "create-karigar-profile",
    label: "Karigar Profile",
    emoji: "👤",
    component: "CreateKarigarProfile",
    description: "Create and manage artisan profiles with skills details",
    color: "#DD2476",
    instructions: [
      "Register new karigar profiles",
      "Capture skill sets",
      "Store contact information",
      "Track experience levels"
    ]
  },
  {
    id: "enter-karigar-details",
    label: "Karigar Details",
    emoji: "✍️",
    component: "EnterKarigarDetails",
    description: "Record daily work details and production entries",
    color: "#38ef7d",
    instructions: [
      "Record daily production entries",
      "Track work hours",
      "Enter piece-rate calculations",
      "Monitor performance"
    ]
  },
  {
    id: "update-lot-completion",
    label: "Lot Completion",
    emoji: "✅",
    component: "UpdateLotCompletion",
    description: "Update and track lot completion status",
    color: "#96c93d",
    instructions: [
      "Update lot completion status",
      "Track completed vs pending lots",
      "Monitor lot progress",
      "Generate completion reports"
    ]
  },
  {
    id: "karigar-lot-detail",
    label: "Karigar Lot Detail",
    emoji: "📋",
    component: "KarigarLotDetail",
    description: "View and manage detailed lot-wise karigar production tracking",
    color: "#FF1493",
    instructions: [
      "Track lot assignments per karigar",
      "Monitor lot-wise production progress",
      "View detailed karigar performance by lot",
      "Manage lot completion metrics"
    ]
  },
   {
    id: "thekedar-payment",
    label: "Thekedar Payment",
    emoji: "👨‍💼",
    component: "supervisorPayment",
    description: "Manage Thekedar and Supervisor payments, track dues and payment schedules",
    color: "#FF6B35",
    instructions: [
      "Process Thekedar payment requests",
      "Track supervisor payment schedules",
      "Manage pending dues",
      "Generate payment receipts"
    ]
  },
];

// Google Sheets configuration
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
  const [hoveredCard, setHoveredCard] = useState(null);

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
          avatarColor: getColorGradient(index),
        }));

        setStitchingSupervisors(supervisors);
      } catch (err) {
        console.error("Error fetching supervisors:", err);
        setStitchingSupervisors([
          { id: "ss1", username: "supervisor", password: "stitch123", name: "Stitching Supervisor", role: "Stitching Supervisor", emoji: "👨‍💼", avatarColor: "#667eea" },
          { id: "ss2", username: "manager", password: "stitch456", name: "Line Manager", role: "Stitching Supervisor", emoji: "👔", avatarColor: "#f5576c" },
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
    if (!username) { setAuthError("Please select your username"); setIsLoading(false); return; }
    if (!password) { setAuthError("Please enter your password"); setIsLoading(false); return; }
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
      localStorage.removeItem("stitching:authenticated");
      localStorage.removeItem("stitching:authenticatedUser");
    }, 300);
  };

  const handleNavigation = (option) => {
    setIsExiting(true);
    setTimeout(() => {
      if (onNavigate) {
        onNavigate(option.component, currentSupervisor);
      }
    }, 400);
  };

  return (
    <div style={styles.page}>
      {/* Modern floating background elements */}
      <div style={styles.bgOrb1}></div>
      <div style={styles.bgOrb2}></div>
      <div style={styles.bgGrid}></div>

      <div style={{ ...styles.container, ...(isExiting ? styles.containerExiting : {}) }}>
        {/* Glassmorphic Header */}
        <header style={styles.header}>
          <div style={styles.headerInner}>
            <div style={styles.logoArea}>
              <div style={styles.logoIcon}>
                <span>🏭</span>
              </div>
              <div>
                <h1 style={styles.logoText}>MH Stitching</h1>
                <p style={styles.logoTagline}>Supervisor Command Center</p>
              </div>
            </div>
            {isAuthenticated && (
              <div style={styles.userArea}>
                <div style={styles.userCard}>
                  <div style={{ ...styles.userAvatar, background: currentSupervisor?.avatarColor || "#667eea" }}>
                    {currentSupervisor?.emoji || "👨‍💼"}
                  </div>
                  <div style={styles.userMeta}>
                    <p style={styles.userName}>{currentSupervisor?.name}</p>
                    <p style={styles.userRole}>Stitching Supervisor</p>
                  </div>
                </div>
                <button onClick={handleLogout} style={styles.logoutButton}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Exit
                </button>
              </div>
            )}
          </div>
        </header>

        <main style={styles.main}>
          {!isAuthenticated ? (
            // Modern Split-Screen Login Experience
            <div style={styles.loginWrapper}>
              {sheetLoading ? (
                <div style={styles.loadingContainer}>
                  <div style={styles.spinner}></div>
                  <p style={styles.loadingText}>Loading secure workspace...</p>
                </div>
              ) : (
                <div style={styles.loginGrid}>
                  <div style={styles.loginHero}>
                    <div style={styles.heroBadge}>✨ Enterprise Suite</div>
                    <h2 style={styles.heroTitle}>Stitching <span style={{color: "#667eea"}}>Intelligence</span></h2>
                    <p style={styles.heroDesc}>Real-time production tracking, material management, and karigar performance — unified command center for modern stitching operations.</p>
                    <div style={styles.featureList}>
                      <div style={styles.featureItem}>📊 Live Production Analytics</div>
                      <div style={styles.featureItem}>🧵 Material Issue & Inventory</div>
                      <div style={styles.featureItem}>👥 Karigar & Thekedar Management</div>
                    </div>
                  </div>
                  <div style={styles.loginCard}>
                    <div style={styles.loginHeader}>
                      <div style={styles.loginBadge}>Welcome back</div>
                      <h3 style={styles.loginTitle}>Sign in to continue</h3>
                      <p style={styles.loginSubtitle}>Access your operational dashboard</p>
                    </div>
                    <form onSubmit={handleLogin} style={styles.loginForm}>
                      <div style={styles.formGroup}>
                        <label style={styles.formLabel}>Username</label>
                        <select
                          style={styles.formSelect}
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                        >
                          <option value="">Select your profile</option>
                          {stitchingSupervisors.map((s) => (
                            <option key={s.id} value={s.username}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div style={styles.formGroup}>
                        <label style={styles.formLabel}>Password</label>
                        <div style={styles.passwordWrapper}>
                          <input
                            type={showPassword ? "text" : "password"}
                            style={styles.formInput}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={styles.eyeButton}
                          >
                            {showPassword ? "🙈" : "👁️"}
                          </button>
                        </div>
                      </div>
                      {authError && <div style={styles.errorAlert}>⚠️ {authError}</div>}
                      <button type="submit" disabled={isLoading} style={{ ...styles.loginButton, ...(isLoading ? styles.loginButtonLoading : {}) }}>
                        {isLoading ? <span style={styles.buttonSpinner}></span> : "Launch Dashboard →"}
                      </button>
                    </form>
                    <p style={styles.loginFooter}>🔒 Secure supervisor access only</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Modern Dashboard with Card Grid & Stats
            <div style={styles.dashboard}>
              {/* Welcome Banner */}
              <div style={styles.welcomeBanner}>
                <div>
                  <h2 style={styles.welcomeTitle}>Good {getTimeBasedGreeting()}, {currentSupervisor?.name} 👋</h2>
                  <p style={styles.welcomeSub}>Here's your stitching command overview — {STITCHING_SUPERVISOR_OPTIONS.length} modules ready</p>
                </div>
                <div style={styles.statsChip}>
                  <span>🟢 Live Session</span>
                  <span style={styles.dot}></span>
                  <span>Today's target: 2,450 pcs</span>
                </div>
              </div>

              {/* Tools Grid - Modern responsive masonry feel */}
              <div style={styles.toolsSection}>
                <div style={styles.sectionHeader}>
                  <div>
                    <h3 style={styles.sectionTitle}>⚡ Production Command Hub</h3>
                    <p style={styles.sectionSubtitle}>Launch any module with one click — real-time operational tools</p>
                  </div>
                  <div style={styles.moduleCount}>{STITCHING_SUPERVISOR_OPTIONS.length} active modules</div>
                </div>

                <div style={styles.gridContainer}>
                  {STITCHING_SUPERVISOR_OPTIONS.map((option) => (
                    <div
                      key={option.id}
                      style={{
                        ...styles.toolCard,
                        ...(hoveredCard === option.id ? styles.toolCardHover : {}),
                      }}
                      onClick={() => handleNavigation(option)}
                      onMouseEnter={() => setHoveredCard(option.id)}
                      onMouseLeave={() => setHoveredCard(null)}
                    >
                      <div style={{ ...styles.toolCardGlow, background: `${option.color}10` }} />
                      <div style={styles.toolCardContent}>
                        <div style={{ ...styles.toolIcon, background: `${option.color}20`, color: option.color }}>
                          <span style={{ fontSize: 26 }}>{option.emoji}</span>
                        </div>
                        <div style={styles.toolInfo}>
                          <h4 style={styles.toolName}>{option.label}</h4>
                          <p style={styles.toolDescription}>{option.description}</p>
                        </div>
                        <div style={styles.toolArrow}>→</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Insight Row: Quick Actions + System Status + Tip */}
              <div style={styles.bottomRow}>
                <div style={styles.insightCard}>
                  <div style={styles.cardHeader}>
                    <span>💡 Smart Assistant</span>
                    <span style={styles.smallBadge}>Pro Tips</span>
                  </div>
                  <ul style={styles.tipsList}>
                    <li>• Update <strong>Daily Report</strong> before shift closure for accurate payroll</li>
                    <li>• Monitor <strong>Zip & Dori</strong> stock levels to avoid line stoppages</li>
                    <li>• Review <strong>Karigar Lot Detail</strong> for performance insights</li>
                    <li>• Process <strong>Thekedar Payment</strong> on schedule for seamless ops</li>
                  </ul>
                </div>
                <div style={styles.statusGlance}>
                  <div style={styles.statusHeader}>
                    <span>🟢 System Nexus</span>
                    <span style={styles.statusBadge}>Operational</span>
                  </div>
                  <div style={styles.statusMetrics}>
                    <div style={styles.metricItem}>
                      <span>Google Sheets Sync</span>
                      <span style={styles.greenText}>Active</span>
                    </div>
                    <div style={styles.metricItem}>
                      <span>Last heartbeat</span>
                      <span>Just now</span>
                    </div>
                    <div style={styles.metricItem}>
                      <span>Supervisor Role</span>
                      <span style={{fontWeight:600}}>{currentSupervisor?.name}</span>
                    </div>
                  </div>
                  <div style={styles.actionHint}>
                    ⚡ All modules are optimized for instant navigation
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        <footer style={styles.footer}>
          <span>© 2025 MH Stitching — Intelligent Supervisor Portal</span>
          <div style={styles.footerLinks}>
            <a href="#">Documentation</a>
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
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

function getColorGradient(index) {
  const colors = ["#667eea", "#f5576c", "#4facfe", "#43e97b", "#FF6B6B", "#3EDBF0", "#FF6A88", "#8A2BE2", "#FF8C00", "#DD2476"];
  return colors[index % colors.length];
}

// Professional Modern Styles - COMPLETELY REDESIGNED LAYOUT (modern, glassmorphic, clean)
const styles = {
  page: {
    minHeight: "100vh",
    background: "#ffffff",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    position: "relative",
    overflowX: "hidden",
  },
  bgOrb1: {
    position: "fixed",
    top: "-20%",
    right: "-10%",
    width: "500px",
    height: "500px",
    background: "radial-gradient(circle, rgba(102,126,234,0.2) 0%, rgba(255,255,255,0) 70%)",
    borderRadius: "50%",
    zIndex: 0,
    pointerEvents: "none",
  },
  bgOrb2: {
    position: "fixed",
    bottom: "-15%",
    left: "-5%",
    width: "450px",
    height: "450px",
    background: "radial-gradient(circle, rgba(245,87,108,0.15) 0%, rgba(255,255,255,0) 70%)",
    borderRadius: "50%",
    zIndex: 0,
    pointerEvents: "none",
  },
  bgGrid: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundImage: "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.02) 1px, transparent 1px)",
    backgroundSize: "32px 32px",
    zIndex: 0,
    pointerEvents: "none",
  },
  container: {
    position: "relative",
    zIndex: 2,
    maxWidth: 2440,
    margin: "0 auto",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    transition: "all 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1)",
  },
  containerExiting: {
    opacity: 0,
    transform: "translateY(12px)",
  },
  header: {
    background: "rgba(236, 206, 245, 0.85)",
    backdropFilter: "blur(18px)",
    borderBottom: "1px solid rgba(255,255,255,0.5)",
    position: "sticky",
    top: 0,
    zIndex: 100,
    boxShadow: "0 4px 20px rgba(0,0,0,0.02)",
  },
  headerInner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 32px",
    maxWidth: 2440,
    margin: "0 auto",
  },
  logoArea: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  logoIcon: {
    background: "linear-gradient(135deg, #667eea, #764ba2)",
    width: 44,
    height: 44,
    borderRadius: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 8px 20px rgba(102,126,234,0.25)",
    fontSize: 22,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 800,
    background: "linear-gradient(135deg, #1e293b, #2d3a5e)",
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    color: "transparent",
    margin: 0,
    letterSpacing: "-0.3px",
  },
  logoTagline: {
    fontSize: 11,
    color: "#5b6e8c",
    margin: 0,
    fontWeight: 500,
  },
  userArea: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  userCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "white",
    padding: "6px 20px 6px 8px",
    borderRadius: 48,
    boxShadow: "0 2px 8px rgba(0,0,0,0.02), inset 0 0 0 1px rgba(255,255,255,0.8)",
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    color: "white",
  },
  userMeta: {
    lineHeight: 1.3,
  },
  userName: {
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
    margin: 0,
  },
  userRole: {
    fontSize: 10,
    color: "#64748b",
    margin: 0,
  },
  logoutButton: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(255,255,255,0.7)",
    border: "1px solid #e2e8f0",
    padding: "8px 18px",
    borderRadius: 40,
    fontSize: 13,
    fontWeight: 500,
    color: "#475569",
    cursor: "pointer",
    transition: "all 0.2s",
    backdropFilter: "blur(4px)",
  },
  main: {
    flex: 1,
    padding: "28px 32px 40px",
  },
  // Login Split Screen
  loginWrapper: {
    display: "flex",
    alignItems: "center",
    minHeight: "calc(100vh - 200px)",
  },
  loginGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 32,
    width: "100%",
    maxWidth: 1200,
    margin: "0 auto",
  },
  loginHero: {
    background: "rgba(255,255,255,0.5)",
    backdropFilter: "blur(10px)",
    borderRadius: 48,
    padding: "48px 40px",
    border: "1px solid rgba(255,255,255,0.6)",
    boxShadow: "0 20px 40px rgba(0,0,0,0.03)",
  },
  heroBadge: {
    display: "inline-block",
    background: "#667eea20",
    color: "#4c51bf",
    padding: "6px 14px",
    borderRadius: 100,
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 16,
    lineHeight: 1.2,
  },
  heroDesc: {
    fontSize: 15,
    color: "#334155",
    lineHeight: 1.5,
    marginBottom: 32,
  },
  featureList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  featureItem: {
    fontSize: 14,
    fontWeight: 500,
    color: "#1e293b",
    padding: "8px 0",
    borderBottom: "1px dashed rgba(0,0,0,0.05)",
  },
  loginCard: {
    background: "white",
    borderRadius: 48,
    padding: "44px 40px",
    boxShadow: "0 25px 45px -12px rgba(0,0,0,0.2)",
    border: "1px solid rgba(255,255,255,0.5)",
  },
  loginHeader: {
    marginBottom: 28,
  },
  loginBadge: {
    fontSize: 12,
    fontWeight: 600,
    color: "#667eea",
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: 12,
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: "#0f172a",
    margin: "0 0 8px 0",
  },
  loginSubtitle: {
    fontSize: 14,
    color: "#64748b",
  },
  loginForm: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#1e293b",
  },
  formSelect: {
    padding: "14px 18px",
    borderRadius: 24,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    background: "#fefefe",
    transition: "all 0.2s",
    fontFamily: "inherit",
  },
  formInput: {
    width: "100%",
    padding: "14px 18px",
    borderRadius: 24,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    fontFamily: "inherit",
  },
  passwordWrapper: {
    position: "relative",
  },
  eyeButton: {
    position: "absolute",
    right: 16,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 18,
  },
  errorAlert: {
    background: "#fee2e2",
    padding: "12px 16px",
    borderRadius: 20,
    fontSize: 13,
    color: "#b91c1c",
  },
  loginButton: {
    background: "#0f172a",
    color: "white",
    border: "none",
    padding: "14px",
    borderRadius: 40,
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
    transition: "all 0.2s",
    marginTop: 8,
  },
  loginButtonLoading: { opacity: 0.7, cursor: "wait" },
  buttonSpinner: {
    display: "inline-block",
    width: 18,
    height: 18,
    border: "2px solid rgba(255,255,255,0.3)",
    borderTop: "2px solid white",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loginFooter: {
    marginTop: 24,
    fontSize: 11,
    textAlign: "center",
    color: "#94a3b8",
  },
  loadingContainer: {
    textAlign: "center",
    background: "white",
    padding: "48px",
    borderRadius: 48,
    width: "100%",
  },
  spinner: {
    width: 40,
    height: 40,
    border: "3px solid #e2e8f0",
    borderTop: "3px solid #667eea",
    borderRadius: "50%",
    margin: "0 auto 16px",
    animation: "spin 1s linear infinite",
  },
  loadingText: { color: "#475569" },
  // Dashboard Styles
  dashboard: { animation: "fadeInUp 0.5s ease-out" },
  welcomeBanner: {
    background: "white",
    borderRadius: 32,
    padding: "24px 32px",
    marginBottom: 36,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 8px 20px rgba(0,0,0,0.02), inset 0 0 0 1px rgba(255,255,255,0.8)",
    border: "1px solid #eef2ff",
  },
  welcomeTitle: { fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 6 },
  welcomeSub: { fontSize: 14, color: "#5b6e8c" },
  statsChip: {
    background: "#f1f5f9",
    padding: "8px 20px",
    borderRadius: 60,
    fontSize: 13,
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  dot: { width: 8, height: 8, background: "#10b981", borderRadius: 8 },
  toolsSection: { marginBottom: 42 },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: 700, color: "#0f172a", margin: 0 },
  sectionSubtitle: { fontSize: 13, color: "#5b6e8c", marginTop: 6 },
  moduleCount: { background: "#eef2ff", padding: "6px 14px", borderRadius: 40, fontSize: 12, fontWeight: 600, color: "#4f46e5" },
  gridContainer: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 20 },
  toolCard: {
    background: "white",
    borderRadius: 28,
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1)",
    border: "1px solid #eef2ff",
    position: "relative",
    overflow: "hidden",
    boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
  },
  toolCardHover: { transform: "translateY(-6px)", boxShadow: "0 20px 30px -12px rgba(0,0,0,0.15)", borderColor: "#cbd5e1" },
  toolCardGlow: { position: "absolute", inset: 0, opacity: 0.4, pointerEvents: "none" },
  toolCardContent: { padding: "20px 22px", display: "flex", alignItems: "center", gap: 16, position: "relative", zIndex: 2 },
  toolIcon: { width: 58, height: 58, borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  toolInfo: { flex: 1 },
  toolName: { fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 6 },
  toolDescription: { fontSize: 12, color: "#5b6e8c", lineHeight: 1.4, margin: 0 },
  toolArrow: { fontSize: 22, color: "#cbd5e1", transition: "transform 0.2s", flexShrink: 0 },
  bottomRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 },
  insightCard: {
    background: "white",
    borderRadius: 32,
    padding: "24px",
    border: "1px solid #eef2ff",
    boxShadow: "0 8px 20px rgba(0,0,0,0.02)",
  },
  cardHeader: { display: "flex", justifyContent: "space-between", marginBottom: 18, fontWeight: 600, color: "#1e293b" },
  smallBadge: { background: "#f1f5f9", padding: "4px 12px", borderRadius: 40, fontSize: 11, fontWeight: 500 },
  tipsList: { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12, fontSize: 13, color: "#334155" },
  statusGlance: {
    background: "white",
    borderRadius: 32,
    padding: "24px",
    border: "1px solid #eef2ff",
  },
  statusHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, fontWeight: 600 },
  statusBadge: { background: "#10b98115", color: "#10b981", padding: "4px 12px", borderRadius: 40, fontSize: 12 },
  statusMetrics: { display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 },
  metricItem: { display: "flex", justifyContent: "space-between", fontSize: 13, paddingBottom: 8, borderBottom: "1px solid #f1f5f9" },
  greenText: { color: "#10b981", fontWeight: 500 },
  actionHint: { fontSize: 12, background: "#f8fafc", padding: "12px 16px", borderRadius: 20, color: "#475569", textAlign: "center" },
  footer: {
    borderTop: "1px solid rgba(0,0,0,0.05)",
    padding: "20px 32px",
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    color: "#5b6e8c",
    background: "rgba(255,255,255,0.75)",
    backdropFilter: "blur(12px)",
  },
  footerLinks: { display: "flex", gap: 24, a: { textDecoration: "none", color: "#5b6e8c" } },
};

// Inject dynamic keyframes for spin & fade
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  @keyframes fadeInUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
  select:focus, input:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
  .tool-card:hover .tool-arrow { transform: translateX(5px); color: #667eea; }
  button:hover { transform: scale(0.98); }
  a { text-decoration: none; color: #5b6e8c; transition: 0.2s; }
  a:hover { color: #667eea; }
`;
document.head.appendChild(styleSheet);