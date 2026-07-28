import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://tdggisdwevfxpitlbeyc.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZ2dpc2R3ZXZmeHBpdGxiZXljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDc5OTcwMywiZXhwIjoyMTAwMzc1NzAzfQ.YsM4-RoxEjKuAI39E_ioSG5Eg9KWj7Dq1vYgRacnXfQ";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const DEMO_EMAIL_DOMAIN = "leerdemo.local";
const DEMO_PASSWORD = "DemoPass123!";

async function runSeeder() {
  console.log("🚀 Seeding new Supabase project (tdggisdwevfxpitlbeyc)...");

  // 1. Create Admin Account
  const adminEmail = `admin@${DEMO_EMAIL_DOMAIN}`;
  const { data: usersList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  let adminUser = usersList?.users?.find(u => u.email === adminEmail);
  let adminId;

  if (!adminUser) {
    console.log("Creating Admin user...");
    const { data: c, error } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: "Pass123",
      email_confirm: true,
    });
    if (error) console.error("Admin user create error:", error);
    adminId = c?.user?.id;
  } else {
    adminId = adminUser.id;
    await supabase.auth.admin.updateUserById(adminId, { password: "Pass123", email_confirm: true });
  }

  if (adminId) {
    await supabase.from("profiles").upsert({
      user_id: adminId,
      username: "admin",
      display_name: "Demo Admin",
      full_name: "Demo Admin",
      bio: "Platform Administrator",
      country: "US",
      native_language: "en",
      is_demo: true,
    }, { onConflict: "user_id" });

    await supabase.from("user_roles").upsert({
      user_id: adminId,
      role: "admin"
    }, { onConflict: "user_id, role" });
  }

  // 2. Create Trainer Accounts & Profiles
  const trainersData = [
    { username: "coach_nova", displayName: "Coach Nova", bio: "Strength & High-Performance Athletic Conditioning", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400", cover: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800" },
    { username: "coach_alex", displayName: "Coach Alex", bio: "Hypertrophy & Physique Architecture Specialist", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400", cover: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800" },
    { username: "coach_sable", displayName: "Coach Sable", bio: "Endurance, Hybrid Running & Marathon Prep", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400", cover: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800" },
    { username: "coach_vega", displayName: "Coach Vega", bio: "Functional Mobility & Bodyweight Calisthenics", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400", cover: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800" },
    { username: "coach_lyra", displayName: "Coach Lyra", bio: "Powerlifting Technique & Max Force Production", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400", cover: "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800" },
    { username: "coach_kimo", displayName: "Coach Kimo", bio: "Combat Fitness, Boxing & Striking Conditioning", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400", cover: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=800" },
    { username: "coach_sol", displayName: "Coach Sol", bio: "Olympic Weightlifting & Explosiveness", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400", cover: "https://images.unsplash.com/photo-1517960413843-0aee8e2b3285?w=800" },
    { username: "coach_rhea", displayName: "Coach Rhea", bio: "Postural Restoration & Spinal Health", avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400", cover: "https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=800" },
    { username: "coach_nyx", displayName: "Coach Nyx", bio: "Metabolic Conditioning & High-Intensity Fat Loss", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400", cover: "https://images.unsplash.com/photo-1534367507873-d2d7e24c797f?w=800" },
  ];

  const sampleImages = [
    "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800",
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800",
    "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800",
    "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800",
    "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800",
    "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=800",
    "https://images.unsplash.com/photo-1517960413843-0aee8e2b3285?w=800",
    "https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=800"
  ];

  for (const t of trainersData) {
    const email = `${t.username}@${DEMO_EMAIL_DOMAIN}`;
    let user = usersList?.users?.find(u => u.email === email);
    let uid;

    if (!user) {
      const { data: c, error } = await supabase.auth.admin.createUser({
        email,
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
      if (error) console.error("Trainer create error:", error);
      uid = c?.user?.id;
    } else {
      uid = user.id;
      await supabase.auth.admin.updateUserById(uid, { password: DEMO_PASSWORD, email_confirm: true });
    }

    if (!uid) continue;

    console.log(`Seeding trainer profile: ${t.displayName} (${t.username})...`);
    await supabase.from("profiles").upsert({
      user_id: uid,
      username: t.username,
      display_name: t.displayName,
      full_name: t.displayName,
      avatar_url: t.avatar,
      cover_url: t.cover,
      bio: t.bio,
      country: "US",
      native_language: "en",
      is_verified: true,
      is_demo: true,
    }, { onConflict: "user_id" });

    await supabase.from("user_roles").upsert({
      user_id: uid,
      role: "trainer"
    }, { onConflict: "user_id, role" });

    await supabase.from("trainer_profiles").upsert({
      user_id: uid,
      slug: t.username,
      display_name: t.displayName,
      bio: t.bio,
      monthly_price_cents: 2999,
      is_verified: true,
      is_demo: true,
    }, { onConflict: "user_id" });

    // Seed 4 sample feed posts for each trainer
    for (let i = 0; i < 4; i++) {
      const media = sampleImages[(trainersData.indexOf(t) + i) % sampleImages.length];
      await supabase.from("posts").insert({
        trainer_id: uid,
        author_id: uid,
        kind: i % 2 === 0 ? "feed" : "short",
        caption: `${t.displayName} workout log #${i + 1}. Focus on form and tempo.`,
        media_url: media,
        thumbnail_url: media,
        respect_count: Math.floor(Math.random() * 45) + 5,
        comment_count: Math.floor(Math.random() * 12) + 1,
        is_published: true,
        is_hidden: false,
        is_demo: true,
      });
    }
  }

  // 3. Seed Trainees
  const traineesData = [
    { username: "trainee1", name: "Alex Rivers" },
    { username: "trainee2", name: "Jordan Kai" },
    { username: "trainee3", name: "Sam Vance" }
  ];

  for (const tr of traineesData) {
    const email = `${tr.username}@${DEMO_EMAIL_DOMAIN}`;
    let user = usersList?.users?.find(u => u.email === email);
    let uid;
    if (!user) {
      const { data: c } = await supabase.auth.admin.createUser({ email, password: DEMO_PASSWORD, email_confirm: true });
      uid = c?.user?.id;
    } else {
      uid = user.id;
    }

    if (uid) {
      await supabase.from("profiles").upsert({
        user_id: uid,
        username: tr.username,
        display_name: tr.name,
        full_name: tr.name,
        is_demo: true,
      }, { onConflict: "user_id" });

      await supabase.from("user_roles").upsert({ user_id: uid, role: "trainee" }, { onConflict: "user_id, role" });

      // Add transformation post
      await supabase.from("transformation_posts").insert({
        user_id: uid,
        kind: "photo",
        media_url: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800",
        thumbnail_url: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800",
        view_angle: "front",
        captured_on: new Date().toISOString().split("T")[0],
        weight_kg: 78.5,
        body_fat_percent: 14.2,
        visibility: "public",
      });
    }
  }

  console.log("✅ Seeding complete! All profiles, trainers, posts, and demo users created.");
}

runSeeder().catch(console.error);
