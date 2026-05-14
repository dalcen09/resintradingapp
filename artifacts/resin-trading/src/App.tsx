import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { CategoryView } from "./pages/CategoryView";
import { TrashView } from "./pages/TrashView";
import { Matches } from "./pages/Matches";
import { LoginPage } from "./pages/LoginPage";
import { useState, useEffect } from "react";
import { verifyToken, clearToken } from "@/lib/auth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function AppRoutes({ onLogout }: { onLogout: () => void }) {
  return (
    <Switch>
      <Route path="/"><Redirect to="/offgrade" /></Route>
      <Route path="/offgrade">{() => <CategoryView category="offgrade" onLogout={onLogout} />}</Route>
      <Route path="/recycled">{() => <CategoryView category="recycled" onLogout={onLogout} />}</Route>
      <Route path="/trash">{() => <TrashView onLogout={onLogout} />}</Route>
      <Route path="/matches/:category">{(params) => <Matches category={params.category} onLogout={onLogout} />}</Route>
      <Route path="/matches">{() => <Matches onLogout={onLogout} />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | "loading">("loading");

  useEffect(() => {
    verifyToken().then(setAuthenticated);
  }, []);

  function handleLogout() {
    clearToken();
    setAuthenticated(false);
  }

  if (authenticated === "loading") {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0faf4" }}>
        <div style={{ width: 32, height: 32, border: "3px solid hsl(152,73%,41%)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginPage onSuccess={() => setAuthenticated(true)} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRoutes onLogout={handleLogout} />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
