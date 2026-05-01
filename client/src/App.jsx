import { useEffect, useState } from "react";
import { api } from "./api";
import AuthScreen from "./components/AuthScreen";
import DashboardPanel from "./components/DashboardPanel";
import ProjectWorkspace from "./components/ProjectWorkspace";
import Sidebar from "./components/Sidebar";

const STORAGE_KEY = "orbit-tasks-token";

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY) || "");
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectData, setProjectData] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [busy, setBusy] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [bootstrapping, setBootstrapping] = useState(Boolean(token));

  useEffect(() => {
    if (!token) {
      localStorage.removeItem(STORAGE_KEY);
      setBootstrapping(false);
      setUser(null);
      setProjects([]);
      setSelectedProjectId(null);
      setProjectData(null);
      setDashboard(null);
      return;
    }

    localStorage.setItem(STORAGE_KEY, token);
    void bootstrap(selectedProjectId);
  }, [token]);

  useEffect(() => {
    if (!token || !selectedProjectId) {
      setProjectData(null);
      return;
    }

    void fetchProject(selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectId(null);
      return;
    }

    if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  async function runAction(label, action) {
    setBusy(label);
    setErrorMessage("");

    try {
      return await action();
    } catch (error) {
      if (error.status === 401) {
        logout();
      }

      setErrorMessage(error.message || "Something went wrong.");
      throw error;
    } finally {
      setBusy("");
    }
  }

  async function bootstrap(focusProjectId) {
    setBootstrapping(true);
    setErrorMessage("");

    try {
      const [me, projectResult, dashboardResult] = await Promise.all([
        api.getMe(token),
        api.listProjects(token),
        api.getDashboard(token)
      ]);

      setUser(me.user);
      setProjects(projectResult.projects);
      setDashboard(dashboardResult);

      const nextProjectId = focusProjectId || projectResult.projects[0]?.id || null;
      setSelectedProjectId(nextProjectId);

      if (nextProjectId) {
        const detail = await api.getProject(token, nextProjectId);
        setProjectData(detail);
      } else {
        setProjectData(null);
      }
    } catch (error) {
      logout();
      setErrorMessage(error.message || "Unable to load your workspace.");
    } finally {
      setBootstrapping(false);
    }
  }

  async function fetchProjects() {
    const result = await api.listProjects(token);
    setProjects(result.projects);
    return result.projects;
  }

  async function fetchDashboard() {
    const result = await api.getDashboard(token);
    setDashboard(result);
    return result;
  }

  async function fetchProject(projectId) {
    const result = await api.getProject(token, projectId);
    setProjectData(result);
    return result;
  }

  async function refreshProjectContext(projectId = selectedProjectId) {
    await Promise.all([
      fetchProjects(),
      fetchDashboard(),
      projectId ? fetchProject(projectId) : Promise.resolve()
    ]);
  }

  async function handleAuth(mode, form) {
    await runAction(mode === "login" ? "Logging in" : "Creating account", async () => {
      const payload = mode === "login"
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password };

      const result = mode === "login" ? await api.login(payload) : await api.register(payload);
      setNotice(mode === "login" ? "Welcome back." : "Account created successfully.");
      setToken(result.token);
      setUser(result.user);
    });
  }

  async function handleCreateProject(payload) {
    await runAction("Creating project", async () => {
      const result = await api.createProject(token, payload);
      setNotice("Project created.");
      await bootstrap(result.project.id);
    });
  }

  async function handleAddMember(projectId, payload) {
    await runAction("Adding member", async () => {
      await api.addMember(token, projectId, payload);
      setNotice("Member added.");
      await refreshProjectContext(projectId);
    });
  }

  async function handleChangeMemberRole(projectId, memberId, payload) {
    await runAction("Updating role", async () => {
      await api.updateMemberRole(token, projectId, memberId, payload);
      setNotice("Member role updated.");
      await refreshProjectContext(projectId);
    });
  }

  async function handleRemoveMember(projectId, memberId) {
    await runAction("Removing member", async () => {
      await api.removeMember(token, projectId, memberId);
      setNotice("Member removed.");
      await refreshProjectContext(projectId);
    });
  }

  async function handleCreateTask(projectId, payload) {
    await runAction("Creating task", async () => {
      await api.createTask(token, projectId, payload);
      setNotice("Task created.");
      await refreshProjectContext(projectId);
    });
  }

  async function handleUpdateTask(taskId, payload, projectId) {
    await runAction("Updating task", async () => {
      await api.updateTask(token, taskId, payload);
      setNotice("Task updated.");
      await refreshProjectContext(projectId);
    });
  }

  async function handleDeleteTask(taskId, projectId) {
    await runAction("Deleting task", async () => {
      await api.deleteTask(token, taskId);
      setNotice("Task deleted.");
      await refreshProjectContext(projectId);
    });
  }

  function logout() {
    setToken("");
    setNotice("You have been logged out.");
  }

  if (!token) {
    return <AuthScreen onSubmit={handleAuth} loading={Boolean(busy)} errorMessage={errorMessage} />;
  }

  if (bootstrapping || !user) {
    return (
      <main className="loading-screen">
        <div className="card loading-card">
          <span className="eyebrow">Orbit Tasks</span>
          <h1>Preparing your workspace...</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <Sidebar
        user={user}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        onCreateProject={handleCreateProject}
        onLogout={logout}
        busy={busy}
      />

      <section className="main-panel">
        {notice ? <p className="banner banner-success">{notice}</p> : null}
        {errorMessage ? <p className="banner banner-error">{errorMessage}</p> : null}

        <DashboardPanel dashboard={dashboard} projectCount={projects.length} />

        <ProjectWorkspace
          projectData={projectData}
          currentUser={user}
          busy={busy}
          onAddMember={handleAddMember}
          onChangeMemberRole={handleChangeMemberRole}
          onRemoveMember={handleRemoveMember}
          onCreateTask={handleCreateTask}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
        />
      </section>
    </main>
  );
}
