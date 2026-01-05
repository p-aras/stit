// src/Welcome.js
import React, { useEffect, useMemo, useState } from "react";

// Stitching Supervisor specific navigation
// Add these two new options to the STITCHING_SUPERVISOR_OPTIONS array
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
  // {
  //   id: "packing-material-order",
  //   label: "Packing Material Order",
  //   emoji: "📦",
  //   component: "PackingIssueOrder",
  //   description: "Create and track material orders for packing department",
  //   color: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  //   accentColor: "#fa709a",
  //   instructions: [
  //     "Order packing materials",
  //     "Track inventory levels",
  //     "Manage supplier orders"
  //   ]
  // },
  // Add these two new cards
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
        // Fallback seed users for offline/dev
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

    // Simulate API call delay
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
        console.log(`Navigating to: ${option.label}`, {
          supervisor: currentSupervisor,
          component: option.component,
        });
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
      <style>{css}</style>

      {/* Subtle Background */}
      <div style={styles.background}>
        <div style={styles.backgroundShape1}></div>
        <div style={styles.backgroundShape2}></div>
        <div style={styles.backgroundPattern}></div>
      </div>

      <div style={{
        ...styles.container,
        ...(isExiting ? styles.containerExiting : {})
      }}>
        {/* Header - Paper Style */}
        <header style={styles.header}>
          <div style={styles.headerContent}>
            <div style={styles.logo}>
              <div style={styles.logoIcon}>
                <div style={styles.logoIconInner}>🧵</div>
              </div>
              <div style={styles.logoText}>
                <span style={styles.logoTitle}>MH STITCHING</span>
                <span style={styles.logoSubtitle}>Supervisor Portal</span>
              </div>
            </div>
            
            {isAuthenticated && (
              <div style={styles.userSection}>
                <div style={styles.userInfo}>
                  <div
                    style={{
                      ...styles.userAvatar,
                      background: currentSupervisor?.avatarColor,
                    }}
                  >
                    {currentSupervisor?.emoji || "👨‍💼"}
                  </div>
                  <div style={styles.userDetails}>
                    <span style={styles.userName}>{currentSupervisor?.name}</span>
                    <span style={styles.userRole}>Stitching Supervisor</span>
                  </div>
                </div>
                <button
                  style={styles.logoutBtn}
                  onClick={handleLogout}
                  className="logout-btn"
                >
                  <span>Logout</span>
                  <svg style={styles.logoutIcon} viewBox="0 0 24 24" fill="none">
                    <path d="M17 16L21 12M21 12L17 8M21 12H9M9 4H7C5.89543 4 5 4.89543 5 6V18C5 19.1046 5.89543 20 7 20H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main style={styles.main}>
          {!isAuthenticated ? (
            <div style={{
              ...styles.authSection,
              ...(isExiting ? styles.authSectionExiting : {})
            }}>
              {sheetLoading ? (
                <div style={styles.loadingContainer}>
                  <div style={styles.loadingSpinner}></div>
                  <p style={styles.loadingText}>
                    Loading supervisor database...
                  </p>
                </div>
              ) : (
                <div style={styles.authCard}>
                  <div style={styles.authHeader}>
                    <div style={styles.authIconContainer}>
                      <div style={styles.authIcon}>🔐</div>
                    </div>
                    <h2 style={styles.authTitle}>Welcome Back</h2>
                    <p style={styles.authSubtitle}>
                      Sign in to access your stitching production dashboard
                    </p>
                  </div>

                  <form onSubmit={handleLogin} style={styles.loginForm}>
                    <div style={styles.inputGroup}>
                      <label style={styles.inputLabel}>Username</label>
                      <select
                        style={styles.select}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="form-input"
                      >
                        <option value="">Select your name</option>
                        {stitchingSupervisors.map((s) => (
                          <option key={s.id} value={s.username}>
                            {s.name} ({s.username})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={styles.inputGroup}>
                      <label style={styles.inputLabel}>Password</label>
                      <div style={styles.passwordContainer}>
                        <input
                          type={showPassword ? "text" : "password"}
                          style={styles.passwordInput}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="form-input"
                        />
                        <button
                          type="button"
                          style={styles.togglePassword}
                          onClick={() => setShowPassword((v) => !v)}
                          className="toggle-password-btn"
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>

                    {authError && (
                      <div style={styles.errorMessage}>
                        <svg style={styles.errorIcon} viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                          <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        {authError}
                      </div>
                    )}

                    <button
                      type="submit"
                      style={{
                        ...styles.loginButton,
                        ...(isLoading ? styles.loginButtonLoading : {})
                      }}
                      disabled={isLoading}
                      className="login-button"
                    >
                      {isLoading ? (
                        <>
                          <div style={styles.buttonSpinner}></div>
                          Signing In...
                        </>
                      ) : (
                        "Sign In"
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            /* Dashboard - Compact Layout */
            <div style={styles.dashboard}>
              {/* Welcome Header */}
              <div style={styles.welcomeHeader}>
                <div style={styles.welcomeContent}>
                  <h1 style={styles.greeting}>
                    Good {getTimeBasedGreeting()},{" "}
                    <span style={styles.userHighlight}>{currentSupervisor?.name}</span>
                  </h1>
                  <p style={styles.dashboardSubtitle}>
                    Manage your production line efficiently with these tools
                  </p>
                </div>
                <div style={styles.statsContainer}>
                  <div style={styles.statCard}>
                    <div style={styles.statIcon}>📈</div>
                    <div style={styles.statContent}>
                      <span style={styles.statValue}>{STITCHING_SUPERVISOR_OPTIONS.length}</span>
                      <span style={styles.statLabel}>Tools</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content Grid */}
              <div style={styles.mainGrid}>
                {/* Features Grid */}
                <div style={styles.featuresSection}>
                  <div style={styles.sectionHeader}>
                    <h3 style={styles.sectionTitle}>Production Tools</h3>
                    <p style={styles.sectionDescription}>
                      Click on any tool to manage your stitching operations
                    </p>
                  </div>

                  <div style={styles.grid}>
                    {STITCHING_SUPERVISOR_OPTIONS.map((option, index) => (
                      <div
                        key={option.id}
                        style={{
                          ...styles.card,
                          animationDelay: `${index * 0.1}s`
                        }}
                        onClick={() => handleNavigation(option)}
                        onMouseEnter={() => handleFeatureHover(option)}
                        onMouseLeave={handleFeatureLeave}
                        className="feature-card"
                      >
                        <div style={styles.cardHeader}>
                          <div 
                            style={{
                              ...styles.cardIcon,
                              background: option.color,
                            }}
                          >
                            {option.emoji}
                          </div>
                          <div style={styles.cardArrow}>
                            <svg viewBox="0 0 24 24" fill="none" style={styles.arrowIcon}>
                              <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        </div>
                        <div style={styles.cardContent}>
                          <h4 style={styles.cardTitle}>{option.label}</h4>
                          <p style={styles.cardDescription}>{option.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Instructions Panel */}
                <div style={styles.instructionsSection}>
                  <div style={styles.instructionsCard}>
                    <div style={styles.instructionsHeader}>
                      <div style={styles.instructionsIcon}>💡</div>
                      <h4 style={styles.instructionsTitle}>
                        {selectedFeature ? `${selectedFeature.label} Guide` : "Quick Guide"}
                      </h4>
                    </div>
                    <div style={styles.instructionsContent}>
                      {selectedFeature ? (
                        <div>
                          <p style={styles.featureDescription}>
                            {selectedFeature.description}
                          </p>
                          <div style={styles.instructionsList}>
                            <h5 style={styles.instructionsSubtitle}>What you can do:</h5>
                            <ul style={styles.instructionsItems}>
                              {selectedFeature.instructions.map((instruction, index) => (
                                <li key={index} style={styles.instructionItem}>
                                  <span style={styles.bullet}>•</span>
                                  {instruction}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ) : (
                        <div style={styles.defaultInstructions}>
                          <p style={styles.defaultText}>
                            Hover over any tool to see detailed instructions and features.
                          </p>
                          <div style={styles.tips}>
                            <h5 style={styles.tipsTitle}>Quick Tips:</h5>
                            <ul style={styles.tipsList}>
                              <li style={styles.tipItem}>Keep your daily reports updated</li>
                              <li style={styles.tipItem}>Track material consumption regularly</li>
                              <li style={styles.tipItem}>Monitor production rates weekly</li>
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* System Status */}
                  <div style={styles.systemStatus}>
                    <div style={styles.statusHeader}>
                      <h5 style={styles.statusTitle}>System Status</h5>
                      <div style={styles.statusIndicator}>
                        <div style={styles.statusDot}></div>
                        Online
                      </div>
                    </div>
                    <div style={styles.statusItems}>
                      <div style={styles.statusItem}>
                        <span style={styles.statusLabel}>Last Sync</span>
                        <span style={styles.statusValue}>Just now</span>
                      </div>
                      <div style={styles.statusItem}>
                        <span style={styles.statusLabel}>Database</span>
                        <span style={styles.statusValue}>Connected</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer style={styles.footer}>
          <div style={styles.footerContent}>
            <div style={styles.footerText}>
              <span style={styles.footerIcon}>🧵</span>
              MH STITCHING Supervisor System v2.1
            </div>
            <div style={styles.footerLinks}>
              <span style={styles.footerLink}>Help Center</span>
              <span style={styles.footerLink}>Support</span>
              <span style={styles.footerLink}>Privacy</span>
            </div>
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

/* ---------- Enhanced Professional Styles ---------- */
const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  background: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  backgroundShape1: {
    position: "absolute",
    top: "-10%",
    right: "-5%",
    width: "400px",
    height: "400px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, rgba(102, 126, 234, 0.03) 0%, rgba(118, 75, 162, 0.02) 100%)",
  },
  backgroundShape2: {
    position: "absolute",
    bottom: "-10%",
    left: "-5%",
    width: "300px",
    height: "300px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, rgba(245, 245, 245, 0.02) 0%, rgba(0, 242, 254, 0.01) 100%)",
  },
  backgroundPattern: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.03) 1px, transparent 0)`,
    backgroundSize: "20px 20px",
  },
  container: {
    position: "relative",
    zIndex: 1,
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    maxWidth: 2200,
    margin: "0 auto",
    background: "white",
    boxShadow: "0 0 0 1px rgba(0,0,0,0.02), 0 4px 6px -1px rgba(0,0,0,0.05)",
    transition: "all 0.3s ease-out",
  },
  containerExiting: {
    opacity: 0,
    transform: "translateY(10px)",
  },
  header: {
    background: "white",
    borderBottom: "1px solid #f1f5f9",
    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  headerContent: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 32px",
    maxWidth: 2200,
    margin: "0 auto",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  logoIcon: {
    position: "relative",
  },
  logoIconInner: {
    fontSize: 24,
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    borderRadius: 10,
    padding: 8,
    color: "white",
  },
  logoText: {
    display: "flex",
    flexDirection: "column",
  },
  logoTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#1e293b",
    lineHeight: 1.2,
  },
  logoSubtitle: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 500,
  },
  userSection: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  userInfo: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 16px",
    background: "#f8fafc",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 600,
    color: "white",
  },
  userDetails: {
    display: "flex",
    flexDirection: "column",
  },
  userName: {
    fontSize: 13,
    fontWeight: 600,
    color: "#1e293b",
  },
  userRole: {
    fontSize: 11,
    color: "#64748b",
  },
  logoutBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    background: "white",
    color: "#64748b",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    transition: "all 0.2s ease",
  },
  logoutIcon: {
    width: 14,
    height: 14,
  },
  main: {
    flex: 1,
    padding: "32px",
  },
  authSection: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "60vh",
    transition: "all 0.3s ease-out",
  },
  authSectionExiting: {
    opacity: 0,
    transform: "translateY(-10px)",
  },
  loadingContainer: {
    textAlign: "center",
    padding: "60px 20px",
  },
  loadingSpinner: {
    width: 40,
    height: 40,
    border: "3px solid #f1f5f9",
    borderTop: "3px solid #667eea",
    borderRadius: "50%",
    margin: "0 auto 20px",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    color: "#64748b",
    fontSize: 16,
  },
  authCard: {
    width: "100%",
    maxWidth: 400,
    padding: "40px",
    background: "white",
    borderRadius: 16,
    border: "1px solid #f1f5f9",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)",
  },
  authHeader: {
    textAlign: "center",
    marginBottom: 32,
  },
  authIconContainer: {
    marginBottom: 20,
  },
  authIcon: {
    fontSize: 48,
    color: "#667eea",
  },
  authTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: "#1e293b",
    margin: "0 0 8px 0",
  },
  authSubtitle: {
    fontSize: 15,
    color: "#64748b",
    lineHeight: 1.5,
    margin: 0,
  },
  loginForm: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: "#374151",
  },
  select: {
    height: 48,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    padding: "0 16px",
    fontSize: 15,
    background: "white",
    color: "#1e293b",
    transition: "all 0.2s ease",
  },
  passwordContainer: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  passwordInput: {
    width: "100%",
    height: 48,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    padding: "0 16px",
    fontSize: 15,
    background: "white",
    color: "#1e293b",
    transition: "all 0.2s ease",
  },
  togglePassword: {
    position: "absolute",
    right: 12,
    background: "none",
    border: "none",
    fontSize: 14,
    color: "#64748b",
    cursor: "pointer",
    padding: 4,
    borderRadius: 4,
    transition: "all 0.2s ease",
  },
  loginButton: {
    height: 48,
    borderRadius: 8,
    border: "none",
    background: "#667eea",
    color: "white",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
    transition: "all 0.2s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loginButtonLoading: {
    background: "#93c5fd",
    cursor: "not-allowed",
  },
  buttonSpinner: {
    width: 16,
    height: 16,
    border: "2px solid transparent",
    borderTop: "2px solid white",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  errorMessage: {
    padding: "12px 16px",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 8,
    color: "#dc2626",
    fontSize: 14,
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  errorIcon: {
    width: 16,
    height: 16,
  },
  dashboard: {
    maxWidth: 2100,
    margin: "0 auto",
    background: '#f1f5f9',
  },
  welcomeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 32,
    padding: "24px",
    background: "white",
    // borderRadius: 12,
    border: "1px solid #f1f5f9",
    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
  },
  welcomeContent: {
    flex: 1,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 700,
    color: "#1e293b",
    margin: "0 0 8px 0",
    lineHeight: 1.2,
  },
  userHighlight: {
    color: "#00ce3eff",
  },
  dashboardSubtitle: {
    fontSize: 15,
    color: "#003681ff",
    margin: 0,
    maxWidth: 500,
  },
  statsContainer: {
    display: "flex",
    gap: 16,
  },
  statCard: {
    padding: "16px 20px",
    background: "#ffffffff",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  statIcon: {
    fontSize: 20,
    color: "#667eea",
  },
  statContent: {
    display: "flex",
    flexDirection: "column",
  },
  statValue: {
    fontSize: 20,
    fontWeight: 700,
    color: "#1e293b",
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 500,
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: 15,
    alignItems: "flex-start",
  },
  featuresSection: {
    background: "white",
    borderRadius: 12,
    border: "1px solid #f1f5f9",
    padding: "24px",
    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
  },
  sectionHeader: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#1e293b",
    margin: "0 0 8px 0",
  },
  sectionDescription: {
    fontSize: 14,
    color: "#64748b",
    margin: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 16,
  },
  card: {
    background: "white",
    borderRadius: 10,
    padding: "20px",
    border: "1px solid #e2e8f0",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    transition: "all 0.3s ease",
    animation: "cardSlideIn 0.6s ease-out both",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    color: "white",
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: "#000000ff",
    margin: "0 0 8px 0",
  },
  cardDescription: {
    fontSize: 13,
    color: "#003681ff",
    lineHeight: 1.5,
    margin: 0,
  },
  cardArrow: {
    color: "#64748b",
    transition: "all 0.3s ease",
  },
  arrowIcon: {
    width: 16,
    height: 16,
  },
  instructionsSection: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  instructionsCard: {
    background: "white",
    borderRadius: 12,
    border: "1px solid #f1f5f9",
    padding: "24px",
    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
  },
  instructionsHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  instructionsIcon: {
    fontSize: 20,
    color: "#667eea",
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: "#1e293b",
    margin: 0,
  },
  instructionsContent: {
    minHeight: 200,
  },
  featureDescription: {
    fontSize: 14,
    color: "#00285fff",
    lineHeight: 1.5,
    marginBottom: 16,
  },
  instructionsList: {
    marginTop: 16,
  },
  instructionsSubtitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#1e293b",
    margin: "0 0 12px 0",
  },
  instructionsItems: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  instructionItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.5,
    marginBottom: 8,
  },
  bullet: {
    color: "#667eea",
    fontWeight: 600,
  },
  defaultInstructions: {
    textAlign: "center",
    padding: "20px 0",
  },
  defaultText: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 20,
    lineHeight: 1.5,
  },
  tips: {
    textAlign: "left",
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#1e293b",
    margin: "0 0 12px 0",
  },
  tipsList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  tipItem: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.5,
    marginBottom: 8,
    paddingLeft: 16,
    position: "relative",
  },
  tipItem: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.5,
    marginBottom: 8,
    paddingLeft: 16,
    position: "relative",
  },
  // tipItem: "before": {
  //   // content: "'•'",
  //   color: "#667eea",
  //   position: "absolute",
  //   left: 0,
  // },
  systemStatus: {
    background: "#f8fafc",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    padding: "20px",
  },
  statusHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#1e293b",
    margin: 0,
  },
  statusIndicator: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "#64748b",
    fontWeight: 500,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#10b981",
  },
  statusItems: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  statusItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  statusValue: {
    fontSize: 12,
    color: "#1e293b",
    fontWeight: 500,
  },
  footer: {
    borderTop: "1px solid #f1f5f9",
    background: "white",
    padding: "20px 32px",
  },
  footerContent: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    maxWidth: 2200,
    margin: "0 auto",
  },
  footerText: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "#64748b",
    fontWeight: 500,
  },
  footerIcon: {
    fontSize: 14,
  },
  footerLinks: {
    display: "flex",
    gap: 16,
  },
  footerLink: {
    fontSize: 13,
    color: "#64748b",
    cursor: "pointer",
    transition: "color 0.2s ease",
  },
};

const css = `
/* Enhanced Professional CSS */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

* { 
  box-sizing: border-box; 
  margin: 0; 
  padding: 0; 
}

body { 
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
  background: #f8fafc;
  color: #1e293b;
  line-height: 1.5;
}

/* Smooth Animations */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes cardSlideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Enhanced Focus States */
.form-input:focus {
  outline: none;
  border-color: #667eea !important;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important;
}

/* Smooth Button Interactions */
.logout-btn:hover {
  background: #f8fafc !important;
  border-color: #d1d5db !important;
  transform: translateY(-1px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.login-button:hover:not(:disabled) {
  background: #5a6fd8 !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.toggle-password-btn:hover {
  background: #f3f4f6;
}

/* Elegant Card Hover Effects */
.feature-card:hover {
  transform: translateY(-2px);
  border-color: #cbd5e1 !important;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08) !important;
}

.feature-card:hover .card-arrow {
  color: #667eea;
  transform: translateX(2px);
}

.feature-card:hover .arrow-icon {
  transform: translateX(2px);
}

/* Paper-style elevation */
.feature-card,
.auth-card,
.instructions-card,
.welcome-header,
.features-section {
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05) !important;
  border: 1px solid #f1f5f9 !important;
}

/* Enhanced header paper effect */
.header {
  background: white !important;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05) !important;
  border-bottom: 1px solid #f1f5f9 !important;
}

/* Smooth Transitions */
select,
input,
button,
.feature-card,
.card-icon,
.logout-btn,
.login-button,
.footer-link {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Loading Animation */
.loading-spinner {
  animation: spin 1s linear infinite;
}

/* Custom Scrollbar */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: #f1f5f9;
}

::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Selection Styles */
::selection {
  background: rgba(102, 126, 234, 0.2);
  color: #1e293b;
}

/* Footer link hover */
.footer-link:hover {
  color: #667eea;
}

/* Tip item bullet fix */
.tip-item::before {
  content: "•";
  color: #667eea;
  position: absolute;
  left: 0;
}

/* Responsive Design */
@media (max-width: 1024px) {
  .main-grid {
    grid-template-columns: 1fr !important;
    gap: 20px;
  }
  
  .welcome-header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
  
  .stats-container {
    align-self: flex-start;
  }
}

@media (max-width: 768px) {
  .container {
    margin: 0;
  }
  
  .header-content {
    padding: 16px 20px;
    flex-direction: column;
    gap: 16px;
  }
  
  .user-section {
    width: 100%;
    justify-content: space-between;
  }
  
  .main {
    padding: 20px;
  }
  
  .auth-card {
    padding: 32px 24px;
    margin: 0 16px;
  }
  
  .greeting {
    font-size: 24px;
  }
  
  .grid {
    grid-template-columns: 1fr !important;
  }
  
  .features-section,
  .instructions-card {
    padding: 20px;
  }
  
  .footer-content {
    flex-direction: column;
    gap: 12px;
    text-align: center;
  }
  
  .footer-links {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .dashboard-header h1 {
    font-size: 22px;
  }
  
  .section-title {
    font-size: 18px;
  }
  
  .card {
    padding: 16px;
  }
  
  .auth-title {
    font-size: 24px;
  }
  
  .welcome-header {
    padding: 20px;
  }
}

/* Utility Classes */
.smooth-transition {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.glass-effect {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
}

/* Focus Visible for Accessibility */
button:focus-visible,
select:focus-visible,
input:focus-visible {
  outline: 2px solid #667eea;
  outline-offset: 2px;
}

/* Print Styles */
@media print {
  .header,
  .footer,
  .instructions-section {
    display: none;
  }
  
  .main-grid {
    grid-template-columns: 1fr;
  }
}
`;