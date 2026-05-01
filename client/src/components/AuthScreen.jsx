import { useMemo, useState } from "react";

const initialState = {
  name: "",
  email: "",
  password: ""
};

export default function AuthScreen({ onSubmit, loading, errorMessage }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(initialState);

  const heading = useMemo(
    () =>
      mode === "login"
        ? "Step into the team cockpit."
        : "Create a shared space for work that moves.",
    [mode]
  );

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      await onSubmit(mode, form);
    } catch {
      return;
    }

    if (mode === "register") {
      setForm(initialState);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setForm(initialState);
  }

  return (
    <main className="auth-shell">
      <section className="auth-hero card">
        <span className="eyebrow">Orbit Tasks</span>
        <h1>{heading}</h1>
        <p>
          Manage projects, assign ownership, and keep every task in motion with a focused
          team dashboard built for the assignment brief.
        </p>
        <div className="hero-grid">
          <div>
            <strong>Roles that matter</strong>
            <p>Admins manage members and tasks. Members focus on the work assigned to them.</p>
          </div>
          <div>
            <strong>Clear task flow</strong>
            <p>Track to-do, in-progress, and done work with due dates and priorities.</p>
          </div>
          <div>
            <strong>One public deployment</strong>
            <p>The same server delivers both the API and the production React app.</p>
          </div>
        </div>
      </section>

      <section className="auth-panel card">
        <div className="auth-tabs">
          <button
            className={mode === "login" ? "active" : ""}
            type="button"
            onClick={() => switchMode("login")}
          >
            Login
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            type="button"
            onClick={() => switchMode("register")}
          >
            Sign up
          </button>
        </div>

        <form className="stack-form" onSubmit={handleSubmit}>
          {mode === "register" ? (
            <label>
              <span>Name</span>
              <input
                name="name"
                placeholder="Aarav Patel"
                value={form.name}
                onChange={handleChange}
                required
              />
            </label>
          ) : null}

          <label>
            <span>Email</span>
            <input
              name="email"
              type="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              name="password"
              type="password"
              placeholder="At least 6 characters"
              value={form.password}
              onChange={handleChange}
              required
              minLength={6}
            />
          </label>

          {errorMessage ? <p className="banner banner-error">{errorMessage}</p> : null}

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Enter workspace" : "Create account"}
          </button>
        </form>
      </section>
    </main>
  );
}
