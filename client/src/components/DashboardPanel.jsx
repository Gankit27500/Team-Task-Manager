import { formatDate } from "../helpers";

function Bar({ label, value, tone }) {
  return (
    <div className="bar-row">
      <div className="bar-row-label">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="bar-track">
        <div className={`bar-fill ${tone}`} style={{ width: `${Math.max(value * 12, value ? 14 : 0)}px` }} />
      </div>
    </div>
  );
}

export default function DashboardPanel({ dashboard, projectCount }) {
  if (!dashboard) {
    return (
      <section className="card section-card">
        <div className="section-heading">
          <h3>Dashboard</h3>
        </div>
        <p className="empty-copy">Your workspace metrics will show up here once data loads.</p>
      </section>
    );
  }

  return (
    <section className="dashboard-panel">
      <div className="stats-grid">
        <article className="stat-card warm">
          <span>Total visible tasks</span>
          <strong>{dashboard.summary.totalTasks}</strong>
        </article>
        <article className="stat-card cool">
          <span>Overdue tasks</span>
          <strong>{dashboard.summary.overdueTasks}</strong>
        </article>
        <article className="stat-card gold">
          <span>Projects joined</span>
          <strong>{projectCount}</strong>
        </article>
      </div>

      <div className="dashboard-grid">
        <section className="card section-card">
          <div className="section-heading">
            <h3>Status snapshot</h3>
            <span>Live workload</span>
          </div>
          <div className="bar-stack">
            <Bar label="To Do" value={dashboard.tasksByStatus.TODO} tone="warm" />
            <Bar label="In Progress" value={dashboard.tasksByStatus.IN_PROGRESS} tone="cool" />
            <Bar label="Done" value={dashboard.tasksByStatus.DONE} tone="gold" />
          </div>
        </section>

        <section className="card section-card">
          <div className="section-heading">
            <h3>Workload by assignee</h3>
            <span>Across visible tasks</span>
          </div>
          {dashboard.tasksPerUser.length === 0 ? (
            <p className="empty-copy">No assignments yet.</p>
          ) : (
            <div className="workload-list">
              {dashboard.tasksPerUser.map((entry) => (
                <div key={entry.userId || "unassigned"} className="workload-row">
                  <span>{entry.userName}</span>
                  <strong>{entry.count}</strong>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card section-card recent-card">
          <div className="section-heading">
            <h3>Recent task activity</h3>
            <span>Last updated first</span>
          </div>
          {dashboard.recentTasks.length === 0 ? (
            <p className="empty-copy">Create a task to see dashboard activity.</p>
          ) : (
            <div className="recent-list">
              {dashboard.recentTasks.map((task) => (
                <article key={task.id} className="recent-item">
                  <div>
                    <strong>{task.title}</strong>
                    <p>
                      {task.projectName} · {task.assignedToName || "Unassigned"}
                    </p>
                  </div>
                  <span>{formatDate(task.updatedAt?.slice(0, 10))}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
