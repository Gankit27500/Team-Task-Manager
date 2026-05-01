export const STATUS_LABELS = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done"
};

export const PRIORITY_LABELS = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent"
};

export function formatDate(value) {
  if (!value) {
    return "No due date";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function isOverdue(task) {
  if (!task?.dueDate || task.status === "DONE") {
    return false;
  }

  const today = new Date().toISOString().slice(0, 10);
  return task.dueDate < today;
}
