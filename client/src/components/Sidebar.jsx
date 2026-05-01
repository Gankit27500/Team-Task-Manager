import { useState } from "react";

export default function Sidebar({
  user,
  projects,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  onLogout,
  busy
}) {
  const [draft, setDraft] = useState({
    name: "",
    description: ""
  });

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      await onCreateProject(draft);
      setDraft({ name: "", description: "" });
    } catch {
      return;
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
  }

  return (
    <aside className="sidebar card">
      <div className="sidebar-header">
        <div>
          <span className="eyebrow">Workspace</span>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
        </div>
        <button className="ghost-button" type="button" onClick={onLogout}>
          Logout
        </button>
      </div>

      <form className="stack-form compact-form" onSubmit={handleSubmit}>
        <div className="section-heading">
          <h3>New project</h3>
          <span>{projects.length} total</span>
        </div>

        <label>
          <span>Project name</span>
          <input
            name="name"
            placeholder="Launch Sprint"
            value={draft.name}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          <span>Description</span>
          <textarea
            name="description"
            rows="3"
            placeholder="What is this project about?"
            value={draft.description}
            onChange={handleChange}
          />
        </label>

        <button className="primary-button" type="submit" disabled={Boolean(busy)}>
          Create project
        </button>
      </form>

      <div className="project-list">
        <div className="section-heading">
          <h3>Projects</h3>
          <span>Select one</span>
        </div>

        {projects.length === 0 ? (
          <p className="empty-copy">Start by creating your first project.</p>
        ) : (
          projects.map((project) => (
            <button
              key={project.id}
              type="button"
              className={`project-tile ${selectedProjectId === project.id ? "active" : ""}`}
              onClick={() => onSelectProject(project.id)}
            >
              <div className="project-tile-top">
                <strong>{project.name}</strong>
                <span className={`role-pill ${project.role.toLowerCase()}`}>{project.role}</span>
              </div>
              <p>{project.description || "No description yet."}</p>
              <div className="project-stats">
                <span>{project.memberCount} members</span>
                <span>{project.completedTaskCount}/{project.taskCount} done</span>
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
