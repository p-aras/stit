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
  // {
  //   id: "create-payable",
  //   label: "Create Payable",
  //   emoji: "💵",
  //   component: "CreatePayable",
  //   description: "Manage payable entries for karigars and suppliers",
  //   color: "#0083b0",
  //   instructions: [
  //     "Create payable entries for wages",
  //     "Manage supplier payments",
  //     "Track operational expenses",
  //     "Generate payment vouchers"
  //   ]
  // },
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
    component: "supervisorPayment",  // CHANGED: Use 'supervisorPayment' instead of 'CreatePayable'
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
  const [selectedFeature, setSelectedFeature] = useState(null);
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
      }
    }, 400);
  };

  return (
    <div style={styles.page}>
      {/* Premium gradient background */}
      <div style={styles.bgGradient}></div>
      <div style={styles.bgPattern}></div>

      <div style={{ ...styles.container, ...(isExiting ? styles.containerExiting : {}) }}>
        {/* Modern Header */}
        <header style={styles.header}>
          <div style={styles.headerInner}>
            <div style={styles.logoArea}>
              <div style={styles.logoIcon}>🏭</div>
              <div>
                <h1 style={styles.logoText}>MH Stitching</h1>
                <p style={styles.logoTagline}>Supervisor Command Center</p>
              </div>
            </div>
            {isAuthenticated && (
              <div style={styles.userArea}>
                <div style={styles.userInfo}>
                  <div style={{ ...styles.userAvatar, background: currentSupervisor?.avatarColor || "#667eea" }}>
                    {currentSupervisor?.emoji || "👨‍💼"}
                  </div>
                  <div>
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
            // Modern Login Screen
            <div style={styles.loginWrapper}>
              {sheetLoading ? (
                <div style={styles.loadingContainer}>
                  <div style={styles.spinner}></div>
                  <p style={styles.loadingText}>Loading secure workspace...</p>
                </div>
              ) : (
                <div style={styles.loginCard}>
                  <div style={styles.loginHeader}>
                    <div style={styles.loginBadge}>Secure Access</div>
                    <h2 style={styles.loginTitle}>Welcome back</h2>
                    <p style={styles.loginSubtitle}>Sign in to manage your stitching operations</p>
                  </div>
                  <form onSubmit={handleLogin} style={styles.loginForm}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Username</label>
                      <select
                        style={styles.formSelect}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      >
                        <option value="">Select your name</option>
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
                          placeholder="Enter your password"
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
                      {isLoading ? <span style={styles.buttonSpinner}></span> : "Sign In →"}
                    </button>
                  </form>
                  <p style={styles.loginFooter}>Authorized personnel only</p>
                </div>
              )}
            </div>
          ) : (
            // Modern Dashboard
            <div style={styles.dashboard}>
              {/* Tools Grid Section */}
              <div style={styles.toolsSection}>
                <div style={styles.sectionHeader}>
                  <div>
                    <h3 style={styles.sectionTitle}>Production Tools</h3>
                    <p style={styles.sectionSubtitle}>Access your daily operational modules</p>
                  </div>
                  <span style={styles.toolsCount}>{STITCHING_SUPERVISOR_OPTIONS.length} modules</span>
                </div>

                <div style={styles.gridContainer}>
                  {STITCHING_SUPERVISOR_OPTIONS.map((option) => (
                    <div
                      key={option.id}
                      style={{
                        ...styles.toolCard,
                        ...(hoveredCard === option.id ? styles.toolCardHover : {}),
                        borderTopColor: option.color
                      }}
                      onClick={() => handleNavigation(option)}
                      onMouseEnter={() => setHoveredCard(option.id)}
                      onMouseLeave={() => setHoveredCard(null)}
                    >
                      <div style={{ ...styles.toolIcon, background: `${option.color}15` }}>
                        <span style={{ fontSize: 28 }}>{option.emoji}</span>
                      </div>
                      <div style={styles.toolInfo}>
                        <h3 style={styles.toolName}>{option.label}</h3>
                        <p style={styles.toolDescription}>{option.description}</p>
                      </div>
                      <div style={styles.toolArrow}>→</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions & System Status Row */}
              <div style={styles.bottomRow}>
                <div style={styles.quickTips}>
                  <h3 style={styles.tipsTitle}>💡 Pro Tips for Today</h3>
                  <ul style={styles.tipsList}>
                    <li>• Update Daily Report before shift end</li>
                    <li>• Check material inventory levels</li>
                    <li>• Review karigar performance metrics</li>
                    <li>• Verify lot completion status</li>
                  </ul>
                </div>
                <div style={styles.statusPanel}>
                  <div style={styles.statusHeader}>
                    <span>🟢 System Health</span>
                    <span style={styles.statusBadge}>Operational</span>
                  </div>
                  <div style={styles.statusItem}>
                    <span>Database Connection</span>
                    <span style={styles.statusConnected}>Connected</span>
                  </div>
                  <div style={styles.statusItem}>
                    <span>Last Sync</span>
                    <span>Just now</span>
                  </div>
                  <div style={styles.statusItem}>
                    <span>Active Session</span>
                    <span>{currentSupervisor?.name}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        <footer style={styles.footer}>
          <span>© 2025 MH Stitching — Enterprise Supervisor Portal</span>
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
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function getColorGradient(index) {
  const colors = ["#667eea", "#f5576c", "#4facfe", "#43e97b", "#FF6B6B", "#3EDBF0", "#FF6A88", "#8A2BE2", "#FF8C00", "#DD2476"];
  return colors[index % colors.length];
}

// Professional Modern Styles - FIXED: No more shorthand/longhand conflicts
const styles = {
  page: {
    minHeight: "100vh",
    background: "#f0f2f8",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    position: "relative",
    overflowX: "hidden",
  },
  bgGradient: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    height: "500px",
    background: "linear-gradient(135deg, #ffffff 0%, #16213e 50%, #0f3460 100%)",
    zIndex: 0,
  },
  bgPattern: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: "radial-gradient(circle at 20% 80%, rgba(255,255,255,0.03) 0%, transparent 50%)",
    zIndex: 0,
  },
  container: {
    position: "relative",
    zIndex: 2,
    maxWidth: 2200,
    margin: "0 auto",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    transition: "all 0.35s ease",
  },
  containerExiting: {
    opacity: 0,
    transform: "translateY(10px)",
  },
  header: {
    background: "rgba(255,255,255,0.98)",
    backdropFilter: "blur(20px)",
    borderBottom: "1px solid rgba(0,0,0,0.05)",
    position: "sticky",
    top: 0,
    zIndex: 100,
    boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
  },
  headerInner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 32px",
    maxWidth: 1400,
    margin: "0 auto",
  },
  logoArea: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  logoIcon: {
    fontSize: 12,
    background: "linear-gradient(135deg, #667eea, #764ba2)",
    width: 48,
    height: 48,
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 12px rgba(102,126,234,0.3)",
  },
  logoText: {
    fontSize: 20,
    fontWeight: 700,
    color: "#1a1a2e",
    margin: 0,
    letterSpacing: "-0.3px",
  },
  logoTagline: {
    fontSize: 11,
    color: "#666",
    margin: 0,
  },
  userArea: {
    display: "flex",
    alignItems: "center",
    gap: 20,
  },
  userInfo: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "6px 16px 6px 8px",
    background: "#f8f9fc",
    borderRadius: 40,
    border: "1px solid #eef2f8",
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 38,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    color: "white",
  },
  userName: {
    fontSize: 13,
    fontWeight: 600,
    color: "#1a1a2e",
    margin: 0,
  },
  userRole: {
    fontSize: 10,
    color: "#888",
    margin: 0,
  },
  logoutButton: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "transparent",
    border: "1px solid #e2e8f0",
    padding: "8px 18px",
    borderRadius: 40,
    fontSize: 13,
    fontWeight: 500,
    color: "#666",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  main: {
    flex: 1,
    padding: "32px",
  },
  // Login Styles
  loginWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "calc(100vh - 200px)",
  },
  loadingContainer: {
    textAlign: "center",
    background: "white",
    padding: "48px",
    borderRadius: 32,
    boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
  },
  spinner: {
    width: 40,
    height: 40,
    border: "3px solid #eef2f8",
    borderTop: "3px solid #667eea",
    borderRadius: "50%",
    margin: "0 auto 16px",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    color: "#666",
  },
  loginCard: {
    background: "white",
    borderRadius: 32,
    padding: "48px 40px",
    width: "100%",
    maxWidth: 460,
    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
    textAlign: "center",
  },
  loginHeader: {
    marginBottom: 32,
  },
  loginBadge: {
    display: "inline-block",
    background: "#667eea15",
    color: "#667eea",
    padding: "4px 14px",
    borderRadius: 40,
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 16,
  },
  loginTitle: {
    fontSize: 32,
    fontWeight: 700,
    color: "#1a1a2e",
    margin: "0 0 8px 0",
  },
  loginSubtitle: {
    color: "#888",
    fontSize: 14,
    margin: 0,
  },
  loginForm: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
    textAlign: "left",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#333",
  },
  formSelect: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    fontFamily: "inherit",
    background: "#fff",
    transition: "all 0.2s",
  },
  formInput: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    fontFamily: "inherit",
  },
  passwordWrapper: {
    position: "relative",
  },
  eyeButton: {
    position: "absolute",
    right: 14,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
  },
  errorAlert: {
    background: "#fef2f2",
    padding: "12px 16px",
    borderRadius: 14,
    fontSize: 13,
    color: "#dc2626",
  },
  loginButton: {
    background: "#1a1a2e",
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
  loginButtonLoading: {
    opacity: 0.7,
    cursor: "wait",
  },
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
    color: "#aaa",
  },
  // Dashboard Styles
  dashboard: {
    animation: "fadeInUp 0.5s ease-out",
  },
  toolsSection: {
    marginBottom: 40,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "#1a1a2e",
    margin: 0,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#888",
    marginTop: 4,
  },
  toolsCount: {
    background: "#eef2f8",
    padding: "6px 14px",
    borderRadius: 40,
    fontSize: 12,
    fontWeight: 500,
    color: "#666",
  },
  gridContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: 20,
  },
  // FIXED: No more shorthand/longhand conflict
  toolCard: {
    background: "white",
    borderRadius: 20,
    padding: "20px",
    display: "flex",
    alignItems: "center",
    gap: 16,
    cursor: "pointer",
    transition: "all 0.25s ease",
    borderWidth: "1px 1px 1px 1px",
    borderStyle: "solid",
    borderColor: "#eef2f8",
    borderTopWidth: "3px",
    borderTopStyle: "solid",
    borderTopColor: "transparent",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  toolCardHover: {
    transform: "translateY(-4px)",
    boxShadow: "0 12px 28px rgba(0,0,0,0.1)",
    borderColor: "#e2e8f0",
  },
  toolIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  toolInfo: {
    flex: 1,
  },
  toolName: {
    fontSize: 16,
    fontWeight: 700,
    color: "#1a1a2e",
    margin: "0 0 4px 0",
  },
  toolDescription: {
    fontSize: 12,
    color: "#888",
    margin: 0,
    lineHeight: 1.4,
  },
  toolArrow: {
    fontSize: 20,
    color: "#ccc",
    transition: "transform 0.2s",
    flexShrink: 0,
  },
  bottomRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 24,
  },
  quickTips: {
    background: "white",
    borderRadius: 24,
    padding: "24px",
    border: "1px solid #eef2f8",
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: "#1a1a2e",
    margin: "0 0 16px 0",
  },
  tipsList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  statusPanel: {
    background: "white",
    borderRadius: 24,
    padding: "24px",
    border: "1px solid #eef2f8",
  },
  statusHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    fontWeight: 600,
  },
  statusBadge: {
    background: "#10b98115",
    color: "#10b981",
    padding: "4px 12px",
    borderRadius: 40,
    fontSize: 12,
  },
  statusItem: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px 0",
    fontSize: 13,
    borderBottom: "1px solid #f0f2f8",
  },
  statusConnected: {
    color: "#10b981",
    fontWeight: 500,
  },
  footer: {
    borderTop: "1px solid rgba(0,0,0,0.05)",
    padding: "20px 32px",
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    color: "#888",
    background: "rgba(255,255,255,0.95)",
  },
  footerLinks: {
    display: "flex",
    gap: 24,
  },
};

// Inject animations
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  select:focus, input:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
  .tool-card:hover .tool-arrow { transform: translateX(4px); color: #667eea; }
  button:hover { transform: scale(0.98); }
`;
document.head.appendChild(styleSheet);