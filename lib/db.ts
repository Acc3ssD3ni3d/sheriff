import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is not defined in environment variables");
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  indexesFixed?: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
  indexesFixed: false,
};

if (process.env.NODE_ENV === "development") {
  global.mongooseCache = cache;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
  }

  cache.conn = await cache.promise;

  // Auto-drop the old conflicting shareToken index once
  if (!cache.indexesFixed && cache.conn.connection.db) {
    try {
      const collections = await cache.conn.connection.db
        .listCollections({ name: "files" })
        .toArray();

      if (collections.length > 0) {
        const indexes = await cache.conn.connection.db
          .collection("files")
          .indexes();

        const oldShareIndex = indexes.find(
          (idx) => idx.name === "shareToken_1" && !idx.partialFilterExpression,
        );

        if (oldShareIndex) {
          await cache.conn.connection.db
            .collection("files")
            .dropIndex("shareToken_1");
        }
      }
    } catch {
      // Ignored if index doesn't exist
    } finally {
      cache.indexesFixed = true;
    }
  }

  return cache.conn;
}
