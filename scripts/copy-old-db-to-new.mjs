import { createClient } from "@supabase/supabase-js";

const OLD_URL = "https://yagtuswiqgnnthxioflt.supabase.co";
const OLD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhZ3R1c3dpcWdubnRoeGlvZmx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NjA3MDcsImV4cCI6MjA5OTQzNjcwN30.1rQNjFswOb36rzHPC7ga4q3y0adptgGmkTNoYhq_P9g";

const NEW_URL = "https://tdggisdwevfxpitlbeyc.supabase.co";
const NEW_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZ2dpc2R3ZXZmeHBpdGxiZXljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDc5OTcwMywiZXhwIjoyMTAwMzc1NzAzfQ.YsM4-RoxEjKuAI39E_ioSG5Eg9KWj7Dq1vYgRacnXfQ";

const oldClient = createClient(OLD_URL, OLD_KEY);
const newClient = createClient(NEW_URL, NEW_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function copyAllData() {
  console.log("🚚 Copying all real data from OLD database (yagtuswiqgnnthxioflt) to NEW database (tdggisdwevfxpitlbeyc)...");

  // 1. Copy Profiles
  const { data: profiles } = await oldClient.from("profiles").select("*");
  if (profiles && profiles.length > 0) {
    console.log(`Copying ${profiles.length} profiles...`);
    for (const p of profiles) {
      // Ensure user exists in Auth or upsert profile
      await newClient.from("profiles").upsert(p, { onConflict: "user_id" });
    }
  }

  // 2. Copy User Roles
  const { data: roles } = await oldClient.from("user_roles").select("*");
  if (roles && roles.length > 0) {
    console.log(`Copying ${roles.length} user roles...`);
    for (const r of roles) {
      await newClient.from("user_roles").upsert(r, { onConflict: "user_id, role" });
    }
  }

  // 3. Copy Trainer Profiles
  const { data: trainers } = await oldClient.from("trainer_profiles").select("*");
  if (trainers && trainers.length > 0) {
    console.log(`Copying ${trainers.length} trainer profiles...`);
    for (const t of trainers) {
      await newClient.from("trainer_profiles").upsert(t, { onConflict: "user_id" });
    }
  }

  // 4. Copy Posts
  const { data: posts } = await oldClient.from("posts").select("*");
  if (posts && posts.length > 0) {
    console.log(`Copying ${posts.length} posts...`);
    for (const po of posts) {
      await newClient.from("posts").upsert(po, { onConflict: "id" });
    }
  }

  // 5. Copy Transformation Posts
  const { data: transformations } = await oldClient.from("transformation_posts").select("*");
  if (transformations && transformations.length > 0) {
    console.log(`Copying ${transformations.length} transformation posts...`);
    for (const tf of transformations) {
      await newClient.from("transformation_posts").upsert(tf, { onConflict: "id" });
    }
  }

  // 6. Copy Community Posts & Comments
  const { data: communityPosts } = await oldClient.from("community_posts").select("*");
  if (communityPosts && communityPosts.length > 0) {
    console.log(`Copying ${communityPosts.length} community posts...`);
    for (const cp of communityPosts) {
      await newClient.from("community_posts").upsert(cp, { onConflict: "id" });
    }
  }

  const { data: communityComments } = await oldClient.from("community_comments").select("*");
  if (communityComments && communityComments.length > 0) {
    console.log(`Copying ${communityComments.length} community comments...`);
    for (const cc of communityComments) {
      await newClient.from("community_comments").upsert(cc, { onConflict: "id" });
    }
  }

  console.log("🎉 Complete Data Migration from OLD DB to NEW DB finished successfully!");
}

copyAllData().catch(console.error);
