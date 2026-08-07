# Contributing to SpotifyDL v2

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Development Setup

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/spotifydl-v2.git
cd spotifydl-v2

# Install dependencies
npm install

# Create local config
cp config/default.json config/local.json
# Edit local.json with your credentials

# Run tests
npm test

# Start development server
npm run dev
```

## Project Structure

- `src/core/` - Core services (logger, config, events)
- `src/auth/` - Authentication and gamification
- `src/download/` - Download engines
- `src/metadata/` - Metadata handling
- `src/plugins/` - Plugin system
- `src/visualizer/` - Audio visualizations
- `src/graphql/` - GraphQL API
- `src/neo4j/` - Graph database
- `src/ml/` - Machine learning
- `src/websocket/` - WebSocket server
- `src/bot/` - Telegram bot
- `src/webhook/` - Webhook management
- `src/cloud/` - Cloud storage
- `src/updater/` - Auto-updater
- `src/utils/` - Utilities
- `src/cli/` - Command-line interface
- `tests/` - Test suites
- `docs/` - Documentation

## Coding Standards

### TypeScript
- Use strict mode
- Explicit return types on public methods
- Interface-driven development
- No `any` types (use `unknown` if necessary)

### Code Style
- 2 spaces indentation
- Single quotes for strings
- Semicolons required
- Max line length: 100 characters

### Naming Conventions
- `PascalCase` for classes and interfaces
- `camelCase` for variables and functions
- `SCREAMING_SNAKE_CASE` for constants
- `kebab-case` for file names

## Testing

### Unit Tests
```bash
npm run test:unit
```

### Integration Tests
```bash
npm run test:integration
```

### Coverage
```bash
npm run test:coverage
```

### Writing Tests
- Place tests in `tests/unit/` or `tests/integration/`
- Name files: `<ModuleName>.test.ts`
- Mock external dependencies
- Test both success and error cases

Example:
```typescript
describe('MyModule', () => {
  it('should do something', () => {
    const result = myModule.doSomething();
    expect(result).toBe('expected');
  });

  it('should handle errors', () => {
    expect(() => myModule.doSomethingInvalid()).toThrow();
  });
});
```

## Pull Request Process

1. **Fork** the repository
2. **Create a branch** from `main`: `git checkout -b feature/my-feature`
3. **Make changes** following coding standards
4. **Add tests** for new functionality
5. **Run tests**: `npm test`
6. **Update documentation** if needed
7. **Commit** with clear messages
8. **Push** to your fork
9. **Create PR** with detailed description

### Commit Messages

Follow conventional commits:
```
feat: add new download engine
fix: resolve memory leak in visualizer
docs: update API documentation
test: add unit tests for AuthManager
refactor: simplify HybridEngine logic
chore: update dependencies
```

## Plugin Development

### Plugin Structure
```
my-plugin/
├── manifest.json
└── index.js
```

### Manifest
```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "What it does",
  "entry": "index.js",
  "permissions": ["download:post", "metadata:modify"],
  "hooks": ["onDownloadComplete"]
}
```

### Plugin Code
```javascript
exports.onDownloadComplete = (context) => {
  console.log('Download completed:', context.trackId);
};
```

## Reporting Issues

When reporting bugs, include:
- Node.js version
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Error messages and stack traces

## Security

For security issues, please email security@spotifydl.dev instead of opening a public issue.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Respect differing viewpoints
