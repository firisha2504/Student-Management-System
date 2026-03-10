# Student Management System

A comprehensive educational platform for managing students, grades, and academic operations.

## Features

- **Role-Based Access Control**
  - Student Portal - View grades and academic progress
  - Teacher Portal - Upload and manage student grades
  - Admin Panel - System management and user control
  - Registrar Portal - Student registration and profile management
  - Director Portal - Academic monitoring and teacher assignments
  - Parent Portal - View child's academic progress

- **Core Functionality**
  - Authentication with Supabase
  - Grade management system
  - Student registration and profiles
  - Academic statistics and charts
  - System lock functionality
  - Dark/light theme support
  - Responsive design

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Backend**: Supabase (BaaS)
- **Routing**: React Router v6
- **State Management**: TanStack Query
- **UI Components**: Shadcn/ui + Radix UI
- **Styling**: Tailwind CSS
- **Charts**: Recharts

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd student-management-system
```

2. Install dependencies
```bash
npm install
```

3. Start the development server
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm test` - Run tests

## Project Structure

```
src/
├── components/       # Reusable UI components
│   ├── ui/          # Shadcn UI components
│   └── admin/       # Admin-specific components
├── hooks/           # Custom React hooks
├── integrations/    # External service integrations
│   └── supabase/    # Supabase client and types
├── lib/             # Utility functions
├── pages/           # Route components
└── test/            # Test files
```

## Backend Setup

This frontend connects to a backend service. Configure your backend connection in the environment variables as needed.

## License

MIT
