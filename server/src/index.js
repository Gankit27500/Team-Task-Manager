require("dotenv").config();

const bcrypt = require("bcryptjs");
const cors = require("cors");
const express = require("express");
const fs = require("fs");
const morgan = require("morgan");
const path = require("path");
const { randomUUID } = require("crypto");

const { authenticate, createToken } = require("./auth");
const { databasePath, db } = require("./db");
const {
  addMemberSchema,
  createProjectSchema,
  createTaskSchema,
  loginSchema,
  memberTaskUpdateSchema,
  registerSchema,
  updateMemberRoleSchema,
  updateTaskSchema
} = require("./schemas");
const {
  AppError,
  formatMember,
  formatProject,
  formatTask,
  formatUser,
  handleError,
  normalizeOptionalAssignee,
  normalizeOptionalDate,
  normalizeOptionalText,
  parseWithSchema
} = require("./utils");

const app = express();
const PORT = Number(process.env.PORT || 4000);
const clientDistPath = path.resolve(__dirname, "../../client/dist");

const allowedOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new AppError(403, "Origin is not allowed."));
    }
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

function requireProjectMembership(projectId, userId) {
  const membership = db
    .prepare(
      `
        SELECT
          p.id,
          p.name,
          p.description,
          p.owner_id,
          p.created_at,
          pm.role,
          (
            SELECT COUNT(*)
            FROM project_members
            WHERE project_id = p.id
          ) AS member_count,
          (
            SELECT COUNT(*)
            FROM tasks
            WHERE project_id = p.id
          ) AS task_count,
          (
            SELECT COUNT(*)
            FROM tasks
            WHERE project_id = p.id
              AND status = 'DONE'
          ) AS completed_task_count
        FROM projects p
        JOIN project_members pm
          ON pm.project_id = p.id
         AND pm.user_id = ?
        WHERE p.id = ?
      `
    )
    .get(userId, projectId);

  if (!membership) {
    throw new AppError(404, "Project not found or you do not have access.");
  }

  return membership;
}

function requireAdmin(projectId, userId) {
  const membership = requireProjectMembership(projectId, userId);

  if (membership.role !== "ADMIN") {
    throw new AppError(403, "Only project admins can perform this action.");
  }

  return membership;
}

function getProjectMembers(projectId) {
  return db
    .prepare(
      `
        SELECT
          u.id,
          u.name,
          u.email,
          pm.role,
          pm.joined_at
        FROM project_members pm
        JOIN users u
          ON u.id = pm.user_id
        WHERE pm.project_id = ?
        ORDER BY
          CASE pm.role
            WHEN 'ADMIN' THEN 0
            ELSE 1
          END,
          u.name COLLATE NOCASE ASC
      `
    )
    .all(projectId)
    .map(formatMember);
}

function getProjectTasks(projectId, currentUserId, role) {
  const baseQuery = `
    SELECT
      t.*,
      assignee.name AS assignee_name,
      assignee.email AS assignee_email,
      creator.name AS creator_name
    FROM tasks t
    LEFT JOIN users assignee
      ON assignee.id = t.assigned_to_id
    LEFT JOIN users creator
      ON creator.id = t.created_by_id
    WHERE t.project_id = ?
  `;

  const roleFilter = role === "ADMIN" ? "" : " AND t.assigned_to_id = ?";
  const query = `
    ${baseQuery}
    ${roleFilter}
    ORDER BY
      CASE t.status
        WHEN 'TODO' THEN 0
        WHEN 'IN_PROGRESS' THEN 1
        ELSE 2
      END,
      CASE t.priority
        WHEN 'URGENT' THEN 0
        WHEN 'HIGH' THEN 1
        WHEN 'MEDIUM' THEN 2
        ELSE 3
      END,
      COALESCE(t.due_date, '9999-12-31') ASC,
      t.created_at DESC
  `;

  const rows = role === "ADMIN"
    ? db.prepare(query).all(projectId)
    : db.prepare(query).all(projectId, currentUserId);

  return rows.map(formatTask);
}

function ensureMemberBelongsToProject(projectId, userId) {
  const membership = db
    .prepare("SELECT project_id, user_id, role FROM project_members WHERE project_id = ? AND user_id = ?")
    .get(projectId, userId);

  if (!membership) {
    throw new AppError(400, "Assignee must be a member of the selected project.");
  }

  return membership;
}

function buildDashboard(userId) {
  const visibleTasks = db
    .prepare(
      `
        SELECT
          t.*,
          p.name AS project_name,
          assignee.name AS assignee_name,
          assignee.email AS assignee_email,
          creator.name AS creator_name
        FROM tasks t
        JOIN projects p
          ON p.id = t.project_id
        JOIN project_members pm
          ON pm.project_id = t.project_id
         AND pm.user_id = ?
        LEFT JOIN users assignee
          ON assignee.id = t.assigned_to_id
        LEFT JOIN users creator
          ON creator.id = t.created_by_id
        WHERE pm.role = 'ADMIN'
           OR t.assigned_to_id = ?
        ORDER BY t.updated_at DESC
      `
    )
    .all(userId, userId)
    .map(formatTask);

  const today = new Date().toISOString().slice(0, 10);
  const tasksByStatus = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
  const tasksPerUserMap = new Map();
  let overdueTasks = 0;

  for (const task of visibleTasks) {
    tasksByStatus[task.status] += 1;

    const assigneeKey = task.assignedToId || "unassigned";
    const assigneeName = task.assignedToName || "Unassigned";
    tasksPerUserMap.set(assigneeKey, {
      userId: task.assignedToId,
      userName: assigneeName,
      count: (tasksPerUserMap.get(assigneeKey)?.count || 0) + 1
    });

    if (task.dueDate && task.dueDate < today && task.status !== "DONE") {
      overdueTasks += 1;
    }
  }

  return {
    summary: {
      totalTasks: visibleTasks.length,
      overdueTasks
    },
    tasksByStatus,
    tasksPerUser: Array.from(tasksPerUserMap.values()).sort((left, right) => right.count - left.count),
    recentTasks: visibleTasks.slice(0, 6)
  };
}

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    databasePath
  });
});

app.post("/api/auth/register", (req, res, next) => {
  try {
    const payload = parseWithSchema(registerSchema, req.body);
    const email = payload.email.toLowerCase();
    const existingUser = db.prepare("SELECT id FROM users WHERE email = ?").get(email);

    if (existingUser) {
      throw new AppError(409, "An account already exists with that email.");
    }

    const user = {
      id: randomUUID(),
      name: payload.name.trim(),
      email,
      passwordHash: bcrypt.hashSync(payload.password, 10)
    };

    db.prepare(
      `
        INSERT INTO users (id, name, email, password_hash)
        VALUES (?, ?, ?, ?)
      `
    ).run(user.id, user.name, user.email, user.passwordHash);

    const createdUser = db
      .prepare("SELECT id, name, email, created_at FROM users WHERE id = ?")
      .get(user.id);

    res.status(201).json({
      token: createToken(createdUser),
      user: formatUser(createdUser)
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", (req, res, next) => {
  try {
    const payload = parseWithSchema(loginSchema, req.body);
    const email = payload.email.toLowerCase();
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

    if (!user || !bcrypt.compareSync(payload.password, user.password_hash)) {
      throw new AppError(401, "Incorrect email or password.");
    }

    const safeUser = formatUser(user);
    res.json({
      token: createToken(safeUser),
      user: safeUser
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/projects", authenticate, (req, res, next) => {
  try {
    const projects = db
      .prepare(
        `
          SELECT
            p.id,
            p.name,
            p.description,
            p.owner_id,
            p.created_at,
            pm.role,
            (
              SELECT COUNT(*)
              FROM project_members
              WHERE project_id = p.id
            ) AS member_count,
            (
              SELECT COUNT(*)
              FROM tasks
              WHERE project_id = p.id
            ) AS task_count,
            (
              SELECT COUNT(*)
              FROM tasks
              WHERE project_id = p.id
                AND status = 'DONE'
            ) AS completed_task_count
          FROM projects p
          JOIN project_members pm
            ON pm.project_id = p.id
           AND pm.user_id = ?
          ORDER BY p.created_at DESC
        `
      )
      .all(req.user.id)
      .map(formatProject);

    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects", authenticate, (req, res, next) => {
  try {
    const payload = parseWithSchema(createProjectSchema, req.body);
    const projectId = randomUUID();

    db.exec("BEGIN");

    try {
      db.prepare(
        `
          INSERT INTO projects (id, name, description, owner_id)
          VALUES (?, ?, ?, ?)
        `
      ).run(
        projectId,
        payload.name.trim(),
        normalizeOptionalText(payload.description),
        req.user.id
      );

      db.prepare(
        `
          INSERT INTO project_members (project_id, user_id, role)
          VALUES (?, ?, 'ADMIN')
        `
      ).run(projectId, req.user.id);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    const project = requireProjectMembership(projectId, req.user.id);
    res.status(201).json({ project: formatProject(project) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects/:projectId", authenticate, (req, res, next) => {
  try {
    const membership = requireProjectMembership(req.params.projectId, req.user.id);
    res.json({
      project: formatProject(membership),
      members: getProjectMembers(req.params.projectId),
      tasks: getProjectTasks(req.params.projectId, req.user.id, membership.role)
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects/:projectId/members", authenticate, (req, res, next) => {
  try {
    const project = requireAdmin(req.params.projectId, req.user.id);
    const payload = parseWithSchema(addMemberSchema, req.body);
    const email = payload.email.toLowerCase();
    const user = db.prepare("SELECT id, name, email, created_at FROM users WHERE email = ?").get(email);

    if (!user) {
      throw new AppError(404, "No registered user was found with that email.");
    }

    const existingMember = db
      .prepare("SELECT user_id FROM project_members WHERE project_id = ? AND user_id = ?")
      .get(project.id, user.id);

    if (existingMember) {
      throw new AppError(409, "That user is already part of the project.");
    }

    db.prepare(
      `
        INSERT INTO project_members (project_id, user_id, role)
        VALUES (?, ?, ?)
      `
    ).run(project.id, user.id, payload.role);

    res.status(201).json({
      message: "Member added successfully.",
      members: getProjectMembers(project.id)
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/projects/:projectId/members/:memberId", authenticate, (req, res, next) => {
  try {
    const project = requireAdmin(req.params.projectId, req.user.id);
    const payload = parseWithSchema(updateMemberRoleSchema, req.body);

    if (req.params.memberId === project.owner_id) {
      throw new AppError(400, "The project owner must remain an admin.");
    }

    const targetMember = db
      .prepare("SELECT user_id FROM project_members WHERE project_id = ? AND user_id = ?")
      .get(project.id, req.params.memberId);

    if (!targetMember) {
      throw new AppError(404, "Project member not found.");
    }

    db.prepare(
      `
        UPDATE project_members
        SET role = ?
        WHERE project_id = ? AND user_id = ?
      `
    ).run(payload.role, project.id, req.params.memberId);

    res.json({
      message: "Member role updated.",
      members: getProjectMembers(project.id)
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/projects/:projectId/members/:memberId", authenticate, (req, res, next) => {
  try {
    const project = requireAdmin(req.params.projectId, req.user.id);

    if (req.params.memberId === project.owner_id) {
      throw new AppError(400, "The project owner cannot be removed.");
    }

    const targetMember = db
      .prepare("SELECT user_id FROM project_members WHERE project_id = ? AND user_id = ?")
      .get(project.id, req.params.memberId);

    if (!targetMember) {
      throw new AppError(404, "Project member not found.");
    }

    db.prepare("DELETE FROM project_members WHERE project_id = ? AND user_id = ?").run(
      project.id,
      req.params.memberId
    );

    db.prepare(
      `
        UPDATE tasks
        SET assigned_to_id = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE project_id = ?
          AND assigned_to_id = ?
      `
    ).run(project.id, req.params.memberId);

    res.json({
      message: "Member removed successfully.",
      members: getProjectMembers(project.id)
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects/:projectId/tasks", authenticate, (req, res, next) => {
  try {
    const project = requireAdmin(req.params.projectId, req.user.id);
    const payload = parseWithSchema(createTaskSchema, req.body);
    const assignedToId = normalizeOptionalAssignee(payload.assignedToId);
    const dueDate = normalizeOptionalDate(payload.dueDate);

    if (assignedToId) {
      ensureMemberBelongsToProject(project.id, assignedToId);
    }

    const taskId = randomUUID();

    db.prepare(
      `
        INSERT INTO tasks (
          id,
          project_id,
          title,
          description,
          due_date,
          priority,
          status,
          assigned_to_id,
          created_by_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      taskId,
      project.id,
      payload.title.trim(),
      normalizeOptionalText(payload.description),
      dueDate,
      payload.priority,
      payload.status,
      assignedToId,
      req.user.id
    );

    const createdTask = db
      .prepare(
        `
          SELECT
            t.*,
            assignee.name AS assignee_name,
            assignee.email AS assignee_email,
            creator.name AS creator_name
          FROM tasks t
          LEFT JOIN users assignee
            ON assignee.id = t.assigned_to_id
          LEFT JOIN users creator
            ON creator.id = t.created_by_id
          WHERE t.id = ?
        `
      )
      .get(taskId);

    res.status(201).json({
      message: "Task created successfully.",
      task: formatTask(createdTask)
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/tasks/:taskId", authenticate, (req, res, next) => {
  try {
    const task = db
      .prepare(
        `
          SELECT
            t.*,
            pm.role AS viewer_role
          FROM tasks t
          JOIN project_members pm
            ON pm.project_id = t.project_id
           AND pm.user_id = ?
          WHERE t.id = ?
        `
      )
      .get(req.user.id, req.params.taskId);

    if (!task) {
      throw new AppError(404, "Task not found or you do not have access.");
    }

    if (task.viewer_role === "MEMBER") {
      if (task.assigned_to_id !== req.user.id) {
        throw new AppError(403, "Members can only update tasks assigned to them.");
      }

      const payload = parseWithSchema(memberTaskUpdateSchema, req.body);
      db.prepare(
        `
          UPDATE tasks
          SET status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `
      ).run(payload.status, task.id);
    } else {
      const payload = parseWithSchema(updateTaskSchema, req.body);
      const nextTitle = payload.title === undefined ? task.title : payload.title.trim();
      const nextDescription = payload.description === undefined
        ? task.description
        : normalizeOptionalText(payload.description);
      const nextDueDate = payload.dueDate === undefined ? task.due_date : normalizeOptionalDate(payload.dueDate);
      const nextPriority = payload.priority || task.priority;
      const nextStatus = payload.status || task.status;
      const nextAssignedToId = payload.assignedToId === undefined
        ? task.assigned_to_id
        : normalizeOptionalAssignee(payload.assignedToId);

      if (nextAssignedToId) {
        ensureMemberBelongsToProject(task.project_id, nextAssignedToId);
      }

      db.prepare(
        `
          UPDATE tasks
          SET
            title = ?,
            description = ?,
            due_date = ?,
            priority = ?,
            status = ?,
            assigned_to_id = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `
      ).run(
        nextTitle,
        nextDescription,
        nextDueDate,
        nextPriority,
        nextStatus,
        nextAssignedToId,
        task.id
      );
    }

    const updatedTask = db
      .prepare(
        `
          SELECT
            t.*,
            assignee.name AS assignee_name,
            assignee.email AS assignee_email,
            creator.name AS creator_name
          FROM tasks t
          LEFT JOIN users assignee
            ON assignee.id = t.assigned_to_id
          LEFT JOIN users creator
            ON creator.id = t.created_by_id
          WHERE t.id = ?
        `
      )
      .get(task.id);

    res.json({
      message: "Task updated successfully.",
      task: formatTask(updatedTask)
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/tasks/:taskId", authenticate, (req, res, next) => {
  try {
    const task = db
      .prepare(
        `
          SELECT
            t.id,
            t.project_id,
            pm.role AS viewer_role
          FROM tasks t
          JOIN project_members pm
            ON pm.project_id = t.project_id
           AND pm.user_id = ?
          WHERE t.id = ?
        `
      )
      .get(req.user.id, req.params.taskId);

    if (!task) {
      throw new AppError(404, "Task not found or you do not have access.");
    }

    if (task.viewer_role !== "ADMIN") {
      throw new AppError(403, "Only project admins can delete tasks.");
    }

    db.prepare("DELETE FROM tasks WHERE id = ?").run(task.id);
    res.json({ message: "Task deleted successfully." });
  } catch (error) {
    next(error);
  }
});

app.get("/api/dashboard", authenticate, (req, res, next) => {
  try {
    res.json(buildDashboard(req.user.id));
  } catch (error) {
    next(error);
  }
});

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/health") {
      return next();
    }

    return res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

app.use(handleError);

app.listen(PORT, () => {
  console.log(`Team Task Manager API listening on port ${PORT}`);
  console.log(`SQLite database file: ${databasePath}`);
});
