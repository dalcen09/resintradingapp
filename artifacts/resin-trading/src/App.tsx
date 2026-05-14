import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { CategoryView } from "./pages/CategoryView";
import { TrashView } from "./pages/TrashView";
import { Matches } from "./pages/Matches";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

type AuthPage = "login" | "register" | "forgot" | "reset";

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
  const [session, setSession] = useState<Session | null | "loading">("loading");
  const [authPage, setAuthPage] = useState<AuthPage>("login");
  const [isReset, setIsReset] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsReset(true);
      }
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (session === "loading") {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0faf4" }}>
        <div style={{ width: 32, height: 32, border: "3px solid hsl(152,73%,41%)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (session && isReset) {
    return <ResetPasswordPage onDone={() => setIsReset(false)} />;
  }

  if (!session) {
    if (authPage === "register") return <RegisterPage onBack={() => setAuthPage("login")} />;
    if (authPage === "forgot") return <ForgotPasswordPage onBack={() => setAuthPage("login")} />;
    return (
      <LoginPage
        onSuccess={() => setAuthPage("login")}
        onRegister={() => setAuthPage("register")}
        onForgotPassword={() => setAuthPage("forgot")}
      />
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRoutes onLogout={() => supabase.auth.signOut()} />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
