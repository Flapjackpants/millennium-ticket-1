import { useState, type FormEvent } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth";

export default function Layout() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [symbol, setSymbol] = useState("");

  const lookup = (e: FormEvent) => {
    e.preventDefault();
    const s = symbol.trim().toUpperCase();
    if (s) navigate(`/tickers/${s}`);
    setSymbol("");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    navigate("/login");
  };

  return (
    <>
      <header className="topbar">
        <Link to="/portfolios" className="brand">
          Risk Platform
        </Link>
        <form onSubmit={lookup} className="row">
          <input
            placeholder="Look up ticker…"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            aria-label="Ticker lookup"
          />
        </form>
        <div className="row">
          <span className="muted small">{session?.user.email}</span>
          <button className="ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
