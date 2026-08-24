# Contributing to TaskMind

Thank you for your interest in contributing to TaskMind! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Documentation](#documentation)
- [License](#license)

## Code of Conduct

We follow the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- **Node.js 22+** (required for Next 16 / sharp 0.35)
- **npm** (package-lock.json committed)
- **Git**
- **Modern web browser** with WebAssembly support

### Fork & Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/what_should_i_do.git
   cd what_should_i_do
   ```
3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/jobelGolde12/what_should_i_do.git
   ```

## Development Setup

### Install Dependencies

```bash
npm install
```

### Environment Variables

Copy the example environment file and configure your local settings:

```bash
cp .env.example .env.local
```

**Required for full functionality:**
- `TOKENROUTER_API_KEY` or `OPENROUTER_API_KEY` (for AI analysis)
- `AUTH_SECRET` (for session signing - generate with `openssl rand -hex 32`)
- `TURSO_DATABASE_URL` (optional - uses local SQLite if not set)

**For development/testing:**
- `AI_MOCK=1` (enables offline AI mock mode)

### Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript compiler (no emit) |
| `npm test` | Run tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |
| `npm run security:audit` | Run npm security audit |

## Coding Standards

### TypeScript

- **Strict mode** is enabled (`tsconfig.json`)
- All code must pass `npm run typecheck`
- Use explicit types for function parameters and return values
- Avoid `any` type; use `unknown` when type is uncertain
- Use type guards for runtime type checking

### React

- Use functional components with hooks
- Follow React 19 patterns (Server Components when possible)
- Keep components small and focused (single responsibility)
- Extract reusable logic into custom hooks

### Styling

- Use **Tailwind CSS** for all styling
- Follow the project's design system (see `docs/design-system.md`)
- Use semantic color tokens (e.g., `text-ink`, `bg-surface-2`)
- Ensure responsive design for all components

### File Structure

```
src/
├── app/              # Next.js App Router pages and API routes
├── components/       # React components (organized by feature)
├── lib/              # Shared utilities and core logic
├── context/          # React contexts
└── proxy.ts          # CSRF protection
```

### Naming Conventions

- **Files:** PascalCase for components (`Button.tsx`), camelCase for utilities (`format.ts`)
- **Components:** PascalCase (`Button`, `AnalysisChatView`)
- **Functions:** camelCase (`analyzeText`, `buildChatMessages`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_INPUT_CHARS`, `PROMPT_VERSION`)
- **Types/Interfaces:** PascalCase with descriptive names (`AnalysisResult`, `ChatProviderConfig`)

### Error Handling

- Use custom error classes (`AnalysisError`, `ChatProviderError`)
- Provide meaningful error messages
- Log errors with context (no PII)
- Handle errors gracefully in UI components

### Logging

- Use structured logging via `src/lib/log.ts`
- Never log analyzed text, passwords, or raw tokens
- Hash email addresses before logging (`maskEmail`)
- Include request IDs for correlation

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring (no feature change)
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

### Examples

```bash
git commit -m "feat(chat): add copy-to-clipboard for assistant messages"
git commit -m "fix(auth): handle expired session tokens gracefully"
git commit -m "docs(readme): update installation instructions"
git commit -m "test(ai): add test cases for provider cascade fallback"
```

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions/updates

## Pull Request Process

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes

- Follow coding standards
- Write tests for new functionality
- Update documentation if needed

### 3. Run Quality Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

### 4. Commit Your Changes

```bash
git add .
git commit -m "feat(scope): your descriptive message"
```

### 5. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 6. Create a Pull Request

- Go to the original repository
- Click "New Pull Request"
- Select your branch
- Fill out the PR template
- Request review from maintainers

### PR Requirements

- [ ] Code follows project style guidelines
- [ ] All tests pass (`npm test`)
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] ESLint passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Documentation updated (if applicable)
- [ ] No console.log statements in production code
- [ ] No sensitive data in code or comments

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- tests/ai.test.ts
```

### Writing Tests

- Place tests in `tests/` directory
- Use descriptive test names
- Test both happy path and error cases
- Mock external dependencies (AI providers, database, etc.)
- Use fixtures for test data

### Test Structure

```typescript
import { describe, it, expect, vi } from "vitest";

describe("FeatureName", () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should do something specific", () => {
    // Arrange
    const input = "test";

    // Act
    const result = functionUnderTest(input);

    // Assert
    expect(result).toBe("expected");
  });

  it("should handle error case", () => {
    // Test error scenarios
  });
});
```

## Documentation

### Code Documentation

- Add JSDoc comments to all exported functions
- Include `@param`, `@returns`, `@throws` tags
- Document complex algorithms and business logic
- Keep comments up-to-date with code changes

### API Documentation

- Update `docs/security.md` when adding new endpoints
- Document request/response formats
- Include rate limits and authentication requirements

### Architecture Documentation

- Update `project-plan/` files for significant changes
- Add ADRs for major decisions (in `project-plan/adrs/`)
- Keep diagrams current

## License

By contributing to TaskMind, you agree that your contributions will be licensed under the [MIT License](LICENSE).

## Questions?

- Open a [GitHub Discussion](https://github.com/jobelGolde12/what_should_i_do/discussions)
- Check existing [Issues](https://github.com/jobelGolde12/what_should_i_do/issues)
- Review [Documentation](docs/)

Thank you for contributing! 🎉
