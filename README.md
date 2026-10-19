# UP2

A New Zealand-first social network for real life. Chronological friends feed, events and invitations, designed around privacy and intentional use.

## Stack
- React + Vite + TypeScript
- Firebase Authentication (email/password and Google)
- Cloud Firestore
- Firebase Storage (for future media uploads)

## Local development
1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and fill in Firebase web app configuration.
4. Run `npm run dev`.

## Firebase setup
Enable Email/Password and Google sign-in in Firebase Authentication. Create a Cloud Firestore database. Deploy `firestore.rules` before testing with real users.

The Firebase web API key identifies the Firebase project; it is not a server secret. Security must be enforced by Firebase Security Rules and Authentication.

## Deploy Firestore security rules

Install the Firebase CLI, sign in to the account that owns `up2-nz`, then run:

```sh
firebase use up2-nz
firebase deploy --only firestore
```

Before using UP2 with real people, review the rules and test them in the Firebase Emulator Suite. The app currently provides in-app event notifications; browser push notifications and email invitations are not implemented yet.
