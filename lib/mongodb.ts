import { MongoClient, type MongoClientOptions } from "mongodb";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("Missing MONGODB_URI in environment.");
}

const options: MongoClientOptions = {
  tls: true,
  tlsAllowInvalidCertificates: true,
  tlsAllowInvalidHostnames: true,
};

const client = new MongoClient(uri, options);

function getClientPromise() {
  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = client.connect();
    }

    return global._mongoClientPromise;
  }

  return client.connect();
}

const clientPromise = getClientPromise();

export async function getDatabase() {
  const connectedClient = await clientPromise;
  const databaseName = process.env.MONGODB_URI_NAME;

  return databaseName ? connectedClient.db(databaseName) : connectedClient.db();
}
