import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useDesignSettings } from "./hooks/useDesignSettings";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Finances from "./pages/Finances";
import Feed from "./pages/Feed";
import Notes from "./pages/Notes";
import CRM from "./pages/CRM";
import Prospection from "./pages/Prospection";
import ClientDetails from "./pages/ClientDetails";
import Agencies from "./pages/Agencies";
import AgencyDetails from "./pages/AgencyDetails";
import Projects from "./pages/Projects";
import ProjectDetails from "./pages/ProjectDetails";
import ArchivedProjects from "./pages/ArchivedProjects";
import Tasks from "./pages/Tasks";
import Messages from "./pages/Messages";
import Activity from "./pages/Activity";
import FAQ from "./pages/FAQ";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import SetPassword from "./pages/SetPassword";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";
import { useEffect, useState } from "react";

const queryClient = new QueryClient();

// Component to redirect PWA/Native users to Feed
const PWARedirect = ({ children }: { children: React.ReactNode }) => {
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    // Check if app is running as PWA or native app
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

const App = () => {
  useDesignSettings();
  
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
            <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/set-password" element={<SetPassword />} />
            <Route path="/" element={<ProtectedRoute><Layout><PWARedirect><Home /></PWARedirect></Layout></ProtectedRoute>} />
            <Route path="/home" element={<ProtectedRoute><Layout><PWARedirect><Home /></PWARedirect></Layout></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Layout><PWARedirect><Dashboard /></PWARedirect></Layout></ProtectedRoute>} />
            <Route path="/finances" element={<ProtectedRoute><Layout><PWARedirect><Finances /></PWARedirect></Layout></ProtectedRoute>} />
            <Route path="/feed" element={<ProtectedRoute><Layout><Feed /></Layout></ProtectedRoute>} />
            <Route path="/notes" element={<ProtectedRoute><Layout><Notes /></Layout></ProtectedRoute>} />
            <Route path="/crm" element={<ProtectedRoute><Layout><CRM /></Layout></ProtectedRoute>} />
            <Route path="/prospection" element={<ProtectedRoute><Layout><Prospection /></Layout></ProtectedRoute>} />
            <Route path="/client/:id" element={<ProtectedRoute><Layout><ClientDetails /></Layout></ProtectedRoute>} />
            <Route path="/agencies" element={<ProtectedRoute><Layout><Agencies /></Layout></ProtectedRoute>} />
            <Route path="/agency/:id" element={<ProtectedRoute><Layout><AgencyDetails /></Layout></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><Layout><Projects /></Layout></ProtectedRoute>} />
            <Route path="/project/:id" element={<ProtectedRoute><Layout><ProjectDetails /></Layout></ProtectedRoute>} />
            <Route path="/archived-projects" element={<ProtectedRoute><Layout><ArchivedProjects /></Layout></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><Layout><Tasks /></Layout></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><Layout><Messages /></Layout></ProtectedRoute>} />
            <Route path="/activity" element={<ProtectedRoute><Layout><Activity /></Layout></ProtectedRoute>} />
            <Route path="/faq" element={<ProtectedRoute><Layout><FAQ /></Layout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
            <Route path="/install" element={<Install />} />
            <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
