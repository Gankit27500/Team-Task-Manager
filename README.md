# Orbit Tasks

Orbit Tasks is a full-stack Team Task Manager web application built for the assignment brief. It includes:

- JWT-based signup and login
- Project creation with automatic `ADMIN` ownership
- Member management with `ADMIN` and `MEMBER` roles
- Task creation, assignment, prioritization, and status tracking
- Dashboard metrics for total tasks, overdue tasks, tasks by status, and workload by assignee
- Production-ready single-service deployment on Railway

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: SQLite via Node.js built-in `node:sqlite`
- Auth: JWT + bcrypt
- Hosting: Railway

## Project Structure

```text
.
|-- client/
|   |-- src/
|   |-- index.html
|   `-- package.json
|-- server/
|   |-- src/
|   |-- data/
|   |-- .env.example
|   `-- package.json
|-- package.json
`-- README.md
```

## Features Mapped to the Assignment

### Authentication

- Register with name, email, and password
- Login with JWT authentication
- Protected API routes

### Project Management

- Create projects
- Project creator becomes `ADMIN`
- Add or remove members
- Promote or demote member roles

### Task Management

- Create tasks with title, description, due date, priority, and status
- Assign tasks to project members
- Members can update the status of their assigned tasks
- Admins can edit or delete any task in their project

### Dashboard

- Total visible tasks
- Overdue task count
- Tasks by status
- Tasks per user
- Recent task activity

## Requirements

- Node.js `24+`
- npm `10+`

Node 24 is required because this project uses the built-in `node:sqlite` module for the SQLite database.

## Local Setup

### 1. Install dependencies

```powershell
npm install
```

### 2. Create environment files

Create the server environment file:

```powershell
Copy-Item server/.env.example server/.env
```

Optional: create the client environment file for local API calls:

```powershell
Copy-Item client/.env.example client/.env
```

### 3. Start the development servers

```powershell
npm run dev
```

This starts:

- frontend at `http://localhost:5173`
- backend at `http://localhost:4000`

### 4. Build and run the production version locally

```powershell
npm run build
npm start
```

This serves the built frontend and API together from:

- `http://localhost:4000`

## Default Local Environment Variables

`server/.env`

```env
PORT=4000
JWT_SECRET=change-me-before-production
CLIENT_ORIGIN=http://localhost:5173
DATABASE_PATH=./data/team-task-manager.db
```

`client/.env`

```env
VITE_API_BASE_URL=http://localhost:4000/api
```

## How to Use the App

1. Register the first user.
2. Create a project.
3. Add other users by email after they have signed up.
4. Create tasks and assign them to members.
5. Use the dashboard to track task volume and overdue work.

## Railway Deployment Guide

This project is designed to run on Railway as a single web service with a persistent volume for the SQLite database.

### 1. Push the code to GitHub

Create a new GitHub repository and push this project.

### 2. Create a Railway project

In Railway:

1. Create a new project.
2. Add a service from your GitHub repository.

Railway uses Railpack to detect Node projects and build them automatically. If needed, you can still override the build and start commands in service settings.

### 3. Attach a persistent volume

Because the app uses SQLite, attach a volume to the web service and mount it at:

```text
/data
```

Then set the database file path to:

```text
/data/team-task-manager.db
```

### 4. Configure environment variables

Add these variables in Railway service settings:

```env
JWT_SECRET=use-a-long-random-secret
CLIENT_ORIGIN=https://your-public-domain.up.railway.app
DATABASE_PATH=/data/team-task-manager.db
```

Notes:

- Railway injects `PORT` automatically, so you do not need to set it manually.
- After Railway generates your public domain, update `CLIENT_ORIGIN` to match that exact URL.

### 5. Build and start commands

Railway should detect the root `package.json` automatically. If you want to set commands manually, use:

```text
Build Command: npm run build
Start Command: npm run start
```

### 6. Set a health check

Configure the health check path as:

```text
/health
```

### 7. Generate a public domain

In the Railway service:

1. Open the `Settings` tab.
2. Generate a public domain.
3. Copy the domain and place it into `CLIENT_ORIGIN`.
4. Redeploy if needed.

### 8. Verify the deployment

After deployment:

- Visit the public domain and confirm the React app loads
- Check `https://your-domain/health`
- Register a user and create a project
- Confirm task creation and dashboard stats work

## Suggested Submission Checklist

- Live Railway URL
- GitHub repository URL
- Updated README
- 2 to 5 minute demo video

## API Summary

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Projects

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `POST /api/projects/:projectId/members`
- `PATCH /api/projects/:projectId/members/:memberId`
- `DELETE /api/projects/:projectId/members/:memberId`

### Tasks

- `POST /api/projects/:projectId/tasks`
- `PATCH /api/tasks/:taskId`
- `DELETE /api/tasks/:taskId`

### Dashboard

- `GET /api/dashboard`

## Current Railway References

- Railway builds and deploys services using Railpack: https://docs.railway.com/reference/railpack
- Build/start commands can be configured in service settings: https://docs.railway.com/builds/build-and-start-commands
- Health checks use a path like `/health` and rely on Railway's injected `PORT`: https://docs.railway.com/deployments/healthchecks
- Volumes are the supported way to persist local files on Railway: https://docs.railway.com/volumes
- Railway supports config as code via `railway.toml` or `railway.json`: https://docs.railway.com/config-as-code

## Notes

- The frontend uses a relative `/api` base path in production, so frontend and backend work from the same Railway domain.
- A member must already have an account before an admin can add them to a project by email.
- SQLite data is stored locally in `server/data/team-task-manager.db` during development.
