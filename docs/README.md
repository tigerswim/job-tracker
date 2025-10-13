# Documentation Index

Welcome to the Job Tracker documentation. This directory contains comprehensive guides for understanding, developing, and deploying the application.

## Getting Started

- **[Main README](../README.md)**: Project overview, installation, and basic usage
- **[Deployment Guide](DEPLOYMENT.md)**: Complete deployment instructions for various platforms

## Technical Documentation

- **[API Documentation](API.md)**: REST API endpoints, request/response formats, and data models
- **[UI Components](COMPONENTS.md)**: Custom component library with usage examples and styling guidelines

## Planning & Strategy

- **[Database Migration Plan](planning/database-migration-plan.md)**: LinkedIn integration database schema updates
- **[LinkedIn Integration User Stories](planning/linkedin-integration-user-stories.md)**: Feature requirements and user stories
- **[User Journey Map](planning/user-journey-map.md)**: User experience flows and touchpoints

## Quick Navigation

### For Developers
1. Start with the [Main README](../README.md) for project setup
2. Review [UI Components](COMPONENTS.md) for component patterns
3. Check [API Documentation](API.md) for backend integration

### For DevOps/Deployment
1. Read the [Main README](../README.md) for prerequisites  
2. Follow the [Deployment Guide](DEPLOYMENT.md) for your chosen platform
3. Reference [API Documentation](API.md) for environment configuration

## Project Structure

```
job-tracker/
├── docs/                    # Documentation (you are here)
│   ├── README.md           # This file
│   ├── API.md              # API documentation
│   ├── COMPONENTS.md       # UI component documentation
│   └── DEPLOYMENT.md       # Deployment guide
├── src/                    # Source code
│   ├── app/               # Next.js app router
│   ├── components/        # React components
│   ├── lib/              # Utility libraries
│   └── types/            # TypeScript type definitions
├── public/               # Static assets
├── .env.local.example    # Environment variables template
└── README.md            # Main project README
```

## Documentation Guidelines

### For Contributors

When adding new features or components:

1. **Update relevant documentation** in this directory
2. **Add JSDoc comments** to complex functions and components
3. **Include examples** in component documentation
4. **Update API docs** when changing endpoints
5. **Test documentation** accuracy against actual implementation

### Documentation Standards

- Use clear, concise language
- Include code examples with proper syntax highlighting
- Provide both beginner and advanced usage patterns
- Keep documentation up-to-date with code changes
- Use consistent formatting and structure

## Need Help?

- **Issues**: Create an issue in the GitHub repository
- **Features**: Use the GitHub discussions for feature requests
- **Development**: Check the component documentation for patterns
- **Deployment**: Follow the deployment guide step-by-step

## Contributing to Documentation

1. Fork the repository
2. Create a documentation branch
3. Make your changes
4. Test any code examples
5. Submit a pull request with clear description

---

*Documentation last updated: January 2025*