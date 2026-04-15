import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useDesignSettings } from "./hooks/useDesignSettings";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { lazy, Suspense, useEffect, useState } from "react";
import { AppSkeleton } from "./components/AppSkeleton";

// Lazy-loaded pages for code splitting
const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Finances = lazy(() => import("./pages/Finances"));
const Feed = lazy(() => import("./pages/Feed"));
const Notes = lazy(() => import("./pages/Notes"));
const CRM = lazy(() => import("./pages/CRM"));
const Prospection = lazy(() => import("./pages/Prospection"));
const ClientDetails = lazy(() => import("./pages/ClientDetails"));
const Agencies = lazy(() => import("./pages/Agencies"));
const AgencyDetails = lazy(() => import("./pages/AgencyDetails"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectDetails = lazy(() => import("./pages/ProjectDetails"));
const ArchivedProjects = lazy(() => import("./pages/ArchivedProjects"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Messages = lazy(() => import("./pages/Messages"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Settings = lazy(() => import("./pages/Settings"));
const Auth = lazy(() => import("./pages/Auth"));
const SetPassword = lazy(() => import("./pages/SetPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Install = lazy(() => import("./pages/Install"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const Lagostina = lazy(() => import("./pages/Lagostina"));
const LagostinaAdmin = lazy(() => import("./pages/LagostinaAdmin"));
const Brisach = lazy(() => import("./pages/Brisach"));
const Announcements = lazy(() => import("./pages/Announcements"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Minimal page-level loading skeleton
function PageSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      {children}
    </Suspense>
  );
}

// Component to redirect PWA/Native users to Feed
const PWARedirect = ({ children }: { children: React.ReactNode }) => {
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;
    const isNative = typeof (window as any).Capacitor !== 'undefined';
    setIsPWA(isStandalone || isInWebAppiOS || isNative);
  }, []);

  if (isPWA) {
    return <Navigate to="/feed" replace />;
  }

  return <>{children}</>;
};

function AppInner() {
  useDesignSettings();
  
  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
        <Routes>
        <Route path="/auth" element={<Suspense fallback={<AppSkeleton />}><Auth /></Suspense>} />
        <Route path="/auth/set-password" element={<Suspense fallback={<AppSkeleton />}><SetPassword /></Suspense>} />
        <Route path="/reset-password" element={<Suspense fallback={<AppSkeleton />}><ResetPassword /></Suspense>} />
        <Route path="/" element={<ProtectedRoute><Layout><PageSuspense><PWARedirect><Home /></PWARedirect></PageSuspense></Layout></ProtectedRoute>} />
        <Route path="/home" element={<ProtectedRoute><Layout><PageSuspense><PWARedirect><Home /></PWARedirect></PageSuspense></Layout></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Layout><PageSuspense><PWARedirect><Dashboard /></PWARedirect></PageSuspense></Layout></ProtectedRoute>} />
        <Route path="/finances" element={<ProtectedRoute><Layout><PageSuspense><PWARedirect><Finances /></PWARedirect></PageSuspense></Layout></ProtectedRoute>} />
        <Route path="/feed" element={<ProtectedRoute><Layout><PageSuspense><Feed /></PageSuspense></Layout></ProtectedRoute>} />
        <Route path="/notes" element={<ProtectedRoute><Layout><PageSuspense><Notes /></PageSuspense></Layout></ProtectedRoute>} />
        <Route path="/crm" element={<ProtectedRoute><Layout><PageSuspense><CRM /></PageSuspense></Layout></ProtectedRoute>} />
        <Route path="/prospection" element={<ProtectedRoute><Layout><PageSuspense><Prospection /></PageSuspense></Layout></ProtectedRoute>} />
        <Route path="/client/:id" element={<ProtectedRoute><Layout><PageSuspense><ClientDetails /></PageSuspense></Layout></ProtectedRoute>} />
        <Route path="/agencies" element={<ProtectedRoute><Layout><PageSuspense><Agencies /></PageSuspense></Layout></ProtectedRoute>} />
        <Route path="/agency/:id" element={<ProtectedRoute><Layout><PageSuspense><AgencyDetails /></PageSuspense></Layout></ProtectedRoute>} />
        <Route path="/projects" element={<ProtectedRoute><Layout><PageSuspense><Projects /></PageSuspense></Layout></ProtectedRoute>} />
        <Route path="/project/:id" element={<ProtectedRoute><Layout><PageSuspense><ProjectDetails /></PageSuspense></Layout></ProtectedRoute>} />
        <Route path="/archived-projects" element={<ProtectedRoute><Layout><PageSuspense><ArchivedProjects /></PageSuspense></Layout></ProtectedRoute>} />
        <Route path="/tasks" element={<ProtectedRoute><Layout><PageSuspense><Tasks /></PageSuspense></Layout></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute><Layout><PageSuspense><Messages /></PageSuspense></Layout></ProtectedRoute>} />
        <Route path="/faq" element={<ProtectedRoute><Layout><PageSuspense><FAQ /></PageSuspense></Layout></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Layout><PageSuspense><Settings /></PageSuspense></Layout></ProtectedRoute>} />
        <Route path="/install" element={<Suspense fallback={<AppSkeleton />}><Install /></Suspense>} />
        <Route path="/unsubscribe" element={<Suspense fallback={<AppSkeleton />}><Unsubscribe /></Suspense>} />
        <Route path="/lagostina" element={<ProtectedRoute><Layout><PageSuspense><Lagostina /></PageSuspense></Layout></ProtectedRoute>} />
        <Route path="/admin/lagostina" element={<ProtectedRoute><Layout><PageSuspense><LagostinaAdmin /></PageSuspense></Layout></ProtectedRoute>} />
        <Route path="/brisach" element={<ProtectedRoute><Layout><PageSuspense><Brisach /></PageSuspense></Layout></ProtectedRoute>} />
        <Route path="/announcements" element={<ProtectedRoute><Layout><PageSuspense><Announcements /></PageSuspense></Layout></ProtectedRoute>} />
        <Route path="*" element={<Suspense fallback={null}><NotFound /></Suspense>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </TooltipProvider>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
