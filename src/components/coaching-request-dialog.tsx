import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createCoachingRequest } from "@/lib/coaching-functions";

export function CoachingRequestDialog({
  open,
  onOpenChange,
  trainerId,
  trainerName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  trainerId: string;
  trainerName: string;
}) {
  const router = useRouter();
  const createFn = useServerFn(createCoachingRequest);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [exercise, setExercise] = useState("");
  const [goal, setGoal] = useState("");
  const [injuryInfo, setInjuryInfo] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          trainerId,
          title: title.trim(),
          description: description.trim(),
          exercise: exercise.trim() || undefined,
          goal: goal.trim() || undefined,
          injury_info: injuryInfo.trim() || undefined,
        },
      }),
    onSuccess: (res) => {
      toast.success("Coaching request submitted");
      onOpenChange(false);
      router.navigate({
        to: "/coaching/$threadId",
        params: { threadId: res.id },
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disabled = title.trim().length < 3 || description.trim().length < 20;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display uppercase">
            Ask {trainerName}
          </DialogTitle>
          <DialogDescription>
            Uses your monthly coaching credit. Trainer has 48 hours to respond.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Feedback on my squat form"
              maxLength={120}
            />
          </div>
          <div>
            <Label>Question / Details</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your question in detail (min 20 chars)…"
              rows={5}
              maxLength={4000}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {description.length}/4000
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Exercise (optional)</Label>
              <Input
                value={exercise}
                onChange={(e) => setExercise(e.target.value)}
                maxLength={80}
              />
            </div>
            <div>
              <Label>Goal (optional)</Label>
              <Input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                maxLength={200}
              />
            </div>
          </div>
          <div>
            <Label>Injuries / limitations (optional)</Label>
            <Textarea
              value={injuryInfo}
              onChange={(e) => setInjuryInfo(e.target.value)}
              rows={2}
              maxLength={1000}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={disabled || mut.isPending}
              onClick={() => mut.mutate()}
            >
              {mut.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Submit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}