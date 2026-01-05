// src/App.js
import React, {
  useMemo,
  useState,
  useEffect,
  Suspense,
  lazy,
  startTransition,
} from "react";
import Welcome from "./Welcome";

/** ---------- Lazy pages (with chunk names for nicer DevTools) ---------- */
const DailyReport = lazy(() =>
  import(/* webpackChunkName: "page-daily-report" */ "./DailyReport")
);
const IssueToStitching = lazy(() =>
  import(/* webpackChunkName: "page-issue-stitching" */ "./IssueStitching")
);
const RateList = lazy(() =>
  import(/* webpackChunkName: "page-rate-list" */ "./RateList")
);
const MaterialStitchingOrder = lazy(() =>
  import(
    /* webpackChunkName: "page-material-stitching-order" */ "./MaterialStitchingOrder"
  )
);
/** NEW: PackingIssueOrder */
const PackingIssueOrder = lazy(() =>
  import(
    /* webpackChunkName: "page-packing-issue-order" */ "./PackingIssueOrder"
  )
);
const DailyUpdationSystem = lazy(() =>
  import(/* webpackChunkName: "page-daily-updation" */ "./DailyUpdationSystem")
);
const ZipManagement = lazy(() =>
  import(/* webpackChunkName: "page-zip-management" */ "./ZipManagement")
);
const DoriManagement = lazy(() =>
  import(/* webpackChunkName: "page-dori-management" */ "./DoriManagement")
);
const AlterJobOrder = lazy(() =>
  import(/* webpackChunkName: "page-alter-job-order" */ "./AlterJobOrder")
);
/** ---------- Tiny hash router (no deps) ---------- */
function parseHash() {
  const raw = (window.location.hash || "").replace(/^#\/?/, "");
  const [component = "Welcome", qs = ""] = raw.split("?");
  const params = Object.fromEntries(new URLSearchParams(qs));
  return { component: component || "Welcome", params };
}

function pushHash(component, params) {
  const qs = params ? new URLSearchParams(params).toString() : "";
  const next = `#/${component}${qs ? `?${qs}` : ""}`;
  if (window.location.hash !== next) window.location.hash = next;
}

/** ---------- Error Boundary for lazy modules ---------- */
class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch() {
    /* optional logging */
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            fontFamily: "Inter, system-ui, sans-serif",
            padding: 24,
            color: "#ef4444",
          }}
        >
          <div
            style={{
              background: "#fff",
              border: "1px solid #fecaca",
              borderRadius: 16,
              padding: 24,
              maxWidth: 560,
              width: "100%",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
            <h2 style={{ margin: 0 }}>
              Something went wrong loading this page.
            </h2>
            <p style={{ marginTop: 8, color: "#6b7280" }}>
              Try going back, or reload the app. (Dev note: see console for
              details.)
            </p>
            <button
              onClick={() => this.setState({ error: null })}
              style={{
                marginTop: 12,
                padding: "10px 16px",
                borderRadius: 12,
                border: "none",
                background: "#4f46e5",
                color: "white",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/** ---------- Accessible center loader ---------- */
function CenterLoader({ label = "Loading..." }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontFamily: "Inter, system-ui, sans-serif",
        color: "#334155",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          role="status"
          aria-live="polite"
          aria-label={label}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "3px solid #e2e8f0",
            borderTopColor: "#6366f1",
            animation: "spin 1s linear infinite",
          }}
        />
        <div aria-hidden="true">{label}</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}

/** ---------- NotFound stays as-is ---------- */
function NotFound({ onNavigate }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontFamily: "Inter, system-ui, sans-serif",
        color: "white",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 16,
          padding: 24,
          backdropFilter: "blur(12px)",
          textAlign: "center",
          maxWidth: 520,
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>🧭</div>
        <h2 style={{ margin: 0, fontWeight: 800 }}>Page not found</h2>
        <p style={{ opacity: 0.9 }}>
          The component you’re trying to open doesn’t exist.
        </p>
        <button
          onClick={() => onNavigate("Welcome", null)}
          style={{
            marginTop: 12,
            padding: "10px 16px",
            borderRadius: 12,
            border: "none",
            background: "white",
            color: "#4f46e5",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ⬅ Back to Home
        </button>
      </div>
    </div>
  );
}

/** ---------- Idle prefetch helper ---------- */
const idle = (cb) =>
  window.requestIdleCallback ? requestIdleCallback(cb) : setTimeout(cb, 300);
function prefetchAll() {
  import("./DailyReport");
  import("./IssueStitching");
  import("./RateList");
  import("./MaterialStitchingOrder");
  import("./PackingIssueOrder");
  import("./ZipManagement");
  import("./DoriManagement");
  import("./DailyUpdationSystem");
  import("./AlterJobOrder"); // ADD THIS LINE
}
export default function App() {
  // initial view from hash OR last known (localStorage) fallback
  const initial = (() => {
    const fromHash = parseHash();
    if (fromHash.component)
      return { component: fromHash.component, user: null, params: fromHash.params };
    try {
      const cached = JSON.parse(localStorage.getItem("app.view") || "null");
      if (cached?.component) return cached;
    } catch {}
    return { component: "Welcome", user: null, params: null };
  })();

  const [view, setView] = useState(initial);

  /** keep URL + title + localStorage in sync */
/** keep URL + title + localStorage in sync */
useEffect(() => {
  pushHash(view.component, view.params);
  document.title =
    {
      Welcome: "Home — Garment Manager",
      DailyReport: "Daily Report — Garment Manager",
      IssueToStitching: "Issue to Stitching — Garment Manager",
      RateList: "Rate List — Garment Manager",
      MaterialStitchingOrder: "Material Stitching Order — Garment Manager",
      PackingIssueOrder: "Packing Issue Order — Garment Manager",
      ZipManagement: "Zip Management — Garment Manager",
      DoriManagement: "Dori Management — Garment Manager",
      DailyUpdationSystem: "Daily Updation System — Garment Manager",
      AlterJobOrder: "Alter Job Order — Garment Manager", // ADD THIS LINE
    }[view.component] || "Garment Manager";
  localStorage.setItem("app.view", JSON.stringify(view));
}, [view]);

  /** react to back/forward */
  useEffect(() => {
    const onHash = () => {
      const { component, params } = parseHash();
      startTransition(() =>
        setView((v) => ({ ...v, component, params }))
      );
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  /** prefetch other pages when idle */
  useEffect(() => {
    idle(prefetchAll);
  }, []);

  /** Navigation API used by children */
  const handleNavigate = (component, user, params = null) => {
    startTransition(() => setView({ component, user, params }));
  };

  /** Page map (wrapped in ErrorBoundary + Suspense) */
/** Page map (wrapped in ErrorBoundary + Suspense) */
const Page = useMemo(() => {
  const map = {
    Welcome: () => <Welcome onNavigate={handleNavigate} />,
    DailyReport: () => (
      <PageErrorBoundary>
        <Suspense fallback={<CenterLoader label="Loading Daily Report..." />}>
          <DailyReport
            user={view.user}
            onNavigate={handleNavigate}
            params={view.params}
          />
        </Suspense>
      </PageErrorBoundary>
    ),
    IssueToStitching: () => (
      <PageErrorBoundary>
        <Suspense
          fallback={<CenterLoader label="Loading Issue to Stitching..." />}
        >
          <IssueToStitching
            user={view.user}
            onNavigate={handleNavigate}
            params={view.params}
          />
        </Suspense>
      </PageErrorBoundary>
    ),
    RateList: () => (
      <PageErrorBoundary>
        <Suspense fallback={<CenterLoader label="Loading Rate List..." />}>
          <RateList
            user={view.user}
            onNavigate={handleNavigate}
            params={view.params}
          />
        </Suspense>
      </PageErrorBoundary>
    ),
    MaterialStitchingOrder: () => (
      <PageErrorBoundary>
        <Suspense
          fallback={
            <CenterLoader label="Loading Material Stitching Order..." />
          }
        >
          <MaterialStitchingOrder
            user={view.user}
            supervisor={view.user}
            onNavigate={handleNavigate}
            params={view.params}
          />
        </Suspense>
      </PageErrorBoundary>
    ),
    ZipManagement: () => (
      <PageErrorBoundary>
        <Suspense fallback={<CenterLoader label="Loading Zip Management..." />}>
          <ZipManagement
            user={view.user}
            onNavigate={handleNavigate}
            params={view.params}
          />
        </Suspense>
      </PageErrorBoundary>
    ),
    DailyUpdationSystem: () => (
      <PageErrorBoundary>
        <Suspense fallback={<CenterLoader label="Loading Daily Updation System..." />}>
          <DailyUpdationSystem
            user={view.user}
            supervisor={view.user}
            onNavigate={handleNavigate}
            params={view.params}
          />
        </Suspense>
      </PageErrorBoundary>
    ),
    PackingIssueOrder: () => (
      <PageErrorBoundary>
        <Suspense fallback={<CenterLoader label="Loading Packing Issue Order..." />}>
          <PackingIssueOrder
            user={view.user}
            onNavigate={handleNavigate}
            params={view.params}
          />
        </Suspense>
      </PageErrorBoundary>
    ),
    DoriManagement: () => (
      <PageErrorBoundary>
        <Suspense fallback={<CenterLoader label="Loading Dori Management..." />}>
          <DoriManagement
            user={view.user}
            onNavigate={handleNavigate}
            params={view.params}
          />
        </Suspense>
      </PageErrorBoundary>
    ),
    // ADD THIS NEW ENTRY FOR ALTER JOB ORDER
    AlterJobOrder: () => (
      <PageErrorBoundary>
        <Suspense fallback={<CenterLoader label="Loading Alter Job Order..." />}>
          <AlterJobOrder
            user={view.user}
            onNavigate={handleNavigate}
            params={view.params}
          />
        </Suspense>
      </PageErrorBoundary>
    ),
  };
  return map[view.component] ?? (() => <NotFound onNavigate={handleNavigate} />);
}, [view]);

  return <Page />;
}
