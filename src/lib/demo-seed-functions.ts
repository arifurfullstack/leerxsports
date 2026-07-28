import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEMO_VIDEO, isVideo, resolveMedia, resolvePoster } from "@/lib/demo-media";

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin access required");
}

const DEMO_EMAIL_DOMAIN = "leerdemo.local";
export const DEMO_PASSWORD = "DemoPass123!";

// -----------------------------------------------------------------------------
// Media helpers — Unsplash photos (variant-sized on the fly) + curated Pexels
// video loops. All URLs pass through `resolveMedia()` before hitting the DB so
// missing/broken sources fall back to deterministic Picsum placeholders.
// -----------------------------------------------------------------------------
// The optional width arg is accepted for source compat with existing seed
// entries; the actual dimensions are applied later by `resolveMedia()`.
const img = (id: string, _w?: number) => `https://images.unsplash.com/photo-${id}`;
const VID = DEMO_VIDEO;

type PostSeed = {
  caption: string;
  media: string;
  thumb?: string;
  kind?: "feed" | "short";
  premium?: boolean;
};

type TrainerSeed = {
  slug: string;
  displayName: string;
  username: string;
  country: string;
  language: string;
  bio: string;
  specialties: string[];
  price: number;
  verified: boolean;
  avatar: string;
  cover: string;
  intro: string;
  posts: PostSeed[];
};

// -----------------------------------------------------------------------------
// 12 trainers spread across sports, geographies, price tiers and verification.
// Each ships 6–8 posts (mix of image / short video, free / premium).
// -----------------------------------------------------------------------------
const TRAINERS: TrainerSeed[] = [
  {
    slug: "coach-nova",
    displayName: "Coach Nova",
    username: "coach_nova",
    country: "US",
    language: "en",
    bio: "Olympic-level swim coach. 12 years poolside. DM me your splits.",
    specialties: ["swimming", "conditioning"],
    price: 19.99,
    verified: true,
    avatar: img("1594381898411-846e7d193883", 400),
    cover: img("1530549387789-4c1017266635", 1600),
    intro:
      "Welcome. I coach freestyle mechanics, race pacing, and dryland. Subs get weekly sets + video review on request.",
    posts: [
      {
        caption: "Freestyle catch drill — slow is smooth, smooth is fast.",
        media: VID.swim,
        thumb: img("1530549387789-4c1017266635"),
        kind: "short",
      },
      {
        caption: "Race-pace 50s. Log your times, tag me.",
        media: img("1519315901367-f34ff9154487"),
      },
      {
        caption: "Breathing pattern for the 200: 3-3-5-5 by lap.",
        media: img("1571902943202-507ec2618e8f"),
      },
      {
        caption: "Members: aerobic threshold ladder (8×200 build).",
        media: img("1522898467493-49726bf28798"),
        premium: true,
      },
      {
        caption: "Underwater dolphin work — the 15m off every wall wins races.",
        media: img("1560089000-7433a4ebbd64"),
      },
      {
        caption: "Pull-buoy set — feel the hips lock in.",
        media: img("1541252260730-0412e8e2108e"),
      },
    ],
  },
  {
    slug: "coach-ronin",
    displayName: "Coach Ronin",
    username: "coach_ronin",
    country: "JP",
    language: "ja",
    bio: "Judo black belt · BJJ brown. Strength through discipline.",
    specialties: ["martial-arts", "mobility"],
    price: 24.99,
    verified: true,
    avatar: img("1519085360753-af0119f7cbe7", 400),
    cover: img("1555597673-b21d5c935865", 1600),
    intro:
      "20 years on the tatami. Subscribe for grip fighting, throws breakdown and ne-waza flows.",
    posts: [
      {
        caption: "Uchi-mata setup — kuzushi first, then commit.",
        media: VID.box,
        thumb: img("1555597673-b21d5c935865"),
        kind: "short",
      },
      {
        caption: "Grip fighting: the fight before the fight.",
        media: img("1517438476312-10d79c077509"),
      },
      {
        caption: "Ne-waza flow: mount → high mount → armbar.",
        media: img("1552674605-db6ffd4facb5"),
      },
      {
        caption: "Members-only: full ne-waza breakdown (24 min).",
        media: img("1517649763962-0c623066013b"),
        premium: true,
      },
      {
        caption: "Newaza escape drill — bridge and shrimp.",
        media: img("1583468982228-19f19164aee2"),
      },
      { caption: "Weekly mobility for grapplers.", media: img("1552196563-55cd4e45efb3") },
    ],
  },
  {
    slug: "coach-vega",
    displayName: "Coach Vega",
    username: "coach_vega",
    country: "ES",
    language: "es",
    bio: "Hypertrophy nerd. Programs that actually work.",
    specialties: ["strength", "hypertrophy"],
    price: 14.99,
    verified: true,
    avatar: img("1571019614242-c5c5dee9f50b", 400),
    cover: img("1534438327276-14e5300c3a48", 1600),
    intro:
      "Evidence-based hypertrophy. Push–pull–legs, upper–lower, PPLR — I run all of them and I'll tell you which fits you.",
    posts: [
      {
        caption: "RDL — hinge before you lift. Bar path stays close.",
        media: VID.lift,
        thumb: img("1534438327276-14e5300c3a48"),
        kind: "short",
      },
      { caption: "Push day: incline dumbbell focus.", media: img("1583454110551-21f2fa2afe61") },
      {
        caption: "Members: 8-week hypertrophy block (PDF + video walkthrough).",
        media: img("1517836357463-d25dfeac3438"),
        premium: true,
      },
      {
        caption: "Cable row angle — grip below the pec line for lats.",
        media: img("1581009146145-b5ef050c2e1e"),
      },
      {
        caption: "Lengthened partials — the 15% cheat code.",
        media: img("1591258739878-3f6b3d0c4dcb"),
      },
      {
        caption: "Sunday grocery haul. Cheap, boring, effective.",
        media: img("1490645935967-10de6ba17061"),
      },
    ],
  },
  {
    slug: "coach-lyra",
    displayName: "Coach Lyra",
    username: "coach_lyra",
    country: "FR",
    language: "fr",
    bio: "Endurance and cycling. Zero to century ride.",
    specialties: ["cycling", "endurance"],
    price: 12.99,
    verified: true,
    avatar: img("1544005313-94ddf0286df2", 400),
    cover: img("1508672019048-805c876b67e2", 1600),
    intro:
      "Structured cycling plans. Zone-2 addicts welcome. Members get FTP tests + weekly zwift group ride.",
    posts: [
      {
        caption: "Zone-2 intervals feel boring. They aren't.",
        media: VID.bike,
        thumb: img("1508672019048-805c876b67e2"),
        kind: "short",
      },
      {
        caption: "Climb technique: cadence over grinding.",
        media: img("1517649763962-0c623066013b"),
      },
      {
        caption: "Members: full FTP test protocol.",
        media: img("1541625602330-2277a4c46182"),
        premium: true,
      },
      {
        caption: "Bike fit basics — saddle height first.",
        media: img("1502744688674-c619d1586c9e"),
      },
      {
        caption: "Nutrition for a 4h ride. Real numbers.",
        media: img("1524594152303-9fd13543fe6e"),
      },
    ],
  },
  {
    slug: "coach-aris",
    displayName: "Coach Aris",
    username: "coach_aris",
    country: "KE",
    language: "en",
    bio: "Marathon coach out of Iten. Sub-3 or your feedback back.",
    specialties: ["running", "endurance"],
    price: 9.99,
    verified: true,
    avatar: img("1552674605-db6ffd4facb5", 400),
    cover: img("1552674605-db6ffd4facb5", 1600),
    intro:
      "18 years coaching distance runners. Members get periodised plans and weekly voice notes on your logs.",
    posts: [
      {
        caption: "Long run cadence check — 178 spm feels floaty.",
        media: VID.run,
        thumb: img("1552674605-db6ffd4facb5"),
        kind: "short",
      },
      {
        caption: "Tempo run structure that actually improves race pace.",
        media: img("1571008887538-b36bb32f4571"),
      },
      {
        caption: "Strides after easy runs. Two minutes, huge return.",
        media: img("1486218119243-13883505764c"),
      },
      {
        caption: "Members: 16-week marathon plan.",
        media: img("1517649763962-0c623066013b"),
        premium: true,
      },
      { caption: "Fueling long runs — carbs per hour.", media: img("1526401485004-46910ecc8e51") },
      { caption: "Sunrise session from Iten.", media: img("1508385082359-f38ae991e8f2") },
    ],
  },
  {
    slug: "coach-mara",
    displayName: "Coach Mara",
    username: "coach_mara",
    country: "IN",
    language: "en",
    bio: "Yoga · mobility · breathwork. Move well before you move more.",
    specialties: ["yoga", "mobility"],
    price: 8.99,
    verified: true,
    avatar: img("1544367567-0f2fcb009e0b", 400),
    cover: img("1545389336-cf090694435e", 1600),
    intro: "Kripalu-trained. Members get daily 15-min mobility flows plus monthly live class.",
    posts: [
      {
        caption: "10-min hip opener after sitting all day.",
        media: VID.yoga,
        thumb: img("1545389336-cf090694435e"),
        kind: "short",
      },
      { caption: "Shoulder CARs — every day, forever.", media: img("1571019613454-1cb2f99b2d8b") },
      { caption: "Breath control for anxiety spikes.", media: img("1518611012118-696072aa579a") },
      {
        caption: "Members: 30-day mobility challenge.",
        media: img("1506126613408-eca07ce68773"),
        premium: true,
      },
      { caption: "Wrist prep for pushups and handstands.", media: img("1554068865-24cecd4e34b8") },
    ],
  },
  {
    slug: "coach-kova",
    displayName: "Coach Kova",
    username: "coach_kova",
    country: "UA",
    language: "uk",
    bio: "Powerlifting, raw. National-level coach.",
    specialties: ["powerlifting", "strength"],
    price: 29.99,
    verified: true,
    avatar: img("1583468982228-19f19164aee2", 400),
    cover: img("1517836357463-d25dfeac3438", 1600),
    intro: "Meet prep, technique, and honest programming. Members get form review within 48h.",
    posts: [
      {
        caption: "Squat brace — 360° of pressure, not just the belly.",
        media: VID.lift,
        thumb: img("1517836357463-d25dfeac3438"),
        kind: "short",
      },
      { caption: "Bench arch — thoracic, not lumbar.", media: img("1571902943202-507ec2618e8f") },
      {
        caption: "Deadlift setup — hips find the bar, not the bar the hips.",
        media: img("1526506118085-60ce8714f8c5"),
      },
      {
        caption: "Members: 12-week meet peak.",
        media: img("1583454110551-21f2fa2afe61"),
        premium: true,
      },
      {
        caption: "Warm-up ramping I use with every lifter.",
        media: img("1534438327276-14e5300c3a48"),
      },
    ],
  },
  {
    slug: "coach-sable",
    displayName: "Coach Sable",
    username: "coach_sable",
    country: "GB",
    language: "en",
    bio: "Boxing coach · former amateur international.",
    specialties: ["boxing", "conditioning"],
    price: 22,
    verified: true,
    avatar: img("1517649763962-0c623066013b", 400),
    cover: img("1517438476312-10d79c077509", 1600),
    intro:
      "Footwork, defense, conditioning. Members get pad-work breakdowns and weekly shadow-boxing flows.",
    posts: [
      {
        caption: "Jab from every angle — the whole game hides here.",
        media: VID.box,
        thumb: img("1517438476312-10d79c077509"),
        kind: "short",
      },
      { caption: "Slip drill: elbow stays home.", media: img("1544717305-2782549b5136") },
      {
        caption: "Footwork ladder — 4 patterns to drill this week.",
        media: img("1526506118085-60ce8714f8c5"),
      },
      {
        caption: "Members: 6-week conditioning block.",
        media: img("1517649763962-0c623066013b"),
        premium: true,
      },
      {
        caption: "Wrap your hands right. Long term wrists say thanks.",
        media: img("1591117207239-788bf8de6c3b"),
      },
    ],
  },
  {
    slug: "coach-rhea",
    displayName: "Coach Rhea",
    username: "coach_rhea",
    country: "IT",
    language: "it",
    bio: "Sport climbing coach. 8b outdoor. Fingers before ego.",
    specialties: ["climbing", "strength"],
    price: 17.5,
    verified: true,
    avatar: img("1502224562085-639556652f33", 400),
    cover: img("1522163182402-834f871fd851", 1600),
    intro: "Injury-free climbing. Members get hangboard protocols matched to your grade and body.",
    posts: [
      {
        caption: "Hangboard hangs — 7/3 repeaters, not max.",
        media: VID.climb,
        thumb: img("1522163182402-834f871fd851"),
        kind: "short",
      },
      {
        caption: "Footwork on slabs: quiet feet, patient hips.",
        media: img("1522163182402-834f871fd851"),
      },
      {
        caption: "Pulley prehab — do this every session.",
        media: img("1519861531473-9200262188bf"),
      },
      {
        caption: "Members: 8-week finger strength block.",
        media: img("1502224562085-639556652f33"),
        premium: true,
      },
      {
        caption: "Redpoint tactics — beta refinement > effort.",
        media: img("1516757316-c4e3ef7c090d"),
      },
    ],
  },
  {
    slug: "coach-kimo",
    displayName: "Coach Kimo",
    username: "coach_kimo",
    country: "BR",
    language: "pt",
    bio: "Surf coach out of Florianópolis. Also a physio.",
    specialties: ["surfing", "mobility"],
    price: 16,
    verified: false, // pending application — surfaces on /admin/applications
    avatar: img("1502680390469-be75c86b636f", 400),
    cover: img("1502680390469-be75c86b636f", 1600),
    intro: "Ocean fitness + technique. Application pending — check back soon.",
    posts: [
      {
        caption: "Pop-up drill: hips before hands.",
        media: VID.surf,
        thumb: img("1502680390469-be75c86b636f"),
        kind: "short",
      },
      {
        caption: "Paddle endurance — 20 min continuous.",
        media: img("1502933691298-84fc14542831"),
      },
      { caption: "Duck dive form on head-high days.", media: img("1493558103817-58b2924bce98") },
      {
        caption: "Members: dryland surf strength.",
        media: img("1502680390469-be75c86b636f"),
        premium: true,
      },
    ],
  },
  {
    slug: "coach-nyx",
    displayName: "Coach Nyx",
    username: "coach_nyx",
    country: "DE",
    language: "de",
    bio: "CrossFit L3, gymnastics background. Volume with intent.",
    specialties: ["crossfit", "gymnastics"],
    price: 19,
    verified: true,
    avatar: img("1517836357463-d25dfeac3438", 400),
    cover: img("1526506118085-60ce8714f8c5", 1600),
    intro:
      "Constantly varied, functional, high intent. Members get scaled options for every workout.",
    posts: [
      {
        caption: "Double-unders — soft wrists, low jump.",
        media: img("1526506118085-60ce8714f8c5"),
      },
      { caption: "Kipping pull-up progression, safely.", media: img("1517836357463-d25dfeac3438") },
      { caption: "Ring dip — false grip counts.", media: img("1541534741688-6078c6bfb5c5") },
      {
        caption: "Members: 6-week gymnastics block.",
        media: img("1571902943202-507ec2618e8f"),
        premium: true,
      },
      {
        caption: "Metcon that hurts on paper, hurts more in life.",
        media: img("1583454110551-21f2fa2afe61"),
      },
    ],
  },
  {
    slug: "coach-sol",
    displayName: "Coach Sol",
    username: "coach_sol",
    country: "MX",
    language: "es",
    bio: "Pilates instructor. Reformer + mat. Core-first everything.",
    specialties: ["pilates", "mobility"],
    price: 13.5,
    verified: true,
    avatar: img("1518611012118-696072aa579a", 400),
    cover: img("1544367567-0f2fcb009e0b", 1600),
    intro: "Rebuild your core and posture. Members get 3 sessions/week with breath-led cues.",
    posts: [
      { caption: "Roll-down — vertebra by vertebra.", media: img("1518611012118-696072aa579a") },
      { caption: "Reformer footwork basics.", media: img("1544367567-0f2fcb009e0b") },
      {
        caption: "Diaphragm reset before every session.",
        media: img("1571019613454-1cb2f99b2d8b"),
      },
      {
        caption: "Members: 4-week posture reset.",
        media: img("1506126613408-eca07ce68773"),
        premium: true,
      },
      {
        caption: "Shoulder-blades on the mat, not the rib flare.",
        media: img("1554068865-24cecd4e34b8"),
      },
    ],
  },
];

type TraineeSeed = {
  username: string;
  displayName: string;
  country: string;
  language: string;
  bio: string;
  goal: string;
  avatar?: string;
  transformations?: {
    media: string;
    view: "front" | "side" | "back";
    weight: number;
    bf: number;
    date: string;
    notes: string;
  }[];
};

// 20 trainees with distinct goals so filters and search show variety.
const TRAINEES: TraineeSeed[] = [
  {
    username: "athlete_kai",
    displayName: "Kai",
    country: "AU",
    language: "en",
    bio: "Working toward my first marathon.",
    goal: "Sub-4 marathon",
    avatar: img("1517836357463-d25dfeac3438", 400),
    transformations: [
      {
        media: img("1517836357463-d25dfeac3438"),
        view: "front",
        weight: 82,
        bf: 22,
        date: "2025-01-10",
        notes: "Baseline.",
      },
      {
        media: img("1526506118085-60ce8714f8c5"),
        view: "front",
        weight: 76,
        bf: 16,
        date: "2025-06-01",
        notes: "12 weeks in.",
      },
    ],
  },
  {
    username: "sam_lifts",
    displayName: "Sam",
    country: "GB",
    language: "en",
    bio: "Trying to hit 200kg deadlift this year.",
    goal: "200kg DL",
    avatar: img("1583454110551-21f2fa2afe61", 400),
    transformations: [
      {
        media: img("1583454110551-21f2fa2afe61"),
        view: "front",
        weight: 85,
        bf: 15,
        date: "2025-05-15",
        notes: "Feeling strong.",
      },
    ],
  },
  {
    username: "mia_moves",
    displayName: "Mia",
    country: "BR",
    language: "pt",
    bio: "Mobility + calisthenics.",
    goal: "First muscle-up",
    avatar: img("1518611012118-696072aa579a", 400),
    transformations: [
      {
        media: img("1518611012118-696072aa579a"),
        view: "side",
        weight: 65,
        bf: 26,
        date: "2025-01-20",
        notes: "Starting point.",
      },
      {
        media: img("1544367567-0f2fcb009e0b"),
        view: "side",
        weight: 62,
        bf: 22,
        date: "2025-04-20",
        notes: "3 months progress.",
      },
    ],
  },
  {
    username: "ana_runs",
    displayName: "Ana",
    country: "PT",
    language: "pt",
    bio: "First 10k in June.",
    goal: "First 10k",
    avatar: img("1508385082359-f38ae991e8f2", 400),
  },
  {
    username: "leo_lifts",
    displayName: "Leo",
    country: "IT",
    language: "it",
    bio: "Masters lifter, 45.",
    goal: "USAPL nationals",
    avatar: img("1571019614242-c5c5dee9f50b", 400),
  },
  {
    username: "yuki_swims",
    displayName: "Yuki",
    country: "JP",
    language: "ja",
    bio: "Sub-1:00 100m free.",
    goal: "Break 1:00",
    avatar: img("1594381898411-846e7d193883", 400),
  },
  {
    username: "priya_yoga",
    displayName: "Priya",
    country: "IN",
    language: "en",
    bio: "Yoga + strength combo.",
    goal: "First handstand",
    avatar: img("1544367567-0f2fcb009e0b", 400),
    transformations: [
      {
        media: img("1544367567-0f2fcb009e0b"),
        view: "front",
        weight: 58,
        bf: 24,
        date: "2025-03-01",
        notes: "Feeling flexible and strong.",
      },
    ],
  },
  {
    username: "diego_ride",
    displayName: "Diego",
    country: "MX",
    language: "es",
    bio: "Weekend crit racer.",
    goal: "Cat 3",
    avatar: img("1544005313-94ddf0286df2", 400),
  },
  {
    username: "elena_box",
    displayName: "Elena",
    country: "ES",
    language: "es",
    bio: "Boxing for fitness. First smoker soon.",
    goal: "First smoker",
    avatar: img("1517649763962-0c623066013b", 400),
  },
  {
    username: "tomas_climbs",
    displayName: "Tomas",
    country: "CZ",
    language: "cs",
    bio: "Trad climbing. Fingers healing.",
    goal: "First 7a redpoint",
    avatar: img("1502224562085-639556652f33", 400),
  },
  {
    username: "noor_fat_loss",
    displayName: "Noor",
    country: "AE",
    language: "ar",
    bio: "Down 8kg, 6 to go.",
    goal: "-6kg",
    avatar: img("1571019614242-c5c5dee9f50b", 400),
    transformations: [
      {
        media: img("1571019614242-c5c5dee9f50b"),
        view: "front",
        weight: 88,
        bf: 32,
        date: "2024-11-01",
        notes: "Starting.",
      },
      {
        media: img("1517836357463-d25dfeac3438"),
        view: "front",
        weight: 80,
        bf: 24,
        date: "2025-04-15",
        notes: "Halfway.",
      },
    ],
  },
  {
    username: "chris_teen",
    displayName: "Chris",
    country: "US",
    language: "en",
    bio: "17 y/o basketball. Vertical goal +10cm.",
    goal: "Dunk",
    avatar: img("1526506118085-60ce8714f8c5", 400),
  },
  {
    username: "hana_post",
    displayName: "Hana",
    country: "DE",
    language: "de",
    bio: "Postpartum, rebuilding gently.",
    goal: "Rebuild core",
    avatar: img("1506126613408-eca07ce68773", 400),
  },
  {
    username: "raj_pullups",
    displayName: "Raj",
    country: "IN",
    language: "en",
    bio: "First pull-up in 30 days.",
    goal: "First pull-up",
    avatar: img("1583454110551-21f2fa2afe61", 400),
  },
  {
    username: "ivy_swim",
    displayName: "Ivy",
    country: "CA",
    language: "en",
    bio: "Triathlon newbie.",
    goal: "Sprint tri",
    avatar: img("1519315901367-f34ff9154487", 400),
  },
  {
    username: "otto_row",
    displayName: "Otto",
    country: "SE",
    language: "sv",
    bio: "Concept2 grinder.",
    goal: "Sub-7 2k",
    avatar: img("1541534741688-6078c6bfb5c5", 400),
  },
  {
    username: "lila_dance",
    displayName: "Lila",
    country: "FR",
    language: "fr",
    bio: "Dancer cross-training.",
    goal: "Injury-free season",
    avatar: img("1518611012118-696072aa579a", 400),
  },
  {
    username: "matt_recomp",
    displayName: "Matt",
    country: "AU",
    language: "en",
    bio: "Recomping. Slow and steady.",
    goal: "Recomp",
    avatar: img("1571019614242-c5c5dee9f50b", 400),
  },
  {
    username: "zara_lifts",
    displayName: "Zara",
    country: "ZA",
    language: "en",
    bio: "Comp prep, bikini.",
    goal: "Regional stage",
    avatar: img("1583454110551-21f2fa2afe61", 400),
    transformations: [
      {
        media: img("1583454110551-21f2fa2afe61"),
        view: "back",
        weight: 62,
        bf: 20,
        date: "2025-02-01",
        notes: "Prep start.",
      },
      {
        media: img("1517836357463-d25dfeac3438"),
        view: "back",
        weight: 56,
        bf: 12,
        date: "2025-06-10",
        notes: "Stage-ready.",
      },
    ],
  },
  {
    username: "ben_ride",
    displayName: "Ben",
    country: "NL",
    language: "nl",
    bio: "Gravel century in October.",
    goal: "160km gravel",
    avatar: img("1502744688674-c619d1586c9e", 400),
  },
];

// -----------------------------------------------------------------------------
// Community threads — 15 total, mixed kinds (only 'question' | 'flex' allowed).
// -----------------------------------------------------------------------------
type CommunitySeed = {
  title: string;
  body: string;
  kind: "question" | "flex";
  authorIdx: number; // index into TRAINEES
  respects?: number;
  comments?: { authorIdx: number; body: string; fromTrainer?: number }[]; // fromTrainer = index into TRAINERS
};

const COMMUNITY_POSTS: CommunitySeed[] = [
  {
    title: "How do I stop rounding my back on deadlifts?",
    body: "Feels fine at 60kg, breaks down at 100kg. Any drills? Video coming.",
    kind: "question",
    authorIdx: 1,
    respects: 8,
    comments: [
      { authorIdx: 4, body: "Film from the side. 9/10 times it's a hinge cue problem." },
      { authorIdx: 0, body: "This exact thing happened to me. Paused deadlifts fixed it." },
      {
        authorIdx: 0,
        body: "Widen your grip and think 'chest tall'. Bar path close.",
        fromTrainer: 6,
      },
    ],
  },
  {
    title: "First 10k under 50min!",
    body: "Six months of zone-2. Consistency wins.",
    kind: "flex",
    authorIdx: 3,
    respects: 22,
    comments: [
      { authorIdx: 5, body: "Nice pacing. Where did you race?" },
      {
        authorIdx: 0,
        body: "Well done — controlled from the start, that's the skill.",
        fromTrainer: 4,
      },
    ],
  },
  {
    title: "Best warm-up before heavy squats?",
    body: "Currently 5min bike + 2 warm-up sets. Missing anything?",
    kind: "question",
    authorIdx: 4,
    respects: 5,
    comments: [
      { authorIdx: 1, body: "Add hip CARs and a couple of light box squats." },
      {
        authorIdx: 0,
        body: "Ramping matters more than volume. Try 5×5 → 3×3 → 1×1 up to work.",
        fromTrainer: 2,
      },
    ],
  },
  {
    title: "Finger pulley — how long off?",
    body: "Felt a pop last week on a crimp. It's tender but bearable.",
    kind: "question",
    authorIdx: 9,
    respects: 3,
    comments: [
      {
        authorIdx: 0,
        body: "Do not climb until an ultrasound. 6+ weeks. Ask me anything.",
        fromTrainer: 8,
      },
    ],
  },
  {
    title: "First muscle-up after 8 months",
    body: "Zero to hero. Programming from Coach Nyx. Small tears at the top 😅",
    kind: "flex",
    authorIdx: 2,
    respects: 34,
    comments: [{ authorIdx: 0, body: "Massive. Now do 10.", fromTrainer: 10 }],
  },
  {
    title: "Form check: front squat depth",
    body: "Getting butt-wink around parallel. Attached a still.",
    kind: "question",
    authorIdx: 5,
    respects: 6,
    comments: [
      { authorIdx: 0, body: "Ankle mobility. Elevate heels 1cm, drill more.", fromTrainer: 6 },
    ],
  },
  {
    title: "First metric century done!",
    body: "100km in 4:12. Legs like jelly, brain buzzing.",
    kind: "flex",
    authorIdx: 19,
    respects: 18,
  },
  {
    title: "Pre-race meal recommendation?",
    body: "Half marathon Sunday. What do you all eat 3h out?",
    kind: "question",
    authorIdx: 3,
    respects: 4,
    comments: [
      { authorIdx: 0, body: "Oats + banana + honey, small coffee. Simple wins.", fromTrainer: 4 },
    ],
  },
  {
    title: "PR — 180kg squat @ 82kg BW",
    body: "Two years of grinding. Kova plan works.",
    kind: "flex",
    authorIdx: 4,
    respects: 41,
  },
  {
    title: "Postpartum — safe to start Pilates at 8 weeks?",
    body: "Cleared by OB, but nervous about DR.",
    kind: "question",
    authorIdx: 12,
    respects: 7,
    comments: [
      {
        authorIdx: 0,
        body: "Yes, gently. DM me and we'll design a 4-week reintro.",
        fromTrainer: 11,
      },
    ],
  },
  {
    title: "Boxing sparring — first round survived",
    body: "Two months in. Kept my hands up (mostly).",
    kind: "flex",
    authorIdx: 8,
    respects: 15,
  },
  {
    title: "Sub-1:00 100m free — is my pull too high?",
    body: "Coach said hip drive is fine but pull looks 'chicken-winged'.",
    kind: "question",
    authorIdx: 5,
    respects: 3,
    comments: [
      {
        authorIdx: 0,
        body: "Elbow up, forearm vertical. Try catch-up drill for a week.",
        fromTrainer: 0,
      },
    ],
  },
  {
    title: "First pull-up!",
    body: "30 days, negatives only. Cannot believe this.",
    kind: "flex",
    authorIdx: 13,
    respects: 27,
  },
  {
    title: "Recovery — sleep vs food, which first?",
    body: "Both suck right now. If you had to fix one first?",
    kind: "question",
    authorIdx: 17,
    respects: 9,
    comments: [{ authorIdx: 0, body: "Sleep. Everything else is downstream.", fromTrainer: 2 }],
  },
  {
    title: "Bikini prep — 10 weeks out",
    body: "Progress pic below. Feedback welcome.",
    kind: "flex",
    authorIdx: 18,
    respects: 24,
  },
];

// -----------------------------------------------------------------------------
// Step-based seed / clear
// -----------------------------------------------------------------------------
export type SeedStep = { key: string; label: string };

export const SEED_STEPS: SeedStep[] = [
  { key: "admin", label: "Admin · admin@leerdemo.local" },
  ...TRAINERS.map((t, i) => ({ key: `trainer:${i}`, label: `Trainer · ${t.displayName}` })),
  ...TRAINEES.map((t, i) => ({ key: `trainee:${i}`, label: `Trainee · ${t.displayName}` })),
  { key: "community", label: "Community threads & comments" },
  { key: "engagement", label: "Follows, respects, comments, subscriptions" },
  { key: "commerce", label: "Tips, transactions, balances, payouts" },
  { key: "moderation", label: "Reports, strikes, audit logs" },
  { key: "notifications", label: "Notifications" },
];

export type DemoAccount = {
  email: string;
  role: "admin" | "trainer" | "trainee";
  displayName: string;
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: `admin@${DEMO_EMAIL_DOMAIN}`, role: "admin", displayName: "Demo Admin" },
  ...TRAINERS.map((t) => ({
    email: `${t.slug}@${DEMO_EMAIL_DOMAIN}`,
    role: "trainer" as const,
    displayName: t.displayName,
  })),
  ...TRAINEES.map((t) => ({
    email: `${t.username}@${DEMO_EMAIL_DOMAIN}`,
    role: "trainee" as const,
    displayName: t.displayName,
  })),
];

// Clear steps: engagement + commerce + moderation first (child rows scoped to
// demo user IDs), then existing content tables, then profiles, then auth users.
export const CLEAR_STEPS: SeedStep[] = [
  { key: "engagement:child", label: "Follows, respects, comments, saves, subscriptions" },
  { key: "commerce:child", label: "Tips, transactions, balances, payouts" },
  { key: "moderation:child", label: "Reports, strikes, moderation & audit logs" },
  { key: "notifications:child", label: "Notifications" },
  { key: "table:posts", label: "Posts" },
  { key: "table:community_comments", label: "Community comments" },
  { key: "table:community_posts", label: "Community posts" },
  { key: "table:transformation_posts", label: "Transformations" },
  { key: "table:trainer_profiles", label: "Trainer profiles" },
  { key: "table:profiles", label: "Profiles" },
  { key: "auth_users", label: "Auth users" },
];

// -----------------------------------------------------------------------------
// Server functions
// -----------------------------------------------------------------------------

async function ensureUser(supabaseAdmin: any, email: string): Promise<string> {
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users?.find((u: any) => u.email === email);
  if (existing) {
    await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    return existing.id;
  }
  const { data: c, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (error || !c?.user) throw new Error(`createUser ${email}: ${error?.message ?? "unknown"}`);
  return c.user.id;
}

async function loadDemoUserMap(supabaseAdmin: any) {
  const { data: rows } = await supabaseAdmin
    .from("profiles")
    .select("user_id, username")
    .eq("is_demo", true);
  const byUsername = new Map<string, string>();
  for (const r of (rows as { user_id: string; username: string | null }[] | null) ?? []) {
    if (r.username) byUsername.set(r.username, r.user_id);
  }
  return byUsername;
}

export const adminSeedDemoStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { step: string }) => {
    if (!d || typeof d.step !== "string") throw new Error("step required");
    return d;
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const step = data.step;
    const counts: Record<string, number> = {};

    if (step === "admin") {
      const email = `admin@${DEMO_EMAIL_DOMAIN}`;
      const uid = await ensureUser(supabaseAdmin, email);
      await supabaseAdmin
        .from("profiles")
        .update({
          username: "admin",
          display_name: "Demo Admin",
          full_name: "Demo Admin",
          bio: "Demo admin account.",
          country: "US",
          native_language: "en",
          is_demo: true,
        })
        .eq("user_id", uid);
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: uid, role: "admin" }, { onConflict: "user_id, role" });
      counts.admins = 1;
      return { step, label: "Admin", counts };
    }

    if (step.startsWith("trainer:")) {
      const idx = Number(step.split(":")[1]);
      const t = TRAINERS[idx];
      if (!t) throw new Error(`Unknown trainer step ${step}`);
      const email = `${t.slug}@${DEMO_EMAIL_DOMAIN}`;
      const uid = await ensureUser(supabaseAdmin, email);
      await supabaseAdmin
        .from("profiles")
        .update({
          username: t.username,
          display_name: t.displayName,
          full_name: t.displayName,
          bio: t.bio,
          country: t.country,
          native_language: t.language,
          avatar_url: resolveMedia(t.avatar, "avatar", `trainer-${t.slug}-avatar`),
          cover_url: resolveMedia(t.cover, "cover", `trainer-${t.slug}-cover`),
          is_demo: true,
        })
        .eq("user_id", uid);
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: uid, role: "trainer" }, { onConflict: "user_id, role" });
      await supabaseAdmin.from("trainer_profiles").upsert(
        {
          user_id: uid,
          specialties: t.specialties,
          value_proposition: t.intro.slice(0, 200),
          subscription_price: t.price,
          is_verified: t.verified,
          monetization_enabled: t.verified,
          is_demo: true,
        },
        { onConflict: "user_id" },
      );
      // Pinned intro post + numbered content posts, backdated so the feed looks alive.
      const now = Date.now();
      const intro = { caption: t.intro, media: t.cover, kind: "feed" as const };
      const allPosts: PostSeed[] = [intro, ...t.posts];
      let postsCount = 0;
      for (let i = 0; i < allPosts.length; i++) {
        const p = allPosts[i]!;
        const createdAt = new Date(now - i * 3 * 24 * 3600_000).toISOString();
        const seed = `post-${t.slug}-${i}`;
        const isVid = isVideo(p.media);
        const mediaUrl = isVid ? p.media : resolveMedia(p.media, "feed", seed);
        const thumbUrl = isVid
          ? resolvePoster(p.thumb ?? t.cover, seed, "thumb")
          : resolveMedia(p.thumb ?? p.media, "thumb", seed);
        await supabaseAdmin.from("posts").insert({
          trainer_id: uid,
          caption: p.caption,
          media_url: mediaUrl,
          thumbnail_url: thumbUrl,
          kind: p.kind ?? "feed",
          is_premium: !!p.premium,
          unlock_price: p.premium ? Math.max(3, Math.round(t.price * 0.35 * 100) / 100) : null,
          created_at: createdAt,
          is_demo: true,
        });
        postsCount++;
      }
      counts.trainers = 1;
      counts.posts = postsCount;
      return { step, label: `Trainer · ${t.displayName}`, counts };
    }

    if (step.startsWith("trainee:")) {
      const idx = Number(step.split(":")[1]);
      const t = TRAINEES[idx];
      if (!t) throw new Error(`Unknown trainee step ${step}`);
      const email = `${t.username}@${DEMO_EMAIL_DOMAIN}`;
      const uid = await ensureUser(supabaseAdmin, email);
      await supabaseAdmin
        .from("profiles")
        .update({
          username: t.username,
          display_name: t.displayName,
          full_name: t.displayName,
          bio: t.bio,
          country: t.country,
          native_language: t.language,
          avatar_url: resolveMedia(t.avatar, "avatar", `trainee-${t.username}-avatar`),
          goal: t.goal,
          is_demo: true,
        })
        .eq("user_id", uid);
      let tf = 0;
      for (let ti = 0; ti < (t.transformations ?? []).length; ti++) {
        const x = t.transformations![ti]!;
        const seed = `xform-${t.username}-${ti}`;
        const media = resolveMedia(x.media, "feed", seed);
        const thumb = resolveMedia(x.media, "thumb", seed);
        await supabaseAdmin.from("transformation_posts").insert({
          user_id: uid,
          media_url: media,
          thumbnail_url: thumb,
          view_angle: x.view,
          captured_on: x.date,
          weight_kg: x.weight,
          body_fat_percent: x.bf,
          notes: x.notes,
          visibility: "public",
          is_demo: true,
        });
        tf++;
      }
      counts.trainees = 1;
      counts.transformations = tf;
      return { step, label: `Trainee · ${t.displayName}`, counts };
    }

    if (step === "community") {
      const map = await loadDemoUserMap(supabaseAdmin);
      let posts = 0,
        comments = 0;
      for (const cp of COMMUNITY_POSTS) {
        const authorId = map.get(TRAINEES[cp.authorIdx % TRAINEES.length]!.username);
        if (!authorId) continue;
        const { data: inserted } = await supabaseAdmin
          .from("community_posts")
          .insert({
            author_id: authorId,
            title: cp.title,
            body: cp.body,
            kind: cp.kind,
            respect_count: cp.respects ?? 0,
            is_demo: true,
          })
          .select("id")
          .single();
        posts++;
        const pid = (inserted as { id: string } | null)?.id;
        if (!pid) continue;
        for (const c of cp.comments ?? []) {
          const cAuthorId =
            c.fromTrainer !== undefined
              ? map.get(TRAINERS[c.fromTrainer]!.username)
              : map.get(TRAINEES[c.authorIdx]!.username);
          if (!cAuthorId) continue;
          await supabaseAdmin.from("community_comments").insert({
            post_id: pid,
            author_id: cAuthorId,
            body: c.body,
          });
          comments++;
        }
      }
      counts.community = posts;
      counts.community_comments = comments;
      return { step, label: "Community", counts };
    }

    if (step === "engagement") {
      const map = await loadDemoUserMap(supabaseAdmin);
      const traineeIds = TRAINEES.map((t) => map.get(t.username)).filter(Boolean) as string[];
      const trainerIds = TRAINERS.map((t) => map.get(t.username)).filter(Boolean) as string[];

      // Follows: each trainee follows 2–5 trainers
      let follows = 0;
      for (const tid of traineeIds) {
        const n = 2 + Math.floor(Math.random() * 4);
        const pick = [...trainerIds].sort(() => Math.random() - 0.5).slice(0, n);
        for (const trainerId of pick) {
          const { error } = await supabaseAdmin
            .from("follows")
            .insert({ follower_id: tid, trainer_id: trainerId });
          if (!error) follows++;
        }
      }

      // Subscriptions: each trainer gets 3–6 subscribers
      let subs = 0;
      for (let ti = 0; ti < TRAINERS.length; ti++) {
        const trainerId = trainerIds[ti];
        if (!trainerId || !TRAINERS[ti]!.verified) continue;
        const n = 3 + Math.floor(Math.random() * 4);
        const pick = [...traineeIds].sort(() => Math.random() - 0.5).slice(0, n);
        for (const subId of pick) {
          const { error } = await supabaseAdmin.from("subscriptions").insert({
            subscriber_id: subId,
            trainer_id: trainerId,
            status: "active",
            price: TRAINERS[ti]!.price,
            current_period_end: new Date(Date.now() + 25 * 24 * 3600_000).toISOString(),
          });
          if (!error) subs++;
        }
      }

      // Respects + saves + comments on posts
      const { data: posts } = await supabaseAdmin
        .from("posts")
        .select("id, trainer_id, is_premium")
        .eq("is_demo", true);
      const commentBank = [
        "This helped a lot, thanks coach.",
        "Trying this tomorrow.",
        "Finally makes sense.",
        "Bookmarking.",
        "Best cue I've heard.",
        "Question — where do I put my elbows?",
        "Ran through this today, felt great.",
      ];
      let respects = 0,
        saves = 0,
        comments = 0;
      for (const p of (posts as any[]) ?? []) {
        const respectCount = 5 + Math.floor(Math.random() * 35);
        const pickR = [...traineeIds]
          .sort(() => Math.random() - 0.5)
          .slice(0, Math.min(respectCount, traineeIds.length));
        for (const uid of pickR) {
          const { error } = await supabaseAdmin
            .from("respects")
            .insert({ user_id: uid, post_id: p.id });
          if (!error) respects++;
        }
        const saveN = Math.floor(Math.random() * 5);
        const pickS = [...traineeIds].sort(() => Math.random() - 0.5).slice(0, saveN);
        for (const uid of pickS) {
          const { error } = await supabaseAdmin
            .from("saves")
            .insert({ user_id: uid, post_id: p.id });
          if (!error) saves++;
        }
        const cN = Math.floor(Math.random() * 4);
        const pickC = [...traineeIds].sort(() => Math.random() - 0.5).slice(0, cN);
        for (const uid of pickC) {
          const body = commentBank[Math.floor(Math.random() * commentBank.length)]!;
          const { error } = await supabaseAdmin
            .from("comments")
            .insert({ post_id: p.id, author_id: uid, body });
          if (!error) comments++;
        }
      }

      counts.follows = follows;
      counts.subscriptions = subs;
      counts.respects = respects;
      counts.saves = saves;
      counts.comments = comments;
      return { step, label: "Engagement", counts };
    }

    if (step === "commerce") {
      const map = await loadDemoUserMap(supabaseAdmin);
      const traineeIds = TRAINEES.map((t) => map.get(t.username)).filter(Boolean) as string[];
      const trainerIds = TRAINERS.map((t, i) =>
        TRAINERS[i]!.verified ? map.get(t.username) : null,
      ).filter(Boolean) as string[];

      // Tips
      let tips = 0;
      const tipMessages = ["Great cue!", "Made my week.", "Thank you!", "Best coach.", ""];
      const currencies = ["USD", "EUR", "GBP"];
      for (let i = 0; i < 15; i++) {
        const from = traineeIds[Math.floor(Math.random() * traineeIds.length)];
        const to = trainerIds[Math.floor(Math.random() * trainerIds.length)];
        if (!from || !to) continue;
        await supabaseAdmin.from("tips").insert({
          from_user_id: from,
          trainer_id: to,
          amount: 2 + Math.floor(Math.random() * 24),
          currency: currencies[i % currencies.length],
          status: "succeeded",
          message: tipMessages[Math.floor(Math.random() * tipMessages.length)] || null,
        });
        tips++;
      }

      // Transactions (mix of subscription, tip, class)
      let tx = 0;
      for (let i = 0; i < 10; i++) {
        const payer = traineeIds[Math.floor(Math.random() * traineeIds.length)];
        const trainer = trainerIds[Math.floor(Math.random() * trainerIds.length)];
        if (!payer || !trainer) continue;
        const gross = 5 + Math.floor(Math.random() * 45);
        const fee = +(gross * 0.15).toFixed(2);
        await supabaseAdmin.from("transactions").insert({
          kind: ["subscription", "tip", "class", "coaching"][i % 4],
          status: i === 9 ? "refunded" : "succeeded",
          payer_id: payer,
          trainer_id: trainer,
          gross,
          platform_fee: fee,
          trainer_amount: gross - fee,
          currency: "USD",
          metadata: { demo: true },
        });
        tx++;
      }

      // Trainer balances + payouts
      let balances = 0,
        payouts = 0;
      for (const trainerId of trainerIds) {
        const available = 50 + Math.floor(Math.random() * 800);
        await supabaseAdmin.from("trainer_balances").upsert(
          {
            trainer_id: trainerId,
            available_amount: available,
            pending_amount: Math.floor(Math.random() * 200),
            frozen_amount: 0,
            paid_out_amount: Math.floor(Math.random() * 500),
            currency: "USD",
          },
          { onConflict: "trainer_id" },
        );
        balances++;
      }
      const payoutStatuses = ["pending", "paid", "failed"];
      for (let i = 0; i < 3; i++) {
        const trainerId = trainerIds[i];
        if (!trainerId) continue;
        await supabaseAdmin.from("payouts").insert({
          trainer_id: trainerId,
          amount: 100 + Math.floor(Math.random() * 400),
          currency: "USD",
          method: "bank_transfer",
          method_details: { bank: "Demo Bank" },
          status: payoutStatuses[i],
        });
        payouts++;
      }

      counts.tips = tips;
      counts.transactions = tx;
      counts.balances = balances;
      counts.payouts = payouts;
      return { step, label: "Commerce", counts };
    }

    if (step === "moderation") {
      const map = await loadDemoUserMap(supabaseAdmin);
      const traineeIds = TRAINEES.map((t) => map.get(t.username)).filter(Boolean) as string[];
      const trainerIds = TRAINERS.map((t) => map.get(t.username)).filter(Boolean) as string[];
      const adminId = map.get("admin");

      // Reports on posts, comments, community posts, transformations
      const { data: postSamples } = await supabaseAdmin
        .from("posts")
        .select("id")
        .eq("is_demo", true)
        .limit(3);
      const { data: cpostSamples } = await supabaseAdmin
        .from("community_posts")
        .select("id")
        .eq("is_demo", true)
        .limit(2);
      const { data: xformSamples } = await supabaseAdmin
        .from("transformation_posts")
        .select("id")
        .eq("is_demo", true)
        .limit(1);
      const targets: { type: "post" | "community_post" | "transformation"; id: string }[] = [];
      for (const p of (postSamples as any[]) ?? []) targets.push({ type: "post", id: p.id });
      for (const p of (cpostSamples as any[]) ?? [])
        targets.push({ type: "community_post", id: p.id });
      for (const p of (xformSamples as any[]) ?? [])
        targets.push({ type: "transformation", id: p.id });

      const reasons = ["spam", "abuse", "misinformation", "nudity", "other"] as const;
      const statuses = ["open", "reviewed", "dismissed", "actioned"] as const;
      let reports = 0;
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i]!;
        const reporter = traineeIds[i % traineeIds.length]!;
        await supabaseAdmin.from("reports").insert({
          reporter_id: reporter,
          target_type: t.type,
          target_id: t.id,
          reason: reasons[i % reasons.length],
          status: statuses[i % statuses.length],
          details: "Demo report — please review.",
        });
        reports++;
      }

      // Trainer strikes on the unverified trainer + one other
      let strikes = 0;
      const kimoId = map.get("coach_kimo");
      if (kimoId) {
        await supabaseAdmin.from("trainer_strikes").insert({
          trainer_id: kimoId,
          reason: "Unverified content flagged by users.",
          status: "active",
          issued_by: adminId ?? null,
        });
        strikes++;
      }
      if (trainerIds[3]) {
        await supabaseAdmin.from("trainer_strikes").insert({
          trainer_id: trainerIds[3],
          reason: "Late response to coaching request.",
          status: "expired",
          issued_by: adminId ?? null,
          expires_at: new Date(Date.now() - 5 * 24 * 3600_000).toISOString(),
        });
        strikes++;
      }

      // Moderation actions + audit logs
      let modActions = 0,
        auditLogs = 0;
      const actions = ["hide", "restore", "warn", "remove"] as const;
      for (let i = 0; i < Math.min(targets.length, 6); i++) {
        const t = targets[i]!;
        await supabaseAdmin.from("moderation_actions").insert({
          actor_id: adminId ?? null,
          target_type: t.type,
          target_id: t.id,
          action: actions[i % actions.length],
          reason: "Demo moderation action.",
          automated: false,
        });
        modActions++;
      }
      const auditActionsList = [
        "role.grant",
        "role.revoke",
        "trainer.verify",
        "user.suspend",
        "policy.update",
        "settings.update",
      ];
      for (let i = 0; i < 8; i++) {
        await supabaseAdmin.from("audit_logs").insert({
          actor_id: adminId ?? null,
          action: auditActionsList[i % auditActionsList.length],
          target_table: "profiles",
          target_id: (trainerIds[i % trainerIds.length] ?? "").toString(),
          metadata: { demo: true, note: "Backfilled by demo seeder." },
        });
        auditLogs++;
      }

      counts.reports = reports;
      counts.strikes = strikes;
      counts.moderation_actions = modActions;
      counts.audit_logs = auditLogs;
      return { step, label: "Moderation", counts };
    }

    if (step === "notifications") {
      const map = await loadDemoUserMap(supabaseAdmin);
      const trainerIds = TRAINERS.map((t) => map.get(t.username)).filter(Boolean) as string[];
      const traineeIds = TRAINEES.map((t) => map.get(t.username)).filter(Boolean) as string[];
      let n = 0;
      // A few unread notifications for each trainer (follows, subs, tips, comments)
      const types: { type: string; title: string; body: string }[] = [
        { type: "follow", title: "New follower", body: "started following you." },
        { type: "subscription", title: "New subscriber", body: "just subscribed to you." },
        { type: "tip", title: "You got a tip", body: "sent you a tip." },
        { type: "comment", title: "New comment", body: "commented on your post." },
      ];
      for (const trainerId of trainerIds) {
        for (let i = 0; i < 3; i++) {
          const actorId = traineeIds[Math.floor(Math.random() * traineeIds.length)];
          const t = types[i % types.length]!;
          await supabaseAdmin.from("notifications").insert({
            user_id: trainerId,
            actor_id: actorId,
            type: t.type,
            title: t.title,
            body: t.body,
            metadata: { demo: true },
          });
          n++;
        }
      }
      counts.notifications = n;
      return { step, label: "Notifications", counts };
    }

    throw new Error(`Unknown seed step: ${step}`);
  });

export const adminClearDemoStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { step: string }) => {
    if (!d || typeof d.step !== "string") throw new Error("step required");
    return d;
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const step = data.step;

    // Helper: get demo user ids (before profiles are deleted)
    async function demoUserIds(): Promise<string[]> {
      const { data } = await supabaseAdmin.from("profiles").select("user_id").eq("is_demo", true);
      return ((data as { user_id: string }[] | null) ?? []).map((r) => r.user_id);
    }

    if (step === "engagement:child") {
      const ids = await demoUserIds();
      if (ids.length === 0) return { step, label: "Engagement", removed: 0 };
      let n = 0;
      for (const table of [
        "follows",
        "respects",
        "saves",
        "shares",
        "comments",
        "subscriptions",
      ] as const) {
        const userCol =
          table === "follows"
            ? "follower_id"
            : table === "subscriptions"
              ? "subscriber_id"
              : table === "comments"
                ? "author_id"
                : "user_id";
        const { count } = await supabaseAdmin
          .from(table)
          .delete({ count: "exact" })
          .in(userCol, ids);
        n += count ?? 0;
      }
      return { step, label: "Engagement", removed: n };
    }

    if (step === "commerce:child") {
      const ids = await demoUserIds();
      if (ids.length === 0) return { step, label: "Commerce", removed: 0 };
      let n = 0;
      const { count: c1 } = await supabaseAdmin
        .from("tips")
        .delete({ count: "exact" })
        .in("trainer_id", ids);
      const { count: c2 } = await supabaseAdmin
        .from("transactions")
        .delete({ count: "exact" })
        .in("trainer_id", ids);
      const { count: c3 } = await supabaseAdmin
        .from("payouts")
        .delete({ count: "exact" })
        .in("trainer_id", ids);
      const { count: c4 } = await supabaseAdmin
        .from("trainer_balances")
        .delete({ count: "exact" })
        .in("trainer_id", ids);
      n = (c1 ?? 0) + (c2 ?? 0) + (c3 ?? 0) + (c4 ?? 0);
      return { step, label: "Commerce", removed: n };
    }

    if (step === "moderation:child") {
      const ids = await demoUserIds();
      let n = 0;
      if (ids.length) {
        const { count: c1 } = await supabaseAdmin
          .from("reports")
          .delete({ count: "exact" })
          .in("reporter_id", ids);
        const { count: c2 } = await supabaseAdmin
          .from("trainer_strikes")
          .delete({ count: "exact" })
          .in("trainer_id", ids);
        const { count: c3 } = await supabaseAdmin
          .from("moderation_actions")
          .delete({ count: "exact" })
          .in("actor_id", ids);
        const { count: c4 } = await supabaseAdmin
          .from("audit_logs")
          .delete({ count: "exact" })
          .in("actor_id", ids);
        n = (c1 ?? 0) + (c2 ?? 0) + (c3 ?? 0) + (c4 ?? 0);
      }
      return { step, label: "Moderation", removed: n };
    }

    if (step === "notifications:child") {
      const ids = await demoUserIds();
      if (ids.length === 0) return { step, label: "Notifications", removed: 0 };
      const { count } = await supabaseAdmin
        .from("notifications")
        .delete({ count: "exact" })
        .in("user_id", ids);
      return { step, label: "Notifications", removed: count ?? 0 };
    }

    if (step.startsWith("table:")) {
      const table = step.slice("table:".length);
      const allowed = new Set([
        "posts",
        "community_posts",
        "community_comments",
        "transformation_posts",
        "trainer_profiles",
        "profiles",
      ]);
      if (!allowed.has(table)) throw new Error(`Unknown clear table: ${table}`);
      const dyn = supabaseAdmin as any;
      // community_comments lacks is_demo — scope by demo authors instead.
      if (table === "community_comments") {
        const ids = await demoUserIds();
        if (ids.length === 0) return { step, label: table, removed: 0 };
        const { count } = await dyn.from(table).delete({ count: "exact" }).in("author_id", ids);
        return { step, label: table, removed: count ?? 0 };
      }
      const { error, count } = await dyn.from(table).delete({ count: "exact" }).eq("is_demo", true);
      if (error) throw new Error(`delete ${table}: ${error.message}`);
      return { step, label: table, removed: count ?? 0 };
    }

    if (step === "auth_users") {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const demoUsers = (list?.users ?? []).filter((u: any) =>
        (u.email ?? "").endsWith(`@${DEMO_EMAIL_DOMAIN}`),
      );
      let n = 0;
      for (const u of demoUsers) {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(u.id);
        if (!error) n++;
      }
      return { step, label: "Auth users", removed: n };
    }

    throw new Error(`Unknown clear step: ${step}`);
  });

export const adminGetDemoStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    async function n(table: string, filter?: [string, any]) {
      let q: any = (supabaseAdmin as any).from(table).select("*", { count: "exact", head: true });
      if (filter) q = q.eq(filter[0], filter[1]);
      const { count } = await q;
      return count ?? 0;
    }

    // Fetch demo user ids for scoped counts (engagement/commerce/moderation tables lack is_demo).
    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("is_demo", true);
    const ids = ((rows as { user_id: string }[] | null) ?? []).map((r) => r.user_id);

    async function scoped(table: string, col: string) {
      if (ids.length === 0) return 0;
      const { count } = await (supabaseAdmin as any)
        .from(table)
        .select("*", { count: "exact", head: true })
        .in(col, ids);
      return count ?? 0;
    }

    const [
      profiles,
      trainerProfiles,
      posts,
      community,
      transformations,
      follows,
      subscriptions,
      tips,
      reports,
      notifications,
    ] = await Promise.all([
      n("profiles", ["is_demo", true]),
      n("trainer_profiles", ["is_demo", true]),
      n("posts", ["is_demo", true]),
      n("community_posts", ["is_demo", true]),
      n("transformation_posts", ["is_demo", true]),
      scoped("follows", "follower_id"),
      scoped("subscriptions", "subscriber_id"),
      scoped("tips", "trainer_id"),
      scoped("reports", "reporter_id"),
      scoped("notifications", "user_id"),
    ]);

    return {
      profiles,
      trainerProfiles,
      posts,
      community,
      transformations,
      follows,
      subscriptions,
      tips,
      reports,
      notifications,
    };
  });

export const adminSeedAdminOnly = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = `admin@${DEMO_EMAIL_DOMAIN}`;
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users?.find((u: any) => u.email === email);
    let uid: string;
    let alreadyExisted = false;
    if (existing) {
      alreadyExisted = true;
      await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
      uid = existing.id;
    } else {
      const { data: c, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
      if (error || !c?.user) throw new Error(`createUser ${email}: ${error?.message ?? "unknown"}`);
      uid = c.user.id;
    }
    await supabaseAdmin
      .from("profiles")
      .update({
        username: "admin",
        display_name: "Demo Admin",
        full_name: "Demo Admin",
        bio: "Demo admin account.",
        country: "US",
        native_language: "en",
        is_demo: true,
      })
      .eq("user_id", uid);
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: uid, role: "admin" }, { onConflict: "user_id, role" });
    return {
      email,
      password: DEMO_PASSWORD,
      displayName: "Demo Admin",
      username: "admin",
      alreadyExisted,
    };
  });
