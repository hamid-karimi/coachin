# Authentication Module

This directory contains the authentication logic for the CoachIn application, handling user registration and login via Supabase.

## Structure

- **components/**: Shared UI components for auth forms.
  - `auth-container.tsx`: Layout wrapper centering the content.
  - `submit-button.tsx`: Form submit button with loading state.
- **login/**: Logic for existing users.
  - `page.tsx`: Login form UI.
  - `actions.ts`: Server action for `signInWithPassword`.
- **register/**: Logic for new users.
  - `page.tsx`: Registration form UI with password validation.
  - `actions.ts`: Server action for `signUp` and validation logic.

## Key Features

- **Server-Side Validation**: Registration checks for password length, complexity, and matching fields before contacting Supabase.
- **Supabase Integration**: Uses Supabase Auth for secure handling of credentials.
- **Error Handling**: Displays user-friendly error messages returned from the server actions.
