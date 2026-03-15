import { MongoClient, type MongoClientOptions } from "mongodb";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const options: MongoClientOptions = {
  tls: true,
  tlsAllowInvalidCertificates: true,
  tlsAllowInvalidHostnames: true,
};

let clientPromise: Promise<MongoClient> | undefined;

function getMongoUri() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Missing MONGODB_URI in environment.");
  }

  return uri;
}

function getClientPromise() {
  if (clientPromise) {
    return clientPromise;
  }

  const client = new MongoClient(getMongoUri(), options);

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = client.connect();
    }

    clientPromise = global._mongoClientPromise;

    return clientPromise;
  }

  clientPromise = client.connect();

  return clientPromise;
}

export async function getDatabase() {
  const connectedClient = await getClientPromise();
  const databaseName = process.env.MONGODB_URI_NAME;

  return databaseName ? connectedClient.db(databaseName) : connectedClient.db();
}
