import "isomorphic-fetch";
import { Client } from "@microsoft/microsoft-graph-client";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { env } from "./env.js";

const msalClient = new ConfidentialClientApplication({
  auth: {
    clientId: env.microsoft.clientId,
    clientSecret: env.microsoft.clientSecret,
    authority: `https://login.microsoftonline.com/${env.microsoft.tenantId}`,
  },
});

export async function getGraphAccessToken(): Promise<string> {
  const response = await msalClient.acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"],
  });

  if (!response?.accessToken) {
    throw new Error("Failed to acquire Microsoft Graph access token");
  }

  return response.accessToken;
}

export async function getGraphClient() {
  const accessToken = await getGraphAccessToken();

  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}
