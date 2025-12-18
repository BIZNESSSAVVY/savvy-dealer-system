// src/App.tsx

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navigation from "./components/Navigation";
import Chatbot from "./components/Chatbot";
import Footer from "./components/Footer";

// 🎯 NEW: Auth Provider and Protected Route
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";

// Page Imports
import Index from "./pages/Index";
import Inventory from "./pages/Inventory";
import VehicleDetails from "./pages/VehicleDetails";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Financing from "./pages/Financing";
import NotFound from "./pages/NotFound";

// Admin Pages
import AdminLogin from "./pages/admin/AdminLogin";
import { InventoryDashboard } from "./components/InventoryDashboard";

// 🎯 NEW: Feedback Page Import - FIXED: Capitalize component name
import Feedback from "./pages/feedback";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <div className="flex flex-col min-h-screen bg-background">
            <Navigation />
            <main className="flex-1">
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Index />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/vehicle/:id" element={<VehicleDetails />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/financing" element={<Financing />} />
                
                {/* 🎯 NEW: Feedback Route (Public) - FIXED: Capital F */}
                <Route path="/feedback" element={<Feedback />} />
                <Route path="/feedback/:token" element={<Feedback />} />

                {/* Admin Login Route (Public) */}
                <Route path="/admin/login" element={<AdminLogin />} />
                
                {/* Protected Admin Dashboard Route */}
                <Route 
                  path="/admin/inventory" 
                  element={
                    <ProtectedRoute>
                      <InventoryDashboard />
                    </ProtectedRoute>
                  } 
                />
                
                {/* Fallback Route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <Footer />
            <Chatbot />
          </div>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;