# Plugin Best Practices

This guide outlines best practices for developing secure, maintainable plugins.

## Security

### 1. Minimal Permissions

Request only the permissions you absolutely need:

```json
{
  "permissions": {
    "database": {
      "tables": ["users"],  // Only the tables you need
      "operations": ["read"]  // Only the operations you need
    }
  }
}
```

### 2. Input Validation

Always validate user input:

```javascript
async function handleRequest(req, res) {
  const { userId } = req.body;
  
  // Validate input
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Invalid userId' });
  }
  
  // Use validated input
  const user = await context.database.executeQuery(...);
}
```

### 3. Organization Isolation

Always include organization filters in database queries:

```javascript
// Good: Includes organization filter
const users = await context.database.executeQuery(
  'users',
  'read',
  'SELECT * FROM users WHERE organization_id = $1 AND id = $2',
  [context.organizationId, userId]
);

// Bad: Missing organization filter
const users = await context.database.executeQuery(
  'users',
  'read',
  'SELECT * FROM users WHERE id = $1',
  [userId]
);
```

### 4. Avoid Dangerous Patterns

Never use:
- `eval()`
- `Function()` constructor
- `child_process` module
- `process.exit()`
- Path traversal (`../../../`)

## Code Quality

### 1. Error Handling

Always handle errors gracefully:

```javascript
async function initialize(context) {
  try {
    await setupPlugin(context);
  } catch (error) {
    context.logger.error('Failed to initialize plugin:', error);
    throw error; // Re-throw if initialization is critical
  }
}
```

### 2. Logging

Use appropriate log levels:

```javascript
context.logger.debug('Detailed debug information');
context.logger.log('General information');
context.logger.warn('Warning: something unusual happened');
context.logger.error('Error: something failed');
```

### 3. Cleanup

Always clean up resources:

```javascript
class MyPlugin {
  private timers = [];
  
  async initialize(context) {
    const timer = setInterval(() => {
      // Periodic task
    }, 1000);
    this.timers.push(timer);
  }
  
  async cleanup() {
    // Clean up timers
    this.timers.forEach(timer => clearInterval(timer));
    this.timers = [];
  }
}
```

## Performance

### 1. Lazy Loading

Load resources only when needed:

```javascript
class MyPlugin {
  private cache = null;
  
  async getData() {
    if (!this.cache) {
      this.cache = await this.loadData();
    }
    return this.cache;
  }
}
```

### 2. Efficient Queries

Use efficient database queries:

```javascript
// Good: Uses indexes, limits results
const users = await context.database.executeQuery(
  'users',
  'read',
  'SELECT * FROM users WHERE organization_id = $1 LIMIT 100',
  [context.organizationId]
);

// Bad: Fetches all data
const users = await context.database.executeQuery(
  'users',
  'read',
  'SELECT * FROM users',
  []
);
```

### 3. Resource Limits

Respect system resource limits:
- Keep file sizes reasonable
- Limit memory usage
- Avoid blocking operations

## Testing

### 1. Test Locally

Test your plugin thoroughly before distribution:

1. Create a test ZIP file
2. Install via admin UI
3. Test all functionality
4. Check logs for errors
5. Test activation/deactivation
6. Test uninstallation

### 2. Test Edge Cases

Test error scenarios:
- Invalid input
- Missing dependencies
- Network failures
- Database errors

### 3. Test Permissions

Verify permission enforcement:
- Try accessing unauthorized resources
- Verify errors are handled gracefully

## Documentation

### 1. Clear Descriptions

Provide clear, descriptive plugin information:

```json
{
  "name": "stripe-payment",
  "description": "Integrates Stripe payment gateway for processing payments",
  "author": "Your Name"
}
```

### 2. Document Dependencies

Clearly document plugin dependencies:

```json
{
  "dependencies": {
    "plugins": [
      {
        "name": "required-plugin",
        "version": "^1.0.0"
      }
    ]
  }
}
```

### 3. Provide Examples

Include usage examples in your plugin documentation.

## Versioning

### 1. Semantic Versioning

Use semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Breaking changes
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes, backward compatible

### 2. Version Compatibility

Declare system version requirements:

```json
{
  "dependencies": {
    "system": {
      "minVersion": "1.0.0"
    }
  }
}
```

## Distribution

### 1. Package Correctly

Ensure your ZIP file:
- Contains `manifest.json` at root
- Includes all required files
- Has correct file structure
- Is properly compressed

### 2. Test Installation

Test installation from ZIP:
- Verify manifest is valid
- Check file structure
- Test extraction
- Verify entry points exist

## Maintenance

### 1. Regular Updates

Keep plugins updated:
- Fix bugs promptly
- Add new features carefully
- Maintain backward compatibility when possible

### 2. Monitor Logs

Regularly check plugin logs:
- Look for errors
- Monitor performance
- Check resource usage

### 3. User Feedback

Listen to user feedback:
- Address issues quickly
- Consider feature requests
- Improve documentation
