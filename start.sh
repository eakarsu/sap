#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                   ║${NC}"
echo -e "${BLUE}║      ${CYAN}SAP CRM${BLUE} - Customer Relationship Management  ║${NC}"
echo -e "${BLUE}║              Enterprise Platform                  ║${NC}"
echo -e "${BLUE}║                                                   ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════╝${NC}"
echo ""

# Navigate to project root
cd "$(dirname "$0")"
PROJECT_ROOT=$(pwd)

# Load env
if [ -f .env ]; then
  set -a
  source .env
  set +a
  echo -e "${GREEN}✓${NC} Environment loaded from .env"
else
  echo -e "${RED}✗ .env file not found!${NC}"
  exit 1
fi

BACKEND_PORT=${BACKEND_PORT:-4002}
FRONTEND_PORT=${FRONTEND_PORT:-3001}

# Clean ports
echo -e "\n${YELLOW}▸ Cleaning ports ${BACKEND_PORT} and ${FRONTEND_PORT}...${NC}"
kill_port_tree() {
  local port=$1
  local pids
  pids=$(lsof -ti:${port} 2>/dev/null || true)
  for pid in $pids; do
    local parent grandparent
    parent=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
    grandparent=$(ps -o ppid= -p "$parent" 2>/dev/null | tr -d ' ')
    kill -9 "$pid" "$parent" "$grandparent" 2>/dev/null || true
  done
}
kill_port_tree "${BACKEND_PORT}"
kill_port_tree "${FRONTEND_PORT}"
sleep 1
echo -e "${GREEN}✓${NC} Ports cleared"

# Check prerequisites
echo -e "\n${YELLOW}▸ Checking prerequisites...${NC}"
command -v node >/dev/null 2>&1 || { echo -e "${RED}✗ Node.js is required${NC}"; exit 1; }
echo -e "${GREEN}✓${NC} Node.js $(node -v)"
command -v psql >/dev/null 2>&1 || { echo -e "${RED}✗ PostgreSQL client is required${NC}"; exit 1; }
echo -e "${GREEN}✓${NC} PostgreSQL client found"
pg_isready -q 2>/dev/null || { echo -e "${RED}✗ PostgreSQL server is not running${NC}"; exit 1; }
echo -e "${GREEN}✓${NC} PostgreSQL server is running"

# Create database
echo -e "\n${YELLOW}▸ Setting up database...${NC}"
DB_NAME=$(node -e "const url = process.env.DATABASE_URL; if (!url) process.exit(1); console.log(new URL(url).pathname.replace(/^\\//, ''));" 2>/dev/null || echo "sapcrm")
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" 2>/dev/null | grep -q 1 || \
  psql -U postgres -c "CREATE DATABASE \"${DB_NAME}\"" 2>/dev/null
echo -e "${GREEN}✓${NC} Database '${DB_NAME}' ready"

# Install backend deps
echo -e "\n${YELLOW}▸ Installing backend dependencies...${NC}"
cd "$PROJECT_ROOT/backend"
npm install --silent 2>&1 | tail -1
echo -e "${GREEN}✓${NC} Backend dependencies installed"

# Install frontend deps
echo -e "\n${YELLOW}▸ Installing frontend dependencies...${NC}"
cd "$PROJECT_ROOT/frontend"
npm install --silent 2>&1 | tail -1
echo -e "${GREEN}✓${NC} Frontend dependencies installed"

# Seed database
echo -e "\n${YELLOW}▸ Seeding database...${NC}"
cd "$PROJECT_ROOT/backend"
node seed.js
echo -e "${GREEN}✓${NC} Database seeded"

# Start backend with hot reload
echo -e "\n${YELLOW}▸ Starting backend on port ${BACKEND_PORT}...${NC}"
cd "$PROJECT_ROOT/backend"
npx nodemon server.js &
BACKEND_PID=$!
echo -e "${GREEN}✓${NC} Backend starting (PID: $BACKEND_PID)"

# Wait for backend
sleep 2

# Start frontend with HMR
echo -e "\n${YELLOW}▸ Starting frontend on port ${FRONTEND_PORT}...${NC}"
cd "$PROJECT_ROOT/frontend"
BACKEND_URL="http://localhost:${BACKEND_PORT}" npx vite --host 0.0.0.0 --port "${FRONTEND_PORT}" &
FRONTEND_PID=$!
echo -e "${GREEN}✓${NC} Frontend starting (PID: $FRONTEND_PID)"

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  ${GREEN}SAP CRM is running!${BLUE}                              ║${NC}"
echo -e "${BLUE}║                                                   ║${NC}"
echo -e "${BLUE}║  ${CYAN}Frontend:${NC} http://localhost:${FRONTEND_PORT}               ${BLUE}║${NC}"
echo -e "${BLUE}║  ${CYAN}Backend:${NC}  http://localhost:${BACKEND_PORT}/api          ${BLUE}║${NC}"
echo -e "${BLUE}║                                                   ║${NC}"
echo -e "${BLUE}║  ${YELLOW}Login:${NC}    admin@sapcrm.com / password123       ${BLUE}║${NC}"
echo -e "${BLUE}║                                                   ║${NC}"
echo -e "${BLUE}║  ${NC}Press Ctrl+C to stop                             ${BLUE}║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════╝${NC}"

# Trap cleanup
cleanup() {
  echo -e "\n${YELLOW}Shutting down...${NC}"
  kill $BACKEND_PID 2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  lsof -ti:${BACKEND_PORT} 2>/dev/null | xargs kill -9 2>/dev/null || true
  lsof -ti:${FRONTEND_PORT} 2>/dev/null | xargs kill -9 2>/dev/null || true
  echo -e "${GREEN}✓${NC} SAP CRM stopped. Goodbye!"
  exit 0
}
trap cleanup SIGINT SIGTERM

# Wait
wait
