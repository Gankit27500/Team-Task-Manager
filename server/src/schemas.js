const { z } = require("zod");
const { PRIORITIES, ROLES, STATUSES } = require("./utils");

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format for dates.");

const uuidField = z.string().uuid("Invalid identifier supplied.");

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters long.").max(60),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters long.").max(100)
});

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required.")
});

const createProjectSchema = z.object({
  name: z.string().trim().min(2, "Project name must be at least 2 characters long.").max(80),
  description: z.string().trim().max(400).optional().default("")
});

const addMemberSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  role: z.enum(ROLES).default("MEMBER")
});

const updateMemberRoleSchema = z.object({
  role: z.enum(ROLES)
});

const createTaskSchema = z.object({
  title: z.string().trim().min(2, "Task title must be at least 2 characters long.").max(120),
  description: z.string().trim().max(1000).optional().default(""),
  dueDate: z.union([dateField, z.literal(""), z.null()]).optional().default(""),
  priority: z.enum(PRIORITIES).default("MEDIUM"),
  status: z.enum(STATUSES).default("TODO"),
  assignedToId: z.union([uuidField, z.literal(""), z.null()]).optional().default("")
});

const updateTaskSchema = z.object({
  title: z.string().trim().min(2, "Task title must be at least 2 characters long.").max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  dueDate: z.union([dateField, z.literal(""), z.null()]).optional(),
  priority: z.enum(PRIORITIES).optional(),
  status: z.enum(STATUSES).optional(),
  assignedToId: z.union([uuidField, z.literal(""), z.null()]).optional()
});

const memberTaskUpdateSchema = z.object({
  status: z.enum(STATUSES)
});

module.exports = {
  addMemberSchema,
  createProjectSchema,
  createTaskSchema,
  loginSchema,
  memberTaskUpdateSchema,
  registerSchema,
  updateMemberRoleSchema,
  updateTaskSchema
};
