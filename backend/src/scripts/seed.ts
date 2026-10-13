import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { User } from "../models/User";
import { Campaign } from "../models/Campaign";
import { Submission } from "../models/Submission";
import { applyViewUpdate } from "../services/payout.service";

const PASSWORD = "demo12345";

async function seed() {
  await mongoose.connect(env.MONGODB_URI);
  console.log(`Connected to "${mongoose.connection.name}"`);

  if (!process.argv.includes("--yes")) {
    console.error(
      "Refusing to wipe without --yes. Re-run: npm run seed -- --yes",
    );
    process.exit(1);
  }

  await Promise.all([
    User.deleteMany({}),
    Campaign.deleteMany({}),
    Submission.deleteMany({}),
  ]);
  console.log("Cleared existing data");

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const brand = await User.create({
    name: "Nykaa Social",
    email: "brand@memed.demo",
    role: "brand",
    passwordHash,
  });
  const creator = await User.create({
    name: "Clip Raja",
    email: "creator@memed.demo",
    role: "creator",
    passwordHash,
  });

  // Fresh — nothing spent yet.
  const fresh = await Campaign.create({
    brand: brand._id,
    name: "Diwali Reel Drop",
    platform: "instagram",
    budget: 25_000,
    ladder: [
      { views: 10_000, payout: 500 },
      { views: 50_000, payout: 2_000 },
      { views: 100_000, payout: 5_000 },
    ],
  });

  // Part-spent — shows a half-filled budget bar.
  const partial = await Campaign.create({
    brand: brand._id,
    name: "Monsoon Meme Pack",
    platform: "youtube",
    budget: 6_000,
    ladder: [
      { views: 20_000, payout: 1_000 },
      { views: 80_000, payout: 3_000 },
    ],
  });

  // Small budget, deliberately exhausted below.
  const tight = await Campaign.create({
    brand: brand._id,
    name: "Flash Clip Sprint",
    platform: "instagram",
    budget: 1_500,
    ladder: [{ views: 10_000, payout: 1_000 }],
  });

  // Submissions, then drive views through the real payout service so the
  // seeded state is reachable by the same code path the app uses.
  const mk = (campaign: mongoose.Types.ObjectId, url: string) =>
    Submission.create({ campaign, creator: creator._id, url });

  const s1 = await mk(fresh._id, "https://instagram.com/p/diwali-01");
  const s2 = await mk(partial._id, "https://youtube.com/watch?v=monsoon-01");
  const s3 = await mk(partial._id, "https://youtube.com/watch?v=monsoon-02");
  const s4 = await mk(tight._id, "https://instagram.com/p/flash-01");
  const s5 = await mk(tight._id, "https://instagram.com/p/flash-02");
  await mk(fresh._id, "https://instagram.com/p/diwali-02"); // 0 views, unpaid

  await applyViewUpdate(String(s1._id), 62_000); // pays 2,000
  await applyViewUpdate(String(s2._id), 95_000); // pays 3,000
  await applyViewUpdate(String(s3._id), 21_000); // pays 1,000 → partial now full
  await applyViewUpdate(String(s4._id), 15_000); // pays 1,000
  await applyViewUpdate(String(s5._id), 11_000); // owed 1,000, only 500 left

  for (const c of [fresh, partial, tight]) {
    const fresh_ = await Campaign.findById(c._id);
    console.log(
      `  ${fresh_!.name}: ${fresh_!.spent}/${fresh_!.budget} (${fresh_!.status})`,
    );
  }

  console.log(`\nbrand@memed.demo / ${PASSWORD}`);
  console.log(`creator@memed.demo / ${PASSWORD}`);

  await mongoose.disconnect();
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
