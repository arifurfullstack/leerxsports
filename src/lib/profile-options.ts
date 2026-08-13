export const COUNTRY_OPTIONS = [
  { value: "Guam", label: "🇬🇺 Guam" },
  { value: "United States", label: "🇺🇸 United States" },
  { value: "United Kingdom", label: "🇬🇧 United Kingdom" },
  { value: "Canada", label: "🇨🇦 Canada" },
  { value: "Australia", label: "🇦🇺 Australia" },
  { value: "Bangladesh", label: "🇧🇩 Bangladesh" },
  { value: "Brazil", label: "🇧🇷 Brazil" },
  { value: "China", label: "🇨🇳 China" },
  { value: "France", label: "🇫🇷 France" },
  { value: "Germany", label: "🇩🇪 Germany" },
  { value: "India", label: "🇮🇳 India" },
  { value: "Indonesia", label: "🇮🇩 Indonesia" },
  { value: "Italy", label: "🇮🇹 Italy" },
  { value: "Japan", label: "🇯🇵 Japan" },
  { value: "Mexico", label: "🇲🇽 Mexico" },
  { value: "Netherlands", label: "🇳🇱 Netherlands" },
  { value: "New Zealand", label: "🇳🇿 New Zealand" },
  { value: "Nigeria", label: "🇳🇬 Nigeria" },
  { value: "Pakistan", label: "🇵🇰 Pakistan" },
  { value: "Philippines", label: "🇵🇭 Philippines" },
  { value: "Saudi Arabia", label: "🇸🇦 Saudi Arabia" },
  { value: "Singapore", label: "🇸🇬 Singapore" },
  { value: "South Africa", label: "🇿🇦 South Africa" },
  { value: "South Korea", label: "🇰🇷 South Korea" },
  { value: "Spain", label: "🇪🇸 Spain" },
  { value: "Sweden", label: "🇸🇪 Sweden" },
  { value: "Switzerland", label: "🇨🇭 Switzerland" },
  { value: "Turkey", label: "🇹🇷 Turkey" },
  { value: "United Arab Emirates", label: "🇦🇪 United Arab Emirates" },
  { value: "Vietnam", label: "🇻🇳 Vietnam" },
  { value: "Argentina", label: "🇦🇷 Argentina" },
  { value: "Austria", label: "🇦🇹 Austria" },
  { value: "Belgium", label: "🇧🇪 Belgium" },
  { value: "Chile", label: "🇨🇱 Chile" },
  { value: "Colombia", label: "🇨🇴 Colombia" },
  { value: "Denmark", label: "🇩🇰 Denmark" },
  { value: "Egypt", label: "🇪🇬 Egypt" },
  { value: "Finland", label: "🇫🇮 Finland" },
  { value: "Greece", label: "🇬🇷 Greece" },
  { value: "Hong Kong", label: "🇭🇰 Hong Kong" },
  { value: "Ireland", label: "🇮🇪 Ireland" },
  { value: "Israel", label: "🇮🇱 Israel" },
  { value: "Malaysia", label: "🇲🇾 Malaysia" },
  { value: "Norway", label: "🇳🇴 Norway" },
  { value: "Poland", label: "🇵🇱 Poland" },
  { value: "Portugal", label: "🇵🇹 Portugal" },
  { value: "Qatar", label: "🇶🇦 Qatar" },
  { value: "Thailand", label: "🇹🇭 Thailand" },
  { value: "Ukraine", label: "🇺🇦 Ukraine" },
];

export const LANGUAGE_OPTIONS = [
  { value: "English", label: "🌐 English" },
  { value: "Spanish", label: "🇪🇸 Spanish" },
  { value: "French", label: "🇫🇷 French" },
  { value: "German", label: "🇩🇪 German" },
  { value: "Mandarin Chinese", label: "🇨🇳 Mandarin Chinese" },
  { value: "Japanese", label: "🇯🇵 Japanese" },
  { value: "Hindi", label: "🇮🇳 Hindi" },
  { value: "Arabic", label: "🇦🇪 Arabic" },
  { value: "Bengali", label: "🇧🇩 Bengali" },
  { value: "Portuguese", label: "🇵🇹 Portuguese" },
  { value: "Russian", label: "🇷🇺 Russian" },
  { value: "Korean", label: "🇰🇷 Korean" },
  { value: "Italian", label: "🇮🇹 Italian" },
  { value: "Dutch", label: "🇳🇱 Dutch" },
  { value: "Turkish", label: "🇹🇷 Turkish" },
  { value: "Polish", label: "🇵🇱 Polish" },
  { value: "Vietnamese", label: "🇻🇳 Vietnamese" },
  { value: "Indonesian", label: "🇮🇩 Indonesian" },
  { value: "Thai", label: "🇹🇭 Thai" },
  { value: "Swedish", label: "🇸🇪 Swedish" },
];

export const HEIGHT_OPTIONS = Array.from({ length: (210 - 140) / 5 + 1 }, (_, i) => {
  const val = 140 + i * 5;
  return { value: String(val), label: `${val} cm` };
});

export const WEIGHT_OPTIONS = Array.from({ length: (150 - 40) / 5 + 1 }, (_, i) => {
  const val = 40 + i * 5;
  return { value: String(val), label: `${val} kg` };
});

export const GOAL_OPTIONS = [
  { value: "Weight Loss", label: "🔥 Weight Loss" },
  { value: "Muscle Gain", label: "💪 Muscle Gain" },
  { value: "Hypertrophy", label: "🏋️ Hypertrophy" },
  { value: "Endurance", label: "🏃 Endurance" },
  { value: "Strength", label: "⚡ Strength" },
  { value: "Flexibility", label: "🧘 Flexibility" },
  { value: "Marathon", label: "🏅 Marathon" },
  { value: "Calisthenics", label: "🤸 Calisthenics" },
  { value: "Boxing & Combat", label: "🥊 Boxing & Combat" },
  { value: "Fat Loss & Toning", label: "🚴 Fat Loss & Toning" },
  { value: "Core & Balance", label: "🧘‍♀️ Core & Balance" },
  { value: "Athletic Performance", label: "🏆 Athletic Performance" },
];

export const EXPERIENCE_LEVEL_OPTIONS = [
  { value: "beginner", label: "🌱 Beginner" },
  { value: "intermediate", label: "💪 Intermediate" },
  { value: "advanced", label: "🔥 Advanced" },
  { value: "elite", label: "⚡ Elite" },
];
