import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export default function Portfolios() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const { data, isLoading, error } = useQuery({ queryKey: ["portfolios"], queryFn: api.listPortfolios });

  const create = useMutation({
    mutationFn: api.createPortfolio,
    onSuccess: () => {
      setName("");
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
    },
  });

  const remove = useMutation({
    mutationFn: api.deletePortfolio,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["portfolios"] }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) create.mutate(name.trim());
  };

  return (
    <>
      <h1>Portfolios</h1>
      <form className="row" onSubmit={submit}>
        <input placeholder="New portfolio name" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" disabled={create.isPending}>
          Create
        </button>
      </form>
      {create.error && <p className="error">{create.error.message}</p>}

      {isLoading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error.message}</p>}
      {data && data.length === 0 && <p className="muted">No portfolios yet. Create one above.</p>}

      <div className="grid">
        {data?.map((p) => (
          <div key={p.id} className="card">
            <Link to={`/portfolios/${p.id}`} className="card-title">
              {p.name}
            </Link>
            <p className="muted small">
              {p.holding_count ?? 0} holding{p.holding_count === 1 ? "" : "s"}
            </p>
            <button
              className="ghost danger small"
              onClick={() => confirm(`Delete "${p.name}"? This cannot be undone.`) && remove.mutate(p.id)}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
