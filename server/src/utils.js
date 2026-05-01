const { ZodError } = require("zod");

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const STATUSES = ["TODO", "IN_PROGRESS", "DONE"];
const ROLES = ["ADMIN", "MEMBER"];

class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function parseWithSchema(schema, payload) {
  return schema.parse(payload);
}

function isDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeOptionalText(value) {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalDate(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (!isDateString(value)) {
    throw new AppError(400, "Due date must use YYYY-MM-DD format.");
  }

  return value;
}

function normalizeOptionalAssignee(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  return value;
}

function formatProject(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ownerId: row.owner_id,
    role: row.role,
    createdAt: row.created_at,
    memberCount: Number(row.member_count || 0),
    taskCount: Number(row.task_count || 0),
    completedTaskCount: Number(row.completed_task_count || 0)
  };
}

function formatMember(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    joinedAt: row.joined_at
  };
}

function formatTask(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    priority: row.priority,
    status: row.status,
    assignedToId: row.assigned_to_id,
    assignedToName: row.assignee_name || null,
    assignedToEmail: row.assignee_email || null,
    createdById: row.created_by_id,
    createdByName: row.creator_name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    projectName: row.project_name || null
  };
}

function formatUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at
  };
}

function handleError(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    return res.status(400).json({ message: firstIssue?.message || "Invalid request payload." });
  }

  console.error(err);
  return res.status(500).json({ message: "Something went wrong on the server." });
}

module.exports = {
  AppError,
  PRIORITIES,
  ROLES,
  STATUSES,
  formatMember,
  formatProject,
  formatTask,
  formatUser,
  handleError,
  normalizeOptionalAssignee,
  normalizeOptionalDate,
  normalizeOptionalText,
  parseWithSchema
};
