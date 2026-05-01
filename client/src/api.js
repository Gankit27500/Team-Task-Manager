const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

async function request(path, options = {}) {
  const { token, body, headers, ...rest } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || "Request failed.");
    error.status = response.status;
    throw error;
  }

  return data;
}

export const api = {
  register(payload) {
    return request("/auth/register", { method: "POST", body: payload });
  },
  login(payload) {
    return request("/auth/login", { method: "POST", body: payload });
  },
  getMe(token) {
    return request("/auth/me", { token });
  },
  getDashboard(token) {
    return request("/dashboard", { token });
  },
  listProjects(token) {
    return request("/projects", { token });
  },
  getProject(token, projectId) {
    return request(`/projects/${projectId}`, { token });
  },
  createProject(token, payload) {
    return request("/projects", { method: "POST", token, body: payload });
  },
  addMember(token, projectId, payload) {
    return request(`/projects/${projectId}/members`, { method: "POST", token, body: payload });
  },
  updateMemberRole(token, projectId, memberId, payload) {
    return request(`/projects/${projectId}/members/${memberId}`, {
      method: "PATCH",
      token,
      body: payload
    });
  },
  removeMember(token, projectId, memberId) {
    return request(`/projects/${projectId}/members/${memberId}`, {
      method: "DELETE",
      token
    });
  },
  createTask(token, projectId, payload) {
    return request(`/projects/${projectId}/tasks`, { method: "POST", token, body: payload });
  },
  updateTask(token, taskId, payload) {
    return request(`/tasks/${taskId}`, { method: "PATCH", token, body: payload });
  },
  deleteTask(token, taskId) {
    return request(`/tasks/${taskId}`, { method: "DELETE", token });
  }
};
