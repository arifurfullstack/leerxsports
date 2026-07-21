import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { adminCreateClass, adminUpdateClass } from "@/lib/admin-functions";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import type { SportsClass } from "@/lib/schemas";

interface AdminClassFormProps {
  classItem?: SportsClass;
  onDone?: () => void;
}

export function AdminClassForm({ classItem, onDone }: AdminClassFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const create = useServerFn(adminCreateClass);
  const update = useServerFn(adminUpdateClass);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: classItem?.title ?? "",
    slug: classItem?.slug ?? "",
    description: classItem?.description ?? "",
    instructor: classItem?.instructor ?? "",
    duration_minutes: classItem?.duration_minutes ?? 60,
    capacity: classItem?.capacity ?? 10,
    schedule: classItem?.schedule ? new Date(classItem.schedule).toISOString().slice(0, 16) : "",
    location: classItem?.location ?? "",
    level: classItem?.level ?? "beginner",
    category: classItem?.category ?? "",
    image_url: classItem?.image_url ?? "",
    price: classItem?.price ?? 0,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (classItem) {
        await update({
          data: {
            id: classItem.id,
            ...form,
          },
        });
      } else {
        await create({ data: form });
      }
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      router.invalidate();
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save class");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" value={form.title} onChange={handleChange} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" name="slug" value={form.slug} onChange={handleChange} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          value={form.description}
          onChange={handleChange}
          rows={3}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="instructor">Instructor</Label>
          <Input
            id="instructor"
            name="instructor"
            value={form.instructor}
            onChange={handleChange}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="schedule">Schedule</Label>
          <Input
            id="schedule"
            name="schedule"
            type="datetime-local"
            value={form.schedule}
            onChange={handleChange}
            required
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="duration_minutes">Duration (min)</Label>
          <Input
            id="duration_minutes"
            name="duration_minutes"
            type="number"
            value={form.duration_minutes}
            onChange={handleChange}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="capacity">Capacity</Label>
          <Input
            id="capacity"
            name="capacity"
            type="number"
            value={form.capacity}
            onChange={handleChange}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="price">Price</Label>
          <Input
            id="price"
            name="price"
            type="number"
            step="0.01"
            value={form.price}
            onChange={handleChange}
            required
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="level">Level</Label>
          <select
            id="level"
            name="level"
            value={form.level}
            onChange={handleChange}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            name="category"
            value={form.category}
            onChange={handleChange}
            placeholder="e.g. cycling"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            name="location"
            value={form.location}
            onChange={handleChange}
            placeholder="e.g. Main pool"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="image_url">Image URL</Label>
        <Input
          id="image_url"
          name="image_url"
          type="url"
          value={form.image_url}
          onChange={handleChange}
          placeholder="https://example.com/image.jpg"
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Saving..." : classItem ? "Update class" : "Create class"}
      </Button>
    </form>
  );
}
