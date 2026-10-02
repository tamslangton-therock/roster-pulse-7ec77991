import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function readMonthDay(value: string): { day: number | null; month: number | null } {
  const text = value.trim();
  const iso = text.match(/^\d{4}-(\d{1,2})-(\d{1,2})/);
  if (iso) return { month: Number(iso[1]), day: Number(iso[2]) };
  const dayMonth = text.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (dayMonth) return { day: Number(dayMonth[1]), month: Number(dayMonth[2]) };
  return { day: null, month: null };
}

function daysInMonth(month: number | null): number {
  if (!month) return 31;
  return new Date(2024, month, 0).getDate();
}

function birthdayValue(day: number | null, month: number | null): string {
  if (!day || !month) return "";
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

export function BirthdayInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const current = readMonthDay(value);
  const dayLimit = daysInMonth(current.month);
  const selectedDay = current.day && current.day <= dayLimit ? current.day : null;

  const changeDay = (next: string) => {
    const day = Number(next);
    onChange(current.month ? birthdayValue(day, current.month) : `day:${day}`);
  };

  const changeMonth = (next: string) => {
    const month = Number(next);
    const day = current.day && current.day <= daysInMonth(month) ? current.day : null;
    onChange(day ? birthdayValue(day, month) : `month:${month}`);
  };

  const pendingDay = value.match(/^day:(\d{1,2})$/);
  const pendingMonth = value.match(/^month:(\d{1,2})$/);
  const day = pendingDay ? Number(pendingDay[1]) : selectedDay;
  const month = pendingMonth ? Number(pendingMonth[1]) : current.month;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={day ? String(day) : undefined} onValueChange={changeDay}>
        <SelectTrigger className="w-24" aria-label="Birthday day">
          <SelectValue placeholder="Day" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: daysInMonth(month) }, (_, index) => index + 1).map((option) => (
            <SelectItem key={option} value={String(option)}>{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={month ? String(month) : undefined} onValueChange={changeMonth}>
        <SelectTrigger className="min-w-40 flex-1" aria-label="Birthday month">
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((name, index) => (
            <SelectItem key={name} value={String(index + 1)}>{name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
          Clear
        </Button>
      )}
    </div>
  );
}