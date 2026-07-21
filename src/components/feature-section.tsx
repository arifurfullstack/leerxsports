import { Calendar, Users, Trophy, MapPin } from "lucide-react";

const features = [
  {
    icon: Calendar,
    title: "Easy booking",
    description: "Find a class that fits your schedule and book in seconds.",
  },
  {
    icon: Users,
    title: "Certified coaches",
    description: "Learn from experienced instructors who know how to push you safely.",
  },
  {
    icon: Trophy,
    title: "All levels welcome",
    description: "From beginner fundamentals to advanced drills, there is a class for you.",
  },
  {
    icon: MapPin,
    title: "Multiple locations",
    description: "Train at the pool, court, studio, or trail — wherever the sport takes you.",
  },
];

export function FeatureSection() {
  return (
    <section className="bg-muted/50 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Why train with leersports?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A simple, powerful platform for athletes and coaches.
          </p>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sport/10 text-sport">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-card-foreground">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
