# UP2

A New Zealand-first social network for real life. Chronological friends feed, events and invitations, designed around privacy and intentional use.

## Stack
- React + Vite + TypeScript
- Firebase Authentication (email/password and Google)
- Cloud Firestore
- Supabase Storage for post media and event albums

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

## Supabase media storage setup

1. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your local `.env.local` and your deployment environment variables.
2. In Supabase, open **Authentication → Third-Party Auth** and connect Firebase using Firebase project ID `up2-nz`. This lets Supabase Storage validate the Firebase ID token supplied by the app.
3. Open the Supabase SQL Editor and run `supabase/setup.sql` from this repository. It creates the `up2-media` bucket and upload policies.
4. Restart/redeploy the app after setting the environment variables.

The bucket is configured for public media URLs so uploaded post and event media can render without expiring links. Anyone who obtains a media URL can view that file, so do not upload sensitive/private photos. Upload policies require a Firebase-authenticated user whose UID matches the relevant folder path.
