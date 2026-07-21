import { Link } from "@tanstack/react-router";
import { Clock, MapPin, Users } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter } from "./ui/card";
import { ResponsiveImage } from "./responsive-image";
import type { SportsClass } from "@/lib/schemas";

interface ClassCardProps {
  classItem: SportsClass;
  bookedCount?: number;
}

export function ClassCard({ classItem, bookedCount = 0 }: ClassCardProps) {
  const date = new Date(classItem.schedule);
  const spotsLeft = classItem.capacity - bookedCount;
  const isFull = spotsLeft <= 0;

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="aspect-video w-full overflow-hidden bg-muted">
        {classItem.image_url ? (
          <ResponsiveImage
            src={classItem.image_url}
            variant="thumb"
            seed={classItem.slug ?? classItem.title}
            alt={classItem.title}
            className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-muted text-muted-foreground">
            No image
          </div>
        )}
      </div>
      <CardContent className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="sport" className="capitalize">
            {classItem.level}
          </Badge>
          {classItem.category && <Badge variant="outline" className="capitalize">{classItem.category}</Badge>}
          {isFull && <Badge variant="destructive">Full</Badge>}
        </div>
        <h3 className="mt-3 text-lg font-semibold text-card-foreground">{classItem.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">with {classItem.instructor}</p>

        <div className="mt-4 space-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>
              {date.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              {" · "}
              {classItem.duration_minutes} min
            </span>
          </div>
          {classItem.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>{classItem.location}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>
              {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-5 pt-0">
        <Link to="/classes/$classId" params={{ classId: classItem.slug }} className="w-full">
          <Button className="w-full" disabled={isFull}>
            {isFull ? "Class full" : "View class"}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
