import { connectDB } from "../lib/db";
import { User } from "../models/user";
import { File } from "../models/file";

async function test() {
  try {
    const db = await connectDB();
    console.log("✅ Connected to MongoDB:", db.connection.name);

    const collections = await db.connection.db!.listCollections().toArray();
    console.log(
      "📁 Collections:",
      collections.map((c) => c.name),
    );

    console.log("✅ User model ready:", User.modelName);
    console.log("✅ File model ready:", File.modelName);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

test();
