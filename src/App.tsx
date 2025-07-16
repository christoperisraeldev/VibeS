import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import Index from "./pages/Index";
import Onboarding from "./pages/Onboarding";
import Profile from "./pages/Profile";
import SmartMatching, { Partner } from "./pages/SmartMatching";
import Chat from "./pages/Chat";
import Messages from "./pages/Messages";
import Scheduler from "./pages/Scheduler";
import Dashboard from "./pages/Dashboard";
import Sessions from "./pages/Sessions";
import VideoSession from "./pages/VideoSession";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";
import { auth } from "@/lib/firebaseClient"; // Import Firebase auth
import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";

const queryClient = new QueryClient();

const SmartMatchingWrapper = () => {
  const navigate = useNavigate();
  
  const handlePartnerSelect = (partner: Partner) => {
    navigate(`/chat?partnerId=${partner.id}`);
  };

  return <SmartMatching onPartnerSelect={handlePartnerSelect} />;
};

const AuthenticatedRoutes = () => {
  const [sessionChecked, setSessionChecked] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        navigate('/');
      }
      setSessionChecked(true);
    });

    return () => unsubscribe();
  }, [navigate]);

  if (!sessionChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/smart-matching" element={<SmartMatchingWrapper />} />
      <Route path="/chat" element={<Chat />} />
      <Route path="/messages" element={<Messages />} />
      <Route path="/scheduler" element={<Scheduler />} />
      <Route path="/sessions" element={<Sessions />} />
      <Route path="/video-session" element={<VideoSession />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/*" element={<AuthenticatedRoutes />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;