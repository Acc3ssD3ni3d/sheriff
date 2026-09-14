import mongoose from "mongoose";
import { getServerEnv } from "@/lib/env";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  indexesFixed?: boolean;
}

declare global {
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
    const mongoUri = getServerEnv().MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI is not defined in environment variables");
    }
    cache.promise = mongoose.connect(mongoUri, {
      bufferCommands: false,
    }).catch((error) => {
      cache.promise = null;
      throw error;
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
