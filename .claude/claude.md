# Claude Development Rules

## CI Consistency

When making changes to this project, always maintain consistency with the CI pipeline:

1. **Before committing**: Run `npm run ci` to ensure all checks pass locally
2. **Formatting**: Use `npm run format` to auto-format code with Biome
3. **Linting**: Run `npm run lint` to check for code quality issues
4. **Type checking**: Ensure TypeScript compilation succeeds with `npm run build`
5. **Testing**: Run `npm test` to verify all tests pass

The CI pipeline runs these checks automatically on all pull requests and pushes:
- Code formatting (Biome)
- Linting (Biome)
- TypeScript compilation
- Test suite

All checks must pass before merging code.
