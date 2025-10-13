# Job Tracker

A comprehensive job application tracking and contact management system built with Next.js, TypeScript, and Supabase. Designed for job seekers to organize their applications, manage professional contacts, track interactions, and set follow-up reminders.

## Features

### 🎯 Job Management
- **Application Tracking**: Track job applications with statuses (interested, applied, interviewing, on hold, offered, rejected)
- **Detailed Information**: Store job title, company, location, salary, job URL, description, and personal notes
- **Status Management**: Visual status indicators and filtering
- **Application Timeline**: Track application dates and progression

### 👥 Contact Management  
- **Professional Network**: Maintain detailed contact profiles with work experience, education, and personal notes
- **Rich Contact Profiles**: Store email, phone, location, LinkedIn profiles, current role, and detailed work history
- **Contact-Job Linking**: Associate contacts with specific job applications and track relationships
- **Interaction Tracking**: Log all communications and touchpoints with contacts

### 💬 Interaction System
- **Communication Logging**: Record emails, phone calls, video calls, LinkedIn messages, meetings, and other interactions
- **Detailed Notes**: Resizable text areas for comprehensive interaction documentation
- **Timeline View**: Chronological view of all contact interactions
- **Type-Based Organization**: Categorized interaction types with visual indicators

### ⏰ Reminder System
- **Smart Reminders**: Set follow-up reminders for applications and contacts
- **Email Notifications**: Automated email reminders for important follow-ups
- **Reminder Management**: Create, edit, and track reminder status
- **Statistics Dashboard**: Overview of reminder metrics and completion rates

### 📊 Reporting & Analytics
- **Application Analytics**: Visual insights into job search progress
- **Contact Statistics**: Network growth and engagement metrics  
- **Performance Tracking**: Success rates and timeline analysis
- **Data Export**: CSV export functionality for external analysis

### 🎨 Enhanced UI/UX
- **Responsive Design**: Optimized for desktop and mobile devices
- **Bottom Sheet Modals**: Mobile-first modal system for better UX
- **Resizable Components**: Drag-to-resize text areas and panels
- **Smart Forms**: Auto-saving forms with validation and null-value handling
- **Compact Layouts**: Data-dense interfaces with expandable content

## Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS 4 with custom component system
- **Database**: Supabase (PostgreSQL) with real-time capabilities
- **Authentication**: Supabase Auth with secure session management
- **Icons**: Lucide React for consistent iconography
- **Deployment**: Netlify (configured via netlify.toml)

## Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun
- Supabase account and project
- Modern web browser with JavaScript enabled

## Installation

1. **Navigate to the project**
   ```bash
   cd kineticbrandpartners/job-tracker
   ```

   > **Note**: This project is part of the kineticbrandpartners monorepo at `https://github.com/tigerswim/kineticbrandpartners.git`

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Environment Setup**
   
   Create a `.env.local` file in the root directory:
   ```bash
   cp .env.local.example .env.local
   ```
   
   Add your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Database Setup**
   
   Run the Supabase migrations to set up your database schema:
   - Jobs table with application tracking fields
   - Contacts table with professional profile data
   - Interactions table for communication logging
   - Reminders table with notification system
   - User authentication and row-level security

5. **Start Development Server**
   ```bash
   npm run dev
   ```
   
   Open [http://localhost:3001](http://localhost:3001) in your browser.

## Usage

### Getting Started
1. **Sign Up/Login**: Create an account or sign in with existing credentials
2. **Add Jobs**: Start by adding job applications you're interested in or have applied to
3. **Manage Contacts**: Add professional contacts from your network
4. **Track Interactions**: Log communications and meetings
5. **Set Reminders**: Schedule follow-ups and important dates

### Key Workflows

#### Job Application Management
- Add new job applications with complete details
- Update application status as you progress through the hiring process
- Link relevant contacts to each job application
- Set reminders for follow-ups and important dates

#### Contact Relationship Building
- Create detailed professional profiles with work history and education
- Track all interactions and communications
- Leverage mutual connections and networking opportunities
- Maintain notes on conversations and relationship context

#### Communication Tracking
- Log every touchpoint with contacts and hiring managers
- Use resizable text areas for detailed interaction notes
- Categorize interactions by type (email, phone, meeting, etc.)
- Build a comprehensive communication timeline

## Architecture

### Core Components

- **ContactList**: Main contact management interface with modal views
- **JobList**: Job application tracking with status management
- **InteractionForm/List**: Communication logging system
- **ReminderSystem**: Follow-up scheduling and notifications
- **Reporting**: Analytics and insights dashboard

### Enhanced UI Components

- **ResizableTextArea**: Drag-to-resize text inputs for detailed notes
- **BottomSheet**: Mobile-optimized modal system
- **ResizablePanel**: Adjustable layout panels
- **TruncatedText**: Expandable content with show more/less functionality

### Data Models

- **Jobs**: Application details, status, timeline
- **Contacts**: Professional profiles, work history, education
- **Interactions**: Communication logs, meeting notes
- **Reminders**: Follow-up scheduling, notification status

## API Routes

- `GET/POST /api/contacts` - Contact management
- `GET/POST /api/reminders` - Reminder system
- `GET /api/reminders/stats` - Reminder analytics
- `PUT/DELETE /api/reminders/[id]` - Individual reminder management

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Use the established component patterns
- Maintain responsive design principles
- Write clear, descriptive commit messages
- Test functionality across desktop and mobile devices

## Deployment

### Netlify (Current Setup)

The project is configured for Netlify deployment via `netlify.toml`:

1. Connected to GitHub repository: `https://github.com/tigerswim/kineticbrandpartners.git`
2. Environment variables configured in Netlify dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NETLIFY_DATABASE_URL` (optional, for additional features)
3. Automatic deployment on push to main branch

### Manual Deployment

```bash
npm run build
npm run start
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment instructions.

## License

This project is private and proprietary. All rights reserved.

## Support

For questions, issues, or feature requests, please create an issue in the GitHub repository or contact the development team.

---

Built with ❤️ for job seekers looking to organize and accelerate their career search.