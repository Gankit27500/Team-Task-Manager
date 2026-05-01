import { useMemo, useState } from "react";
import { formatDate, isOverdue, PRIORITY_LABELS, STATUS_LABELS } from "../helpers";

const emptyTask = {
  title: "",
  description: "",
  dueDate: "",
  priority: "MEDIUM",
  status: "TODO",
  assignedToId: ""
};

const emptyMember = {
  email: "",
  role: "MEMBER"
};

function TaskColumn({ title, tasks, children }) {
  return (
    <section className="kanban-column">
      <div className="section-heading">
        <h3>{title}</h3>
        <span>{tasks.length}</span>
      </div>
      <div className="task-stack">
        {tasks.length === 0 ? <p className="empty-copy">Nothing here yet.</p> : children}
      </div>
    </section>
  );
}

export default function ProjectWorkspace({
  projectData,
  currentUser,
  busy,
  onAddMember,
  onChangeMemberRole,
  onRemoveMember,
  onCreateTask,
  onUpdateTask,
  onDeleteTask
}) {
  const [memberForm, setMemberForm] = useState(emptyMember);
  const [taskForm, setTaskForm] = useState(emptyTask);
  const [editingTaskId, setEditingTaskId] = useState(null);

  const members = projectData?.members || [];
  const tasks = projectData?.tasks || [];
  const project = projectData?.project;
  const isAdmin = project?.role === "ADMIN";

  const groupedTasks = useMemo(
    () => ({
      TODO: tasks.filter((task) => task.status === "TODO"),
      IN_PROGRESS: tasks.filter((task) => task.status === "IN_PROGRESS"),
      DONE: tasks.filter((task) => task.status === "DONE")
    }),
    [tasks]
  );

  if (!projectData) {
    return (
      <section className="card section-card workspace-empty">
        <h2>Select a project</h2>
        <p>Choose a project from the left or create one to start collaborating.</p>
      </section>
    );
  }

  async function handleMemberSubmit(event) {
    event.preventDefault();
    try {
      await onAddMember(project.id, memberForm);
      setMemberForm(emptyMember);
    } catch {
      return;
    }
  }

  async function handleTaskSubmit(event) {
    event.preventDefault();

    try {
      if (editingTaskId) {
        await onUpdateTask(editingTaskId, taskForm, project.id);
      } else {
        await onCreateTask(project.id, taskForm);
      }

      setTaskForm(emptyTask);
      setEditingTaskId(null);
    } catch {
      return;
    }
  }

  function beginEdit(task) {
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title,
      description: task.description || "",
      dueDate: task.dueDate || "",
      priority: task.priority,
      status: task.status,
      assignedToId: task.assignedToId || ""
    });
  }

  function cancelEdit() {
    setEditingTaskId(null);
    setTaskForm(emptyTask);
  }

  async function handleRoleChange(memberId, role) {
    try {
      await onChangeMemberRole(project.id, memberId, { role });
    } catch {
      return;
    }
  }

  async function handleRemove(memberId) {
    try {
      await onRemoveMember(project.id, memberId);
    } catch {
      return;
    }
  }

  async function quickStatusUpdate(task, status) {
    try {
      await onUpdateTask(task.id, { status }, project.id);
    } catch {
      return;
    }
  }

  async function handleDelete(taskId) {
    try {
      await onDeleteTask(taskId, project.id);
    } catch {
      return;
    }
  }

  return (
    <section className="workspace-shell">
      <article className="card section-card project-headline">
        <div>
          <span className="eyebrow">Selected project</span>
          <h2>{project.name}</h2>
          <p>{project.description || "No description added yet."}</p>
        </div>
        <div className="headline-meta">
          <span className={`role-pill ${project.role.toLowerCase()}`}>{project.role}</span>
          <span>{members.length} members</span>
          <span>{tasks.length} visible tasks</span>
        </div>
      </article>

      <div className="workspace-grid">
        <section className="card section-card">
          <div className="section-heading">
            <h3>Team members</h3>
            <span>{isAdmin ? "Manage access" : "Visible roster"}</span>
          </div>

          <div className="member-list">
            {members.map((member) => {
              const isOwner = member.id === project.ownerId;

              return (
                <article key={member.id} className="member-card">
                  <div>
                    <strong>{member.name}</strong>
                    <p>{member.email}</p>
                  </div>

                  {isAdmin ? (
                    <div className="member-actions">
                      <select
                        value={member.role}
                        onChange={(event) => handleRoleChange(member.id, event.target.value)}
                        disabled={Boolean(busy) || isOwner}
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="MEMBER">Member</option>
                      </select>
                      <button
                        className="ghost-button danger"
                        type="button"
                        onClick={() => handleRemove(member.id)}
                        disabled={Boolean(busy) || isOwner}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <span className={`role-pill ${member.role.toLowerCase()}`}>{member.role}</span>
                  )}
                </article>
              );
            })}
          </div>

          {isAdmin ? (
            <form className="stack-form compact-form" onSubmit={handleMemberSubmit}>
              <label>
                <span>Add member by email</span>
                <input
                  name="email"
                  type="email"
                  placeholder="member@company.com"
                  value={memberForm.email}
                  onChange={(event) =>
                    setMemberForm((current) => ({ ...current, email: event.target.value }))
                  }
                  required
                />
              </label>

              <label>
                <span>Role</span>
                <select
                  value={memberForm.role}
                  onChange={(event) =>
                    setMemberForm((current) => ({ ...current, role: event.target.value }))
                  }
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </label>

              <button className="primary-button" type="submit" disabled={Boolean(busy)}>
                Add member
              </button>
            </form>
          ) : null}
        </section>

        <section className="card section-card">
          <div className="section-heading">
            <h3>{isAdmin ? (editingTaskId ? "Edit task" : "Create task") : "Your task view"}</h3>
            <span>{isAdmin ? "Admin controls" : "Status updates only"}</span>
          </div>

          {isAdmin ? (
            <form className="stack-form compact-form" onSubmit={handleTaskSubmit}>
              <label>
                <span>Title</span>
                <input
                  name="title"
                  value={taskForm.title}
                  onChange={(event) =>
                    setTaskForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Prepare sprint retrospective"
                  required
                />
              </label>

              <label>
                <span>Description</span>
                <textarea
                  name="description"
                  rows="4"
                  value={taskForm.description}
                  onChange={(event) =>
                    setTaskForm((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Share context and acceptance criteria"
                />
              </label>

              <div className="form-row">
                <label>
                  <span>Due date</span>
                  <input
                    name="dueDate"
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, dueDate: event.target.value }))
                    }
                  />
                </label>

                <label>
                  <span>Priority</span>
                  <select
                    value={taskForm.priority}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, priority: event.target.value }))
                    }
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </label>
              </div>

              <div className="form-row">
                <label>
                  <span>Status</span>
                  <select
                    value={taskForm.status}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, status: event.target.value }))
                    }
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="DONE">Done</option>
                  </select>
                </label>

                <label>
                  <span>Assign to</span>
                  <select
                    value={taskForm.assignedToId}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, assignedToId: event.target.value }))
                    }
                  >
                    <option value="">Unassigned</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} ({member.role})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="inline-actions">
                <button className="primary-button" type="submit" disabled={Boolean(busy)}>
                  {editingTaskId ? "Save changes" : "Create task"}
                </button>
                {editingTaskId ? (
                  <button className="ghost-button" type="button" onClick={cancelEdit}>
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <p className="empty-copy">
              You can move your assigned tasks between To Do, In Progress, and Done directly from
              the board below.
            </p>
          )}
        </section>
      </div>

      <section className="kanban-grid">
        {Object.entries(groupedTasks).map(([status, columnTasks]) => (
          <TaskColumn key={status} title={STATUS_LABELS[status]} tasks={columnTasks}>
            {columnTasks.map((task) => (
              <article
                key={task.id}
                className={`task-card ${isOverdue(task) ? "overdue" : ""} ${
                  task.assignedToId === currentUser.id ? "mine" : ""
                }`}
              >
                <div className="task-card-top">
                  <div>
                    <strong>{task.title}</strong>
                    <p>{task.description || "No description added."}</p>
                  </div>
                  <span className={`priority-pill ${task.priority.toLowerCase()}`}>
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                </div>

                <div className="task-meta">
                  <span>{task.assignedToName || "Unassigned"}</span>
                  <span>{formatDate(task.dueDate)}</span>
                </div>

                <div className="task-footer">
                  <select
                    value={task.status}
                    onChange={(event) => quickStatusUpdate(task, event.target.value)}
                    disabled={Boolean(busy)}
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="DONE">Done</option>
                  </select>

                  {isAdmin ? (
                    <div className="inline-actions">
                      <button className="ghost-button" type="button" onClick={() => beginEdit(task)}>
                        Edit
                      </button>
                      <button
                        className="ghost-button danger"
                        type="button"
                        onClick={() => handleDelete(task.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </TaskColumn>
        ))}
      </section>
    </section>
  );
}
