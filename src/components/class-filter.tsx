import { Search } from "lucide-react";
import { Input } from "./ui/input";

interface ClassFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export function ClassFilter({ value, onChange }: ClassFilterProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Search by sport, instructor, or level..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10"
      />
    </div>
  );
}
