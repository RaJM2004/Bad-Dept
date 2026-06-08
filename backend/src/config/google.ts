import { google } from 'googleapis';

export const getOauth2Client = () => {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectURI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173/auth/callback';

  if (!clientID || !clientSecret) {
    console.warn('WARNING: Google OAuth credentials are not fully configured in the environment.');
  }
  return new google.auth.OAuth2(
    clientID || 'MOCK_CLIENT_ID',
    clientSecret || 'MOCK_CLIENT_SECRET',
    redirectURI
  );
};

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

// Helper to get authenticated client using user access/refresh token
export const getAuthenticatedClient = (accessToken?: string, refreshToken?: string) => {
  const oauth2Client = getOauth2Client();
  if (accessToken) {
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }
  return oauth2Client;
};
