
# Space2Book SDK – Codex Instructions

## Repositories

The development environment contains two repositories:

1. space2book_sdk – primary development repository
2. Space2Book backend – reference repository

## Repository boundaries

- Only modify files inside space2book_sdk.
- Treat the Space2Book backend as read-only reference.
- Never commit, modify, or refactor backend files.
- If backend changes are required, report them separately.

## API integration

- Inspect actual CodeIgniter 4 routes and controllers.
- Verify HTTP methods, authentication, request parameters,
  response structures and error handling.
- Never invent API endpoints or response fields.
- Follow existing availability and booking rules.
- Never expose private API credentials in browser code.

## SDK architecture

- Framework-independent JavaScript SDK.
- Support iframe embedding and Booking Button.
- Venue-controlled styling.
- Confirmation before closing the booking modal.
- Required domain restrictions.
- Validate postMessage origins and message types.
- Support multiple instances on one page.
- Keep the SDK lightweight and easy to integrate.

## Quality

- Provide automated tests.
- Test initialization, lifecycle and error handling.
- Validate browser security and iframe communication.
- Run relevant tests before completing a task.
- Report all changes and any backend dependencies.
